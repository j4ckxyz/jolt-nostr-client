import { 
    getPrivateKeyFromNsec, 
    saveKeysToStorage, 
    subscribeToNotes, 
    formatTimestamp,
    getMetadata,
    decodeNpub
} from './nostr.js';

import { shouldDisplayEvent } from './filters.js';

let subscription = null;
const displayedNotes = new Set();
let filterSettings = {
    onlyJoltClient: true,
    filterCrypto: true,
    hideReplies: true
};

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nsec = document.getElementById('nsec').value.trim();
    
    try {
        const privateKey = getPrivateKeyFromNsec(nsec);
        const publicKey = await import('https://esm.sh/nostr-tools@2.7.2').then(m => m.getPublicKey(privateKey));
        const npub = await import('https://esm.sh/nostr-tools@2.7.2').then(m => m.nip19.npubEncode(publicKey));
        
        saveKeysToStorage(nsec, npub);
        
        window.location.href = 'home.html';
    } catch (error) {
        alert('Invalid private key. Please check your nsec and try again.');
    }
});

async function displayNote(event) {
    if (displayedNotes.has(event.id)) return;
    displayedNotes.add(event.id);
    
    const timeline = document.getElementById('public-timeline');
    
    const metadata = await getMetadata(event.pubkey);
    const displayName = metadata?.name || event.pubkey.substring(0, 8);
    
    const sparkEl = document.createElement('div');
    sparkEl.className = 'spark';
    
    const avatarUrl = metadata?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${event.pubkey}`;
    
    sparkEl.innerHTML = `
        <img src="${avatarUrl}" class="spark-avatar" alt="Avatar">
        <div class="spark-content">
            <a href="#" class="spark-author">${displayName}</a>
            <div class="spark-text">${escapeHtml(event.content)}</div>
            <div class="spark-meta">${formatTimestamp(event.created_at)}</div>
        </div>
    `;
    
    timeline.insertBefore(sparkEl, timeline.firstChild);
    
    while (timeline.children.length > 50) {
        const lastChild = timeline.lastChild;
        displayedNotes.delete(lastChild.dataset.id);
        timeline.removeChild(lastChild);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadTimeline() {
    document.getElementById('timeline-loading').textContent = 'Loading latest sparks...';
    
    try {
        const response = await fetch('/api/spark-posts');
        if (response.ok) {
            const data = await response.json();
            console.log(`Loaded ${data.posts.length} cached Jolt/Chirp posts from server`);
            
            data.posts.forEach(event => {
                displayNote(event);
            });
            
            document.getElementById('timeline-loading').style.display = 'none';
            
            subscription = await subscribeToNotes((event) => {
                if (shouldDisplayEvent(event, filterSettings)) {
                    displayNote(event);
                }
            }, 100);
            
            return;
        }
    } catch (error) {
        console.log('Server cache not available, loading directly from relays:', error);
    }
    
    subscription = await subscribeToNotes((event) => {
        if (shouldDisplayEvent(event, filterSettings)) {
            displayNote(event);
        }
        document.getElementById('timeline-loading').style.display = 'none';
    }, 200);
}

loadTimeline();
