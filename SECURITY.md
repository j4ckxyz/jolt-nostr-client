# Security Architecture

## Client-Side Key Management

### Private Keys (nsec)
- **Storage**: Browser localStorage ONLY
- **Never transmitted**: Keys never leave the user's device
- **Signing**: All Nostr events signed client-side using nostr-tools
- **No server access**: Server has zero knowledge of private keys

### How it Works
1. User enters nsec on login page
2. Browser validates and stores in localStorage
3. All event signing happens in browser using nostr-tools
4. Only signed events are published to Nostr relays
5. Server never sees or stores nsec values

## Server Security

### What the Server Does
- Serves static HTML/CSS/JS files
- Caches PUBLIC Jolt posts from Nostr relays
- Provides `/api/spark-posts` read-only endpoint
- Sets security headers on responses

### What the Server DOES NOT Do
- Store user credentials
- Access private keys
- Sign Nostr events
- Track user sessions
- Store user data

## Attack Surface Analysis

### ✅ Protected Against
- **Private key theft**: Keys never sent to server
- **XSS**: Content Security Policy prevents unauthorized scripts
- **Clickjacking**: X-Frame-Options: DENY
- **MIME sniffing**: X-Content-Type-Options: nosniff
- **Session hijacking**: No sessions exist

### ⚠️ User Responsibility
- **Secure nsec storage**: Users must protect their private keys
- **Browser security**: Keys stored in localStorage (not encrypted)
- **Phishing**: Users must verify they're on correct domain
- **Device security**: Compromised device = compromised keys

## Best Practices for Users

1. **Save your nsec offline** in a password manager
2. **Never share your nsec** with anyone
3. **Use HTTPS** - verify padlock in browser
4. **Clear browser data** when using public computers
5. **Backup your nsec** - we cannot recover lost keys

## Content Security Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://esm.sh;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https: http:;
connect-src 'self' wss: https:;
frame-src https://www.youtube.com;
```

- Scripts only from self and esm.sh (nostr-tools CDN)
- WebSocket connections allowed (for Nostr relays)
- Images from any HTTPS (for user content)
- YouTube embeds allowed

## Data Privacy

### What We Collect
- **Nothing** - Server is stateless

### What Nostr Relays Collect
- Public posts (intended to be public)
- Metadata (profile info you set)
- Connection IPs (relay-dependent)

### Third-Party Services
- **Blossom servers**: Image uploads (URLs public)
- **Nostr relays**: All posts are public by design
- **YouTube embeds**: Subject to YouTube privacy policy

## Recommendations for Deployment

1. **Use HTTPS** - Let's Encrypt is free
2. **Enable fail2ban** - Protect SSH
3. **Regular updates** - Keep Node.js and dependencies current
4. **Monitor logs** - Watch for unusual activity
5. **Backup strategy** - Though no user data stored
6. **Rate limiting** - Prevent API abuse
7. **DDoS protection** - Use Cloudflare or similar

## Reporting Security Issues

If you discover a security vulnerability, please:
1. **DO NOT** open a public GitHub issue
2. Email security concerns privately
3. Allow time for fix before public disclosure

## Audit Trail

- All Nostr events are signed and verifiable
- Event signatures can be verified by anyone
- No central authority can forge events
- Immutable public record on Nostr relays
