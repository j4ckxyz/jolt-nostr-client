import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SimplePool } from 'nostr-tools';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const RELAYS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.nostr.band',
    'wss://nostr.wine'
];

const pool = new SimplePool();

let joltPostsCache = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 30000;

const userTimelineCache = new Map();
const metadataCache = new Map();
const joltSignups = new Set();
const blacklistedWords = [];
const userBlacklist = new Set();

const SIGNUPS_FILE = path.join(__dirname, 'jolt-signups.json');
const BLACKLIST_FILE = path.join(__dirname, 'jolt-blacklist.json');
const MUTE_WORDS_FILE = path.join(__dirname, 'mute-words.json');

function loadMuteWords() {
    try {
        if (fs.existsSync(MUTE_WORDS_FILE)) {
            const data = fs.readFileSync(MUTE_WORDS_FILE, 'utf8');
            const words = JSON.parse(data);
            blacklistedWords.push(...words);
            console.log(`Loaded ${blacklistedWords.length} mute words from disk`);
        }
    } catch (error) {
        console.error('Error loading mute words:', error);
    }
}

function loadSignups() {
    try {
        if (fs.existsSync(SIGNUPS_FILE)) {
            const data = fs.readFileSync(SIGNUPS_FILE, 'utf8');
            const signups = JSON.parse(data);
            signups.forEach(pubkey => joltSignups.add(pubkey));
            console.log(`Loaded ${joltSignups.size} Jolt signups from disk`);
        }
    } catch (error) {
        console.error('Error loading signups:', error);
    }
}

function saveSignups() {
    try {
        fs.writeFileSync(SIGNUPS_FILE, JSON.stringify(Array.from(joltSignups)), 'utf8');
    } catch (error) {
        console.error('Error saving signups:', error);
    }
}

function loadBlacklist() {
    try {
        if (fs.existsSync(BLACKLIST_FILE)) {
            const data = fs.readFileSync(BLACKLIST_FILE, 'utf8');
            const blacklist = JSON.parse(data);
            blacklist.forEach(pubkey => userBlacklist.add(pubkey));
            console.log(`Loaded ${userBlacklist.size} blacklisted users from disk`);
        }
    } catch (error) {
        console.error('Error loading blacklist:', error);
    }
}

function saveBlacklist() {
    try {
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(Array.from(userBlacklist)), 'utf8');
    } catch (error) {
        console.error('Error saving blacklist:', error);
    }
}

function containsBlacklistedContent(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return blacklistedWords.some(word => lowerText.includes(word));
}

function isBlacklisted(pubkey) {
    return userBlacklist.has(pubkey);
}

function filterMetadata(metadata, pubkey = null) {
    if (!metadata) return null;
    if (pubkey && isBlacklisted(pubkey)) return null;
    if (containsBlacklistedContent(metadata.name) || containsBlacklistedContent(metadata.about)) {
        return null;
    }
    return metadata;
}

loadSignups();
loadBlacklist();
loadMuteWords();

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const ONE_MONTH_AGO = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

async function fetchJoltPosts() {
    try {
        console.log('Fetching posts from relays...');
        const events = await pool.querySync(RELAYS, {
            kinds: [1],
            since: ONE_MONTH_AGO,
            limit: 2000
        });
        
        const joltAndChirpEvents = events.filter(event => {
            if (!event.tags) return false;
            const hasClientTag = event.tags.some(tag => 
                Array.isArray(tag) && 
                tag.length >= 2 && 
                tag[0] === 'client' && 
                (tag[1] === 'Jolt' || tag[1] === 'Chirp')
            );
            
            if (!hasClientTag) return false;
            
            const isReply = event.tags.some(tag => 
                Array.isArray(tag) && 
                tag[0] === 'e'
            );
            
            return !isReply;
        });
        
        joltAndChirpEvents.sort((a, b) => b.created_at - a.created_at);
        joltPostsCache = joltAndChirpEvents.slice(0, 200);
        lastCacheUpdate = Date.now();
        
        const joltCount = joltAndChirpEvents.filter(e => e.tags.some(t => t[0] === 'client' && t[1] === 'Jolt')).length;
        const chirpCount = joltAndChirpEvents.filter(e => e.tags.some(t => t[0] === 'client' && t[1] === 'Chirp')).length;
        console.log(`Fetched ${events.length} total posts from last month, found ${joltCount} Jolt + ${chirpCount} Chirp posts (non-replies), cached ${joltPostsCache.length}`);
        return joltPostsCache;
    } catch (error) {
        console.error('Error fetching Jolt posts:', error);
        return joltPostsCache;
    }
}

fetchJoltPosts();

setInterval(() => {
    fetchJoltPosts();
}, CACHE_TTL);

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://esm.sh; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https: http:; " +
        "connect-src 'self' wss: https:; " +
        "frame-src https://www.youtube.com; " +
        "font-src 'self' data:;"
    );
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.url === '/api/spark-posts') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=15');
        
        if (joltPostsCache.length === 0 || Date.now() - lastCacheUpdate > CACHE_TTL) {
            await fetchJoltPosts();
        }
        
        res.writeHead(200);
        res.end(JSON.stringify({
            posts: joltPostsCache,
            cached_at: lastCacheUpdate,
            count: joltPostsCache.length
        }));
        return;
    }
    
    if (req.url.startsWith('/api/user-timeline?')) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pubkey = url.searchParams.get('pubkey');
        
        if (!pubkey) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'pubkey parameter required' }));
            return;
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=30');
        
        try {
            const cached = userTimelineCache.get(pubkey);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                res.writeHead(200);
                res.end(JSON.stringify({
                    posts: cached.posts,
                    cached_at: cached.timestamp
                }));
                return;
            }
            
            const events = await pool.querySync(RELAYS, {
                kinds: [1],
                authors: [pubkey],
                limit: 50
            });
            
            events.sort((a, b) => b.created_at - a.created_at);
            
            userTimelineCache.set(pubkey, {
                posts: events,
                timestamp: Date.now()
            });
            
            res.writeHead(200);
            res.end(JSON.stringify({
                posts: events,
                cached_at: Date.now()
            }));
        } catch (error) {
            console.error('Error fetching user timeline:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to fetch timeline' }));
        }
        return;
    }
    
    if (req.url.startsWith('/api/metadata?')) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pubkey = url.searchParams.get('pubkey');
        
        if (!pubkey) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'pubkey parameter required' }));
            return;
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=60');
        
        try {
            const cached = metadataCache.get(pubkey);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL * 2) {
                res.writeHead(200);
                res.end(JSON.stringify({
                    metadata: cached.data,
                    cached_at: cached.timestamp
                }));
                return;
            }
            
            const events = await pool.querySync(RELAYS, {
                kinds: [0],
                authors: [pubkey],
                limit: 1
            });
            
            if (events.length === 0) {
                metadataCache.set(pubkey, { data: null, timestamp: Date.now() });
                res.writeHead(200);
                res.end(JSON.stringify({ metadata: null, cached_at: Date.now() }));
                return;
            }
            
            events.sort((a, b) => b.created_at - a.created_at);
            const metadata = JSON.parse(events[0].content);
            const filteredMetadata = filterMetadata(metadata, pubkey);
            
            metadataCache.set(pubkey, {
                data: filteredMetadata,
                timestamp: Date.now()
            });
            
            res.writeHead(200);
            res.end(JSON.stringify({
                metadata: filteredMetadata,
                cached_at: Date.now()
            }));
        } catch (error) {
            console.error('Error fetching metadata:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to fetch metadata' }));
        }
        return;
    }
    
    if (req.method === 'POST' && req.url === '/api/blacklist/add') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { pubkey } = JSON.parse(body);
                if (pubkey && typeof pubkey === 'string' && pubkey.length === 64) {
                    userBlacklist.add(pubkey);
                    saveBlacklist();
                    metadataCache.delete(pubkey);
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid pubkey' }));
                }
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }
    
    if (req.method === 'POST' && req.url === '/api/blacklist/remove') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { pubkey } = JSON.parse(body);
                if (pubkey && typeof pubkey === 'string') {
                    userBlacklist.delete(pubkey);
                    saveBlacklist();
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid pubkey' }));
                }
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }
    
    if (req.url === '/api/blacklist') {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ blacklist: Array.from(userBlacklist) }));
        return;
    }
    
    if (req.method === 'POST' && req.url === '/api/register-signup') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { pubkey } = JSON.parse(body);
                if (pubkey && typeof pubkey === 'string' && pubkey.length === 64) {
                    joltSignups.add(pubkey);
                    saveSignups();
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid pubkey' }));
                }
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }
    
    if (req.url === '/api/recommended-users') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=60');
        
        try {
            const signupArray = Array.from(joltSignups);
            const recommended = [];
            
            for (const pubkey of signupArray.slice(0, 20)) {
                const cached = metadataCache.get(pubkey);
                let metadata = cached?.data;
                
                if (!cached || Date.now() - cached.timestamp > CACHE_TTL * 2) {
                    const events = await pool.querySync(RELAYS, {
                        kinds: [0],
                        authors: [pubkey],
                        limit: 1
                    });
                    
                    if (events.length > 0) {
                        events.sort((a, b) => b.created_at - a.created_at);
                        metadata = JSON.parse(events[0].content);
                        metadata = filterMetadata(metadata);
                        metadataCache.set(pubkey, { data: metadata, timestamp: Date.now() });
                    }
                }
                
                if (metadata) {
                    recommended.push({
                        pubkey,
                        name: metadata.name || 'Anonymous',
                        about: metadata.about || '',
                        picture: metadata.picture || ''
                    });
                }
            }
            
            res.writeHead(200);
            res.end(JSON.stringify({ users: recommended }));
        } catch (error) {
            console.error('Error fetching recommended users:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to fetch recommendations' }));
        }
        return;
    }
    
    if (req.url.startsWith('/api/search-users?')) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const query = url.searchParams.get('q');
        
        if (!query) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'query parameter required' }));
            return;
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=30');
        
        try {
            const events = await pool.querySync(RELAYS, {
                kinds: [0],
                limit: 200
            });
            
            const matches = [];
            const lowerQuery = query.toLowerCase();
            
            for (const event of events) {
                try {
                    const metadata = JSON.parse(event.content);
                    const filteredMetadata = filterMetadata(metadata, event.pubkey);
                    
                    if (!filteredMetadata) continue;
                    
                    const name = (filteredMetadata.name || '').toLowerCase();
                    const about = (filteredMetadata.about || '').toLowerCase();
                    const displayName = (filteredMetadata.display_name || '').toLowerCase();
                    
                    if (name.includes(lowerQuery) || about.includes(lowerQuery) || displayName.includes(lowerQuery)) {
                        matches.push({
                            pubkey: event.pubkey,
                            metadata: filteredMetadata,
                            timestamp: event.created_at
                        });
                    }
                } catch (error) {
                    console.error('Error parsing metadata:', error);
                }
            }
            
            matches.sort((a, b) => b.timestamp - a.timestamp);
            
            res.writeHead(200);
            res.end(JSON.stringify({
                users: matches.slice(0, 30),
                cached_at: Date.now()
            }));
        } catch (error) {
            console.error('Error searching users:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to search users' }));
        }
        return;
    }
    
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 - File not found');
            } else {
                res.writeHead(500);
                res.end('500 - Internal server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Jolt server running on http://localhost:${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/spark-posts`);
});
