# Jolt Deployment Guide

## VPS Requirements
- **RAM**: 2GB minimum
- **Storage**: 10GB minimum
- **OS**: Ubuntu 20.04+ or Debian 11+
- **Network**: Stable internet connection

## Quick Deploy

### 1. Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install npm dependencies
cd /var/www/spark
npm install
```

### 2. Setup as System Service
```bash
# Create systemd service
sudo nano /etc/systemd/system/spark.service
```

Paste:
```ini
[Unit]
Description=Jolt Social Network
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/spark
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable spark
sudo systemctl start spark
sudo systemctl status spark
```

### 3. Setup Nginx Reverse Proxy
```bash
sudo apt install -y nginx

sudo nano /etc/nginx/sites-available/spark
```

Paste:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support for Nostr relays
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/spark /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Setup SSL with Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 5. Firewall Configuration
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Security Considerations

### Private Keys (nsec)
- **NEVER stored on server** - All nsec keys remain in browser localStorage only
- Server has **ZERO access** to private keys
- All signing happens client-side using nostr-tools in browser

### Content Security Policy
Server sets strict CSP headers:
- Scripts only from self and esm.sh (for nostr-tools)
- No eval() or inline scripts except where explicitly needed
- Images from any HTTPS source (for user avatars/content)
- WebSocket connections only to Nostr relays

### API Security
- `/api/spark-posts` endpoint is read-only
- No user authentication required (public feed)
- Rate limiting recommended (nginx limit_req)
- CORS headers restrict to same-origin

### Recommended Additions
1. **Rate Limiting**:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20;
}
```

2. **Fail2ban** for SSH protection
3. **Automated backups** (though nothing critical stored server-side)
4. **Monitoring**: Use uptime monitoring service

## Memory Optimization

The server caches only 50 Jolt posts in memory (~100KB), refreshed every minute. Very light footprint suitable for 2GB RAM VPS.

## Logs
```bash
# View server logs
sudo journalctl -u spark -f

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Updating
```bash
cd /var/www/spark
git pull
npm install
sudo systemctl restart spark
```

## Performance Tips
- Enable gzip compression in nginx
- Set appropriate cache headers for static files
- Use CDN for static assets (optional)
- Monitor with `htop` or similar

## Troubleshooting

**Server won't start:**
```bash
sudo journalctl -u spark -n 50
```

**Can't connect to Nostr relays:**
- Check firewall allows outbound WebSocket connections
- Verify DNS resolution: `nslookup relay.damus.io`

**High memory usage:**
- Reduce cache size in server.js (CACHE_TTL, limit in querySync)
- Restart service: `sudo systemctl restart spark`
