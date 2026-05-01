# Pixora Social — Firebase Spark Safe Advanced Version

A polished Firebase social media front-end using Firebase Auth, Google login, Cloud Firestore, real-time listeners, and Firebase Hosting. This version does **not** use Firebase Storage, so it stays friendly for Firebase Spark/free-plan projects.

## Features

- Email/password sign in and sign up
- Google sign in / sign up
- Compact Instagram-style sidebar with the expand button fixed inside the sidebar
- Global Firestore feed visible to all accounts
- Local photo upload for posts, stored as compressed Firestore inline data
- Likes, comments with emoji shortcuts, saves, and share counts
- Share posts by copying a link or sending them to following/discover users in chat
- Discover users and open other users' profiles
- Profile pages for yourself and other users with posts, followers, and following counts
- Settings page with profile editing, saved posts, logout, and account deletion
- Profile photo crop, zoom, move, and rotate before saving from Settings or your profile page
- Real-time messaging with only real conversations shown
- Chat emoji panel, GIPHY GIF search, and local image sharing in messages
- No premade posts, no fake users, and no fake chat history

## Important: media uploads

Firebase Cloud Storage requires billing for newer Firebase projects. This project avoids Storage completely.

Because Firestore documents have a 1 MiB max size, local uploads are limited to compressed images only. Videos cannot be stored persistently without Firebase Storage, Cloudinary, Supabase Storage, or your own backend.

## Setup

Install dependencies:

```bash
npm install
```

Create `.env` in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id_optional
VITE_GIPHY_API_KEY=your_giphy_api_key_optional
```

The app includes a GIPHY API key for GIF search for reliability.

Run locally:

```bash
npm run dev
```

Build and deploy:

```bash
npm run build
firebase deploy
```

Deploy Firestore rules only:

```bash
firebase deploy --only firestore:rules
```

## Firebase Console checklist

Enable these providers:

- Authentication → Sign-in method → Email/Password
- Authentication → Sign-in method → Google

Create:

- Firestore Database
- Firebase Hosting

Do not enable Firebase Storage for this Spark/free-plan version.


## Notes for this build

- The GIF button appears inside an active chat. Open a user profile or Discover card, click Message, then use the `GIF` button beside the emoji/photo buttons.
- Profile photo editing is available in Settings and also from your own Profile page using `Change photo`.
- Post sharing opens a Pixora share modal. You can copy the post link or send the post into a chat.
- On mobile, the sidebar becomes a bottom navigation bar for a cleaner responsive layout.


## Safety, Reports, and Moderation

Pixora includes client-side safety checks for posts and comments. Content that matches blocked adult/vulgar patterns is prevented from publishing and a record is written to the `moderationEvents` collection.

User reports are stored in the `reports` collection with fields such as:

- `reporterId`
- `targetUserId`
- `targetType`
- `postId`
- `commentId`
- `reasonGroup`
- `details`
- `status`
- `createdAt`

To review reports in Firebase Console:

1. Open Firebase Console.
2. Go to Firestore Database.
3. Open the `reports` collection.
4. Filter or sort by `reasonGroup`, `targetUserId`, `status`, or `createdAt`.
5. Change `status` manually if you want to mark a report as reviewed.

Temporary limits are stored on the user document with fields like `bannedUntil`, `banReason`, `reportCount`, and `moderationViolationCount`.

For production apps, moderation and bans should be moved to a trusted backend or Firebase Cloud Functions so users cannot bypass enforcement from the browser.
