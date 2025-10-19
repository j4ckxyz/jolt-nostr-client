import { 
    getKeysFromStorage,
    clearKeysFromStorage,
    decodeNpub,
    getMetadata,
    subscribeToNotes,
    formatTimestamp,
    followUser,
    unfollowUser,
    isFollowing,
    getFollowList,
    publishReaction,
    getReactionCount,
    hasUserReacted,
    getPrivateKeyFromNsec
} from './nostr.js';

import { shouldDisplayEvent } from './filters.js';
import { SimplePool, nip19 } from 'https://esm.sh/nostr-tools@2.7.2';
import { nip05 } from 'https://esm.sh/nostr-tools@2.7.2';

const keys = getKeysFromStorage();

if (!keys) {
    window.location.href = 'index.html';
}

const RELAYS = JSON.parse(localStorage.getItem('jolt_relays') || 'null') || [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.nostr.band',
    'wss://nostr.wine'
];

const pool = new SimplePool();
let currentTab = 'users';
let searchQuery = '';
let userFollowList = [];

document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    clearKeysFromStorage();
    window.location.href = 'index.html';
});

async function loadFollowList() {
    try {
        const publicKey = decodeNpub(keys.npub);
        userFollowList = await getFollowList(publicKey);
    } catch (error) {
        console.error('Error loading follow list:', error);
    }
}

loadFollowList();

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentTab = btn.dataset.tab;
        
        if (currentTab === 'users') {
            document.getElementById('users-tab-content').style.display = 'block';
            document.getElementById('sparks-tab-content').style.display = 'none';
        } else {
            document.getElementById('users-tab-content').style.display = 'none';
            document.getElementById('sparks-tab-content').style.display = 'block';
        }
    });
});

document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    searchQuery = document.getElementById('search-query').value.trim();
    
    if (!searchQuery) {
        return;
    }
    
    if (currentTab === 'users') {
        await searchUsers(searchQuery);
    } else {
        await searchSparks(searchQuery);
    }
});

async function searchUsers(query) {
    const resultsDiv = document.getElementById('users-results');
    const loadingDiv = document.getElementById('users-loading');
    const mediaSettings = JSON.parse(localStorage.getItem('jolt_media_settings') || '{"lowDataMode": false}');
    
    resultsDiv.innerHTML = '';
    loadingDiv.style.display = 'block';
    
    try {
        let pubkey = null;
        
        if (query.startsWith('npub1')) {
            try {
                pubkey = decodeNpub(query);
                const metadata = await getMetadata(pubkey);
                if (metadata) {
                    resultsDiv.innerHTML = renderUserCard(pubkey, metadata);
                } else {
                    resultsDiv.innerHTML = '<p style="text-align: center; padding: 20px;">User not found</p>';
                }
                loadingDiv.style.display = 'none';
                return;
            } catch (error) {
                console.error('Error decoding npub:', error);
            }
        }
        
        if (query.includes('@')) {
            try {
                const profile = await nip05.queryProfile(query);
                if (profile) {
                    pubkey = profile.pubkey;
                    const metadata = await getMetadata(pubkey);
                    if (metadata) {
                        resultsDiv.innerHTML = renderUserCard(pubkey, metadata);
                    } else {
                        resultsDiv.innerHTML = '<p style="text-align: center; padding: 20px;">User not found</p>';
                    }
                    loadingDiv.style.display = 'none';
                    return;
                }
            } catch (error) {
                console.error('Error resolving NIP-05:', error);
            }
        }
        
        const lowerQuery = query.toLowerCase();
        
        if (!mediaSettings.lowDataMode) {
            const response = await fetch(`/api/search-users?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.users && data.users.length > 0) {
                resultsDiv.innerHTML = data.users.map(match => 
                    renderUserCard(match.pubkey, match.metadata)
                ).join('');
                loadingDiv.style.display = 'none';
                return;
            }
        }
        
        const events = await pool.querySync(RELAYS, {
            kinds: [0],
            limit: 100
        });
        
        const matches = [];
        
        for (const event of events) {
            try {
                const metadata = JSON.parse(event.content);
                const name = (metadata.name || '').toLowerCase();
                const about = (metadata.about || '').toLowerCase();
                const displayName = (metadata.display_name || '').toLowerCase();
                
                if (name.includes(lowerQuery) || about.includes(lowerQuery) || displayName.includes(lowerQuery)) {
                    matches.push({
                        pubkey: event.pubkey,
                        metadata,
                        timestamp: event.created_at
                    });
                }
            } catch (error) {
                console.error('Error parsing metadata:', error);
            }
        }
        
        matches.sort((a, b) => b.timestamp - a.timestamp);
        
        if (matches.length === 0) {
            resultsDiv.innerHTML = '<p style="text-align: center; padding: 20px;">No users found</p>';
        } else {
            resultsDiv.innerHTML = matches.slice(0, 20).map(match => 
                renderUserCard(match.pubkey, match.metadata)
            ).join('');
        }
    } catch (error) {
        console.error('Error searching users:', error);
        resultsDiv.innerHTML = '<p style="text-align: center; padding: 20px; color: red;">Search failed. Please try again.</p>';
    }
    
    loadingDiv.style.display = 'none';
}

function renderUserCard(pubkey, metadata) {
    const name = metadata.name || 'Anonymous';
    const about = metadata.about || '';
    const picture = metadata.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${pubkey}`;
    const nip05 = metadata.nip05 || '';
    const npub = nip19.npubEncode(pubkey);
    
    const following = userFollowList.includes(pubkey);
    
    return `
        <div class="user-card" style="border: 1px solid #ccc; padding: 15px; margin-bottom: 10px; border-radius: 5px;">
            <div style="display: flex; align-items: start; gap: 10px;">
                <img src="${picture}" alt="${name}" style="width: 48px; height: 48px; border-radius: 50%;">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <strong><a href="profile.html?npub=${npub}" style="color: #ff6600;">${name}</a></strong>
                            ${nip05 ? `<div style="font-size: 10px; color: #666;">✓ ${nip05}</div>` : ''}
                        </div>
                        <button 
                            class="follow-btn btn-small" 
                            data-pubkey="${pubkey}"
                            style="background: ${following ? '#ccc' : '#ff6600'};"
                        >
                            ${following ? 'Unfollow' : 'Follow'}
                        </button>
                    </div>
                    ${about ? `<p style="font-size: 11px; margin-top: 5px; color: #333;">${about.substring(0, 150)}${about.length > 150 ? '...' : ''}</p>` : ''}
                </div>
            </div>
        </div>
    `;
}

async function searchSparks(query) {
    const resultsDiv = document.getElementById('sparks-results');
    const loadingDiv = document.getElementById('sparks-loading');
    const showAllNotes = document.getElementById('show-all-notes').checked;
    
    resultsDiv.innerHTML = '';
    loadingDiv.style.display = 'block';
    
    try {
        const lowerQuery = query.toLowerCase();
        
        const events = await pool.querySync(RELAYS, {
            kinds: [1],
            search: query,
            limit: 100
        });
        
        const matches = events.filter(event => {
            const content = event.content.toLowerCase();
            if (!content.includes(lowerQuery)) {
                return false;
            }
            
            if (!showAllNotes) {
                const hasJoltTag = event.tags?.some(tag => 
                    Array.isArray(tag) && 
                    tag.length >= 2 && 
                    tag[0] === 'client' && 
                    tag[1] === 'Jolt'
                );
                return hasJoltTag;
            }
            
            return true;
        });
        
        matches.sort((a, b) => b.created_at - a.created_at);
        
        if (matches.length === 0) {
            resultsDiv.innerHTML = '<p style="text-align: center; padding: 20px;">No sparks found</p>';
        } else {
            for (const event of matches.slice(0, 20)) {
                const noteDiv = await renderNote(event);
                resultsDiv.innerHTML += noteDiv;
            }
        }
    } catch (error) {
        console.error('Error searching sparks:', error);
        resultsDiv.innerHTML = '<p style="text-align: center; padding: 20px; color: red;">Search failed. Please try again.</p>';
    }
    
    loadingDiv.style.display = 'none';
}

async function renderNote(event) {
    const metadata = await getMetadata(event.pubkey);
    const name = metadata?.name || 'Anonymous';
    const picture = metadata?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${event.pubkey}`;
    
    const reactionCount = await getReactionCount(event.id);
    const userReacted = await hasUserReacted(event.id, decodeNpub(keys.npub));
    
    return `
        <div class="note" data-note-id="${event.id}">
            <div style="display: flex; gap: 10px;">
                <img src="${picture}" alt="${name}" class="avatar" style="width: 40px; height: 40px; border-radius: 50%;">
                <div style="flex: 1;">
                    <div>
                        <strong>${name}</strong>
                        <span style="color: #666; font-size: 10px;"> · ${formatTimestamp(event.created_at)}</span>
                    </div>
                    <p style="margin: 5px 0;">${event.content}</p>
                    <div class="note-actions" style="display: flex; gap: 15px; margin-top: 5px;">
                        <button class="spark-btn" data-note-id="${event.id}" style="background: ${userReacted ? '#ff6600' : '#eee'}; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">
                            ⚡ ${reactionCount > 0 ? reactionCount : ''}
                        </button>
                        <a href="post.html?id=${event.id}" style="color: #666; font-size: 11px;">Reply</a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('follow-btn')) {
        const pubkey = e.target.dataset.pubkey;
        const following = userFollowList.includes(pubkey);
        
        try {
            const privateKey = getPrivateKeyFromNsec(keys.nsec);
            
            if (following) {
                await unfollowUser(privateKey, pubkey);
                userFollowList = userFollowList.filter(p => p !== pubkey);
                e.target.textContent = 'Follow';
                e.target.style.background = '#ff6600';
            } else {
                await followUser(privateKey, pubkey);
                userFollowList.push(pubkey);
                e.target.textContent = 'Unfollow';
                e.target.style.background = '#ccc';
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
            alert('Failed to update follow status');
        }
    }
    
    if (e.target.classList.contains('spark-btn')) {
        const noteId = e.target.dataset.noteId;
        
        try {
            await publishReaction(noteId);
            const count = await getReactionCount(noteId);
            e.target.textContent = `⚡ ${count > 0 ? count : ''}`;
            e.target.style.background = '#ff6600';
        } catch (error) {
            console.error('Error sparking:', error);
            alert('Failed to spark');
        }
    }
});
