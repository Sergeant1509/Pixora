import { deleteCurrentUserAccount, listenToAuth, logoutUser } from './services/auth.service.js';
import { getUserById, listenToUser, listenToUsers, updateUserProfile } from './services/user.service.js';
import {
  addComment,
  createPost,
  deletePost,
  increaseShareCount,
  listenToComments,
  listenToPosts,
  toggleLike,
  toggleSave
} from './services/post.service.js';
import { followUser, getFollowStats, listenToFollowers, listenToFollowing, listenToFollowStats, unfollowUser } from './services/social.service.js';
import { listenToConversations, listenToMessages, openConversation, sendMessage } from './services/chat.service.js';
import { cropImageFileToDataUrl, uploadAvatar, uploadMessageImage, uploadPostMedia } from './services/storage.service.js';
import { $, $$, avatarTemplate, emptyState, escapeHTML, setButtonLoading } from './utils/dom.js';
import { timeAgo } from './utils/time.js';
import { friendlyError, showToast } from './ui/toast.js';

const emojiSet = ['😀', '😂', '😍', '🔥', '❤️', '👏', '✨', '😭', '😎', '🙏', '💯', '🎉', '😊', '🤝', '🌟', '💬'];
const giphyKey = import.meta.env.VITE_GIPHY_API_KEY || '';

const state = {
  authUser: null,
  profile: null,
  users: [],
  profileCache: new Map(),
  posts: [],
  following: new Set(),
  followers: new Set(),
  conversations: [],
  activeConversationId: null,
  activeChatUser: null,
  viewingProfileUid: null,
  viewingStats: { uid: '', followers: 0, following: 0 },
  currentSharePost: null,
  crop: { file: null, rotation: 0, zoom: 1, offsetX: 0, offsetY: 0 },
  openComments: new Set(),
  commentUnsubscribers: new Map(),
  unsubscribers: [],
  unsubscribeMessages: null,
  unsubscribeProfileStats: null,
  linkScrolled: false
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
  avatarFile: $('#avatar-file'),
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
  copyPostLink: $('#copy-post-link')
};

boot();

function boot() {
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

  $('[name="content"]', $('#post-form'))?.addEventListener('input', (event) => {
    $('#post-count').textContent = `${event.target.value.length} / 800`;
  });

  views.postMediaInput?.addEventListener('change', renderSelectedMediaPreview);
  views.peopleSearch?.addEventListener('input', renderPeople);
  views.avatarFile?.addEventListener('change', openCropperForAvatar);
  views.cropZoom?.addEventListener('input', updateCropPreview);
  views.cropX?.addEventListener('input', updateCropPreview);
  views.cropY?.addEventListener('input', updateCropPreview);
  views.cropRotate?.addEventListener('click', rotateCrop);
  views.saveCrop?.addEventListener('click', saveCroppedAvatar);
  $$('[data-close-crop]').forEach((button) => button.addEventListener('click', closeCropModal));
  $$('[data-close-share]').forEach((button) => button.addEventListener('click', closeShareModal));
  views.copyPostLink?.addEventListener('click', copyShareLink);

  $('#emoji-toggle')?.addEventListener('click', () => toggleChatTools('emoji'));
  $('#gif-toggle')?.addEventListener('click', () => toggleChatTools('gif'));
}

function switchView(target) {
  const labels = {
    feed: ['Welcome back', 'Feed'],
    discover: ['People', 'Discover'],
    messages: ['Inbox', 'Messages'],
    profile: ['Profile', 'Profile'],
    settings: ['Account', 'Settings']
  };

  $$('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.viewTarget === target));
  $$('.view').forEach((view) => view.classList.toggle('active', view.dataset.view === target));
  views.topbarKicker.textContent = labels[target]?.[0] || 'Pixora';
  views.topbarTitle.textContent = labels[target]?.[1] || 'Pixora';

  if (target === 'settings') renderSettingsPanel();
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
      state.profileCache.set(profile.uid, profile);
      if (!state.viewingProfileUid) state.viewingProfileUid = profile.uid;
      renderCurrentUser();
      renderSettingsPanel();
      renderPeople();
      renderConversations();
      renderProfilePanel();
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
    })
  );

  state.unsubscribers.push(
    listenToFollowing(uid, (following) => {
      state.following = following;
      if (state.viewingProfileUid === uid) state.viewingStats = { uid, followers: state.followers.size, following: following.size };
      renderPeople();
      renderProfilePanel();
      renderSettingsPanel();
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
}

function cleanupRealtimeListeners() {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  state.unsubscribers = [];
  if (state.unsubscribeMessages) state.unsubscribeMessages();
  state.unsubscribeMessages = null;
  if (state.unsubscribeProfileStats) state.unsubscribeProfileStats();
  state.unsubscribeProfileStats = null;
  state.commentUnsubscribers.forEach((unsubscribe) => unsubscribe?.());
  state.commentUnsubscribers.clear();
  state.openComments.clear();
  state.profile = null;
  state.users = [];
  state.profileCache.clear();
  state.posts = [];
  state.following = new Set();
  state.followers = new Set();
  state.conversations = [];
  state.activeConversationId = null;
  state.activeChatUser = null;
}

function showApp() {
  views.appShell.classList.remove('hidden');
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
  renderAvatarInto(views.settingsAvatarPreview, { ...state.profile, avatarUrl: form.avatarUrl.value || state.profile.avatarUrl }, 'xl');

  const savedPosts = state.posts.filter((post) => post.savedBy.includes(state.profile.uid));
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
  const userPosts = state.posts.filter((post) => post.authorId === user.uid);
  const stats = isMe
    ? { followers: state.followers.size, following: state.following.size }
    : (state.viewingStats.uid === user.uid ? state.viewingStats : { followers: user.followersCount || 0, following: user.followingCount || 0 });

  views.profileHero.innerHTML = `
    <div class="profile-cover"></div>
    <div class="profile-identity">
      ${avatarTemplate(user, 'xl')}
      <div class="profile-copy">
        <span class="muted-label">${isMe ? 'Your profile' : 'Profile'}</span>
        <h2>${escapeHTML(user.displayName || 'User')}</h2>
        <p>@${escapeHTML(user.username || 'user')}</p>
        <p class="profile-bio-preview">${escapeHTML(user.bio || 'No bio yet.')}</p>
      </div>
      <div class="profile-actions">
        ${isMe ? `
          <button class="ghost-btn" type="button" data-avatar-pick>Change photo</button>
          <button class="primary-btn" type="button" data-view-target="settings">Edit profile</button>
        ` : `
          <button class="${isFollowing ? 'ghost-btn' : 'primary-btn'}" type="button" data-profile-follow>${isFollowing ? 'Following' : 'Follow'}</button>
          <button class="ghost-btn" type="button" data-profile-message>Message</button>
        `}
      </div>
    </div>
    <div class="profile-stats">
      <div><strong>${userPosts.length}</strong><span>Posts</span></div>
      <div><strong>${stats.followers || 0}</strong><span>Followers</span></div>
      <div><strong>${stats.following || 0}</strong><span>Following</span></div>
    </div>
  `;

  views.profilePostsKicker.textContent = isMe ? 'Timeline' : `@${user.username}`;
  views.profilePostsTitle.textContent = isMe ? 'Your posts' : 'Posts';

  renderPostsInto(views.profilePostsList, userPosts, {
    emptyTitle: 'No posts yet',
    emptyBody: isMe ? 'Your posts will appear here after you publish them.' : 'This profile has not posted yet.'
  });

  $('[data-view-target="settings"]', views.profileHero)?.addEventListener('click', () => switchView('settings'));
  $('[data-avatar-pick]', views.profileHero)?.addEventListener('click', () => views.avatarFile?.click());
  $('[data-profile-follow]', views.profileHero)?.addEventListener('click', () => toggleFollow(user));
  $('[data-profile-message]', views.profileHero)?.addEventListener('click', () => startChat(user));
}

function renderPosts() {
  renderPostsInto(views.postsList, state.posts, {
    emptyTitle: 'No posts yet',
    emptyBody: 'Create the first post and it will appear globally for every account.'
  });
}

function renderPostsInto(container, posts, options = {}) {
  if (!container) return;

  if (!posts.length) {
    container.innerHTML = emptyState(options.emptyTitle || 'No posts yet', options.emptyBody || 'Posts will appear here.');
    return;
  }

  container.innerHTML = posts.map((post) => postTemplate(post)).join('');
  bindPostActions(container);

  state.openComments.forEach((postId) => {
    if (container.querySelector(`[data-post-id="${cssEscape(postId)}"]`)) attachCommentListener(postId);
  });
}

function postTemplate(post) {
  const uid = state.profile?.uid;
  const canDelete = uid === post.authorId;
  const liked = post.likedBy.includes(uid);
  const saved = post.savedBy.includes(uid);
  const commentsOpen = state.openComments.has(post.id);
  const media = mediaTemplate(post);

  return `
    <article class="post-card" data-post-id="${escapeHTML(post.id)}">
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
        <button class="action-btn ${liked ? 'active' : ''}" type="button" data-like-post>${liked ? '♥' : '♡'} <span>${post.likeCount}</span></button>
        <button class="action-btn" type="button" data-toggle-comments>💬 <span>${post.commentCount}</span></button>
        <button class="action-btn ${saved ? 'active' : ''}" type="button" data-save-post>🔖 <span>${saved ? 'Saved' : 'Save'}</span></button>
        <button class="action-btn" type="button" data-share-post>↗ <span>${post.shareCount || 'Share'}</span></button>
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
      try {
        await toggleLike(post, state.profile.uid);
      } catch (error) {
        showToast(friendlyError(error), 'error');
      }
    });
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
        await addComment(post.id, state.profile, input.value);
        form.reset();
      } catch (error) {
        showToast(friendlyError(error), 'error');
      }
    });
  });
}

function attachCommentListener(postId) {
  if (state.commentUnsubscribers.has(postId)) return;

  const unsubscribe = listenToComments(postId, (comments) => {
    const targets = $$(`[data-comments-list="${cssEscape(postId)}"]`);
    const markup = comments.length
      ? comments.map((comment) => `
        <div class="comment-item">
          ${avatarTemplate({ displayName: comment.authorName, username: comment.authorUsername, avatarUrl: comment.authorAvatarUrl }, 'tiny')}
          <div>
            <strong>${escapeHTML(comment.authorName)}</strong>
            <span>${escapeHTML(comment.text)}</span>
          </div>
        </div>
      `).join('')
      : '<div class="empty-comments">No comments yet. Be first.</div>';

    targets.forEach((target) => {
      target.innerHTML = markup;
    });
  });

  state.commentUnsubscribers.set(postId, unsubscribe);
}

function renderPeople() {
  if (!state.profile) return;

  const term = views.peopleSearch?.value?.trim().toLowerCase() || '';
  const users = state.users.filter((user) => {
    const haystack = `${user.displayName || ''} ${user.username || ''}`.toLowerCase();
    return haystack.includes(term);
  });

  if (!users.length) {
    views.peopleList.innerHTML = emptyState('No people found', 'When more users join, they will appear here.');
    return;
  }

  views.peopleList.innerHTML = users.map((user) => {
    const isFollowing = state.following.has(user.uid);
    return `
      <article class="person-card" data-user-id="${escapeHTML(user.uid)}">
        <button class="person-card-header as-button" type="button" data-view-user>
          ${avatarTemplate(user)}
          <div class="person-meta">
            <strong>${escapeHTML(user.displayName || 'User')}</strong>
            <span>@${escapeHTML(user.username || 'user')}</span>
          </div>
        </button>
        <p class="person-bio">${escapeHTML(user.bio || 'No bio yet.')}</p>
        <div class="person-actions">
          <button class="${isFollowing ? 'ghost-btn' : 'primary-btn'}" type="button" data-follow-action>${isFollowing ? 'Unfollow' : 'Follow'}</button>
          <button class="ghost-btn" type="button" data-message-action>Message</button>
        </div>
      </article>
    `;
  }).join('');

  $$('[data-view-user]', views.peopleList).forEach((button) => {
    button.addEventListener('click', () => openUserProfile(button.closest('[data-user-id]').dataset.userId));
  });

  $$('[data-follow-action]', views.peopleList).forEach((button) => {
    button.addEventListener('click', () => toggleFollow(findUser(button.closest('[data-user-id]').dataset.userId)));
  });

  $$('[data-message-action]', views.peopleList).forEach((button) => {
    button.addEventListener('click', () => startChat(findUser(button.closest('[data-user-id]').dataset.userId)));
  });
}

function renderConversations() {
  if (!state.profile) return;

  const realConversations = state.conversations.filter((conversation) => Boolean(conversation.lastMessage));
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
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

async function startChat(user) {
  if (!user || !state.profile) return;

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
        <span>@${escapeHTML(otherUser.username || 'user')}</span>
      </div>
    </button>
  `;
  $('[data-chat-profile]', views.chatHeader)?.addEventListener('click', () => openUserProfile(otherUser.uid));

  renderConversations();
  hideChatTools();

  if (state.unsubscribeMessages) state.unsubscribeMessages();
  state.unsubscribeMessages = listenToMessages(conversationId, renderMessages);
}

function renderMessages(messages) {
  if (!messages.length) {
    views.messagesList.innerHTML = emptyState('No messages yet', 'Send the first message to start this chat.');
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
  views.messagesList.scrollTop = views.messagesList.scrollHeight;
}

function messageTemplate(message) {
  const mine = message.senderId === state.profile?.uid;
  const content = [];
  if (message.text) content.push(`<div>${escapeHTML(message.text)}</div>`);
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
    <div class="message-bubble ${mine ? 'mine' : ''}">
      ${content.join('')}
      <small>${escapeHTML(timeAgo(message.createdAt))}</small>
    </div>
  `;
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
    <div id="gif-results" class="gif-results">
      <span class="soft-note">Type a word like happy, love, teddy, funny...</span>
    </div>
  `;

  const input = $('#gif-search', views.chatTools);
  const button = $('#gif-search-btn', views.chatTools);

  button?.addEventListener('click', () => {
    loadGifs(input.value);
  });

  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      loadGifs(input.value);
    }
  });

  let gifTimer;
  input?.addEventListener('input', () => {
    clearTimeout(gifTimer);

    gifTimer = setTimeout(() => {
      if (input.value.trim().length >= 2) {
        loadGifs(input.value);
      }
    }, 500);
  });
}

async function loadGifs(queryText) {
  const results = $('#gif-results', views.chatTools);
  const query = cleanInput(queryText, 40);

  if (!query) {
    results.innerHTML = '<span class="soft-note">Search for a GIF to send.</span>';
    return;
  }

  if (!giphyKey) {
    results.innerHTML = '<span class="soft-note">Missing GIPHY API key. Add VITE_GIPHY_API_KEY in .env, then rebuild and deploy.</span>';
    return;
  }

  results.innerHTML = '<span class="soft-note">Loading GIFs...</span>';

  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(giphyKey)}&q=${encodeURIComponent(query)}&limit=16&rating=g&lang=en`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`GIPHY request failed: ${response.status}`);
    }

    const data = await response.json();
    const gifs = data.data || [];

    if (!gifs.length) {
      results.innerHTML = '<span class="soft-note">No GIFs found. Try another word.</span>';
      return;
    }

    results.innerHTML = gifs.map((gif) => {
      const src =
        gif.images?.fixed_height_small?.url ||
        gif.images?.downsized_medium?.url ||
        gif.images?.original?.url ||
        '';

      if (!src) return '';

      return `
        <button type="button" data-gif-url="${escapeHTML(src)}" data-gif-title="${escapeHTML(gif.title || 'GIF')}">
          <img src="${escapeHTML(src)}" alt="${escapeHTML(gif.title || 'GIF')}" loading="lazy" />
        </button>
      `;
    }).join('');

    $$('[data-gif-url]', results).forEach((button) => {
      button.addEventListener('click', () => {
        sendGif(button.dataset.gifUrl, button.dataset.gifTitle);
      });
    });
  } catch (error) {
    console.error(error);
    results.innerHTML = '<span class="soft-note">GIF search failed. Check your GIPHY API key and browser console.</span>';
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
  } catch (error) {
    showToast(friendlyError(error), 'error');
  }
}

function renderSelectedMediaPreview() {
  const file = views.postMediaInput.files?.[0];
  if (!file) {
    clearMediaPreview();
    return;
  }

  if (file.type?.startsWith('video/')) {
    views.postMediaInput.value = '';
    showToast('Video upload needs Firebase Storage, Cloudinary, or a backend. This Spark version supports images only.', 'error');
    return;
  }

  const url = URL.createObjectURL(file);
  views.mediaPreview.classList.remove('hidden');
  views.mediaPreview.innerHTML = `<img src="${url}" alt="Selected media" /><button type="button" data-clear-media>×</button>`;

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
