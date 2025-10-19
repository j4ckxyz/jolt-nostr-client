# Quick Start Guide

## Running Jolt Locally

### Option 1: Python HTTP Server (Recommended)

```bash
# If you have Python 3
python3 -m http.server 8000

# Or use npm script
npm run dev
```

Then open: http://localhost:8000

### Option 2: Any HTTP Server

You can use any static file server:

```bash
# Using Node's http-server
npx http-server -p 8000

# Using PHP
php -S localhost:8000
```

### Option 3: Direct File Open

⚠️ **Not Recommended** - ES modules may not work properly

You can try opening `index.html` directly in your browser, but CORS restrictions may prevent the Nostr library from loading properly.

## First Time Setup

1. **Start the server** (see above)
2. **Open in browser**: http://localhost:8000
3. **Click "Sign up"**
4. **Generate keys** - These are created locally, never sent anywhere
5. **SAVE YOUR PRIVATE KEY (nsec)** - Store it securely!
6. **Set up profile** - Choose a display name
7. **Start sparking!**

## Testing with Existing Nostr Account

If you already have Nostr keys:

1. Click "Login" on homepage
2. Enter your `nsec` private key
3. Your existing Nostr identity will load

## Deploying to Production

### GitHub Pages (Free)

1. Push to GitHub
2. Settings → Pages → Source: main branch
3. Done! Site live at `https://username.github.io/repo`

### Vercel (Free)

```bash
npm install -g vercel
vercel
```

### Netlify (Free)

```bash
npm install -g netlify-cli
netlify deploy --prod
```

## Troubleshooting

### "Failed to connect to relays"
- Check your internet connection
- Some networks block WebSocket connections
- Try a different network or use a VPN

### "Keys not working"
- Make sure you're using an `nsec` key (starts with "nsec1")
- Check that you copied the full key including all characters
- Clear browser cache and try again

### "Timeline not loading"
- Wait 10-15 seconds for relays to respond
- Some public relays may be slow or down
- Refresh the page to reconnect

### ES Module errors
- Don't open HTML files directly (file://)
- Always use an HTTP server (http://localhost)
- Check browser console for specific errors

## Browser Compatibility

Works best in:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

Requires ES6 module support.

## Security Notes

- **Private keys (nsec)** are stored in browser LocalStorage
- Clear browser data = lose access (if you didn't save your nsec)
- Never share your nsec key with anyone
- Always save a backup of your nsec in a secure password manager

## What's Next?

Once you're up and running:
- Post your first spark
- Explore the public timeline
- Connect with other Nostr users
- Your sparks work across ALL Nostr apps!

## Need Help?

- Check browser console for errors (F12)
- Verify you're using an HTTP server
- Make sure JavaScript is enabled
- Try a different browser
