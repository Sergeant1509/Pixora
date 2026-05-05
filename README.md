# Pixora

Pixora is a Firebase powered social media web app built with HTML, CSS, JavaScript and Vite. It includes real-time posts, chat, profiles, followers/following, notifications, reports, saved posts, comments, likes, themes and a simple responsive interface.

## Main features

- Email/password and Google sign-in
- Unique usernames with suggestions
- Following based feed with own posts and trending posts
- Recommended post grid in Discover
- Post likes, comments, saves, shares and comment likes
- Notifications for likes, comments, mentions and comment likes
- Real-time messaging with image and GIF support
- Demo encrypted text messages in Firestore
- Delete message for everyone / delete chat option
- Audio/video call request starter using browser media permissions and Firestore call records
- Profile photo crop, cover photo and profile stats
- Followers/following lists with follow, unfollow and remove follower options
- Report, block and basic moderation flows
- Last activity status with a setting to hide it
- Theme modes: Default dark, Day, Summer, Spring, Rainy and Winter
- Mobile friendly bottom navigation

## Tech stack

- HTML5
- CSS3
- JavaScript
- Vite
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- GIPHY API
- Cloudinary unsigned uploads

## Environment setup

Create a `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id_optional
VITE_GIPHY_API_KEY=your_giphy_api_key_optional
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
```

Do not put `.env` on GitHub.

## Cloudinary setup

This project uses Cloudinary unsigned upload presets for browser uploads. Add only the cloud name and unsigned upload preset to `.env`.

Do not add the Cloudinary API secret to frontend files. The API secret belongs on a backend server only.

## Run locally

```bash
npm install
npm run dev
```

## Build and deploy

```bash
npm run build
firebase deploy
firebase deploy --only firestore:rules
```

## Notes

This is a demo version. It is not a complete production social media platform. For a real public app, move sensitive operations such as moderation decisions, bans, media signing and stronger encryption to a backend or Firebase Cloud Functions.
