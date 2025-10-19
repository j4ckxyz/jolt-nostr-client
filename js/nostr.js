import { SimplePool, generateSecretKey, getPublicKey, finalizeEvent, nip19 } from 'https://esm.sh/nostr-tools@2.7.2';

const DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.nostr.band',
    'wss://nostr.wine'
];

const customRelays = JSON.parse(localStorage.getItem('jolt_relays') || 'null');
export const relays = customRelays || DEFAULT_RELAYS;

export const pool = new SimplePool();

const metadataCache = new Map();

export function generateKeys() {
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    
    return {
        privateKey: sk,
        publicKey: pk,
        nsec: nip19.nsecEncode(sk),
        npub: nip19.npubEncode(pk)
    };
}

export function decodeNsec(nsec) {
    try {
        const { type, data } = nip19.decode(nsec);
        if (type !== 'nsec') {
            throw new Error('Invalid private key format');
        }
        return data;
    } catch (error) {
        throw new Error('Invalid nsec key');
    }
}

export function decodeNpub(npub) {
    try {
        const { type, data } = nip19.decode(npub);
        if (type !== 'npub') {
            throw new Error('Invalid public key format');
        }
        return data;
    } catch (error) {
        throw new Error('Invalid npub key');
    }
}

export function getPrivateKeyFromNsec(nsec) {
    return decodeNsec(nsec);
}

export function getPublicKeyFromPrivate(privateKey) {
    return getPublicKey(privateKey);
}

export async function publishNote(privateKey, content, imageTags = []) {
    const publicKey = getPublicKey(privateKey);
    
    const tags = [
        ['client', 'Jolt'],
        ...imageTags
    ];
    
    const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: content,
        pubkey: publicKey
    };
    
    const signedEvent = finalizeEvent(event, privateKey);
    
    await Promise.any(pool.publish(relays, signedEvent));
    
    return signedEvent;
}

const BLOSSOM_SERVERS = [
    'https://blossom.primal.net',
    'https://blossom.nostr.hu',
    'https://cdn.satellite.earth',
    'https://nostr.download',
    'https://void.cat'
];

export async function uploadImageToBlossom(file, privateKey, altText = '') {
    const publicKey = getPublicKey(privateKey);
    
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const authEvent = {
        kind: 24242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['t', 'upload'],
            ['x', sha256],
            ['expiration', String(Math.floor(Date.now() / 1000) + 3600)]
        ],
        content: `Upload ${file.name}`,
        pubkey: publicKey
    };
    
    const signedAuthEvent = finalizeEvent(authEvent, privateKey);
    const authHeader = btoa(JSON.stringify(signedAuthEvent));
    
    const uploadedUrls = [];
    const errors = [];
    
    for (const server of BLOSSOM_SERVERS) {
        try {
            const response = await fetch(`${server}/upload`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Nostr ${authHeader}`,
                    'Content-Type': file.type || 'application/octet-stream'
                },
                body: arrayBuffer
            });
            
            if (response.ok) {
                const data = await response.json();
                uploadedUrls.push(data.url);
                console.log(`Uploaded to ${server}:`, data.url);
                
                if (uploadedUrls.length >= 2) {
                    break;
                }
            } else {
                errors.push(`${server}: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            errors.push(`${server}: ${error.message}`);
            console.error(`Failed to upload to ${server}:`, error);
        }
    }
    
    if (uploadedUrls.length === 0) {
        throw new Error(`Failed to upload image to any server. Errors: ${errors.join(', ')}`);
    }
    
    const imageUrl = uploadedUrls[0];
    const mimeType = file.type || 'image/jpeg';
    const fileExtension = file.name.split('.').pop() || 'jpg';
    
    const imageTag = ['imeta', 
        `url ${imageUrl}`,
        `m ${mimeType}`,
        `x ${sha256}`,
        `size ${file.size}`
    ];
    
    if (altText) {
        imageTag.push(`alt ${altText}`);
    }
    
    if (fileExtension) {
        imageTag.push(`dim ${fileExtension}`);
    }
    
    return { url: imageUrl, tag: imageTag, sha256, uploadedUrls };
}

export async function publishMetadata(privateKey, metadata) {
    const publicKey = getPublicKey(privateKey);
    
    const event = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(metadata),
        pubkey: publicKey
    };
    
    const signedEvent = finalizeEvent(event, privateKey);
    
    await Promise.any(pool.publish(relays, signedEvent));
    
    return signedEvent;
}

export async function getMetadata(publicKey) {
    if (metadataCache.has(publicKey)) {
        return metadataCache.get(publicKey);
    }
    
    try {
        const events = await pool.querySync(relays, {
            kinds: [0],
            authors: [publicKey],
            limit: 1
        });
        
        if (events.length === 0) {
            metadataCache.set(publicKey, null);
            return null;
        }
        
        events.sort((a, b) => b.created_at - a.created_at);
        
        const metadata = JSON.parse(events[0].content);
        metadataCache.set(publicKey, metadata);
        return metadata;
    } catch (error) {
        console.error('Error fetching metadata:', error);
        metadataCache.set(publicKey, null);
        return null;
    }
}

export async function subscribeToNotes(callback, limit = 50) {
    const initialEvents = [];
    let isInitialLoad = true;
    
    const sub = pool.subscribeMany(
        relays,
        [
            {
                kinds: [1],
                limit: limit
            }
        ],
        {
            onevent(event) {
                if (isInitialLoad) {
                    initialEvents.push(event);
                } else {
                    callback(event);
                }
            },
            oneose() {
                console.log('Initial notes loaded');
                isInitialLoad = false;
                initialEvents.sort((a, b) => b.created_at - a.created_at);
                initialEvents.forEach(event => callback(event));
            }
        }
    );
    
    return sub;
}

export function formatTimestamp(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    if (diff < 60) return 'less than a minute ago';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
}

export function saveKeysToStorage(nsec, npub) {
    localStorage.setItem('jolt_nsec', nsec);
    localStorage.setItem('jolt_npub', npub);
}

export function getKeysFromStorage() {
    const nsec = localStorage.getItem('jolt_nsec');
    const npub = localStorage.getItem('jolt_npub');
    
    if (!nsec || !npub) return null;
    
    return { nsec, npub };
}

export function clearKeysFromStorage() {
    localStorage.removeItem('jolt_nsec');
    localStorage.removeItem('jolt_npub');
}

export function isLoggedIn() {
    return getKeysFromStorage() !== null;
}

export async function publishReaction(privateKey, eventId, eventAuthor, emoji = '+') {
    const publicKey = getPublicKey(privateKey);
    
    const event = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['e', eventId],
            ['p', eventAuthor],
            ['client', 'Jolt']
        ],
        content: emoji,
        pubkey: publicKey
    };
    
    const signedEvent = finalizeEvent(event, privateKey);
    await Promise.any(pool.publish(relays, signedEvent));
    
    return signedEvent;
}

export async function publishReply(privateKey, content, replyToEventId, replyToAuthor) {
    const publicKey = getPublicKey(privateKey);
    
    const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['e', replyToEventId, '', 'reply'],
            ['p', replyToAuthor],
            ['client', 'Jolt']
        ],
        content: content,
        pubkey: publicKey
    };
    
    const signedEvent = finalizeEvent(event, privateKey);
    await Promise.any(pool.publish(relays, signedEvent));
    
    return signedEvent;
}

export async function getReplies(eventId) {
    try {
        const events = await pool.querySync(relays, {
            kinds: [1],
            '#e': [eventId],
            limit: 50
        });
        
        events.sort((a, b) => a.created_at - b.created_at);
        
        return events;
    } catch (error) {
        console.error('Error fetching replies:', error);
        return [];
    }
}

export async function getFollowList(publicKey) {
    try {
        const events = await pool.querySync(relays, {
            kinds: [3],
            authors: [publicKey],
            limit: 1
        });
        
        if (events.length === 0) return [];
        
        events.sort((a, b) => b.created_at - a.created_at);
        
        const followList = events[0].tags
            .filter(tag => tag[0] === 'p')
            .map(tag => tag[1]);
        
        return followList;
    } catch (error) {
        console.error('Error fetching follow list:', error);
        return [];
    }
}

export async function publishFollowList(privateKey, followList) {
    const publicKey = getPublicKey(privateKey);
    
    const tags = followList.map(pubkey => ['p', pubkey]);
    tags.push(['client', 'Jolt']);
    
    const event = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: '',
        pubkey: publicKey
    };
    
    const signedEvent = finalizeEvent(event, privateKey);
    
    try {
        const publishPromises = pool.publish(relays, signedEvent);
        
        const results = await Promise.allSettled(publishPromises);
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        
        if (successCount === 0) {
            throw new Error('Failed to publish to any relay');
        }
    } catch (error) {
        console.error('Error publishing follow list:', error);
        throw error;
    }
    
    return signedEvent;
}

export async function followUser(privateKey, targetPubkey) {
    const publicKey = getPublicKey(privateKey);
    const currentFollowList = await getFollowList(publicKey);
    
    if (currentFollowList.includes(targetPubkey)) {
        return { success: false, message: 'Already following' };
    }
    
    const newFollowList = [...currentFollowList, targetPubkey];
    await publishFollowList(privateKey, newFollowList);
    
    return { success: true, message: 'Followed successfully' };
}

export async function unfollowUser(privateKey, targetPubkey) {
    const publicKey = getPublicKey(privateKey);
    const currentFollowList = await getFollowList(publicKey);
    
    const newFollowList = currentFollowList.filter(pubkey => pubkey !== targetPubkey);
    await publishFollowList(privateKey, newFollowList);
    
    return { success: true, message: 'Unfollowed successfully' };
}

export async function isFollowing(userPubkey, targetPubkey) {
    const followList = await getFollowList(userPubkey);
    return followList.includes(targetPubkey);
}

export async function getMentions(publicKey) {
    try {
        const events = await pool.querySync(relays, {
            kinds: [1],
            '#p': [publicKey],
            limit: 50
        });
        
        events.sort((a, b) => b.created_at - a.created_at);
        
        return events;
    } catch (error) {
        console.error('Error fetching mentions:', error);
        return [];
    }
}

export async function getReactionCount(eventId) {
    try {
        const events = await pool.querySync(relays, {
            kinds: [7],
            '#e': [eventId],
            limit: 100
        });
        
        return events.length;
    } catch (error) {
        console.error('Error fetching reaction count:', error);
        return 0;
    }
}

export async function hasUserReacted(eventId, userPublicKey) {
    try {
        const events = await pool.querySync(relays, {
            kinds: [7],
            '#e': [eventId],
            authors: [userPublicKey],
            limit: 1
        });
        
        return events.length > 0;
    } catch (error) {
        console.error('Error checking user reaction:', error);
        return false;
    }
}
