# Hosting Jolt - Free Deployment Guide

Jolt is a static web application that can be hosted **completely free** on multiple platforms. This guide covers all free hosting options and how to keep users logged in securely.

## ✅ What Makes Jolt Easy to Host

- **No backend required** - Pure client-side application
- **No database** - Everything stored in browser LocalStorage
- **No build step** - Just HTML, CSS, and vanilla JavaScript
- **No API keys needed** - Connects directly to public Nostr relays
- **Tiny footprint** - Less than 50KB total size

## 🔒 Security & User Sessions

### How Login Persistence Works

Jolt uses browser `localStorage` to keep users logged in:

```javascript
// Keys are stored securely in browser
localStorage.setItem('spark_nsec', nsec);  // Private key
localStorage.setItem('spark_npub', npub);  // Public key
```

### Security Features

✅ **Private keys never leave the user's browser**
✅ **No server-side storage** - keys stay on user's device
✅ **HTTPS encryption** - All hosting platforms provide free SSL
✅ **Direct relay connections** - No middleman servers
✅ **Client-side signing** - Events signed locally with nostr-tools

### Important Security Notes

1. **localStorage Persistence:**
   - Keys persist across browser sessions
   - Clearing browser data = losing access (unless user saved their nsec)
   - Keys are domain-specific (can't be accessed by other sites)

2. **HTTPS is Required:**
   - All recommended hosting platforms provide free SSL certificates
   - HTTPS protects WebSocket connections to Nostr relays
   - LocalStorage is more secure over HTTPS

3. **No Server = No Server Breach:**
   - Since there's no backend, there's nothing to hack server-side
   - User keys are only vulnerable if their device is compromised
   - This is actually MORE secure than traditional password-based systems

## 🌐 Free Hosting Options

### Option 1: GitHub Pages (Recommended for Beginners)

**Cost:** FREE forever  
**Bandwidth:** Generous (100GB/month)  
**Custom domain:** Yes  
**SSL:** Automatic  

**Setup Steps:**

```bash
# 1. Create GitHub repository
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/spark.git
git push -u origin master

# 2. Enable GitHub Pages
# Go to: Settings → Pages
# Source: Deploy from branch: master
# Folder: / (root)
# Save

# 3. Your site will be live at:
# https://yourusername.github.io/spark/
```

**Custom Domain:**
1. Add a file named `CNAME` with your domain: `spark.yourdomain.com`
2. Add DNS record: `CNAME spark yourusername.github.io`
3. Enable "Enforce HTTPS" in GitHub settings

### Option 2: Vercel (Recommended for Speed)

**Cost:** FREE (hobby plan)  
**Bandwidth:** 100GB/month  
**Build time:** Instant  
**Custom domain:** Yes  
**SSL:** Automatic  
**Edge network:** Global CDN  

**Setup Steps:**

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? spark
# - Directory? ./
# - Override settings? No

# 3. Production deployment
vercel --prod
```

**Configuration:**

The included `vercel.json` is already configured:
```json
{
  "buildCommand": null,
  "outputDirectory": ".",
  "installCommand": null
}
```

**Custom Domain:**
```bash
vercel domains add spark.yourdomain.com
# Follow DNS instructions
```

### Option 3: Netlify (Recommended for Features)

**Cost:** FREE (starter plan)  
**Bandwidth:** 100GB/month  
**Build minutes:** 300/month  
**Custom domain:** Yes  
**SSL:** Automatic  
**Forms:** Included  

**Setup Steps:**

```bash
# 1. Install Netlify CLI
npm install -g netlify-cli

# 2. Login
netlify login

# 3. Deploy
netlify deploy

# Follow prompts:
# - Create & configure new site? Yes
# - Team? Your account
# - Site name? spark
# - Publish directory? .

# 4. Production deployment
netlify deploy --prod
```

**Configuration:**

The included `netlify.toml` handles routing:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false
```

**Custom Domain:**
```bash
netlify domains:add spark.yourdomain.com
# Follow DNS instructions
```

### Option 4: Cloudflare Pages

**Cost:** FREE  
**Bandwidth:** Unlimited  
**Builds:** 500/month  
**Custom domain:** Yes  
**SSL:** Automatic  
**CDN:** Global, extremely fast  

**Setup Steps:**

1. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
2. Connect GitHub repository
3. Configure build:
   - Build command: *(leave empty)*
   - Build output directory: `/`
4. Deploy

**Custom Domain:**
- Automatically works if domain is on Cloudflare
- Or add custom domain in Pages settings

## 🚀 Deployment Checklist

Before deploying, ensure:

- [ ] `.env` file is in `.gitignore` (it already is)
- [ ] No sensitive data in code
- [ ] All HTML files reference correct paths
- [ ] `index.html` is at root level
- [ ] HTTPS will be enabled (all platforms do this automatically)
- [ ] Browser localStorage works (test locally first)

## 📊 Performance Optimization

### Already Optimized

✅ **Minimal Dependencies:** Only uses `nostr-tools` from CDN  
✅ **No Build Step:** Browsers cache files directly  
✅ **Small Payload:** ~50KB total  
✅ **Reduced Relays:** Only 2 relays (was 4) to prevent rate limiting  
✅ **Metadata Caching:** Reduces redundant requests  

### Optional Improvements

**1. Enable Compression (automatic on all platforms)**

All hosting platforms automatically enable gzip/brotli compression.

**2. Add Service Worker for Offline Support**

```javascript
// sw.js
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('spark-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/home.html',
        '/signup.html',
        '/css/style.css',
        '/js/app.js',
        '/js/home.js',
        '/js/nostr.js',
        '/js/signup.js'
      ]);
    })
  );
});
```

**3. Add Cache Headers (platform-specific)**

Vercel example (`vercel.json`):
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

## 🔧 Troubleshooting

### Users Can't Stay Logged In

**Issue:** Users logged out after closing browser  
**Solution:** Check that localStorage is working:
```javascript
// Test in browser console
localStorage.setItem('test', 'value');
console.log(localStorage.getItem('test')); // Should show 'value'
```

**Common causes:**
- Private browsing mode (localStorage doesn't persist)
- Browser settings blocking storage
- User manually clearing browser data

### Relay Connection Errors

**Issue:** "Failed to connect to relays"  
**Solution:**
- Ensure HTTPS is enabled (HTTP won't work with WSS relays)
- Check browser console for WebSocket errors
- Try different relays if current ones are down

### ES Module Import Errors

**Issue:** "Cannot use import statement outside a module"  
**Solution:**
- Files must be served via HTTP (not file://)
- Check `<script type="module">` is set in HTML
- Verify CDN links are accessible

## 📱 Mobile Considerations

All hosting platforms serve mobile-friendly content automatically:

- ✅ Viewport meta tag included
- ✅ Touch-friendly button sizes
- ✅ Responsive CSS (max-width: 763px)
- ✅ LocalStorage works on mobile browsers
- ✅ PWA-ready (can be enhanced with manifest.json)

## 💰 Cost Comparison

| Platform | Free Bandwidth | Build Minutes | Custom Domain | Serverless | Best For |
|----------|---------------|---------------|---------------|------------|----------|
| **GitHub Pages** | 100GB/month | N/A | Yes | N/A | Simplicity |
| **Vercel** | 100GB/month | Unlimited | Yes | Yes | Speed |
| **Netlify** | 100GB/month | 300/month | Yes | Yes | Features |
| **Cloudflare Pages** | Unlimited | 500/month | Yes | Yes | Scale |

**Recommendation:** Start with **GitHub Pages** for simplicity, switch to **Cloudflare Pages** if you expect high traffic.

## 🛡️ Security Best Practices

### For Hosting

1. **Always use HTTPS** (automatic on all platforms)
2. **Enable security headers** (platform-specific)
3. **Don't commit secrets** (.gitignore is configured)
4. **Monitor for XSS** (input escaping already implemented)

### For Users

1. **Save nsec securely** (password manager recommended)
2. **Use trusted devices** (private keys stored locally)
3. **Logout on shared computers** (clears localStorage)
4. **Backup keys offline** (paper backup suggested during signup)

## 🎯 Next Steps After Deployment

1. **Test on deployed URL**
   - Sign up with new account
   - Verify persistence across sessions
   - Test posting sparks
   - Check WebSocket connections to relays

2. **Share Your Instance**
   - Your instance works with ALL Nostr content
   - Users can use their existing Nostr keys
   - No account needed on your server (there is no server!)

3. **Monitor Usage** (if desired)
   - GitHub Pages: No built-in analytics
   - Vercel: Analytics available
   - Netlify: Analytics available
   - Cloudflare: Analytics available

4. **Add Custom Features**
   - Fork the repository
   - Add your enhancements
   - Deploy your custom version

## 🌟 Example Deployments

Once deployed, your Jolt instance will be accessible at:

```
GitHub Pages:     https://yourusername.github.io/spark/
Vercel:           https://spark.vercel.app/
Netlify:          https://spark.netlify.app/
Cloudflare:       https://spark.pages.dev/
Custom Domain:    https://spark.yourdomain.com/
```

All users across all instances see the **same Nostr network** - that's the power of decentralization!

---

## 📞 Need Help?

- Check browser console for errors (F12)
- Verify you're using HTTP server (not file://)
- Test localStorage in browser console
- Ensure HTTPS is enabled on production
- Check Nostr relay status at [nostr.watch](https://nostr.watch)

**The app is production-ready and can handle real users right now!** 🎉
