import { deleteCurrentUserAccount, listenToAuth, logoutUser } from './services/auth.service.js';
import { getUserById, getUserByUsername, listenToUser, listenToUsers, updateUserMeta, updateUserProfile } from './services/user.service.js';
import {
  addComment,
  updateComment,
  deleteComment,
  createPost,
  deletePost,
  increaseShareCount,
  listenToComments,
  listenToPosts,
  toggleLike,
  toggleCommentLike,
  toggleSave
} from './services/post.service.js';
import { followUser, getFollowStats, listenToFollowers, listenToFollowing, listenToFollowList, listenToFollowStats, removeFollower, unfollowUser } from './services/social.service.js';
import { clearConversationForEveryone, deleteMessageForEveryone, listenToConversations, listenToMessages, openConversation, sendMessage } from './services/chat.service.js';
import { listenToNotifications, markNotificationsRead, notifyCommentLike, notifyCommentMention, notifyPostComment, notifyPostLike } from './services/notification.service.js';
import { createCallInvite } from './services/call.service.js';
import { cloudinaryReady, cropImageFileToDataUrl, uploadAvatar, uploadCoverImage, uploadMessageImage, uploadPostMedia } from './services/storage.service.js';
import { REPORT_GROUPS, banMessage, blockUser, getBanInfo, listenToBlocked, registerContentViolation, scanContent, submitReport } from './services/moderation.service.js';
import { $, $$, avatarTemplate, emptyState, escapeHTML, setButtonLoading } from './utils/dom.js';
import { timeAgo } from './utils/time.js';
import { friendlyError, showToast } from './ui/toast.js';

const emojiSet = ['😀', '😂', '😍', '🔥', '❤️', '👏', '✨', '😭', '😎', '🙏', '💯', '🎉', '😊', '🤝', '🌟', '💬'];
const giphyKey = import.meta.env.VITE_GIPHY_API_KEY || '';

function cleanInput(value = '', maxLength = 80) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function formatCount(value = 0) {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(number);
}


function getFeedSkipKey() {
  return state.profile?.uid ? `pixora-feed-suggestions-skipped:${state.profile.uid}` : '';
}

function loadFeedSuggestionPreference() {
  const key = getFeedSkipKey();
  state.feedSuggestionsSkipped = key ? localStorage.getItem(key) === 'true' : false;
}

function saveFeedSuggestionPreference(value) {
  const key = getFeedSkipKey();
  state.feedSuggestionsSkipped = Boolean(value);
  if (key) localStorage.setItem(key, String(Boolean(value)));
}

function shouldShowFeedIntro() {
  return Boolean(state.profile?.uid) && !Boolean(state.profile?.feedIntroSeen);
}

async function markFeedIntroSeen() {
  if (!state.profile?.uid || state.profile.feedIntroSeen) return;

  state.profile = { ...state.profile, feedIntroSeen: true };
  if (state.feedIntroTimer) clearTimeout(state.feedIntroTimer);
  state.feedIntroTimer = null;
  if (state.feedIntroScrollHandler) {
    window.removeEventListener('scroll', state.feedIntroScrollHandler);
    document.querySelector('.workspace')?.removeEventListener('scroll', state.feedIntroScrollHandler);
    state.feedIntroScrollHandler = null;
  }

  renderPosts();

  try {
    await updateUserMeta(state.profile.uid, { feedIntroSeen: true });
  } catch (error) {
    console.warn('Could not save feed intro preference:', error);
  }
}

function bindFeedIntroDismissal(container) {
  const card = container?.querySelector('[data-feed-intro-card]');
  if (!card || state.profile?.feedIntroSeen) return;

  $('[data-feed-intro-dismiss]', card)?.addEventListener('click', () => {
    markFeedIntroSeen();
  });

  if (state.feedIntroTimer) clearTimeout(state.feedIntroTimer);
  if (state.feedIntroScrollHandler) {
    window.removeEventListener('scroll', state.feedIntroScrollHandler);
    document.querySelector('.workspace')?.removeEventListener('scroll', state.feedIntroScrollHandler);
  }

  state.feedIntroTimer = setTimeout(() => markFeedIntroSeen(), 8500);
  state.feedIntroScrollHandler = () => {
    const workspaceScroll = document.querySelector('.workspace')?.scrollTop || 0;
    if (window.scrollY > 80 || workspaceScroll > 80) markFeedIntroSeen();
  };
  window.addEventListener('scroll', state.feedIntroScrollHandler, { passive: true });
  document.querySelector('.workspace')?.addEventListener('scroll', state.feedIntroScrollHandler, { passive: true });
}

function getSuggestedFollowUsers(limit = 5) {
  if (!state.profile) return [];

  return state.users
    .filter((user) => user.uid && user.uid !== state.profile.uid)
    .filter((user) => !state.following.has(user.uid) && !state.blocked.has(user.uid))
    .sort((a, b) => {
      const followersA = Number(a.followersCount || a.followerCount || 0);
      const followersB = Number(b.followersCount || b.followerCount || 0);
      if (followersB !== followersA) return followersB - followersA;
      return String(a.displayName || a.username || '').localeCompare(String(b.displayName || b.username || ''));
    })
    .slice(0, limit);
}

function getPostEngagement(post = {}) {
  const savedCount = Array.isArray(post.savedBy) ? post.savedBy.length : 0;
  return (Number(post.likeCount || 0) * 3)
    + (Number(post.commentCount || 0) * 5)
    + (Number(post.shareCount || 0) * 6)
    + (savedCount * 4);
}

function getPostAgeHours(post = {}) {
  const created = post.createdAt?.toDate ? post.createdAt.toDate() : new Date(post.createdAt || Date.now());
  const time = created instanceof Date && !Number.isNaN(created.getTime()) ? created.getTime() : Date.now();
  return Math.max(0.25, (Date.now() - time) / 36e5);
}

function getViralScore(post = {}) {
  const engagement = getPostEngagement(post);
  const ageHours = getPostAgeHours(post);
  const recencyBoost = Math.max(0, 18 - ageHours) * 0.7;
  const velocity = engagement / Math.pow(ageHours + 2, 0.65);
  const creatorBoost = post.authorId === state.profile?.uid && ageHours < 48 ? 4 : 0;
  return Number((velocity + recencyBoost + creatorBoost).toFixed(2));
}

function isTrendingPost(post = {}) {
  if (!state.profile || state.blocked.has(post.authorId)) return false;
  if (post.authorId === state.profile.uid || state.following.has(post.authorId)) return false;

  const ageHours = getPostAgeHours(post);
  const engagement = getPostEngagement(post);
  const score = getViralScore(post);

  return ageHours <= 168 && (score >= 6 || engagement >= 12 || Number(post.shareCount || 0) >= 2);
}

function sortFeedPosts(posts = []) {
  return [...posts].sort((a, b) => {
    const aOwnBoost = a.authorId === state.profile?.uid ? 18 : 0;
    const bOwnBoost = b.authorId === state.profile?.uid ? 18 : 0;
    const scoreDiff = (getViralScore(b) + bOwnBoost) - (getViralScore(a) + aOwnBoost);
    if (Math.abs(scoreDiff) > 1.5) return scoreDiff;

    const aCreated = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
    const bCreated = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
    return bCreated - aCreated;
  });
}

function getPersonalizedFeedPosts() {
  if (!state.profile) return { posts: [], ownPosts: [], followedPosts: [], trendingPosts: [] };

  const cleanPosts = state.posts.filter((post) => post.authorId && !state.blocked.has(post.authorId));
  const ownPosts = cleanPosts.filter((post) => post.authorId === state.profile.uid);
  const followedPosts = cleanPosts.filter((post) => state.following.has(post.authorId));
  const trendingPosts = sortFeedPosts(cleanPosts.filter(isTrendingPost));

  if (!state.following.size) {
    return {
      posts: sortFeedPosts(ownPosts),
      ownPosts,
      followedPosts,
      trendingPosts: []
    };
  }

  const baseFeed = sortFeedPosts([...ownPosts, ...followedPosts]);
  const merged = [];
  const usedIds = new Set();
  let trendingIndex = 0;

  baseFeed.forEach((post, index) => {
    if (!usedIds.has(post.id)) {
      merged.push({ ...post, feedReason: post.authorId === state.profile.uid ? 'Your post' : '' });
      usedIds.add(post.id);
    }

    const shouldInsertTrending = (index + 1) % 5 === 0 || (baseFeed.length < 4 && index === baseFeed.length - 1);
    if (shouldInsertTrending && trendingPosts[trendingIndex]) {
      const trend = trendingPosts[trendingIndex++];
      if (trend && !usedIds.has(trend.id)) {
        merged.push({ ...trend, feedReason: 'Trending' });
        usedIds.add(trend.id);
      }
    }
  });

  while (merged.length < 8 && trendingPosts[trendingIndex]) {
    const trend = trendingPosts[trendingIndex++];
    if (!usedIds.has(trend.id)) {
      merged.push({ ...trend, feedReason: 'Trending' });
      usedIds.add(trend.id);
    }
  }

  return {
    posts: merged,
    ownPosts,
    followedPosts,
    trendingPosts
  };
}

const state = {
  authUser: null,
  profile: null,
  users: [],
  profileCache: new Map(),
  posts: [],
  following: new Set(),
  followers: new Set(),
  feedSuggestionSelection: new Set(),
  feedSuggestionsSkipped: false,
  feedIntroTimer: null,
  feedIntroScrollHandler: null,
  conversations: [],
  notifications: [],
  blocked: new Set(),
  commentMenu: { postId: '', commentId: '' },
  activeConversationId: null,
  activeChatUser: null,
  viewingProfileUid: null,
  viewingStats: { uid: '', followers: 0, following: 0 },
  followModal: { uid: '', type: 'followers', user: null, items: [] },
  likesModalPost: null,
  currentSharePost: null,
  crop: { file: null, rotation: 0, zoom: 1, offsetX: 0, offsetY: 0 },
  openComments: new Set(),
  commentsByPost: new Map(),
  commentUnsubscribers: new Map(),
  unsubscribers: [],
  unsubscribeMessages: null,
  unsubscribeProfileStats: null,
  unsubscribeFollowList: null,
  linkScrolled: false,
  currentTheme: localStorage.getItem('pixora-theme') || 'day',
  activityTimer: null
};

const views = {
  appShell: $('#app-shell'),
  sidebarToggle: $('#sidebar-toggle'),
  topbarTitle: $('#topbar-title'),
  topbarKicker: $('#topbar-kicker'),
  userChip: $('#current-user-chip'),
  composerAvatar: $('#composer-avatar'),
  postMediaInput: $('#post-media'),
  mediaPreview: $('#media-preview'),
  postsList: $('#posts-list'),
  peopleList: $('#people-list'),
  peopleSearch: $('#people-search'),
  conversationList: $('#conversation-list'),
  notificationsList: $('#notifications-list'),
  notificationBadge: $('#notification-badge'),
  markNotificationsRead: $('#mark-notifications-read'),
  chatEmpty: $('#chat-empty'),
  chatActive: $('#chat-active'),
  chatHeader: $('#chat-header'),
  messagesList: $('#messages-list'),
  chatTools: $('#chat-tools'),
  messageForm: $('#message-form'),
  messageInput: $('[name="message"]', $('#message-form')),
  messageImageInput: $('#message-image'),
  profileHero: $('#profile-hero'),
  profilePostsKicker: $('#profile-posts-kicker'),
  profilePostsTitle: $('#profile-posts-title'),
  profilePostsList: $('#profile-posts-list'),
  savedPostsList: $('#saved-posts-list'),
  settingsAvatarPreview: $('#settings-avatar-preview'),
  settingsCoverPreview: $('#settings-cover-preview'),
  avatarFile: $('#avatar-file'),
  coverFile: $('#cover-file'),
  cropModal: $('#avatar-crop-modal'),
  cropImage: $('#crop-image'),
  cropZoom: $('#crop-zoom'),
  cropX: $('#crop-x'),
  cropY: $('#crop-y'),
  cropRotate: $('#crop-rotate'),
  saveCrop: $('#save-crop'),
  shareModal: $('#share-modal'),
  shareUsersList: $('#share-users-list'),
  shareLinkField: $('#share-link-field'),
  copyPostLink: $('#copy-post-link'),
  followModal: $('#follow-modal'),
  followModalTitle: $('#follow-modal-title'),
  followModalSubtitle: $('#follow-modal-subtitle'),
  followList: $('#follow-list'),
  likesModal: $('#likes-modal'),
  likesModalTitle: $('#likes-modal-title'),
  likesList: $('#likes-list')
};

boot();

function boot() {
  applyTheme(state.currentTheme);
  bindStaticEvents();

  listenToAuth((user) => {
    state.authUser = user;

    if (user?.uid) {
      showApp();
      attachRealtimeListeners(user.uid);
    } else {
      cleanupRealtimeListeners();
      window.location.replace('/signin.html');
    }
  });
}

function bindStaticEvents() {
  $$('.nav-link').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.viewTarget === 'profile') openUserProfile(state.profile?.uid);
      else switchView(button.dataset.viewTarget);
    });
  });

  views.userChip?.addEventListener('click', () => openUserProfile(state.profile?.uid));

  views.sidebarToggle?.addEventListener('click', () => {
    views.appShell.classList.toggle('sidebar-collapsed');
  });

  $('#settings-logout')?.addEventListener('click', handleLogout);
  $('#delete-account')?.addEventListener('click', handleDeleteAccount);
  $('#post-form')?.addEventListener('submit', handleCreatePost);
  views.messageForm?.addEventListener('submit', handleSendMessage);
  $('#profile-form')?.addEventListener('submit', handleProfileSave);
  $('#theme-options')?.addEventListener('change', handleThemeChange);
  $('#hide-activity-toggle')?.addEventListener('change', handleActivityToggle);

  $('[name="content"]', $('#post-form'))?.addEventListener('input', (event) => {
    $('#post-count').textContent = `${event.target.value.length} / 800`;
  });

  views.postMediaInput?.addEventListener('change', renderSelectedMediaPreview);
  views.peopleSearch?.addEventListener('input', renderPeople);
  views.avatarFile?.addEventListener('change', openCropperForAvatar);
  views.coverFile?.addEventListener('change', handleCoverSelect);
  views.cropZoom?.addEventListener('input', updateCropPreview);
  views.cropX?.addEventListener('input', updateCropPreview);
  views.cropY?.addEventListener('input', updateCropPreview);
  views.cropRotate?.addEventListener('click', rotateCrop);
  views.saveCrop?.addEventListener('click', saveCroppedAvatar);
  $$('[data-close-crop]').forEach((button) => button.addEventListener('click', closeCropModal));
  $$('[data-close-share]').forEach((button) => button.addEventListener('click', closeShareModal));
  $$('[data-close-follow]').forEach((button) => button.addEventListener('click', closeFollowModal));
  views.copyPostLink?.addEventListener('click', copyShareLink);
  views.markNotificationsRead?.addEventListener('click', handleMarkNotificationsRead);
  $$('[data-close-likes]').forEach((button) => button.addEventListener('click', closeLikesModal));

  $('#emoji-toggle')?.addEventListener('click', () => toggleChatTools('emoji'));
  $('#gif-toggle')?.addEventListener('click', () => toggleChatTools('gif'));

  document.addEventListener('click', (event) => {
    if (event.target.closest('.comment-more-wrap')) return;
    if (state.commentMenu.postId || state.commentMenu.commentId) {
      const postId = state.commentMenu.postId;
      state.commentMenu = { postId: '', commentId: '' };
      if (postId) renderCommentsForPost(postId);
    }
  });
}

function switchView(target) {
  const labels = {
    feed: ['Welcome back', 'Feed'],
    discover: ['Explore', 'Discover'],
    messages: ['Inbox', 'Messages'],
    notifications: ['Activity', 'Notifications'],
    profile: ['Profile', 'Profile'],
    settings: ['Account', 'Settings']
  };

  $$('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.viewTarget === target));
  $$('.view').forEach((view) => view.classList.toggle('active', view.dataset.view === target));
  views.topbarKicker.textContent = labels[target]?.[0] || 'Pixora';
  views.topbarTitle.textContent = labels[target]?.[1] || 'Pixora';

  if (target === 'settings') renderSettingsPanel();
  if (target === 'notifications') {
    renderNotifications();
    handleMarkNotificationsRead({ silent: true });
  }
  if (target === 'profile' && !state.viewingProfileUid) openUserProfile(state.profile?.uid);
}

async function handleLogout() {
  try {
    await logoutUser();
    showToast('Logged out.');
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

async function handleDeleteAccount() {
  const confirmed = window.confirm('Delete your account permanently? This removes your profile and signs you out. Firebase may ask you to sign in again if your session is old.');
  if (!confirmed) return;

  try {
    await deleteCurrentUserAccount();
    showToast('Account deleted.');
    window.location.replace('/signup.html');
  } catch (error) {
    showToast(`${friendlyError(error)} If Firebase says recent login is required, log out and sign in again first.`, 'error');
  }
}

async function handleCreatePost(event) {
  event.preventDefault();
  if (!state.profile) return;

  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const data = Object.fromEntries(new FormData(form));
  const file = data.mediaFile;

  setButtonLoading(button, true, file?.size ? 'Preparing image...' : 'Publishing...');

  try {
    if (ensureNotBanned()) return;
    const moderation = scanContent(data.content);
    if (moderation.flagged) {
      await handleBlockedContent('post', data.content, moderation);
      return;
    }

    const media = file?.size ? await uploadPostMedia(file, state.profile.uid) : null;
    setButtonLoading(button, true, 'Publishing...');
    await createPost(state.profile, data.content, media);
    form.reset();
    clearMediaPreview();
    $('#post-count').textContent = '0 / 800';
    showToast('Post published.');
  } catch (error) {
    showToast(friendlyError(error), 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleProfileSave(event) {
  event.preventDefault();
  if (!state.profile) return;

  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const data = Object.fromEntries(new FormData(form));

  setButtonLoading(button, true, 'Saving...');

  try {
    if (data.avatarUrl && data.avatarUrl !== state.profile.avatarUrl) {
      const uploaded = await uploadAvatar(data.avatarUrl);
      data.avatarUrl = uploaded.url;
    }

    if (data.coverUrl && data.coverUrl !== state.profile.coverUrl) {
      const uploaded = await uploadCoverImage(data.coverUrl);
      data.coverUrl = uploaded.url;
    }

    await updateUserProfile(state.profile.uid, data);
    showToast('Profile updated.');
  } catch (error) {
    showToast(friendlyError(error), 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleSendMessage(event) {
  event.preventDefault();
  if (!state.activeConversationId || !state.activeChatUser || !state.profile) return;

  const button = $('button[type="submit"]', views.messageForm);
  const input = views.messageInput;
  const imageFile = views.messageImageInput?.files?.[0];
  const text = input.value.trim();

  if (!text && !imageFile) return;
  setButtonLoading(button, true, imageFile ? 'Sending photo...' : 'Sending...');

  try {
    let media = null;
    if (imageFile) media = await uploadMessageImage(imageFile);
    await sendMessage(state.activeConversationId, state.profile, {
      type: media ? 'image' : 'text',
      text,
      imageUrl: media?.url || ''
    });
    views.messageForm.reset();
    hideChatTools();
    scrollMessagesToBottom({ smooth: true });
  } catch (error) {
    showToast(friendlyError(error), 'error');
  } finally {
    setButtonLoading(button, false);
    input.focus();
  }
}

function attachRealtimeListeners(uid) {
  cleanupRealtimeListeners();

  state.unsubscribers.push(
    listenToUser(uid, (profile) => {
      if (!profile) {
        showToast('Your profile was not found. Check Firebase Auth and Firestore rules.', 'error');
        return;
      }

      state.profile = profile;
      loadFeedSuggestionPreference();
      state.profileCache.set(profile.uid, profile);
      if (!state.viewingProfileUid) state.viewingProfileUid = profile.uid;
      renderCurrentUser();
      renderSettingsPanel();
      renderPeople();
      renderConversations();
      renderProfilePanel();
      renderPosts();
    })
  );

  state.unsubscribers.push(
    listenToPosts((posts) => {
      state.posts = posts;
      renderPosts();
      scrollToLinkedPost();
      renderProfilePanel();
      renderSettingsPanel();
    })
  );

  state.unsubscribers.push(
    listenToUsers(uid, (users) => {
      state.users = users;
      users.forEach((user) => state.profileCache.set(user.uid, user));
      renderPeople();
      renderConversations();
      renderProfilePanel();
      renderPosts();
    })
  );

  state.unsubscribers.push(
    listenToFollowing(uid, (following) => {
      state.following = following;
      if (state.viewingProfileUid === uid) state.viewingStats = { uid, followers: state.followers.size, following: following.size };
      renderPeople();
      renderProfilePanel();
      renderSettingsPanel();
      renderPosts();
    })
  );

  state.unsubscribers.push(
    listenToFollowers(uid, (followers) => {
      state.followers = followers;
      if (state.viewingProfileUid === uid) state.viewingStats = { uid, followers: followers.size, following: state.following.size };
      renderProfilePanel();
    })
  );

  state.unsubscribers.push(
    listenToConversations(uid, (conversations) => {
      state.conversations = conversations;
      renderConversations();
    })
  );

  state.unsubscribers.push(
    listenToNotifications(uid, (notifications) => {
      state.notifications = notifications;
      renderNotificationBadge();
      renderNotifications();
    })
  );

  state.unsubscribers.push(
    listenToBlocked(uid, (blocked) => {
      state.blocked = blocked;
      renderPeople();
      renderPosts();
      renderProfilePanel();
      renderConversations();
    })
  );

  updateActivityNow();
  if (state.activityTimer) clearInterval(state.activityTimer);
  state.activityTimer = setInterval(updateActivityNow, 60000);
}


function cleanupRealtimeListeners() {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  state.unsubscribers = [];
  if (state.unsubscribeMessages) state.unsubscribeMessages();
  state.unsubscribeMessages = null;
  if (state.unsubscribeProfileStats) state.unsubscribeProfileStats();
  state.unsubscribeProfileStats = null;
  if (state.unsubscribeFollowList) state.unsubscribeFollowList();
  state.unsubscribeFollowList = null;
  state.commentUnsubscribers.forEach((unsubscribe) => unsubscribe?.());
  state.commentUnsubscribers.clear();
  state.commentsByPost.clear();
  state.openComments.clear();
  state.profile = null;
  state.users = [];
  state.profileCache.clear();
  state.posts = [];
  state.following = new Set();
  state.followers = new Set();
  state.feedSuggestionSelection = new Set();
  state.feedSuggestionsSkipped = false;
  if (state.feedIntroTimer) clearTimeout(state.feedIntroTimer);
  if (state.feedIntroScrollHandler) {
    window.removeEventListener('scroll', state.feedIntroScrollHandler);
    document.querySelector('.workspace')?.removeEventListener('scroll', state.feedIntroScrollHandler);
  }
  state.feedIntroTimer = null;
  state.feedIntroScrollHandler = null;
  state.conversations = [];
  state.notifications = [];
  state.blocked = new Set();
  state.commentMenu = { postId: '', commentId: '' };
  state.likesModalPost = null;
  state.activeConversationId = null;
  state.activeChatUser = null;
  state.followModal = { uid: '', type: 'followers', user: null, items: [] };
  if (state.activityTimer) clearInterval(state.activityTimer);
  state.activityTimer = null;
}

function showApp() {
  views.appShell.classList.remove('hidden');
}

function applyTheme(theme = 'default-dark') {
  const allowed = ['default-dark', 'day', 'summer', 'spring', 'rainy', 'winter'];
  const nextTheme = allowed.includes(theme) ? theme : 'default-dark';
  state.currentTheme = nextTheme;
  localStorage.setItem('pixora-theme', nextTheme);
  document.body.dataset.theme = nextTheme;
}

async function handleThemeChange(event) {
  const theme = event.target?.value;
  if (!theme || !state.profile) return;
  applyTheme(theme);
  try {
    await updateUserMeta(state.profile.uid, { theme });
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

async function handleActivityToggle(event) {
  if (!state.profile) return;
  const hideActivity = Boolean(event.target.checked);
  state.profile = { ...state.profile, hideActivity };
  renderProfilePanel();
  try {
    await updateUserMeta(state.profile.uid, { hideActivity });
    showToast(hideActivity ? 'Last activity hidden.' : 'Last activity visible.');
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

async function updateActivityNow() {
  if (!state.profile?.uid || state.profile.hideActivity) return;
  try {
    await updateUserMeta(state.profile.uid, { lastActiveAt: new Date().toISOString() });
  } catch (error) {
    console.warn('Activity update failed:', error);
  }
}

function activityText(user = {}) {
  if (user.hideActivity) return 'Last activity hidden';
  if (!user.lastActiveAt) return 'Activity not available';
  return `Active ${timeAgo(user.lastActiveAt)}`;
}

function renderCurrentUser() {
  if (!state.profile) return;

  views.userChip.innerHTML = `
    ${avatarTemplate(state.profile)}
    <div>
      <strong>${escapeHTML(state.profile.displayName)}</strong>
      <span>@${escapeHTML(state.profile.username)}</span>
    </div>
  `;

  renderAvatarInto(views.composerAvatar, state.profile);
}

function renderSettingsPanel() {
  if (!state.profile) return;
  const form = $('#profile-form');
  if (!form) return;

  if (document.activeElement !== form.displayName) form.displayName.value = state.profile.displayName || '';
  if (document.activeElement !== form.username) form.username.value = state.profile.username || '';
  if (document.activeElement !== form.bio) form.bio.value = state.profile.bio || '';
  if (!form.avatarUrl.value) form.avatarUrl.value = state.profile.avatarUrl || '';
  if (!form.coverUrl.value) form.coverUrl.value = state.profile.coverUrl || '';
  renderAvatarInto(views.settingsAvatarPreview, { ...state.profile, avatarUrl: form.avatarUrl.value || state.profile.avatarUrl }, 'xl');
  renderCoverPreview(form.coverUrl.value || state.profile.coverUrl || '');

  const hideToggle = $('#hide-activity-toggle');
  if (hideToggle) hideToggle.checked = Boolean(state.profile.hideActivity);
  const currentTheme = state.profile.theme || state.currentTheme || 'day';
  $$('[name="themeMode"]').forEach((input) => { input.checked = input.value === currentTheme; });

  const savedPosts = state.posts.filter((post) => post.savedBy.includes(state.profile.uid) && !state.blocked.has(post.authorId));
  renderPostsInto(views.savedPostsList, savedPosts, {
    emptyTitle: 'No saved posts',
    emptyBody: 'Tap the save button on posts you want to revisit later.'
  });
}

function startProfileStatsListener(uid) {
  if (state.unsubscribeProfileStats) {
    state.unsubscribeProfileStats();
    state.unsubscribeProfileStats = null;
  }

  if (!uid) return;

  state.unsubscribeProfileStats = listenToFollowStats(uid, (stats) => {
    if (state.viewingProfileUid !== uid) return;
    state.viewingStats = stats;
    renderProfilePanel();
  });
}

async function openUserProfile(uid) {
  if (!uid || !state.profile) return;
  state.viewingProfileUid = uid;
  switchView('profile');

  if (!findUser(uid)) {
    views.profileHero.innerHTML = emptyState('Loading profile', 'Fetching the latest profile details...');
    views.profilePostsList.innerHTML = '';
    const loadedUser = await getUserById(uid);
    if (loadedUser) {
      state.profileCache.set(loadedUser.uid, loadedUser);
      if (loadedUser.uid !== state.profile.uid && !state.users.some((user) => user.uid === loadedUser.uid)) {
        state.users = [loadedUser, ...state.users];
      }
    }
  }

  renderProfilePanel();
  startProfileStatsListener(uid);

  if (uid === state.profile.uid) {
    state.viewingStats = { uid, followers: state.followers.size, following: state.following.size };
    renderProfilePanel();
    return;
  }

  const stats = await getFollowStats(uid);
  if (state.viewingProfileUid === uid) {
    state.viewingStats = { uid, ...stats };
    renderProfilePanel();
  }
}

function renderProfilePanel() {
  if (!state.profile || !views.profileHero) return;

  const uid = state.viewingProfileUid || state.profile.uid;
  const user = uid === state.profile.uid ? state.profile : findUser(uid);
  if (!user) {
    views.profileHero.innerHTML = emptyState('Profile unavailable', 'This user could not be loaded.');
    views.profilePostsList.innerHTML = '';
    return;
  }

  const isMe = user.uid === state.profile.uid;
  const isFollowing = state.following.has(user.uid);
  const userPosts = state.posts.filter((post) => post.authorId === user.uid && !state.blocked.has(post.authorId));
  const stats = isMe
    ? { followers: state.followers.size, following: state.following.size }
    : (state.viewingStats.uid === user.uid ? state.viewingStats : { followers: user.followersCount || 0, following: user.followingCount || 0 });

  const coverStyle = user.coverUrl ? ` style="--cover-image: url('${escapeHTML(user.coverUrl)}')"` : '';

  views.profileHero.innerHTML = `
    <div class="profile-cover ${user.coverUrl ? 'has-cover' : ''}"${coverStyle}>
      ${isMe ? '<button class="cover-change-btn" type="button" data-cover-pick>Change cover</button>' : ''}
    </div>
    <div class="profile-identity">
      ${avatarTemplate(user, 'xl')}
      <div class="profile-copy">
        <span class="muted-label">${isMe ? 'Your profile' : 'Profile'}</span>
        <h2>${escapeHTML(user.displayName || 'User')}</h2>
        <p>@${escapeHTML(user.username || 'user')}</p>
        <p class="profile-bio-preview">${escapeHTML(user.bio || 'No bio yet.')}</p>
        <p class="activity-line">${activityText(user)}</p>
      </div>
      <div class="profile-actions">
        ${isMe ? `
          <button class="ghost-btn" type="button" data-avatar-pick>Change photo</button>
          <button class="ghost-btn" type="button" data-cover-pick>Change cover</button>
          <button class="primary-btn" type="button" data-view-target="settings">Edit profile</button>
        ` : `
          <button class="${isFollowing ? 'ghost-btn' : 'primary-btn'}" type="button" data-profile-follow>${isFollowing ? 'Following' : 'Follow'}</button>
          <button class="ghost-btn" type="button" data-profile-message>Message</button>
          <button class="ghost-btn" type="button" data-profile-report>Report</button>
          <button class="ghost-btn danger" type="button" data-profile-block>Block</button>
        `}
      </div>
    </div>
    <div class="profile-stats">
      <div class="profile-stat"><strong>${formatCount(userPosts.length)}</strong><span>Posts</span></div>
      <button class="profile-stat" type="button" data-open-follow-list="followers" aria-label="View followers"><strong>${formatCount(stats.followers || 0)}</strong><span>Followers</span></button>
      <button class="profile-stat" type="button" data-open-follow-list="following" aria-label="View following"><strong>${formatCount(stats.following || 0)}</strong><span>Following</span></button>
    </div>
  `;

  views.profilePostsKicker.textContent = isMe ? 'Timeline' : `@${user.username}`;
  views.profilePostsTitle.textContent = isMe ? 'Your posts' : 'Posts';

  renderPostsInto(views.profilePostsList, userPosts, {
    emptyTitle: 'No posts yet',
    emptyBody: isMe ? 'Your posts will appear here after you publish them.' : 'This profile has not posted yet.'
  });

  $('[data-view-target="settings"]', views.profileHero)?.addEventListener('click', () => switchView('settings'));
  $$('[data-avatar-pick]', views.profileHero).forEach((button) => button.addEventListener('click', () => views.avatarFile?.click()));
  $$('[data-cover-pick]', views.profileHero).forEach((button) => button.addEventListener('click', () => views.coverFile?.click()));
  $('[data-profile-follow]', views.profileHero)?.addEventListener('click', () => toggleFollow(user));
  $('[data-profile-message]', views.profileHero)?.addEventListener('click', () => startChat(user));
  $('[data-profile-report]', views.profileHero)?.addEventListener('click', () => openReportFlow({ targetUser: user, targetType: 'user' }));
  $('[data-profile-block]', views.profileHero)?.addEventListener('click', () => handleBlockUser(user));
  $$('[data-open-follow-list]', views.profileHero).forEach((button) => {
    button.addEventListener('click', () => openFollowListModal(user, button.dataset.openFollowList));
  });
}



function openFollowListModal(user, type = 'followers') {
  if (!user?.uid || !views.followModal) return;

  const normalizedType = type === 'following' ? 'following' : 'followers';
  state.followModal = { uid: user.uid, type: normalizedType, user, items: [] };
  views.followModal.classList.remove('hidden');
  renderFollowModal();

  if (state.unsubscribeFollowList) state.unsubscribeFollowList();
  state.unsubscribeFollowList = listenToFollowList(user.uid, normalizedType, (items) => {
    state.followModal.items = items;
    items.forEach((item) => state.profileCache.set(item.uid, { ...findUser(item.uid), ...item }));
    renderFollowModal();
  });
}

function closeFollowModal() {
  views.followModal?.classList.add('hidden');
  if (state.unsubscribeFollowList) state.unsubscribeFollowList();
  state.unsubscribeFollowList = null;
  state.followModal = { uid: '', type: 'followers', user: null, items: [] };
}

function renderFollowModal() {
  if (!views.followModal || views.followModal.classList.contains('hidden')) return;

  const { uid, type, user, items } = state.followModal;
  if (!uid || !user) return;

  const isOwnProfile = uid === state.profile?.uid;
  const title = type === 'following' ? 'Following' : 'Followers';
  views.followModalTitle.textContent = title;
  views.followModalSubtitle.textContent = `${user.displayName || 'User'} · @${user.username || 'user'}`;

  if (!items.length) {
    views.followList.innerHTML = emptyState(
      type === 'following' ? 'Not following anyone yet' : 'No followers yet',
      type === 'following' ? 'People this profile follows will appear here.' : 'Followers will appear here when people follow this profile.'
    );
    return;
  }

  views.followList.innerHTML = items.map((item) => {
    const rowUser = findUser(item.uid) || item;
    const isMe = rowUser.uid === state.profile?.uid;
    const iFollow = state.following.has(rowUser.uid);
    const primaryAction = isMe
      ? '<span class="follow-pill">You</span>'
      : `<button class="${iFollow ? 'ghost-btn' : 'primary-btn'} compact-action" type="button" data-follow-list-action="toggle" data-user-id="${escapeHTML(rowUser.uid)}">${iFollow ? 'Unfollow' : 'Follow'}</button>`;

    const removeAction = type === 'followers' && isOwnProfile && !isMe
      ? `<button class="ghost-btn danger compact-action" type="button" data-follow-list-action="remove" data-user-id="${escapeHTML(rowUser.uid)}">Remove</button>`
      : '';

    return `
      <article class="follow-row" data-user-id="${escapeHTML(rowUser.uid)}">
        <button class="follow-person as-button" type="button" data-follow-list-profile="${escapeHTML(rowUser.uid)}">
          ${avatarTemplate(rowUser)}
          <span>
            <strong>${escapeHTML(rowUser.displayName || 'User')}</strong>
            <small>@${escapeHTML(rowUser.username || 'user')}</small>
          </span>
        </button>
        <div class="follow-row-actions">
          ${primaryAction}
          ${removeAction}
        </div>
      </article>
    `;
  }).join('');

  $$('[data-follow-list-profile]', views.followList).forEach((button) => {
    button.addEventListener('click', () => {
      const selectedUid = button.dataset.followListProfile;
      closeFollowModal();
      openUserProfile(selectedUid);
    });
  });

  $$('[data-follow-list-action="toggle"]', views.followList).forEach((button) => {
    button.addEventListener('click', async () => {
      const userToToggle = findUser(button.dataset.userId) || state.followModal.items.find((item) => item.uid === button.dataset.userId);
      await toggleFollow(userToToggle);
    });
  });

  $$('[data-follow-list-action="remove"]', views.followList).forEach((button) => {
    button.addEventListener('click', async () => {
      const userToRemove = findUser(button.dataset.userId) || state.followModal.items.find((item) => item.uid === button.dataset.userId);
      if (!userToRemove || !window.confirm(`Remove ${userToRemove.displayName || 'this user'} from your followers?`)) return;

      try {
        await removeFollower(state.profile, userToRemove);
        showToast('Follower removed.');
      } catch (error) {
        showToast(friendlyError(error), 'error');
      }
    });
  });
}

function renderPosts() {
  if (!views.postsList || !state.profile) return;

  const feed = getPersonalizedFeedPosts();

  if (!state.following.size && !feed.posts.length && !state.feedSuggestionsSkipped) {
    renderFollowStarterPanel();
    return;
  }

  if (!state.following.size && feed.posts.length) {
    renderPostsInto(views.postsList, feed.posts, {
      intro: shouldShowFeedIntro() ? {
        kicker: 'Your feed',
        title: 'Your posts are live',
        body: 'Because you are not following anyone yet, your home feed shows your own posts. Follow a few accounts to start seeing more updates.',
        dismissible: true
      } : null,
      showSuggestionsAfter: !state.feedSuggestionsSkipped,
      emptyTitle: 'No posts yet',
      emptyBody: 'Create your first post or follow accounts from Discover.'
    });
    return;
  }

  renderPostsInto(views.postsList, feed.posts, {
    intro: shouldShowFeedIntro() ? {
      kicker: 'Personalized feed',
      title: 'Posts from your circle',
      body: 'Your feed is based on people you follow, your own recent posts, and occasional trending posts with strong engagement.',
      dismissible: true
    } : null,
    emptyTitle: 'Your feed is quiet',
    emptyBody: 'Posts from people you follow will appear here. Your own posts will also show up after you publish them.'
  });
}

function renderFollowStarterPanel() {
  const suggestions = getSuggestedFollowUsers(5);

  if (!suggestions.length) {
    views.postsList.innerHTML = emptyState('Follow some accounts to show posts', 'No suggestions are available yet. Open Discover when more people join Pixora.');
    return;
  }

  if (!state.feedSuggestionSelection.size) {
    state.feedSuggestionSelection = new Set(suggestions.map((user) => user.uid));
  } else {
    state.feedSuggestionSelection = new Set([...state.feedSuggestionSelection].filter((uid) => suggestions.some((user) => user.uid === uid)));
  }

  views.postsList.innerHTML = `
    <section class="follow-onboarding glass-card reveal-up">
      <div class="follow-onboarding-copy">
        <span class="muted-label">Build your feed</span>
        <h3>Follow some accounts to show posts</h3>
        <p>Your feed is now personal. It only shows posts from people you follow, so start with a few popular profiles.</p>
      </div>
      <div class="suggested-follow-list">
        ${suggestions.map((user) => {
          const selected = state.feedSuggestionSelection.has(user.uid);
          return `
            <article class="suggested-follow-card ${selected ? 'selected' : ''}" data-suggested-user="${escapeHTML(user.uid)}">
              <button class="suggested-person as-button" type="button" data-suggested-profile="${escapeHTML(user.uid)}">
                ${avatarTemplate(user)}
                <span>
                  <strong>${escapeHTML(user.displayName || 'User')}</strong>
                  <small>@${escapeHTML(user.username || 'user')} · ${formatCount(user.followersCount || 0)} followers</small>
                </span>
              </button>
              <button class="suggest-toggle ${selected ? 'selected' : ''}" type="button" data-suggest-toggle="${escapeHTML(user.uid)}">${selected ? 'Selected' : 'Select'}</button>
            </article>
          `;
        }).join('')}
      </div>
      <div class="follow-onboarding-actions">
        <button class="primary-btn" type="button" data-continue-following>Continue with following</button>
        <button class="ghost-btn" type="button" data-skip-following>Skip for now</button>
      </div>
      <p class="soft-note">You can follow or unfollow people anytime from Discover or their profile.</p>
    </section>
  `;

  bindFollowStarterActions();
}

function bindFollowStarterActions() {
  $$('[data-suggested-profile]', views.postsList).forEach((button) => {
    button.addEventListener('click', () => openUserProfile(button.dataset.suggestedProfile));
  });

  $$('[data-suggest-toggle]', views.postsList).forEach((button) => {
    button.addEventListener('click', () => {
      const uid = button.dataset.suggestToggle;
      if (state.feedSuggestionSelection.has(uid)) state.feedSuggestionSelection.delete(uid);
      else state.feedSuggestionSelection.add(uid);
      renderFollowStarterPanel();
    });
  });

  $('[data-skip-following]', views.postsList)?.addEventListener('click', () => {
    saveFeedSuggestionPreference(true);
    renderPosts();
  });

  $('[data-continue-following]', views.postsList)?.addEventListener('click', async (event) => {
    const selectedUsers = [...state.feedSuggestionSelection]
      .map((uid) => findUser(uid))
      .filter(Boolean)
      .slice(0, 5);

    if (!selectedUsers.length) {
      showToast('Select at least one account or skip for now.', 'error');
      return;
    }

    const button = event.currentTarget;
    setButtonLoading(button, true, 'Following...');

    try {
      await Promise.all(selectedUsers.map((user) => followUser(state.profile, user)));
      saveFeedSuggestionPreference(true);
      state.feedSuggestionSelection.clear();
      showToast('Your feed is ready.');
    } catch (error) {
      showToast(friendlyError(error), 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });
}

function renderPostsInto(container, posts, options = {}) {
  if (!container) return;

  if (!posts.length) {
    container.innerHTML = emptyState(options.emptyTitle || 'No posts yet', options.emptyBody || 'Posts will appear here.');
    return;
  }

  const introMarkup = options.intro ? `
    <section class="feed-algorithm-card glass-card reveal-up" data-feed-intro-card>
      <button class="feed-intro-dismiss" type="button" data-feed-intro-dismiss aria-label="Hide feed note">×</button>
      <span class="muted-label">${escapeHTML(options.intro.kicker || 'Feed')}</span>
      <h3>${escapeHTML(options.intro.title || 'Your feed')}</h3>
      <p>${escapeHTML(options.intro.body || '')}</p>
    </section>
  ` : '';

  const suggestionsMarkup = options.showSuggestionsAfter ? miniFollowSuggestionsTemplate() : '';

  container.innerHTML = `${introMarkup}${posts.map((post) => postTemplate(post)).join('')}${suggestionsMarkup}`;
  bindPostActions(container);
  bindMiniFollowSuggestions(container);
  bindFeedIntroDismissal(container);

  state.openComments.forEach((postId) => {
    if (container.querySelector(`[data-post-id="${cssEscape(postId)}"]`)) {
      attachCommentListener(postId);
      renderCommentsForPost(postId);
    }
  });
}

function miniFollowSuggestionsTemplate() {
  const suggestions = getSuggestedFollowUsers(5);
  if (!suggestions.length) return '';

  return `
    <section class="mini-follow-suggestions glass-card reveal-up">
      <div>
        <span class="muted-label">Suggested accounts</span>
        <h3>Follow accounts to improve your feed</h3>
      </div>
      <div class="mini-suggestion-list">
        ${suggestions.map((user) => `
          <article class="mini-suggestion-card">
            <button class="suggested-person as-button" type="button" data-mini-suggest-profile="${escapeHTML(user.uid)}">
              ${avatarTemplate(user)}
              <span>
                <strong>${escapeHTML(user.displayName || 'User')}</strong>
                <small>@${escapeHTML(user.username || 'user')} · ${formatCount(user.followersCount || 0)} followers</small>
              </span>
            </button>
            <button class="suggest-toggle selected" type="button" data-mini-follow="${escapeHTML(user.uid)}">Follow</button>
          </article>
        `).join('')}
      </div>
      <button class="ghost-btn" type="button" data-hide-mini-suggestions>Not now</button>
    </section>
  `;
}

function bindMiniFollowSuggestions(container) {
  $$('[data-mini-suggest-profile]', container).forEach((button) => {
    button.addEventListener('click', () => openUserProfile(button.dataset.miniSuggestProfile));
  });

  $$('[data-mini-follow]', container).forEach((button) => {
    button.addEventListener('click', async () => {
      const user = findUser(button.dataset.miniFollow);
      if (!user) return;
      try {
        await followUser(state.profile, user);
        showToast(`Following ${user.displayName || user.username || 'user'}.`);
      } catch (error) {
        showToast(friendlyError(error), 'error');
      }
    });
  });

  $('[data-hide-mini-suggestions]', container)?.addEventListener('click', () => {
    saveFeedSuggestionPreference(true);
    renderPosts();
  });
}

function postTemplate(post) {
  const uid = state.profile?.uid;
  const canDelete = uid === post.authorId;
  const liked = post.likedBy.includes(uid);
  const saved = post.savedBy.includes(uid);
  const commentsOpen = state.openComments.has(post.id);
  const media = mediaTemplate(post);
  const feedBadge = post.feedReason
    ? `<span class="feed-reason-badge ${post.feedReason === 'Trending' ? 'trending' : 'own'}">${escapeHTML(post.feedReason)}</span>`
    : '';

  return `
    <article class="post-card" data-post-id="${escapeHTML(post.id)}">
      ${feedBadge}
      <header class="post-header">
        <button class="post-author as-button" type="button" data-open-profile="${escapeHTML(post.authorId)}">
          ${avatarTemplate({ displayName: post.authorName, username: post.authorUsername, avatarUrl: post.authorAvatarUrl })}
          <div class="post-meta">
            <strong>${escapeHTML(post.authorName || 'User')}</strong>
            <span>@${escapeHTML(post.authorUsername || 'user')} · ${escapeHTML(timeAgo(post.createdAt))}</span>
          </div>
        </button>
        ${canDelete ? '<button class="icon-btn danger" type="button" data-delete-post title="Delete post">×</button>' : ''}
      </header>
      ${post.content ? `<p class="post-content">${escapeHTML(post.content)}</p>` : ''}
      ${media}
      <footer class="post-actions">
        <button class="action-btn ${liked ? 'active' : ''}" type="button" data-like-post>${liked ? '♥' : '♡'} <span>${formatCount(post.likeCount)}</span></button>
        <button class="action-btn" type="button" data-view-likes>Liked by <span>${formatCount(post.likeCount)}</span></button>
        <button class="action-btn" type="button" data-toggle-comments>💬 <span>${formatCount(post.commentCount)}</span></button>
        <button class="action-btn ${saved ? 'active' : ''}" type="button" data-save-post>🔖 <span>${saved ? 'Saved' : 'Save'}</span></button>
        <button class="action-btn" type="button" data-share-post>↗ <span>${post.shareCount ? formatCount(post.shareCount) : 'Share'}</span></button>
      </footer>
      <section class="comments-panel ${commentsOpen ? 'open' : ''}" data-comments-panel>
        <div class="comments-list" data-comments-list="${escapeHTML(post.id)}"></div>
        <form class="comment-form" data-comment-form>
          <div class="comment-emoji-row">
            ${['😊', '🔥', '❤️', '👏'].map((emoji) => `<button type="button" data-comment-emoji="${emoji}">${emoji}</button>`).join('')}
          </div>
          <div class="comment-input-row">
            <input name="comment" type="text" maxlength="300" autocomplete="off" placeholder="Add a comment..." required />
            <button type="submit">Post</button>
          </div>
        </form>
      </section>
    </article>
  `;
}

function mediaTemplate(post) {
  if (!post.mediaUrl) return '';
  if (post.mediaType === 'video') {
    return `<video class="post-media" src="${escapeHTML(post.mediaUrl)}" controls playsinline preload="metadata"></video>`;
  }
  return `<img class="post-media" src="${escapeHTML(post.mediaUrl)}" alt="Post media" loading="lazy" />`;
}

function bindPostActions(container) {
  $$('[data-open-profile]', container).forEach((button) => {
    button.addEventListener('click', () => openUserProfile(button.dataset.openProfile));
  });

  $$('[data-delete-post]', container).forEach((button) => {
    button.addEventListener('click', async () => {
      const post = getPostFromButton(button);
      if (!post || !window.confirm('Delete this post?')) return;
      try {
        await deletePost(post.id);
        showToast('Post deleted.');
      } catch (error) {
        showToast(friendlyError(error), 'error');
      }
    });
  });

  $$('[data-like-post]', container).forEach((button) => {
    button.addEventListener('click', async () => {
      const post = getPostFromButton(button);
      const addingLike = post && !post.likedBy.includes(state.profile.uid);
      try {
        await toggleLike(post, state.profile.uid);
        if (addingLike) {
          notifyPostLike(post, state.profile).catch((error) => console.warn('Like notification failed:', error));
        }
      } catch (error) {
        showToast(friendlyError(error), 'error');
      }
    });
  });

  $$('[data-view-likes]', container).forEach((button) => {
    button.addEventListener('click', () => openLikesModal(getPostFromButton(button)));
  });

  $$('[data-save-post]', container).forEach((button) => {
    button.addEventListener('click', async () => {
      const post = getPostFromButton(button);
      try {
        await toggleSave(post, state.profile.uid);
        showToast(post.savedBy.includes(state.profile.uid) ? 'Removed from saved.' : 'Saved post.');
      } catch (error) {
        showToast(friendlyError(error), 'error');
      }
    });
  });

  $$('[data-share-post]', container).forEach((button) => {
    button.addEventListener('click', () => openShareModal(getPostFromButton(button)));
  });

  $$('[data-toggle-comments]', container).forEach((button) => {
    button.addEventListener('click', () => {
      const post = getPostFromButton(button);
      if (!post) return;
      if (state.openComments.has(post.id)) state.openComments.delete(post.id);
      else {
        state.openComments.add(post.id);
        attachCommentListener(post.id);
      }
      renderPosts();
      renderProfilePanel();
      renderSettingsPanel();
    });
  });

  $$('[data-comment-emoji]', container).forEach((button) => {
    button.addEventListener('click', () => {
      const form = button.closest('[data-comment-form]');
      const input = $('[name="comment"]', form);
      input.value += button.dataset.commentEmoji;
      input.focus();
    });
  });

  $$('[data-comment-form]', container).forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const post = getPostFromButton(form);
      const input = $('[name="comment"]', form);
      try {
        if (ensureNotBanned()) return;
        const text = input.value;
        const moderation = scanContent(text);
        if (moderation.flagged) {
          await handleBlockedContent('comment', text, moderation);
          return;
        }

        await addComment(post.id, state.profile, text);
        state.openComments.add(post.id);
        attachCommentListener(post.id);
        form.reset();

        notifyPostComment(post, state.profile, text).catch((error) => console.warn('Comment notification failed:', error));
        const mentionedUsers = await resolveMentionedUsers(text);
        mentionedUsers
          .filter((user) => user.uid !== state.profile.uid && user.uid !== post.authorId)
          .forEach((user) => notifyCommentMention(post, state.profile, user, text).catch((error) => console.warn('Mention notification failed:', error)));
      } catch (error) {
        showToast(friendlyError(error), 'error');
      }
    });
  });
}

function attachCommentListener(postId) {
  if (state.commentUnsubscribers.has(postId)) {
    renderCommentsForPost(postId);
    return;
  }

  const unsubscribe = listenToComments(postId, (comments) => {
    state.commentsByPost.set(postId, comments);
    renderCommentsForPost(postId);
  });

  state.commentUnsubscribers.set(postId, unsubscribe);
}

function renderCommentsForPost(postId) {
  const comments = (state.commentsByPost.get(postId) || []).filter((comment) => !state.blocked.has(comment.authorId));
  const targets = $$(`[data-comments-list="${cssEscape(postId)}"]`);
  const markup = comments.length
    ? comments.map((comment) => commentTemplate(postId, comment)).join('')
    : '<div class="empty-comments">No comments yet. Be first.</div>';

  targets.forEach((target) => {
    target.innerHTML = markup;
    bindCommentActions(target, postId);
  });
}

function commentTemplate(postId, comment) {
  const uid = state.profile?.uid;
  const post = state.posts.find((item) => item.id === postId);
  const liked = Array.isArray(comment.likedBy) && comment.likedBy.includes(uid);
  const canEdit = comment.authorId === uid;
  const canDelete = comment.authorId === uid || post?.authorId === uid;
  const canModerate = comment.authorId !== uid;

  return `
    <div class="comment-item" data-comment-id="${escapeHTML(comment.id)}" data-comment-post-id="${escapeHTML(postId)}" data-comment-author-id="${escapeHTML(comment.authorId)}">
      <button class="as-button" type="button" data-comment-profile="${escapeHTML(comment.authorId)}">
        ${avatarTemplate({ displayName: comment.authorName, username: comment.authorUsername, avatarUrl: comment.authorAvatarUrl }, 'tiny')}
      </button>
      <div class="comment-body">
        <button class="comment-author as-button" type="button" data-comment-profile="${escapeHTML(comment.authorId)}">${escapeHTML(comment.authorName)}</button>
        <span>${renderMentionedText(comment.text, 'comment')}${comment.edited ? ' <small class="edited-label">(edited)</small>' : ''}</span>
      </div>
      <button class="comment-like ${liked ? 'liked' : ''}" type="button" data-comment-like title="Like comment">
        <span>♥</span><small>${comment.likeCount ? formatCount(comment.likeCount) : ''}</small>
      </button>
      <div class="comment-more-wrap">
        <button class="comment-more-btn" type="button" data-comment-menu-button title="Comment options">•••</button>
        <div class="comment-menu ${state.commentMenu.postId === postId && state.commentMenu.commentId === comment.id ? 'open' : ''}" data-comment-menu>
          ${canEdit ? '<button type="button" data-comment-edit>Edit comment</button>' : ''}
          ${canDelete ? '<button type="button" class="danger" data-comment-delete>Delete comment</button>' : ''}
          ${canModerate ? '<button type="button" data-comment-report>Report comment</button>' : ''}
          ${canModerate ? '<button type="button" data-comment-report-user>Report user</button>' : ''}
          ${canModerate ? '<button type="button" class="danger" data-comment-block-user>Block user</button>' : ''}
        </div>
      </div>
    </div>
  `;
}

function bindCommentActions(target, postId) {
  $$('[data-comment-profile]', target).forEach((button) => {
    button.addEventListener('click', () => openUserProfile(button.dataset.commentProfile));
  });

  $$('[data-comment-mention]', target).forEach((button) => {
    button.addEventListener('click', () => openUserProfile(button.dataset.commentMention));
  });

  $$('[data-comment-like]', target).forEach((button) => {
    button.addEventListener('click', async () => {
      const item = button.closest('[data-comment-id]');
      await toggleCommentLikeFromElement(postId, item);
    });
  });

  $$('[data-comment-menu-button]', target).forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const item = button.closest('[data-comment-id]');
      toggleCommentMenu(postId, item?.dataset.commentId);
    });
  });

  $$('[data-comment-edit]', target).forEach((button) => {
    button.addEventListener('click', () => editCommentFromElement(postId, button.closest('[data-comment-id]')));
  });

  $$('[data-comment-delete]', target).forEach((button) => {
    button.addEventListener('click', () => deleteCommentFromElement(postId, button.closest('[data-comment-id]')));
  });

  $$('[data-comment-report]', target).forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.closest('[data-comment-id]');
      const comment = findComment(postId, item?.dataset.commentId);
      const post = state.posts.find((entry) => entry.id === postId);
      const targetUser = findUser(comment?.authorId) || {
        uid: comment?.authorId,
        displayName: comment?.authorName,
        username: comment?.authorUsername,
        avatarUrl: comment?.authorAvatarUrl
      };
      openReportFlow({ targetUser, targetComment: comment, post, targetType: 'comment' });
    });
  });

  $$('[data-comment-report-user]', target).forEach((button) => {
    button.addEventListener('click', () => {
      const comment = findComment(postId, button.closest('[data-comment-id]')?.dataset.commentId);
      const targetUser = findUser(comment?.authorId) || {
        uid: comment?.authorId,
        displayName: comment?.authorName,
        username: comment?.authorUsername,
        avatarUrl: comment?.authorAvatarUrl
      };
      openReportFlow({ targetUser, targetType: 'user' });
    });
  });

  $$('[data-comment-block-user]', target).forEach((button) => {
    button.addEventListener('click', () => {
      const comment = findComment(postId, button.closest('[data-comment-id]')?.dataset.commentId);
      const targetUser = findUser(comment?.authorId) || {
        uid: comment?.authorId,
        displayName: comment?.authorName,
        username: comment?.authorUsername,
        avatarUrl: comment?.authorAvatarUrl
      };
      handleBlockUser(targetUser);
    });
  });

  $$('[data-comment-id]', target).forEach((item) => {
    item.addEventListener('dblclick', async (event) => {
      if (event.target.closest('button') || event.target.closest('[data-comment-menu]')) return;
      await toggleCommentLikeFromElement(postId, item);
    });

    let holdTimer = null;
    item.addEventListener('touchstart', () => {
      holdTimer = setTimeout(() => toggleCommentMenu(postId, item.dataset.commentId), 560);
    }, { passive: true });
    item.addEventListener('touchend', () => clearTimeout(holdTimer));
    item.addEventListener('touchmove', () => clearTimeout(holdTimer));
  });
}

function toggleCommentMenu(postId, commentId) {
  if (!postId || !commentId) return;
  const same = state.commentMenu.postId === postId && state.commentMenu.commentId === commentId;
  state.commentMenu = same ? { postId: '', commentId: '' } : { postId, commentId };
  renderCommentsForPost(postId);
}

async function editCommentFromElement(postId, item) {
  const comment = findComment(postId, item?.dataset.commentId);
  if (!comment || comment.authorId !== state.profile?.uid) return;

  const nextText = window.prompt('Edit your comment', comment.text);
  if (nextText === null) return;
  const cleanTextValue = cleanInput(nextText, 300);
  if (!cleanTextValue) {
    showToast('Comment cannot be empty.', 'error');
    return;
  }

  if (ensureNotBanned()) return;
  const moderation = scanContent(cleanTextValue);
  if (moderation.flagged) {
    await handleBlockedContent('comment', cleanTextValue, moderation);
    return;
  }

  try {
    await updateComment(postId, comment.id, state.profile.uid, cleanTextValue);
    state.commentMenu = { postId: '', commentId: '' };
    showToast('Comment updated.');
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

async function deleteCommentFromElement(postId, item) {
  const comment = findComment(postId, item?.dataset.commentId);
  const post = state.posts.find((entry) => entry.id === postId);
  if (!comment) return;

  const canDelete = comment.authorId === state.profile?.uid || post?.authorId === state.profile?.uid;
  if (!canDelete) return;

  if (!window.confirm('Delete this comment?')) return;

  try {
    await deleteComment(postId, comment.id);
    state.commentMenu = { postId: '', commentId: '' };
    showToast('Comment deleted.');
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

function ensureNotBanned() {
  const message = banMessage(state.profile);
  if (!message) return false;
  showToast(message, 'error');
  return true;
}

async function handleBlockedContent(source, text, moderation) {
  try {
    const result = await registerContentViolation(state.profile, {
      type: `${source}_blocked`,
      source,
      text,
      group: moderation.group,
      matchedTerm: moderation.matchedTerm
    });

    if (result.banned) {
      showToast(`Content blocked. Your account is temporarily limited for ${result.minutes} minutes.`, 'error');
    } else {
      showToast('Content blocked because it appears to violate Pixora community rules.', 'error');
    }
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

async function handleBlockUser(user) {
  if (!user?.uid || user.uid === state.profile?.uid) return;
  const confirmed = window.confirm(`Block @${user.username || 'this user'}? You will stop seeing their posts and conversations.`);
  if (!confirmed) return;

  try {
    await blockUser(state.profile, user);
    state.blocked.add(user.uid);
    state.commentMenu = { postId: '', commentId: '' };
    renderPeople();
    renderPosts();
    renderProfilePanel();
    renderConversations();
    showToast(`Blocked @${user.username || 'user'}.`);
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

async function openReportFlow({ targetUser, targetComment = null, post = null, targetType = 'user' }) {
  if (!targetUser?.uid || targetUser.uid === state.profile?.uid) return;

  const reasonList = REPORT_GROUPS.map((reason, index) => `${index + 1}. ${reason}`).join('\n');
  const reasonInput = window.prompt(`Why are you reporting this ${targetType}?\n\n${reasonList}\n\nEnter a number or type your reason group:`, '1');
  if (reasonInput === null) return;

  const selectedIndex = Number(reasonInput.trim()) - 1;
  const group = REPORT_GROUPS[selectedIndex] || REPORT_GROUPS.find((reason) => reason.toLowerCase() === reasonInput.trim().toLowerCase()) || 'Other';

  const details = window.prompt('Add a short note for review. What happened?', targetComment?.text || '');
  if (details === null) return;

  const confirmReport = window.confirm(`Submit report?\n\nUser: @${targetUser.username || 'user'}\nReason: ${group}`);
  if (!confirmReport) return;

  try {
    await submitReport({
      reporter: state.profile,
      targetUser,
      targetComment,
      post,
      group,
      details
    });

    state.commentMenu = { postId: '', commentId: '' };
    showToast('Report submitted. Thank you for helping keep Pixora safe.');
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}


async function toggleCommentLikeFromElement(postId, item) {
  const commentId = item?.dataset.commentId;
  const comment = findComment(postId, commentId);
  const post = state.posts.find((entry) => entry.id === postId);
  if (!comment) return;

  const addingLike = !Array.isArray(comment.likedBy) || !comment.likedBy.includes(state.profile.uid);

  try {
    await toggleCommentLike(postId, comment, state.profile.uid);
    if (addingLike) {
      notifyCommentLike(post, comment, state.profile).catch((error) => console.warn('Comment like notification failed:', error));
    }
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

function findComment(postId, commentId) {
  return (state.commentsByPost.get(postId) || []).find((comment) => comment.id === commentId);
}

function renderMentionedText(text = '', sourceType = 'message') {
  const source = String(text || '');
  const mentionPattern = /@([a-zA-Z0-9_.]{3,30})/g;
  let cursor = 0;
  let output = '';
  let match;

  while ((match = mentionPattern.exec(source)) !== null) {
    const username = match[1].toLowerCase();
    const user = findUserByUsername(username);
    const attr = sourceType === 'comment' ? 'data-comment-mention' : 'data-message-mention';
    output += escapeHTML(source.slice(cursor, match.index));
    if (user?.uid) {
      output += `<button class="mention-link" type="button" ${attr}="${escapeHTML(user.uid)}">@${escapeHTML(match[1])}</button>`;
    } else {
      output += `<span class="mention-text">@${escapeHTML(match[1])}</span>`;
    }
    cursor = match.index + match[0].length;
  }

  output += escapeHTML(source.slice(cursor));
  return output;
}

function findUserByUsername(username = '') {
  const usernameLower = String(username || '').toLowerCase();
  return [state.profile, ...state.users, ...state.profileCache.values()].find((item) => item?.username?.toLowerCase() === usernameLower) || null;
}

async function resolveMentionedUsers(text = '') {
  const usernames = Array.from(new Set(Array.from(String(text || '').matchAll(/@([a-zA-Z0-9_.]{3,30})/g)).map((match) => match[1].toLowerCase())));
  const users = [];

  for (const username of usernames) {
    let user = findUserByUsername(username);
    if (!user) {
      user = await getUserByUsername(username);
      if (user?.uid) state.profileCache.set(user.uid, user);
    }
    if (user?.uid && !users.some((item) => item.uid === user.uid)) users.push(user);
  }

  return users;
}

function renderNotificationBadge() {
  const unreadCount = state.notifications.filter((item) => !item.read).length;
  if (!views.notificationBadge) return;
  views.notificationBadge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
  views.notificationBadge.classList.toggle('hidden', unreadCount === 0);
}

async function handleMarkNotificationsRead(options = {}) {
  if (!state.profile?.uid) return;
  const hasUnread = state.notifications.some((item) => !item.read);
  if (!hasUnread) return;
  try {
    await markNotificationsRead(state.profile.uid);
    if (!options.silent) showToast('Notifications marked as read.');
  } catch (error) {
    if (!options.silent) showToast(friendlyError(error), 'error');
  }
}

function renderNotifications() {
  if (!views.notificationsList) return;

  if (!state.notifications.length) {
    views.notificationsList.innerHTML = emptyState('No notifications yet', 'Likes and other activity from your posts will appear here.');
    return;
  }

  views.notificationsList.innerHTML = state.notifications.map((notification) => notificationTemplate(notification)).join('');

  $$('[data-notification-post]', views.notificationsList).forEach((button) => {
    button.addEventListener('click', () => openNotificationPost(button.dataset.notificationPost));
  });

  $$('[data-notification-profile]', views.notificationsList).forEach((button) => {
    button.addEventListener('click', () => openUserProfile(button.dataset.notificationProfile));
  });
}

function notificationTemplate(notification) {
  const latestActor = findUser(notification.latestActorId) || {
    uid: notification.latestActorId,
    displayName: notification.latestActorName,
    username: notification.latestActorUsername,
    avatarUrl: notification.latestActorAvatarUrl
  };

  let title = 'New activity on Pixora';
  let body = notification.postPreview || 'Open the post';

  if (notification.type === 'post_like') {
    const moreCount = Math.max(0, (notification.actorCount || notification.actorIds.length || 1) - 1);
    title = moreCount > 0
      ? `${latestActor.displayName || notification.latestActorName} and ${moreCount} more liked your post`
      : `${latestActor.displayName || notification.latestActorName} liked your post`;
  } else if (notification.type === 'post_comment') {
    title = `${latestActor.displayName || notification.latestActorName} commented on your post`;
    body = notification.commentText || notification.postPreview || 'Open your post';
  } else if (notification.type === 'comment_mention') {
    title = `${latestActor.displayName || notification.latestActorName} mentioned you in a comment`;
    body = notification.commentText || notification.postPreview || 'Open the post';
  } else if (notification.type === 'comment_like') {
    title = `${latestActor.displayName || notification.latestActorName} liked your comment`;
    body = notification.commentText || notification.postPreview || 'Open the post';
  } else if (notification.type === 'call_invite') {
    title = `${latestActor.displayName || notification.latestActorName} started a call`;
    body = notification.postPreview || 'Open messages to respond.';
  } else if (notification.type === 'account_ban') {
    title = 'Your account has a temporary safety limit';
    body = notification.commentText || notification.postPreview || 'Open account settings for details.';
  }

  return `
    <article class="notification-item ${notification.read ? '' : 'unread'}">
      <button class="notification-avatar as-button" type="button" data-notification-profile="${escapeHTML(latestActor.uid || '')}">
        ${avatarTemplate(latestActor)}
      </button>
      <button class="notification-copy as-button" type="button" data-notification-post="${escapeHTML(notification.postId)}">
        <strong>${escapeHTML(title)}</strong>
        <span>${escapeHTML(body)}</span>
        <small>${escapeHTML(timeAgo(notification.updatedAt))}</small>
      </button>
    </article>
  `;
}
function openNotificationPost(postId) {
  if (!postId) return;
  const post = state.posts.find((item) => item.id === postId);
  if (post) {
    state.openComments.add(post.id);
    renderPosts();
  }
  switchView('feed');
  setTimeout(() => {
    const element = document.querySelector(`[data-post-id="${cssEscape(postId)}"]`);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else showToast('That post is not in your current feed.', 'error');
  }, 80);
}

async function openLikesModal(post) {
  if (!post?.id || !views.likesModal) return;
  state.likesModalPost = post;
  views.likesModal.classList.remove('hidden');
  renderLikesModal();

  const missingIds = post.likedBy.filter((uid) => uid && !findUser(uid));
  if (missingIds.length) {
    const loadedUsers = await Promise.all(missingIds.slice(0, 30).map((uid) => getUserById(uid)));
    loadedUsers.filter(Boolean).forEach((user) => state.profileCache.set(user.uid, user));
    renderLikesModal();
  }
}

function closeLikesModal() {
  views.likesModal?.classList.add('hidden');
  state.likesModalPost = null;
}

function renderLikesModal() {
  const post = state.likesModalPost;
  if (!post || !views.likesList) return;

  const likedUsers = post.likedBy.map((uid) => findUser(uid) || { uid, displayName: 'Pixora user', username: 'user', avatarUrl: '' });
  if (views.likesModalTitle) views.likesModalTitle.textContent = `${formatCount(post.likeCount || likedUsers.length)} ${post.likeCount === 1 ? 'like' : 'likes'}`;

  if (!likedUsers.length) {
    views.likesList.innerHTML = emptyState('No likes yet', 'People who like this post will appear here.');
    return;
  }

  views.likesList.innerHTML = likedUsers.map((user) => {
    const isMe = user.uid === state.profile?.uid;
    const iFollow = state.following.has(user.uid);
    return `
      <article class="likes-row">
        <button class="follow-person as-button" type="button" data-like-profile="${escapeHTML(user.uid)}">
          ${avatarTemplate(user)}
          <span>
            <strong>${escapeHTML(user.displayName || 'User')}</strong>
            <small>@${escapeHTML(user.username || 'user')}</small>
          </span>
        </button>
        ${isMe ? '<span class="follow-pill">You</span>' : `<button class="${iFollow ? 'ghost-btn' : 'primary-btn'} compact-action" type="button" data-like-follow="${escapeHTML(user.uid)}">${iFollow ? 'Unfollow' : 'Follow'}</button>`}
      </article>
    `;
  }).join('');

  $$('[data-like-profile]', views.likesList).forEach((button) => {
    button.addEventListener('click', () => {
      closeLikesModal();
      openUserProfile(button.dataset.likeProfile);
    });
  });

  $$('[data-like-follow]', views.likesList).forEach((button) => {
    button.addEventListener('click', () => toggleFollow(findUser(button.dataset.likeFollow)));
  });
}

function renderPeople() {
  if (!state.profile || !views.peopleList) return;

  const term = views.peopleSearch?.value?.trim().toLowerCase() || '';
  const recommended = state.posts
    .filter((post) => post.authorId && post.authorId !== state.profile.uid && !state.blocked.has(post.authorId))
    .filter((post) => {
      const haystack = `${post.content || ''} ${post.authorName || ''} ${post.authorUsername || ''}`.toLowerCase();
      return !term || haystack.includes(term);
    })
    .sort((a, b) => getViralScore(b) - getViralScore(a) || getPostAgeHours(a) - getPostAgeHours(b))
    .slice(0, 36);

  if (!recommended.length) {
    views.peopleList.innerHTML = emptyState('No recommended posts yet', 'As more people post and interact, recommended posts will appear here.');
    return;
  }

  views.peopleList.innerHTML = recommended.map((post) => {
    const media = post.mediaUrl
      ? (post.mediaType === 'video'
        ? `<video src="${escapeHTML(post.mediaUrl)}" muted playsinline preload="metadata"></video>`
        : `<img src="${escapeHTML(post.mediaUrl)}" alt="Post media" loading="lazy" />`)
      : `<div class="discover-text-tile">${escapeHTML((post.content || 'Pixora post').slice(0, 120))}</div>`;

    return `
      <button class="discover-post-tile" type="button" data-discover-post="${escapeHTML(post.id)}">
        ${media}
        <span class="discover-post-overlay">
          <strong>@${escapeHTML(post.authorUsername || 'user')}</strong>
          <small>♡ ${formatCount(post.likeCount)} · 💬 ${formatCount(post.commentCount)}</small>
        </span>
      </button>
    `;
  }).join('');

  $$('[data-discover-post]', views.peopleList).forEach((button) => {
    button.addEventListener('click', () => {
      const postId = button.dataset.discoverPost;
      state.openComments.add(postId);
      switchView('feed');
      setTimeout(() => document.querySelector(`[data-post-id="${cssEscape(postId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    });
  });
}

function renderConversations() {
  if (!state.profile) return;

  const realConversations = state.conversations.filter((conversation) => {
    const other = getOtherMember(conversation);
    return Boolean(conversation.lastMessage) && !state.blocked.has(other.uid);
  });
  if (!realConversations.length) {
    views.conversationList.innerHTML = '<div class="empty-state"><strong>No chats</strong><span>Only conversations with real messages appear here.</span></div>';
    return;
  }

  views.conversationList.innerHTML = realConversations.map((conversation) => {
    const other = getOtherMember(conversation);
    const active = conversation.id === state.activeConversationId ? 'active' : '';
    return `
      <button class="conversation-item ${active}" type="button" data-conversation-id="${escapeHTML(conversation.id)}" data-other-id="${escapeHTML(other.uid)}">
        ${avatarTemplate(other)}
        <span class="conversation-copy">
          <strong>${escapeHTML(other.displayName || 'User')}</strong>
          <span>${escapeHTML(conversation.lastMessage || 'No messages yet')}</span>
        </span>
      </button>
    `;
  }).join('');

  $$('[data-conversation-id]', views.conversationList).forEach((button) => {
    button.addEventListener('click', async () => {
      const conversation = state.conversations.find((item) => item.id === button.dataset.conversationId);
      const other = getOtherMember(conversation);
      await activateConversation(conversation.id, other);
    });
  });
}

async function toggleFollow(user) {
  if (!user || !state.profile) return;

  const wasFollowing = state.following.has(user.uid);

  try {
    if (wasFollowing) {
      await unfollowUser(state.profile, user);
      state.following.delete(user.uid);
      if (state.viewingProfileUid === user.uid) {
        state.viewingStats = {
          ...state.viewingStats,
          uid: user.uid,
          followers: Math.max(0, (state.viewingStats.followers || 0) - 1)
        };
      }
      showToast(`Unfollowed @${user.username}.`);
    } else {
      await followUser(state.profile, user);
      state.following.add(user.uid);
      if (state.viewingProfileUid === user.uid) {
        state.viewingStats = {
          ...state.viewingStats,
          uid: user.uid,
          followers: (state.viewingStats.followers || 0) + 1
        };
      }
      showToast(`Following @${user.username}.`);
    }

    renderPeople();
    renderProfilePanel();
    renderSettingsPanel();
    renderFollowModal();
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

async function startChat(user) {
  if (!user || !state.profile) return;
  if (state.blocked.has(user.uid)) {
    showToast('You blocked this user. Unblock them before messaging.', 'error');
    return;
  }

  try {
    const conversationId = await openConversation(state.profile, user);
    switchView('messages');
    await activateConversation(conversationId, user);
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

async function activateConversation(conversationId, otherUser) {
  state.activeConversationId = conversationId;
  state.activeChatUser = otherUser;

  views.chatEmpty.classList.add('hidden');
  views.chatActive.classList.remove('hidden');

  views.chatHeader.innerHTML = `
    <button class="post-author as-button" type="button" data-chat-profile>
      ${avatarTemplate(otherUser)}
      <div class="person-meta">
        <strong>${escapeHTML(otherUser.displayName || 'User')}</strong>
        <span>@${escapeHTML(otherUser.username || 'user')} · ${activityText(otherUser)}</span>
      </div>
    </button>
    <div class="chat-header-actions">
      <button class="ghost-btn compact-action" type="button" data-audio-call>Audio</button>
      <button class="primary-btn compact-action" type="button" data-video-call>Video</button>
      <button class="ghost-btn danger compact-action" type="button" data-clear-chat>Delete chat</button>
    </div>
  `;
  $('[data-chat-profile]', views.chatHeader)?.addEventListener('click', () => openUserProfile(otherUser.uid));
  $('[data-audio-call]', views.chatHeader)?.addEventListener('click', () => startCall('audio'));
  $('[data-video-call]', views.chatHeader)?.addEventListener('click', () => startCall('video'));
  $('[data-clear-chat]', views.chatHeader)?.addEventListener('click', handleClearChat);

  renderConversations();
  hideChatTools();

  if (state.unsubscribeMessages) state.unsubscribeMessages();
  state.unsubscribeMessages = listenToMessages(conversationId, renderMessages);
}

function scrollMessagesToBottom(options = {}) {
  const list = views.messagesList;
  if (!list) return;

  const behavior = options.smooth ? 'smooth' : 'auto';
  const scroll = () => {
    list.scrollTo({ top: list.scrollHeight, behavior });
  };

  requestAnimationFrame(() => {
    scroll();
    setTimeout(scroll, 80);
    setTimeout(scroll, 260);
  });
}

function renderMessages(messages) {
  if (!messages.length) {
    views.messagesList.innerHTML = emptyState('No messages yet', 'Send the first message to start this chat.');
    scrollMessagesToBottom();
    return;
  }

  views.messagesList.innerHTML = messages.map((message) => messageTemplate(message)).join('');
  $$('[data-message-post]', views.messagesList).forEach((button) => {
    button.addEventListener('click', () => {
      const post = state.posts.find((item) => item.id === button.dataset.messagePost);
      if (post) {
        state.openComments.add(post.id);
        switchView('feed');
        setTimeout(() => document.querySelector(`[data-post-id="${cssEscape(post.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      }
    });
  });

  $$('[data-message-mention]', views.messagesList).forEach((button) => {
    button.addEventListener('click', () => openUserProfile(button.dataset.messageMention));
  });

  $$('[data-unsend-message]', views.messagesList).forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Delete this message for everyone?')) return;
      try {
        await deleteMessageForEveryone(state.activeConversationId, button.dataset.unsendMessage, state.profile);
        showToast('Message deleted.');
      } catch (error) {
        showToast(friendlyError(error), 'error');
      }
    });
  });

  $$('img', views.messagesList).forEach((image) => {
    if (!image.complete) {
      image.addEventListener('load', () => scrollMessagesToBottom(), { once: true });
    }
  });

  scrollMessagesToBottom();
}


function renderMessageText(text = '') {
  return renderMentionedText(text, 'message');
}


function messageTemplate(message) {
  const mine = message.senderId === state.profile?.uid;
  const content = [];
  if (message.text) content.push(`<div>${renderMessageText(message.text)}</div>`);
  if (message.imageUrl) content.push(`<img class="message-media" src="${escapeHTML(message.imageUrl)}" alt="Shared image" loading="lazy" />`);
  if (message.gifUrl) content.push(`<img class="message-media gif" src="${escapeHTML(message.gifUrl)}" alt="${escapeHTML(message.gifTitle || 'GIF')}" loading="lazy" />`);
  if (message.postId && message.postPreview) {
    content.push(`
      <button class="shared-post-card" type="button" data-message-post="${escapeHTML(message.postId)}">
        <strong>${escapeHTML(message.postPreview.authorName || 'Pixora post')}</strong>
        <span>${escapeHTML(message.postPreview.content || 'Open shared post')}</span>
      </button>
    `);
  }

  return `
    <div class="message-bubble ${mine ? 'mine' : ''}" data-message-id="${escapeHTML(message.id)}">
      ${mine ? `<button class="message-unsend" type="button" data-unsend-message="${escapeHTML(message.id)}" title="Delete for everyone">×</button>` : ''}
      ${content.join('')}
      <small>${escapeHTML(timeAgo(message.createdAt))}</small>
    </div>
  `;
}

async function handleClearChat() {
  if (!state.activeConversationId || !window.confirm('Delete this whole chat for everyone?')) return;
  try {
    await clearConversationForEveryone(state.activeConversationId);
    state.activeConversationId = null;
    state.activeChatUser = null;
    views.chatActive.classList.add('hidden');
    views.chatEmpty.classList.remove('hidden');
    showToast('Chat deleted.');
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

async function startCall(mode = 'audio') {
  if (!state.activeConversationId || !state.activeChatUser || !state.profile) return;
  try {
    const constraints = mode === 'video' ? { audio: true, video: true } : { audio: true, video: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.getTracks().forEach((track) => track.stop());
    await createCallInvite({
      conversationId: state.activeConversationId,
      caller: state.profile,
      receiver: state.activeChatUser,
      mode
    });
    showToast(`${mode === 'video' ? 'Video' : 'Audio'} call request sent. WebRTC signaling records were created in Firestore.`);
  } catch (error) {
    showToast(error?.name === 'NotAllowedError' ? 'Camera/microphone permission was denied.' : friendlyError(error), 'error');
  }
}

function toggleChatTools(panel) {
  if (!views.chatTools) return;
  const alreadyOpen = views.chatTools.dataset.panel === panel && !views.chatTools.classList.contains('hidden');
  if (alreadyOpen) {
    hideChatTools();
    return;
  }

  views.chatTools.dataset.panel = panel;
  views.chatTools.classList.remove('hidden');

  if (panel === 'emoji') renderEmojiPanel();
  if (panel === 'gif') renderGifPanel();
}

function hideChatTools() {
  views.chatTools?.classList.add('hidden');
  if (views.chatTools) views.chatTools.innerHTML = '';
}

function renderEmojiPanel() {
  views.chatTools.innerHTML = `
    <div class="emoji-grid">
      ${emojiSet.map((emoji) => `<button type="button" data-emoji="${emoji}">${emoji}</button>`).join('')}
    </div>
  `;

  $$('[data-emoji]', views.chatTools).forEach((button) => {
    button.addEventListener('click', () => {
      insertAtCursor(views.messageInput, button.dataset.emoji);
      views.messageInput.focus();
    });
  });
}

function renderGifPanel() {
  views.chatTools.innerHTML = `
    <div class="gif-search-row">
      <input id="gif-search" type="search" placeholder="Search GIFs" autocomplete="off" />
      <button id="gif-search-btn" class="ghost-btn" type="button">Search</button>
    </div>
    <div id="gif-results" class="gif-results"><span class="soft-note">Type a word like teddy, happy, funny, love...</span></div>
  `;

  const input = $('#gif-search', views.chatTools);
  const button = $('#gif-search-btn', views.chatTools);

  const runSearch = () => loadGifs(input?.value || 'reaction');

  button?.addEventListener('click', runSearch);

  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  });

  let gifTimer;
  input?.addEventListener('input', () => {
    clearTimeout(gifTimer);
    gifTimer = setTimeout(() => {
      const value = cleanInput(input.value, 40);
      if (value.length >= 2) loadGifs(value);
    }, 450);
  });

  input?.focus();
}

async function loadGifs(queryText) {
  const results = $('#gif-results', views.chatTools);
  const query = cleanInput(queryText, 40);

  if (!results) return;

  if (!query) {
    results.innerHTML = '<span class="soft-note">Search for a GIF to send.</span>';
    return;
  }

  if (!giphyKey) {
    results.innerHTML = '<span class="soft-note">Missing GIPHY API key. Add VITE_GIPHY_API_KEY in .env, then run npm run build and firebase deploy.</span>';
    return;
  }

  results.innerHTML = '<span class="soft-note">Loading GIFs...</span>';

  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(giphyKey)}&q=${encodeURIComponent(query)}&limit=16&rating=g&lang=en`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`GIPHY request failed with status ${response.status}`);
    }

    const data = await response.json();
    const gifs = data.data || [];

    if (!gifs.length) {
      results.innerHTML = '<span class="soft-note">No GIFs found. Try another word.</span>';
      return;
    }

    results.innerHTML = gifs.map((gif) => {
      const src = gif.images?.fixed_height_small?.url || gif.images?.downsized_medium?.url || gif.images?.original?.url || '';
      if (!src) return '';

      return `
        <button type="button" data-gif-url="${escapeHTML(src)}" data-gif-title="${escapeHTML(gif.title || 'GIF')}">
          <img src="${escapeHTML(src)}" alt="${escapeHTML(gif.title || 'GIF')}" loading="lazy" />
        </button>
      `;
    }).join('');

    $$('[data-gif-url]', results).forEach((button) => {
      button.addEventListener('click', () => sendGif(button.dataset.gifUrl, button.dataset.gifTitle));
    });
  } catch (error) {
    console.error(error);
    results.innerHTML = '<span class="soft-note">GIF search failed. Check your GIPHY key, internet, and browser console.</span>';
  }
}

async function sendGif(url, title) {
  if (!state.activeConversationId || !url) return;
  try {
    await sendMessage(state.activeConversationId, state.profile, {
      type: 'gif',
      gifUrl: url,
      gifTitle: title || 'GIF'
    });
    hideChatTools();
    scrollMessagesToBottom({ smooth: true });
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

async function handleCoverSelect() {
  const file = views.coverFile?.files?.[0];
  if (!file || !state.profile) return;

  try {
    showToast('Preparing cover image...');
    const uploaded = await uploadCoverImage(file);
    const form = $('#profile-form');
    if (form?.coverUrl) form.coverUrl.value = uploaded.url;
    renderCoverPreview(uploaded.url);
    await updateUserProfile(state.profile.uid, {
      displayName: state.profile.displayName,
      username: state.profile.username,
      bio: state.profile.bio,
      avatarUrl: state.profile.avatarUrl,
      coverUrl: uploaded.url
    });
    showToast('Cover image updated.');
  } catch (error) {
    showToast(friendlyError(error), 'error');
  } finally {
    if (views.coverFile) views.coverFile.value = '';
  }
}

function renderCoverPreview(coverUrl = '') {
  if (!views.settingsCoverPreview) return;
  views.settingsCoverPreview.classList.toggle('has-cover', Boolean(coverUrl));
  views.settingsCoverPreview.style.backgroundImage = coverUrl ? `linear-gradient(180deg, rgba(8,8,14,0.08), rgba(8,8,14,0.4)), url("${coverUrl}")` : '';
  views.settingsCoverPreview.innerHTML = coverUrl ? '<span>Cover selected</span>' : '<span>No cover image selected</span>';
}

function renderSelectedMediaPreview() {
  const file = views.postMediaInput.files?.[0];
  if (!file) {
    clearMediaPreview();
    return;
  }

  const url = URL.createObjectURL(file);
  views.mediaPreview.classList.remove('hidden');
  if (file.type?.startsWith('video/')) {
    if (!cloudinaryReady()) {
      views.postMediaInput.value = '';
      clearMediaPreview();
      showToast('Video upload needs Cloudinary. Add cloud name and unsigned preset in .env first.', 'error');
      return;
    }
    views.mediaPreview.innerHTML = `<video src="${url}" controls playsinline muted></video><button type="button" data-clear-media>×</button>`;
  } else {
    views.mediaPreview.innerHTML = `<img src="${url}" alt="Selected media" /><button type="button" data-clear-media>×</button>`;
  }

  $('[data-clear-media]', views.mediaPreview)?.addEventListener('click', () => {
    views.postMediaInput.value = '';
    clearMediaPreview();
  });
}

function clearMediaPreview() {
  views.mediaPreview.classList.add('hidden');
  views.mediaPreview.innerHTML = '';
}

function openCropperForAvatar() {
  const file = views.avatarFile.files?.[0];
  if (!file) return;

  state.crop = { file, rotation: 0, zoom: 1, offsetX: 0, offsetY: 0 };
  views.cropImage.src = URL.createObjectURL(file);
  views.cropZoom.value = '1';
  views.cropX.value = '0';
  views.cropY.value = '0';
  views.cropModal.classList.remove('hidden');
  updateCropPreview();
}

function updateCropPreview() {
  if (!views.cropImage) return;
  state.crop.zoom = Number(views.cropZoom.value || 1);
  state.crop.offsetX = Number(views.cropX.value || 0);
  state.crop.offsetY = Number(views.cropY.value || 0);
  views.cropImage.style.transform = `translate(calc(-50% + ${state.crop.offsetX}px), calc(-50% + ${state.crop.offsetY}px)) rotate(${state.crop.rotation}deg) scale(${state.crop.zoom})`;
}

function rotateCrop() {
  state.crop.rotation = (state.crop.rotation + 90) % 360;
  updateCropPreview();
}

async function saveCroppedAvatar() {
  if (!state.crop.file) return;
  setButtonLoading(views.saveCrop, true, 'Cropping...');
  try {
    const dataUrl = await cropImageFileToDataUrl(state.crop.file, state.crop);
    const form = $('#profile-form');
    form.avatarUrl.value = dataUrl;
    renderAvatarInto(views.settingsAvatarPreview, { ...state.profile, avatarUrl: dataUrl }, 'xl');
    closeCropModal();
    showToast('Profile photo ready. Save changes to apply it.');
  } catch (error) {
    showToast(friendlyError(error), 'error');
  } finally {
    setButtonLoading(views.saveCrop, false);
  }
}

function closeCropModal() {
  views.cropModal.classList.add('hidden');
  if (views.cropImage?.src?.startsWith('blob:')) URL.revokeObjectURL(views.cropImage.src);
  views.cropImage.src = '';
  views.avatarFile.value = '';
}

function openShareModal(post) {
  if (!post?.id) {
    showToast('This post is still loading. Try again in a moment.', 'error');
    return;
  }
  state.currentSharePost = post;
  if (views.shareLinkField) views.shareLinkField.value = postLink(post);
  views.shareModal.classList.remove('hidden');
  renderShareUsers();
}

function closeShareModal() {
  views.shareModal.classList.add('hidden');
  state.currentSharePost = null;
  if (views.shareLinkField) views.shareLinkField.value = '';
}

async function copyShareLink() {
  if (!state.currentSharePost) return;
  const link = postLink(state.currentSharePost);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
    } else {
      fallbackCopyText(link);
    }
    await increaseShareCount(state.currentSharePost.id);
    showToast('Post link copied.');
  } catch {
    fallbackCopyText(link);
    showToast('Copy the highlighted link manually.');
  }
}

function fallbackCopyText(text) {
  if (views.shareLinkField) {
    views.shareLinkField.value = text;
    views.shareLinkField.focus();
    views.shareLinkField.select();
    try { document.execCommand('copy'); } catch {}
    return;
  }

  const temp = document.createElement('textarea');
  temp.value = text;
  document.body.append(temp);
  temp.select();
  try { document.execCommand('copy'); } catch {}
  temp.remove();
}

function renderShareUsers() {
  const following = state.users.filter((user) => state.following.has(user.uid));
  const others = state.users.filter((user) => !state.following.has(user.uid));
  const users = [...following, ...others];

  if (!users.length) {
    views.shareUsersList.innerHTML = emptyState('No people available', 'Copy the link now, or use Discover after more people join Pixora.');
    return;
  }

  views.shareUsersList.innerHTML = users.map((user) => {
    const badge = state.following.has(user.uid) ? 'Following' : 'Discover';
    return `
      <button class="share-user" type="button" data-share-user="${escapeHTML(user.uid)}">
        ${avatarTemplate(user)}
        <span>
          <strong>${escapeHTML(user.displayName || 'User')}</strong>
          <small>@${escapeHTML(user.username || 'user')} · ${badge}</small>
        </span>
      </button>
    `;
  }).join('');

  $$('[data-share-user]', views.shareUsersList).forEach((button) => {
    button.addEventListener('click', async () => {
      const user = findUser(button.dataset.shareUser);
      await sharePostToUser(user);
    });
  });
}

async function sharePostToUser(user) {
  const post = state.currentSharePost;
  if (!user || !post) return;

  try {
    const conversationId = await openConversation(state.profile, user);
    await sendMessage(conversationId, state.profile, {
      type: 'post',
      text: `Shared a post from @${post.authorUsername}`,
      postId: post.id,
      postPreview: {
        authorName: post.authorName,
        authorUsername: post.authorUsername,
        content: post.content?.slice(0, 160) || 'Open shared post'
      }
    });
    await increaseShareCount(post.id);
    closeShareModal();
    showToast(`Shared with ${user.displayName}.`);
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

function postLink(post) {
  return `${window.location.origin}${window.location.pathname}?post=${encodeURIComponent(post.id)}`;
}

function renderAvatarInto(element, user, sizeClass = '') {
  if (!element) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = avatarTemplate(user, sizeClass).trim();
  const avatar = wrapper.firstElementChild;
  element.className = avatar.className;
  element.innerHTML = avatar.innerHTML;
}

function getPostFromButton(button) {
  const postId = button.closest('[data-post-id]')?.dataset.postId;
  return state.posts.find((post) => post.id === postId) || null;
}

function findUser(uid) {
  if (uid === state.profile?.uid) return state.profile;
  return state.profileCache.get(uid) || state.users.find((user) => user.uid === uid) || null;
}

function getOtherMember(conversation = {}) {
  const otherUid = conversation.members?.find((uid) => uid !== state.profile.uid);
  return conversation.memberInfo?.[otherUid] || findUser(otherUid) || { uid: otherUid, displayName: 'User', username: 'user' };
}

function insertAtCursor(input, text) {
  if (!input) return;
  const start = input.selectionStart || input.value.length;
  const end = input.selectionEnd || input.value.length;
  input.value = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
  input.selectionStart = input.selectionEnd = start + text.length;
}

function scrollToLinkedPost() {
  if (state.linkScrolled) return;
  const postId = new URLSearchParams(window.location.search).get("post");
  if (!postId) return;
  state.linkScrolled = true;
  switchView("feed");
  setTimeout(() => document.querySelector(`[data-post-id="${cssEscape(postId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
}

function cssEscape(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
