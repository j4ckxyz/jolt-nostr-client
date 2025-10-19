import { 
    getKeysFromStorage,
    clearKeysFromStorage,
    getPrivateKeyFromNsec,
    publishNote,
    publishReaction,
    publishReply,
    subscribeToNotes,
    formatTimestamp,
    getMetadata,
    decodeNpub,
    getFollowList,
    getReactionCount,
    hasUserReacted,
    uploadImageToBlossom,
    followUser,
    unfollowUser,
    isFollowing
} from './nostr.js';

import { shouldDisplayEvent } from './filters.js';

const keys = getKeysFromStorage();

if (!keys) {
    window.location.href = 'index.html';
}

let subscription = null;
const displayedNotes = new Set();
const savedFilters = JSON.parse(localStorage.getItem('jolt_filters') || '{}');
let filterSettings = {
    onlyJoltClient: savedFilters.onlyJoltClient !== undefined ? savedFilters.onlyJoltClient : true,
    filterCrypto: true,
    hideReplies: true
};
let currentTab = 'all';
let userFollowList = [];
let searchTimeout = null;

async function loadUserProfile() {
    try {
        const publicKey = decodeNpub(keys.npub);
        const metadata = await getMetadata(publicKey);
        
        if (metadata) {
            document.getElementById('user-name').textContent = metadata.name || 'Anonymous';
            if (metadata.picture) {
                document.getElementById('user-avatar').src = metadata.picture;
            } else {
                document.getElementById('user-avatar').src = `https://api.dicebear.com/7.x/identicon/svg?seed=${publicKey}`;
            }
        } else {
            document.getElementById('user-name').textContent = 'Anonymous';
            document.getElementById('user-avatar').src = `https://api.dicebear.com/7.x/identicon/svg?seed=${publicKey}`;
        }
        
        userFollowList = await getFollowList(publicKey);
        document.getElementById('following-count').textContent = userFollowList.length;
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    clearKeysFromStorage();
    window.location.href = 'index.html';
});

document.getElementById('profile-link').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'profile.html';
});

document.addEventListener('click', (e) => {
    if (e.target.id === 'view-profile-link') {
        e.preventDefault();
        window.location.href = 'profile.html';
    }
});

const postTextarea = document.getElementById('post-text');
const charCount = document.getElementById('char-count');

postTextarea.addEventListener('input', () => {
    const remaining = 140 - postTextarea.value.length;
    charCount.textContent = remaining;
    
    if (remaining < 0) {
        charCount.classList.add('warning');
    } else {
        charCount.classList.remove('warning');
    }
});

let selectedImageFile = null;

document.getElementById('upload-image-btn').addEventListener('click', () => {
    document.getElementById('image-file-input').click();
});

document.getElementById('image-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('preview-img').src = event.target.result;
            document.getElementById('image-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('remove-image-btn').addEventListener('click', () => {
    selectedImageFile = null;
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('preview-img').src = '';
    document.getElementById('image-alt-text').value = '';
    document.getElementById('image-file-input').value = '';
});

postTextarea.addEventListener('paste', async (e) => {
    const items = e.clipboardData.items;
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = item.getAsFile();
            selectedImageFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('preview-img').src = event.target.result;
                document.getElementById('image-preview').style.display = 'block';
            };
            reader.readAsDataURL(file);
            break;
        }
    }
});

document.getElementById('post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const content = postTextarea.value.trim();
    
    if (!content && !selectedImageFile) {
        alert('Please enter some text or add an image!');
        return;
    }
    
    if (content.length > 140) {
        alert('Your spark is too long! Please keep it under 140 characters.');
        return;
    }
    
    try {
        const privateKey = getPrivateKeyFromNsec(keys.nsec);
        
        let imageTags = [];
        let finalContent = content;
        
        if (selectedImageFile) {
            const uploadBtn = document.querySelector('#post-form button[type="submit"]');
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading image...';
            
            try {
                const altText = document.getElementById('image-alt-text').value.trim();
                const uploadResult = await uploadImageToBlossom(selectedImageFile, privateKey, altText);
                
                imageTags.push(uploadResult.tag);
                
                console.log('Image uploaded to:', uploadResult.uploadedUrls);
            } catch (uploadError) {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Update';
                alert('Error uploading image: ' + uploadError.message);
                return;
            }
            
            uploadBtn.textContent = 'Posting...';
        }
        
        await publishNote(privateKey, finalContent, imageTags);
        
        postTextarea.value = '';
        charCount.textContent = '140';
        charCount.classList.remove('warning');
        
        if (selectedImageFile) {
            document.getElementById('remove-image-btn').click();
        }
        
        const uploadBtn = document.querySelector('#post-form button[type="submit"]');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Update';
        
        const successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.textContent = 'Jolt posted successfully!';
        document.querySelector('.post-box').appendChild(successMsg);
        
        setTimeout(() => successMsg.remove(), 3000);
    } catch (error) {
        const uploadBtn = document.querySelector('#post-form button[type="submit"]');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Update';
        alert('Error posting spark: ' + error.message);
    }
});

async function displayNote(event) {
    if (displayedNotes.has(event.id)) return;
    displayedNotes.add(event.id);
    
    const timeline = document.getElementById('timeline');
    
    const metadata = await getMetadata(event.pubkey);
    const displayName = metadata?.name || event.pubkey.substring(0, 8);
    
    const sparkEl = document.createElement('div');
    sparkEl.className = 'spark';
    sparkEl.dataset.id = event.id;
    
    const avatarUrl = metadata?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${event.pubkey}`;
    
    const clientTag = event.tags?.find(tag => tag[0] === 'client')?.[1] || 'Nostr';
    const clientText = clientTag === 'Jolt' ? 'from Jolt' : `from ${clientTag}`;
    
    const mediaSettings = JSON.parse(localStorage.getItem('jolt_media_settings') || '{"showYouTubeEmbeds": true, "showTwitterEmbeds": true, "showImages": true}');
    
    const linkedContent = linkifyText(escapeHtml(event.content));
    const mediaHtml = extractMediaFromEvent(event, mediaSettings);
    
    sparkEl.innerHTML = `
        <img src="${avatarUrl}" class="spark-avatar clickable-avatar" alt="Avatar" data-author="${event.pubkey}">
        <div class="spark-content">
            <a href="#" class="spark-author" data-author="${event.pubkey}">${escapeHtml(displayName)}</a>
            <div class="spark-text">${linkedContent}</div>
            ${mediaHtml}
            <div class="spark-meta">${formatTimestamp(event.created_at)} ${clientText}</div>
            <div class="spark-actions">
                <a href="#" class="reply-link" data-event-id="${event.id}" data-author="${event.pubkey}" data-author-name="${escapeHtml(displayName)}">reply</a>
                <a href="#" class="favorite-link" data-event-id="${event.id}" data-author="${event.pubkey}">favorite</a>
                <span class="favorite-count" data-event-id="${event.id}"></span>
            </div>
        </div>
        <div class="replies-container" id="replies-${event.id}" style="display: none;"></div>
    `;
    
    timeline.appendChild(sparkEl);
    
    const userPublicKey = decodeNpub(keys.npub);
    
    Promise.all([
        getReactionCount(event.id),
        hasUserReacted(event.id, userPublicKey)
    ]).then(([count, hasReacted]) => {
        const countEl = sparkEl.querySelector('.favorite-count');
        const favoriteLink = sparkEl.querySelector('.favorite-link');
        
        if (count > 0 && countEl) {
            countEl.textContent = `★ ${count}`;
            countEl.style.color = '#ffcc00';
            countEl.style.marginLeft = '10px';
        }
        
        if (hasReacted && favoriteLink) {
            favoriteLink.textContent = '★ favorited';
            favoriteLink.style.color = '#ffcc00';
            favoriteLink.style.pointerEvents = 'none';
        }
    });
    
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

function linkifyText(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let result = text.replace(urlRegex, (url) => {
        const cleanUrl = url.replace(/[.,;!?]$/, '');
        if (/\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?$/i.test(cleanUrl)) {
            return '';
        }
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${cleanUrl}</a>`;
    });
    
    const hashtagRegex = /#(\w+)/g;
    result = result.replace(hashtagRegex, (match, tag) => {
        return `<a href="hashtag.html?tag=${encodeURIComponent(tag)}" class="hashtag-link" onclick="event.stopPropagation()">${match}</a>`;
    });
    
    return result;
}

function extractMediaFromEvent(event, settings = {}) {
    const { showYouTubeEmbeds = true, showTwitterEmbeds = true, showImages = true } = settings;
    let mediaHtml = '';
    const text = event.content;
    
    if (showImages && event.tags) {
        const imetaTags = event.tags.filter(tag => tag[0] === 'imeta');
        imetaTags.forEach(imetaTag => {
            let imageUrl = '';
            let altText = '';
            
            for (let i = 1; i < imetaTag.length; i++) {
                const part = imetaTag[i];
                if (part.startsWith('url ')) {
                    imageUrl = part.substring(4);
                } else if (part.startsWith('alt ')) {
                    altText = part.substring(4);
                }
            }
            
            if (imageUrl) {
                mediaHtml += `<div class="embedded-image"><img src="${imageUrl}" alt="${escapeHtml(altText || 'Embedded image')}" title="${escapeHtml(altText)}" style="max-width: 100%; max-height: 400px; border: 1px solid #ccc; margin-top: 8px; cursor: pointer;" onclick="window.open('${imageUrl}', '_blank'); event.stopPropagation();"></div>`;
            }
        });
    }
    
    if (showImages) {
        const imageRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?)/gi;
        const imageMatches = text.match(imageRegex);
        if (imageMatches) {
            imageMatches.forEach(imageUrl => {
                mediaHtml += `<div class="embedded-image"><img src="${imageUrl}" alt="Embedded image" style="max-width: 100%; max-height: 400px; border: 1px solid #ccc; margin-top: 8px; cursor: pointer;" onclick="window.open('${imageUrl}', '_blank'); event.stopPropagation();"></div>`;
            });
        }
    }
    
    if (showYouTubeEmbeds) {
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const youtubeMatch = text.match(youtubeRegex);
        if (youtubeMatch) {
            const videoId = youtubeMatch[1];
            mediaHtml += `<div class="embedded-video" style="margin-top: 8px;">
                <iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" 
                frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen onclick="event.stopPropagation();"></iframe>
            </div>`;
        }
    }
    
    if (showTwitterEmbeds) {
        const twitterRegex = /https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/;
        const twitterMatch = text.match(twitterRegex);
        if (twitterMatch) {
            const tweetId = twitterMatch[1];
            mediaHtml += `<div class="embedded-tweet" style="margin-top: 8px;">
                <blockquote class="twitter-tweet" data-theme="light">
                    <a href="https://twitter.com/x/status/${tweetId}" target="_blank" rel="noopener noreferrer">View on Twitter/X</a>
                </blockquote>
            </div>`;
        }
    }
    
    return mediaHtml;
}

async function loadTimeline() {
    document.getElementById('timeline-loading').textContent = 'Loading sparks...';
    
    try {
        const response = await fetch('/api/spark-posts');
        if (response.ok) {
            const data = await response.json();
            console.log(`Loaded ${data.posts.length} cached Jolt/Chirp posts from server`);
            
            data.posts.forEach(event => {
                if (shouldDisplayEvent(event, filterSettings)) {
                    if (currentTab === 'following' && !userFollowList.includes(event.pubkey)) {
                        return;
                    }
                    displayNote(event);
                }
            });
            
            document.getElementById('timeline-loading').style.display = 'none';
        }
    } catch (error) {
        console.log('Server cache not available, loading from relays:', error);
    }
    
    subscription = await subscribeToNotes((event) => {
        if (shouldDisplayEvent(event, filterSettings)) {
            if (currentTab === 'following' && !userFollowList.includes(event.pubkey)) {
                return;
            }
            displayNote(event);
        }
        document.getElementById('timeline-loading').style.display = 'none';
    }, 200);
}

function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';
    displayedNotes.clear();
    
    if (subscription) {
        subscription.close();
    }
    
    loadTimeline();
}

async function loadRecommendedUsers() {
    try {
        const response = await fetch('http://localhost:3000/api/recommended-users');
        const data = await response.json();
        
        const container = document.getElementById('recommended-users-list');
        container.innerHTML = '';
        
        if (data.users.length === 0) {
            container.innerHTML = '<p style="padding: 10px; color: #666;">No recommendations yet</p>';
            return;
        }
        
        const publicKey = decodeNpub(keys.npub);
        
        for (const user of data.users) {
            if (user.pubkey === publicKey) continue;
            
            const metadata = await getMetadata(user.pubkey);
            const displayName = metadata?.name || user.pubkey.substring(0, 8);
            const avatarUrl = metadata?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.pubkey}`;
            const about = metadata?.about || '';
            
            const following = await isFollowing(publicKey, user.pubkey);
            
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            userCard.innerHTML = `
                <img src="${avatarUrl}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px;">
                <div style="flex: 1;">
                    <div style="font-weight: bold;">${escapeHtml(displayName)}</div>
                    <div style="font-size: 12px; color: #666;">${escapeHtml(about.substring(0, 50))}${about.length > 50 ? '...' : ''}</div>
                </div>
                <button class="follow-btn" data-pubkey="${user.pubkey}" style="background: ${following ? '#ccc' : '#007bff'}; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px;">
                    ${following ? 'Following' : 'Follow'}
                </button>
            `;
            
            container.appendChild(userCard);
        }
    } catch (error) {
        console.error('Error loading recommended users:', error);
    }
}

async function searchUsers(query) {
    const container = document.getElementById('search-results');
    container.innerHTML = '';
    
    if (!query.trim()) {
        return;
    }
    
    container.innerHTML = '<p style="padding: 10px;">Searching...</p>';
    
    try {
        const response = await fetch(`http://localhost:3000/api/recommended-users`);
        const data = await response.json();
        
        const publicKey = decodeNpub(keys.npub);
        const lowerQuery = query.toLowerCase();
        
        const matches = [];
        for (const user of data.users) {
            if (user.pubkey === publicKey) continue;
            
            const metadata = await getMetadata(user.pubkey);
            const displayName = metadata?.name || '';
            const about = metadata?.about || '';
            
            if (displayName.toLowerCase().includes(lowerQuery) || 
                about.toLowerCase().includes(lowerQuery) ||
                user.pubkey.includes(query)) {
                matches.push({ ...user, metadata });
            }
        }
        
        container.innerHTML = '';
        
        if (matches.length === 0) {
            container.innerHTML = '<p style="padding: 10px; color: #666;">No users found</p>';
            return;
        }
        
        for (const user of matches.slice(0, 10)) {
            const displayName = user.metadata?.name || user.pubkey.substring(0, 8);
            const avatarUrl = user.metadata?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.pubkey}`;
            const about = user.metadata?.about || '';
            
            const following = await isFollowing(publicKey, user.pubkey);
            
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            userCard.innerHTML = `
                <img src="${avatarUrl}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px;">
                <div style="flex: 1;">
                    <div style="font-weight: bold;">${escapeHtml(displayName)}</div>
                    <div style="font-size: 12px; color: #666;">${escapeHtml(about.substring(0, 50))}${about.length > 50 ? '...' : ''}</div>
                </div>
                <button class="follow-btn" data-pubkey="${user.pubkey}" style="background: ${following ? '#ccc' : '#007bff'}; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px;">
                    ${following ? 'Following' : 'Follow'}
                </button>
            `;
            
            container.appendChild(userCard);
        }
    } catch (error) {
        console.error('Error searching users:', error);
        container.innerHTML = '<p style="padding: 10px; color: red;">Error searching users</p>';
    }
}



document.addEventListener('click', async (e) => {
    if (e.target.closest('.spark-text')) {
        const spark = e.target.closest('.spark');
        if (spark && spark.dataset.id) {
            window.location.href = `post.html?id=${spark.dataset.id}`;
        }
        return;
    }

    if (e.target.classList.contains('spark-author') || e.target.classList.contains('clickable-avatar')) {
        e.preventDefault();
        const authorPubkey = e.target.dataset.author;
        const npub = await import('https://esm.sh/nostr-tools@2.7.2').then(m => m.nip19.npubEncode(authorPubkey));
        window.location.href = `profile.html?npub=${npub}`;
        return;
    }

    if (e.target.classList.contains('favorite-link')) {
        e.preventDefault();
        const eventId = e.target.dataset.eventId;
        const author = e.target.dataset.author;
        
        try {
            const privateKey = getPrivateKeyFromNsec(keys.nsec);
            await publishReaction(privateKey, eventId, author, '⭐');
            
            e.target.textContent = '★ favorited';
            e.target.style.color = '#ffcc00';
            e.target.style.pointerEvents = 'none';
        } catch (error) {
            alert('Error favoriting: ' + error.message);
        }
    }
    
    if (e.target.classList.contains('reply-link')) {
        e.preventDefault();
        const eventId = e.target.dataset.eventId;
        const author = e.target.dataset.author;
        const authorName = e.target.dataset.authorName;
        
        const replyText = prompt(`Reply to ${authorName}:`);
        if (!replyText || !replyText.trim()) return;
        
        if (replyText.length > 140) {
            alert('Reply is too long! Please keep it under 140 characters.');
            return;
        }
        
        try {
            const privateKey = getPrivateKeyFromNsec(keys.nsec);
            await publishReply(privateKey, replyText.trim(), eventId, author);
            
            alert('Reply posted successfully!');
        } catch (error) {
            alert('Error posting reply: ' + error.message);
        }
    }
});

async function displayReply(event, container) {
    const metadata = await getMetadata(event.pubkey);
    const displayName = metadata?.name || event.pubkey.substring(0, 8);
    const avatarUrl = metadata?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${event.pubkey}`;
    
    const replyEl = document.createElement('div');
    replyEl.className = 'reply';
    replyEl.innerHTML = `
        <img src="${avatarUrl}" class="reply-avatar clickable-avatar" alt="Avatar" data-author="${event.pubkey}">
        <div class="reply-content">
            <a href="#" class="spark-author" data-author="${event.pubkey}">${escapeHtml(displayName)}</a>
            <div class="spark-text">${escapeHtml(event.content)}</div>
            <div class="spark-meta">${formatTimestamp(event.created_at)}</div>
        </div>
    `;
    
    container.appendChild(replyEl);
}



document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
    });
});

document.getElementById('user-search').addEventListener('input', (e) => {
    const query = e.target.value;
    
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    searchTimeout = setTimeout(() => {
        searchUsers(query);
    }, 300);
});

document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('follow-btn')) {
        const button = e.target;
        const targetPubkey = button.dataset.pubkey;
        const isCurrentlyFollowing = button.textContent.trim() === 'Following';
        
        try {
            const privateKey = getPrivateKeyFromNsec(keys.nsec);
            
            if (isCurrentlyFollowing) {
                await unfollowUser(privateKey, targetPubkey);
                button.textContent = 'Follow';
                button.style.background = '#007bff';
                
                userFollowList = userFollowList.filter(pk => pk !== targetPubkey);
            } else {
                await followUser(privateKey, targetPubkey);
                button.textContent = 'Following';
                button.style.background = '#ccc';
                
                if (!userFollowList.includes(targetPubkey)) {
                    userFollowList.push(targetPubkey);
                }
            }
            
            document.getElementById('following-count').textContent = userFollowList.length;
        } catch (error) {
            alert('Error updating follow: ' + error.message);
        }
    }
});

loadUserProfile();
loadTimeline();
loadRecommendedUsers();
