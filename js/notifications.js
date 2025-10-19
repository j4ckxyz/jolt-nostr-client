import { 
    getKeysFromStorage,
    clearKeysFromStorage,
    getMentions,
    formatTimestamp,
    getMetadata,
    decodeNpub,
    pool,
    relays,
    getPrivateKeyFromNsec,
    publishReply
} from './nostr.js';

const keys = getKeysFromStorage();

if (!keys) {
    window.location.href = 'index.html';
}

document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    clearKeysFromStorage();
    window.location.href = 'index.html';
});

async function loadNotifications() {
    const notificationsLoading = document.getElementById('notifications-loading');
    const notificationsList = document.getElementById('notifications-list');
    
    try {
        const publicKey = decodeNpub(keys.npub);
        
        const [mentions, reactions] = await Promise.all([
            getMentions(publicKey),
            getReactions(publicKey)
        ]);
        
        const allNotifications = [
            ...mentions.map(e => ({ type: 'mention', event: e })),
            ...reactions.map(e => ({ type: 'reaction', event: e }))
        ];
        
        allNotifications.sort((a, b) => b.event.created_at - a.event.created_at);
        
        notificationsLoading.style.display = 'none';
        
        if (allNotifications.length === 0) {
            notificationsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No notifications yet.</div>';
            return;
        }
        
        for (const notification of allNotifications) {
            await displayNotification(notification);
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        notificationsLoading.textContent = 'Error loading notifications.';
    }
}

async function getReactions(publicKey) {
    try {
        const myPosts = await pool.querySync(relays, {
            kinds: [1],
            authors: [publicKey],
            limit: 50
        });
        
        const myPostIds = myPosts.map(p => p.id);
        
        if (myPostIds.length === 0) return [];
        
        const reactions = await pool.querySync(relays, {
            kinds: [7],
            '#e': myPostIds,
            limit: 100
        });
        
        return reactions.filter(r => r.pubkey !== publicKey);
    } catch (error) {
        console.error('Error fetching reactions:', error);
        return [];
    }
}

async function displayNotification(notification) {
    const notificationsList = document.getElementById('notifications-list');
    const event = notification.event;
    const type = notification.type;
    
    const metadata = await getMetadata(event.pubkey);
    const displayName = metadata?.name || event.pubkey.substring(0, 8);
    const avatarUrl = metadata?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${event.pubkey}`;
    
    const notifEl = document.createElement('div');
    notifEl.className = 'spark';
    notifEl.style.cursor = 'pointer';
    
    let notificationText = '';
    let targetEventId = '';
    
    if (type === 'mention') {
        notificationText = 'mentioned you';
        targetEventId = event.id;
    } else if (type === 'reaction') {
        notificationText = 'favorited your spark';
        const eTag = event.tags.find(tag => tag[0] === 'e');
        targetEventId = eTag ? eTag[1] : event.id;
    }
    
    const contentPreview = event.content.length > 100 ? event.content.substring(0, 100) + '...' : event.content;
    
    notifEl.innerHTML = `
        <img src="${avatarUrl}" class="spark-avatar" alt="Avatar">
        <div class="spark-content">
            <div class="spark-author">${escapeHtml(displayName)} ${notificationText}</div>
            ${type === 'mention' ? `<div class="spark-text">${escapeHtml(contentPreview)}</div>` : ''}
            <div class="spark-meta">${formatTimestamp(event.created_at)}</div>
        </div>
    `;
    
    notifEl.addEventListener('click', () => {
        window.location.href = `post.html?id=${targetEventId}`;
    });
    
    notificationsList.appendChild(notifEl);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

loadNotifications();
