import { changeCurrentUserPassword, deleteCurrentUserAccount, listenToAuth, logoutUser, sendResetPasswordEmail } from './services/auth.service.js';
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

const UI_ICON_SVGS = {
  heart: '<svg viewBox="0 0 24 24"><path d="M20.2 5.8a5.1 5.1 0 0 0-7.2 0L12 6.8l-1-1a5.1 5.1 0 0 0-7.2 7.2l1 1L12 21l7.2-7 .95-.95a5.1 5.1 0 0 0 .05-7.25z"/></svg>',
  heartFilled: '<svg viewBox="0 0 24 24" class="filled"><path d="M20.2 5.8a5.1 5.1 0 0 0-7.2 0L12 6.8l-1-1a5.1 5.1 0 0 0-7.2 7.2l1 1L12 21l7.2-7 .95-.95a5.1 5.1 0 0 0 .05-7.25z"/></svg>',
  comment: '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H9l-5 4v-6.5z"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.8L6 21z"/></svg>',
  bookmarkFilled: '<svg viewBox="0 0 24 24" class="filled"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.8L6 21z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M8.5 5.5 6.8 3.8A2 2 0 0 0 4 3.8l-1 1C2 5.8 2.3 8.6 4.7 12.2c2.4 3.6 5.5 6.7 9.1 9.1 3.6 2.4 6.4 2.7 7.4 1.7l1-1a2 2 0 0 0 0-2.8l-1.7-1.7a2 2 0 0 0-2.3-.35l-2.2 1.1c-2.8-1.4-5-3.6-6.4-6.4l1.1-2.2a2 2 0 0 0-.35-2.3z"/></svg>',
  video: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-3v10l-6-3z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a1.8 1.8 0 0 0 .35 2l.05.05a2 2 0 0 1-2.83 2.83l-.05-.05a1.8 1.8 0 0 0-2-.35 1.8 1.8 0 0 0-1.1 1.65V21a2 2 0 0 1-4 0v-.08a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-2 .35l-.05.05a2 2 0 0 1-2.83-2.83l.05-.05a1.8 1.8 0 0 0 .35-2 1.8 1.8 0 0 0-1.65-1.1H2.5a2 2 0 0 1 0-4h.08a1.8 1.8 0 0 0 1.65-1.1 1.8 1.8 0 0 0-.35-2l-.05-.05a2 2 0 0 1 2.83-2.83l.05.05a1.8 1.8 0 0 0 2 .35 1.8 1.8 0 0 0 1.1-1.65V2.5a2 2 0 0 1 4 0v.08a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 2-.35l.05-.05a2 2 0 0 1 2.83 2.83l-.05.05a1.8 1.8 0 0 0-.35 2 1.8 1.8 0 0 0 1.65 1.1h.08a2 2 0 0 1 0 4h-.08A1.8 1.8 0 0 0 19.4 15z"/></svg>'
};

function uiIcon(name, extraClass = '') {
  return `<span class="ui-icon ${extraClass}" aria-hidden="true">${UI_ICON_SVGS[name] || ''}</span>`;
}

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
  if (!state.profile) return { posts: [], ownPosts: [], followedPosts: [] };

  const cleanPosts = state.posts.filter((post) => post.authorId && post.postKind !== 'story' && !state.blocked.has(post.authorId));
  const ownPosts = cleanPosts.filter((post) => post.authorId === state.profile.uid);
  const followedPosts = cleanPosts.filter((post) => state.following.has(post.authorId));

  if (!state.following.size) {
    return {
      posts: sortFeedPosts(ownPosts).map((post) => ({ ...post, feedReason: 'Your post' })),
      ownPosts,
      followedPosts
    };
  }

  const usedIds = new Set();
  const posts = sortFeedPosts([...ownPosts, ...followedPosts])
    .filter((post) => {
      if (usedIds.has(post.id)) return false;
      usedIds.add(post.id);
      return true;
    })
    .map((post) => ({
      ...post,
      feedReason: post.authorId === state.profile.uid ? 'Your post' : ''
    }));

  return {
    posts,
    ownPosts,
    followedPosts
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
  storiesTray: $('#stories-tray'),
  rightRail: $('#right-rail'),
  videoFeedList: $('#video-feed-list'),
  mediaStudioModal: $('#media-studio-modal'),
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
  likesList: $('#likes-list'),
  storyModal: $('#story-modal'),
  storyViewerTitle: $('#story-viewer-title'),
  storyViewerBody: $('#story-viewer-body'),
  settingsNav: $('#settings-nav'),
  settingsPanels: $('#settings-panels')
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
  $('#create-story-btn')?.addEventListener('click', () => {
    setCreateKind('story');
    switchView('create');
    setTimeout(() => $('#post-media')?.click(), 80);
  });
  $('#open-media-studio')?.addEventListener('click', openMediaStudio);
  $$('[data-close-media-studio]').forEach((button) => button.addEventListener('click', closeMediaStudio));
  $('#studio-muted')?.addEventListener('change', (event) => {
    $('[name="videoMuted"]', $('#post-form')).checked = event.target.checked;
  });
  $('#studio-loop')?.addEventListener('change', (event) => {
    $('[name="videoLoop"]', $('#post-form')).checked = event.target.checked;
  });
  views.messageForm?.addEventListener('submit', handleSendMessage);
  $('#profile-form')?.addEventListener('submit', handleProfileSave);
  $('#theme-options')?.addEventListener('change', handleThemeChange);
  $('#hide-activity-toggle')?.addEventListener('change', handleActivityToggle);
  $('#password-form')?.addEventListener('submit', handlePasswordChange);
  $('#send-reset-email')?.addEventListener('click', handlePasswordResetEmail);
  views.settingsNav?.addEventListener('click', handleSettingsNav);

  $$('[data-view-target="create"]').forEach((button) => {
    button.addEventListener('click', () => switchView('create'));
  });

  $$('[name="postKind"]', $('#post-form')).forEach((input) => {
    input.addEventListener('change', () => updateCreateModeUI());
  });
  updateCreateModeUI();

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
  $$('[data-close-story]').forEach((button) => button.addEventListener('click', closeStoryViewer));

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
    video: ['Watch', 'Video feed'],
    discover: ['Explore', 'Search'],
    messages: ['Inbox', 'Messages'],
    create: ['Create', 'Post or story'],
    notifications: ['Activity', 'Notifications'],
    profile: ['Profile', 'Profile'],
    settings: ['Account', 'Settings']
  };

  $$('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.viewTarget === target));
  $$('.view').forEach((view) => view.classList.toggle('active', view.dataset.view === target));
  views.topbarKicker.textContent = labels[target]?.[0] || 'Pixora';
  views.topbarTitle.textContent = labels[target]?.[1] || 'Pixora';

  if (target === 'settings') renderSettingsPanel();
  if (target === 'discover') renderPeople();
  if (target === 'video') renderVideoFeed();
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

function setCreateKind(kind = 'post') {
  const next = kind === 'story' ? 'story' : 'post';
  const radio = $(`[name="postKind"][value="${next}"]`, $('#post-form'));
  if (radio) radio.checked = true;
  updateCreateModeUI();
}

function updateCreateModeUI() {
  const form = $('#post-form');
  if (!form) return;
  const kind = new FormData(form).get('postKind') === 'story' ? 'story' : 'post';
  form.dataset.kind = kind;
  const textarea = $('[name="content"]', form);
  const publish = $('#publish-submit', form) || $('button[type="submit"]', form);
  if (textarea) textarea.placeholder = kind === 'story'
    ? 'Write a short story caption...'
    : 'Share something with your circle...';
  if (publish) publish.textContent = kind === 'story' ? 'Publish story' : 'Publish post';
}

async function handleCreatePost(event) {
  event.preventDefault();
  if (!state.profile) return;

  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const data = Object.fromEntries(new FormData(form));
  const file = data.mediaFile;

  const mediaLabel = file?.type?.startsWith('video/') ? 'video' : 'image';
  setButtonLoading(button, true, file?.size ? `Preparing ${mediaLabel}...` : 'Publishing...');

  try {
    if (ensureNotBanned()) return;
    const moderation = scanContent(data.content);
    if (moderation.flagged) {
      await handleBlockedContent('post', data.content, moderation);
      return;
    }

    const media = file?.size ? await uploadPostMedia(file, state.profile.uid) : null;
    setButtonLoading(button, true, data.postKind === 'story' ? 'Publishing story...' : 'Publishing...');
    await createPost(state.profile, data.content, media, {
      postKind: data.postKind || 'post',
      videoMuted: data.videoMuted === 'on',
      videoLoop: data.videoLoop === 'on'
    });
    form.reset();
    clearMediaPreview();
    $('#post-count').textContent = '0 / 800';
    showToast(data.postKind === 'story' ? 'Story published.' : 'Post published.');
    if (data.postKind === 'story') switchView('feed');
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
      renderVideoFeed();
      renderConversations();
      renderProfilePanel();
      renderPosts();
    })
  );

  state.unsubscribers.push(
    listenToPosts((posts) => {
      state.posts = posts;
      renderPosts();
      renderVideoFeed();
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
      renderVideoFeed();
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
      renderVideoFeed();
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
      renderVideoFeed();
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

function handleSettingsNav(event) {
  const button = event.target.closest('[data-settings-tab]');
  if (!button) return;
  const target = button.dataset.settingsTab;
  $$('.settings-tab').forEach((item) => item.classList.toggle('active', item.dataset.settingsTab === target));
  $$('.settings-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.settingsPanel === target));
}

async function handlePasswordChange(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const data = Object.fromEntries(new FormData(form));

  if (!data.newPassword || String(data.newPassword).length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  if (data.newPassword !== data.confirmPassword) {
    showToast('Both password fields must match.', 'error');
    return;
  }

  setButtonLoading(button, true, 'Updating...');

  try {
    await changeCurrentUserPassword(data.newPassword);
    form.reset();
    showToast('Password changed.');
  } catch (error) {
    showToast(`${friendlyError(error)} If Firebase asks for recent login, use the reset email button below.`, 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function handlePasswordResetEmail() {
  const email = state.profile?.email || state.authUser?.email;
  if (!email) {
    showToast('No email found for this account.', 'error');
    return;
  }

  try {
    await sendResetPasswordEmail(email);
    showToast(`Password reset email sent to ${email}.`);
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


function openMediaStudio() {
  if (!views.mediaStudioModal) return;
  $('#studio-muted').checked = Boolean($('[name="videoMuted"]', $('#post-form'))?.checked);
  $('#studio-loop').checked = Boolean($('[name="videoLoop"]', $('#post-form'))?.checked);
  views.mediaStudioModal.classList.remove('hidden');
}

function closeMediaStudio() {
  views.mediaStudioModal?.classList.add('hidden');
}

function renderStoriesTray() {
  if (!views.storiesTray || !state.profile) return;
  const storyPosts = state.posts
    .filter((post) => post.postKind === 'story' && post.authorId && !state.blocked.has(post.authorId))
    .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));

  const stories = storyPosts.slice(0, 18);

  if (!stories.length) {
    views.storiesTray.innerHTML = '<span class="soft-note story-empty-note">Stories from your circle will appear here.</span>';
    return;
  }

  const storyCountByUser = storyPosts.reduce((map, story) => {
    map.set(story.authorId, (map.get(story.authorId) || 0) + 1);
    return map;
  }, new Map());

  views.storiesTray.innerHTML = stories.map((story) => {
    const user = findUser(story.authorId) || {
      uid: story.authorId,
      displayName: story.authorName,
      username: story.authorUsername,
      avatarUrl: story.authorAvatarUrl
    };
    const count = storyCountByUser.get(story.authorId) || 1;
    const label = user.uid === state.profile.uid ? 'Your story' : user.username || 'story';
    return `
      <button class="story-chip" type="button" data-story-profile="${escapeHTML(user.uid)}" data-story-id="${escapeHTML(story.id)}">
        <span class="story-ring">${avatarTemplate(user)}${count > 1 ? `<em>${formatCount(count)}</em>` : ''}</span>
        <small>${escapeHTML(label)}</small>
      </button>
    `;
  }).join('');

  $$('[data-story-profile]', views.storiesTray).forEach((button) => {
    button.addEventListener('click', () => openStoryViewer(button.dataset.storyProfile, button.dataset.storyId));
  });
}

function toTime(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return new Date(value).getTime() || 0;
}

function openStoryViewer(uid, selectedStoryId = '') {
  if (!views.storyModal || !views.storyViewerBody) return;
  const stories = state.posts
    .filter((post) => post.postKind === 'story' && post.authorId === uid && !state.blocked.has(post.authorId))
    .sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));

  if (!stories.length) return;

  const index = Math.max(0, stories.findIndex((story) => story.id === selectedStoryId));
  state.storyViewer = { uid, stories, index: index === -1 ? stories.length - 1 : index };
  views.storyModal.classList.remove('hidden');
  renderActiveStory();
}

function renderActiveStory() {
  if (!views.storyViewerBody || !state.storyViewer?.stories?.length) return;
  const { uid, stories, index } = state.storyViewer;
  const story = stories[index] || stories[0];
  const user = findUser(uid) || { displayName: story.authorName, username: story.authorUsername, avatarUrl: story.authorAvatarUrl };
  views.storyViewerTitle.textContent = `${user.displayName || user.username || 'Story'} ${stories.length > 1 ? `${index + 1}/${stories.length}` : ''}`;
  const media = story.mediaUrl
    ? (story.mediaType === 'video'
      ? `<div class="video-shell story-video"><video src="${escapeHTML(story.mediaUrl)}" playsinline autoplay muted loop preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture oncontextmenu="return false"></video></div>`
      : `<img src="${escapeHTML(story.mediaUrl)}" alt="Story media" />`)
    : '';
  views.storyViewerBody.innerHTML = `
    <div class="story-progress-row">
      ${stories.map((_, progressIndex) => `<span class="${progressIndex === index ? 'active' : ''}"></span>`).join('')}
    </div>
    <div class="story-viewer-user">
      ${avatarTemplate(user)}
      <span><strong>${escapeHTML(user.displayName || 'User')}</strong><small>@${escapeHTML(user.username || 'user')} · ${escapeHTML(timeAgo(story.createdAt))}</small></span>
    </div>
    ${media}
    ${story.content ? `<p class="story-caption">${escapeHTML(story.content)}</p>` : ''}
    ${stories.length > 1 ? `
      <div class="story-nav-actions">
        <button class="ghost-btn" type="button" data-story-prev ${index <= 0 ? 'disabled' : ''}>Previous</button>
        <button class="primary-btn" type="button" data-story-next ${index >= stories.length - 1 ? 'disabled' : ''}>Next</button>
      </div>
    ` : ''}
  `;

  $('[data-story-prev]', views.storyViewerBody)?.addEventListener('click', () => {
    if (state.storyViewer.index > 0) {
      state.storyViewer.index -= 1;
      renderActiveStory();
    }
  });

  $('[data-story-next]', views.storyViewerBody)?.addEventListener('click', () => {
    if (state.storyViewer.index < state.storyViewer.stories.length - 1) {
      state.storyViewer.index += 1;
      renderActiveStory();
    }
  });
}

function closeStoryViewer() {
  views.storyModal?.classList.add('hidden');
  state.storyViewer = null;
  if (views.storyViewerBody) views.storyViewerBody.innerHTML = '';
}

function renderRightRail() {
  if (!views.rightRail || !state.profile) return;
  const suggestions = getSuggestedFollowUsers(5);

  views.rightRail.innerHTML = `
    <section class="rail-profile-card">
      ${avatarTemplate(state.profile)}
      <div>
        <strong>${escapeHTML(state.profile.displayName || 'User')}</strong>
        <span>@${escapeHTML(state.profile.username || 'user')}</span>
      </div>
      <button type="button" data-rail-profile>Profile</button>
    </section>
    <section class="rail-card">
      <div class="rail-card-head"><strong>Suggested for you</strong><span>Follow more people</span></div>
      ${suggestions.length ? suggestions.map((user) => `
        <article class="rail-user-row">
          <button class="rail-user-info" type="button" data-rail-open-user="${escapeHTML(user.uid)}">
            ${avatarTemplate(user)}
            <span><strong>${escapeHTML(user.displayName || 'User')}</strong><small>@${escapeHTML(user.username || 'user')}</small></span>
          </button>
          <button class="rail-follow" type="button" data-rail-follow="${escapeHTML(user.uid)}">Follow</button>
        </article>
      `).join('') : '<p class="soft-note">No suggestions yet.</p>'}
    </section>
  `;

  $('[data-rail-profile]', views.rightRail)?.addEventListener('click', () => openUserProfile(state.profile.uid));
  $$('[data-rail-open-user]', views.rightRail).forEach((button) => button.addEventListener('click', () => openUserProfile(button.dataset.railOpenUser)));
  $$('[data-rail-follow]', views.rightRail).forEach((button) => button.addEventListener('click', () => toggleFollow(findUser(button.dataset.railFollow))));
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

  const profileNavIcon = document.querySelector('.nav-profile .nav-icon');
  if (profileNavIcon) {
    profileNavIcon.classList.add('profile-nav-avatar-slot');
    profileNavIcon.innerHTML = avatarTemplate(state.profile, 'tiny');
  }

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
  if (!document.querySelector('.settings-panel.active')) {
    $('[data-settings-tab="profile"]')?.classList.add('active');
    $('[data-settings-panel="profile"]')?.classList.add('active');
  }

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
      ${isMe ? `<button class="profile-settings-fab" type="button" data-view-target="settings" title="Settings" aria-label="Open settings">${uiIcon('settings')}</button><button class="cover-change-btn" type="button" data-cover-pick>Change cover</button>` : ''}
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
  renderStoriesTray();
  renderRightRail();

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
      body: 'Your feed shows people you follow and your own posts, so everything stays personal and easy to follow.',
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


function getLivePostAuthor(post = {}) {
  const liveUser = findUser(post.authorId) || {};
  return {
    uid: post.authorId,
    displayName: liveUser.displayName || post.authorName || 'User',
    username: liveUser.username || post.authorUsername || 'user',
    avatarUrl: liveUser.avatarUrl || post.authorAvatarUrl || '',
    coverUrl: liveUser.coverUrl || ''
  };
}

function postTemplate(post) {
  const uid = state.profile?.uid;
  const author = getLivePostAuthor(post);
  const canDelete = uid === post.authorId;
  const liked = post.likedBy.includes(uid);
  const saved = post.savedBy.includes(uid);
  const commentsOpen = state.openComments.has(post.id);
  const media = mediaTemplate(post);
  const feedBadge = post.feedReason
    ? `<span class="feed-reason-badge ${'own'}">${escapeHTML(post.feedReason)}</span>`
    : '';

  return `
    <article class="post-card" data-post-id="${escapeHTML(post.id)}">
      ${feedBadge}
      <header class="post-header">
        <button class="post-author as-button" type="button" data-open-profile="${escapeHTML(post.authorId)}">
          ${avatarTemplate(author)}
          <div class="post-meta">
            <strong>${escapeHTML(author.displayName || 'User')}</strong>
            <span>@${escapeHTML(author.username || 'user')} · ${escapeHTML(timeAgo(post.createdAt))}</span>
          </div>
        </button>
        ${canDelete ? `
          <div class="post-more-wrap">
            <button class="icon-btn post-more-btn" type="button" data-post-menu-toggle title="Post options" aria-label="Post options">${uiIcon('more')}</button>
            <div class="post-more-menu">
              <button class="danger" type="button" data-delete-post>Delete post</button>
            </div>
          </div>` : ''}
      </header>
      ${post.content ? `<p class="post-content">${escapeHTML(post.content)}</p>` : ''}
      ${media}
      <footer class="post-actions">
        <button class="action-btn ${liked ? 'active' : ''}" type="button" data-like-post>${uiIcon(liked ? 'heartFilled' : 'heart')} <span>${formatCount(post.likeCount)}</span></button>
        <button class="action-btn" type="button" data-view-likes>Liked by <span>${formatCount(post.likeCount)}</span></button>
        <button class="action-btn" type="button" data-toggle-comments>${uiIcon('comment')} <span>${formatCount(post.commentCount)}</span></button>
        <button class="action-btn ${saved ? 'active' : ''}" type="button" data-save-post>${uiIcon(saved ? 'bookmarkFilled' : 'bookmark')} <span>${saved ? 'Saved' : 'Save'}</span></button>
        <button class="action-btn" type="button" data-share-post>${uiIcon('share')} <span>${post.shareCount ? formatCount(post.shareCount) : 'Share'}</span></button>
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
    const muted = post.videoMuted ? 'muted' : '';
    const loop = post.videoLoop ? 'loop' : '';
    return `<div class="video-shell" data-video-shell>
      <video class="post-media" src="${escapeHTML(post.mediaUrl)}" ${muted} ${loop} playsinline preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture oncontextmenu="return false"></video>
      <button class="video-play-btn" type="button" data-video-toggle>▶</button>
      <button class="video-mute-btn" type="button" data-video-mute>${post.videoMuted ? '🔇' : '🔊'}</button>
    </div>`;
  }
  return `<img class="post-media" src="${escapeHTML(post.mediaUrl)}" alt="Post media" loading="lazy" />`;
}

function bindPostActions(container) {
  $$('[data-open-profile]', container).forEach((button) => {
    button.addEventListener('click', () => openUserProfile(button.dataset.openProfile));
  });

  $$('[data-video-toggle]', container).forEach((button) => {
    button.addEventListener('click', () => {
      const video = button.closest('[data-video-shell]')?.querySelector('video');
      if (!video) return;
      if (video.paused) {
        video.play().catch(() => {});
        button.textContent = 'Ⅱ';
      } else {
        video.pause();
        button.textContent = '▶';
      }
    });
  });

  $$('[data-video-mute]', container).forEach((button) => {
    button.addEventListener('click', () => {
      const video = button.closest('[data-video-shell]')?.querySelector('video');
      if (!video) return;
      video.muted = !video.muted;
      button.textContent = video.muted ? '🔇' : '🔊';
    });
  });

  $$('[data-post-menu-toggle]', container).forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const wrap = button.closest('.post-more-wrap');
      $$('.post-more-wrap.open').forEach((item) => { if (item !== wrap) item.classList.remove('open'); });
      wrap?.classList.toggle('open');
    });
  });

  document.addEventListener('click', () => {
    $$('.post-more-wrap.open').forEach((item) => item.classList.remove('open'));
    $$('.message-more-wrap.open').forEach((item) => item.classList.remove('open'));
    $$('.chat-more-wrap.open').forEach((item) => item.classList.remove('open'));
  }, { once: true });

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
      if (form.dataset.submitting === 'true') return;
      form.dataset.submitting = 'true';
      const post = getPostFromButton(form);
      const input = $('[name="comment"]', form);
      const submitButton = $('button[type="submit"]', form);
      try {
        if (ensureNotBanned()) return;
        const text = input.value.trim();
        if (!text) return;
        setButtonLoading(submitButton, true, 'Posting...');
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
      } finally {
        form.dataset.submitting = 'false';
        setButtonLoading(submitButton, false);
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

function isMediaPost(post = {}) {
  return Boolean(post.mediaUrl) && (post.mediaType === 'image' || post.mediaType === 'video') && post.postKind !== 'story';
}

function getExploreMediaPosts(term = '') {
  const query = term.trim().toLowerCase();
  return state.posts
    .filter((post) => isMediaPost(post))
    .filter((post) => post.authorId && !state.blocked.has(post.authorId))
    .filter((post) => {
      if (!query) return true;
      const author = getLivePostAuthor(post);
      const haystack = `${post.content || ''} ${author.displayName || ''} ${author.username || ''}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => getViralScore(b) - getViralScore(a) || getPostAgeHours(a) - getPostAgeHours(b))
    .slice(0, 60);
}

function renderVideoFeed() {
  if (!views.videoFeedList || !state.profile) return;

  const videos = state.posts
    .filter((post) => post.mediaType === 'video' && post.mediaUrl && post.postKind !== 'story')
    .filter((post) => post.authorId && !state.blocked.has(post.authorId))
    .sort((a, b) => getViralScore(b) - getViralScore(a) || getPostAgeHours(a) - getPostAgeHours(b))
    .slice(0, 40);

  if (!videos.length) {
    views.videoFeedList.innerHTML = emptyState('No videos yet', 'Video posts from Pixora users will appear here. Create a video post to start this feed.');
    return;
  }

  views.videoFeedList.innerHTML = videos.map((post) => videoReelTemplate(post)).join('');
  bindPostActions(views.videoFeedList);

  $$('[data-video-open-post]', views.videoFeedList).forEach((button) => {
    button.addEventListener('click', () => {
      const post = getPostFromButton(button);
      if (!post) return;
      state.openComments.add(post.id);
      openUserProfile(post.authorId);
      setTimeout(() => {
        document.querySelector(`[data-post-id="${cssEscape(post.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 160);
    });
  });
}

function videoReelTemplate(post) {
  const uid = state.profile?.uid;
  const author = getLivePostAuthor(post);
  const liked = post.likedBy.includes(uid);
  const saved = post.savedBy.includes(uid);
  const canDelete = uid === post.authorId;

  return `
    <article class="video-reel-card post-card" data-post-id="${escapeHTML(post.id)}">
      <div class="video-reel-media" data-video-shell>
        <video src="${escapeHTML(post.mediaUrl)}" playsinline preload="metadata" loop controlslist="nodownload noplaybackrate" disablepictureinpicture oncontextmenu="return false"></video>
        <button class="video-play-btn" type="button" data-video-toggle aria-label="Play video">▶</button>
        <button class="video-mute-btn" type="button" data-video-mute aria-label="Mute video">🔇</button>
      </div>
      <div class="video-reel-caption">
        <button class="post-author as-button" type="button" data-open-profile="${escapeHTML(post.authorId)}">
          ${avatarTemplate(author)}
          <div class="post-meta">
            <strong>${escapeHTML(author.displayName || 'User')}</strong>
            <span>@${escapeHTML(author.username || 'user')} · ${escapeHTML(timeAgo(post.createdAt))}</span>
          </div>
        </button>
        ${post.content ? `<p>${escapeHTML(post.content)}</p>` : ''}
      </div>
      <aside class="video-reel-actions">
        <button class="reel-action ${liked ? 'active' : ''}" type="button" data-like-post title="Like">${uiIcon(liked ? 'heartFilled' : 'heart')}<span>${formatCount(post.likeCount)}</span></button>
        <button class="reel-action" type="button" data-video-open-post title="Comments">${uiIcon('comment')}<span>${formatCount(post.commentCount)}</span></button>
        <button class="reel-action ${saved ? 'active' : ''}" type="button" data-save-post title="Save">${uiIcon(saved ? 'bookmarkFilled' : 'bookmark')}<span>${saved ? 'Saved' : 'Save'}</span></button>
        <button class="reel-action" type="button" data-share-post title="Share">${uiIcon('share')}<span>${post.shareCount ? formatCount(post.shareCount) : 'Share'}</span></button>
        ${canDelete ? `<div class="post-more-wrap reel-more"><button class="reel-action" type="button" data-post-menu-toggle title="More">${uiIcon('more')}</button><div class="post-more-menu"><button class="danger" type="button" data-delete-post>Delete post</button></div></div>` : ''}
      </aside>
    </article>
  `;
}

function renderPeople() {
  if (!state.profile || !views.peopleList) return;
  renderRightRail();

  const term = views.peopleSearch?.value?.trim().toLowerCase() || '';
  const mediaPosts = getExploreMediaPosts(term);
  const matchingUsers = term
    ? state.users
      .filter((user) => user.uid && user.uid !== state.profile.uid && !state.blocked.has(user.uid))
      .filter((user) => `${user.displayName || ''} ${user.username || ''}`.toLowerCase().includes(term))
      .slice(0, 8)
    : [];

  const userResults = matchingUsers.length ? `
    <section class="explore-user-results">
      <div class="explore-section-title"><strong>People</strong><span>Search results</span></div>
      <div class="explore-user-list">
        ${matchingUsers.map((user) => {
          const following = state.following.has(user.uid);
          return `
            <article class="explore-user-card">
              <button class="explore-user-info" type="button" data-explore-user="${escapeHTML(user.uid)}">
                ${avatarTemplate(user)}
                <span><strong>${escapeHTML(user.displayName || 'User')}</strong><small>@${escapeHTML(user.username || 'user')}</small></span>
              </button>
              <button class="rail-follow" type="button" data-explore-follow="${escapeHTML(user.uid)}">${following ? 'Following' : 'Follow'}</button>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  ` : '';

  if (!mediaPosts.length && !matchingUsers.length) {
    views.peopleList.innerHTML = emptyState('Nothing found', 'Try another name, username, or caption. Only media posts appear in Explore.');
    return;
  }

  const grid = mediaPosts.length ? `
    <section class="explore-media-section">
      <div class="explore-section-title"><strong>Media posts</strong><span>Photos and videos from across Pixora</span></div>
      <div class="explore-media-grid">
        ${mediaPosts.map((post) => {
          const author = getLivePostAuthor(post);
          const media = post.mediaType === 'video'
            ? `<video src="${escapeHTML(post.mediaUrl)}" muted playsinline preload="metadata" oncontextmenu="return false"></video><span class="tile-type-badge">▶</span>`
            : `<img src="${escapeHTML(post.mediaUrl)}" alt="Post media" loading="lazy" />`;

          return `
            <button class="discover-post-tile" type="button" data-discover-post="${escapeHTML(post.id)}" data-discover-author="${escapeHTML(post.authorId)}">
              ${media}
              <span class="discover-post-overlay">
                <strong>@${escapeHTML(author.username || 'user')}</strong>
                <small>♡ ${formatCount(post.likeCount)} · 💬 ${formatCount(post.commentCount)}</small>
              </span>
            </button>
          `;
        }).join('')}
      </div>
    </section>
  ` : '';

  views.peopleList.innerHTML = `${userResults}${grid}`;

  $$('[data-explore-user]', views.peopleList).forEach((button) => button.addEventListener('click', () => openUserProfile(button.dataset.exploreUser)));
  $$('[data-explore-follow]', views.peopleList).forEach((button) => {
    button.addEventListener('click', () => toggleFollow(findUser(button.dataset.exploreFollow)));
  });
  $$('[data-discover-post]', views.peopleList).forEach((button) => {
    button.addEventListener('click', () => {
      const authorId = button.dataset.discoverAuthor;
      openUserProfile(authorId);
      setTimeout(() => document.querySelector(`[data-post-id="${cssEscape(button.dataset.discoverPost)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);
    });
  });
}

function conversationPreviewText(conversation = {}) {
  const preview = String(conversation.lastMessage || '').trim();
  if (!preview) return 'No messages yet';
  if (preview.toLowerCase().includes('encrypted message')) return 'Open chat to view the latest message';
  return preview.length > 54 ? `${preview.slice(0, 54)}...` : preview;
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
          <span>${escapeHTML(conversationPreviewText(conversation))}</span>
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
      <button class="chat-call-btn" type="button" data-audio-call title="Audio call" aria-label="Audio call">${uiIcon('phone')}</button>
      <button class="chat-call-btn primary-call" type="button" data-video-call title="Video call" aria-label="Video call">${uiIcon('video')}</button>
      <div class="chat-more-wrap">
        <button class="chat-call-btn" type="button" data-chat-menu-toggle title="Conversation options" aria-label="Conversation options">${uiIcon('more')}</button>
        <div class="chat-more-menu">
          <button class="danger" type="button" data-clear-chat>Delete chat</button>
        </div>
      </div>
    </div>
  `;
  $('[data-chat-profile]', views.chatHeader)?.addEventListener('click', () => openUserProfile(otherUser.uid));
  $('[data-chat-menu-toggle]', views.chatHeader)?.addEventListener('click', (event) => {
    event.stopPropagation();
    views.chatHeader.querySelector('.chat-more-wrap')?.classList.toggle('open');
  });

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

  $$('[data-message-menu-toggle]', views.messagesList).forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const wrap = button.closest('.message-more-wrap');
      $$('.message-more-wrap.open', views.messagesList).forEach((item) => { if (item !== wrap) item.classList.remove('open'); });
      wrap?.classList.toggle('open');
    });
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
      ${mine ? `
        <div class="message-more-wrap">
          <button class="message-more-btn" type="button" data-message-menu-toggle title="Message options" aria-label="Message options">⋯</button>
          <div class="message-more-menu">
            <button class="danger" type="button" data-unsend-message="${escapeHTML(message.id)}">Delete for everyone</button>
          </div>
        </div>` : ''}
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
    views.mediaPreview.innerHTML = `<div class="video-shell preview-video"><video src="${url}" playsinline muted preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture oncontextmenu="return false"></video><button class="video-play-btn" type="button" onclick="const v=this.parentElement.querySelector('video'); if(v.paused){v.play();this.textContent='Ⅱ'}else{v.pause();this.textContent='▶'}">▶</button></div><button type="button" data-clear-media>×</button>`;
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
