# Agent Guidelines for Jolt (Nostr Client)

## Build/Run Commands
- **Dev server**: `npm run dev` or `python3 -m http.server 8000` (port 8000)
- **Production server**: `npm start` or `node server.js` (port 3000)
- **No tests**: This project has no test suite

## Project Structure
- Vanilla HTML/CSS/JavaScript (no framework/build tools)
- ES6 modules with CDN imports (`https://esm.sh/nostr-tools@2.7.2`)
- `/js/*.js` - Client logic, `/css/style.css` - Styling, `*.html` - Pages, `server.js` - Node backend
- Pages: `index.html` (login), `signup.html`, `home.html` (timeline), `profile.html`, `post.html`, `notifications.html`, `hashtag.html`, `settings.html`

## Code Style
- **No comments**: DO NOT add comments unless explicitly requested
- **Imports**: Use ES6 imports, external deps from esm.sh CDN
- **Formatting**: 4 spaces indent, camelCase naming
- **Error handling**: Try-catch with user-friendly alerts, console logging
- **Security**: Never expose/log nsec keys; client-side key generation; CSP headers
- **Nostr conventions**: Use kind 1 (notes), kind 0 (metadata), kind 3 (follows), kind 7 (reactions); filter by 'client' tag; cache metadata

## Key Patterns
- LocalStorage for keys (`jolt_nsec`, `jolt_npub`) and filters (`jolt_filters`)
- Filter posts: `shouldDisplayEvent()` for client/crypto/reply filtering
- SimplePool for relay connections, avoid duplicate subscriptions
- Server-side caching: 60s TTL for timeline, metadata, and user caches
- Follow/unfollow: kind 3 contact list events
- Reactions: kind 7 events with + content
- Mentions: kind 1 events with p-tags matching user pubkey
