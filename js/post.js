import { 
    getKeysFromStorage,
    clearKeysFromStorage,
    pool,
    relays,
    formatTimestamp,
    getMetadata,
    getReplies,
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

const urlParams = new URLSearchParams(window.location.search);
const noteId = urlParams.get('id');

if (!noteId) {
    document.getElementById('post-loading').textContent = 'No post ID provided.';
} else {
    loadPost(noteId);
}

async function loadPost(noteId) {
    try {
        const events = await pool.querySync(relays, {
            ids: [noteId],
            kinds: [1],
            limit: 1
        });
        
        if (events.length === 0) {
            document.getElementById('post-loading').textContent = 'Jolt not found.';
            return;
        }
        
        const event = events[0];
        document.getElementById('post-loading').style.display = 'none';
        
        await displayMainPost(event);
        await loadConversation(noteId);
        
        const shareUrl = `${window.location.origin}/post.html?id=${noteId}`;
        document.getElementById('share-url').value = shareUrl;
        
    } catch (error) {
        console.error('Error loading post:', error);
        document.getElementById('post-loading').textContent = 'Error loading spark.';
    }
}

async function displayMainPost(event) {
    const mainPostContainer = document.getElementById('main-post');
    
    const metadata = await getMetadata(event.pubkey);
    const displayName = metadata?.name || event.pubkey.substring(0, 8);
    const avatarUrl = metadata?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${event.pubkey}`;
    
    const clientTag = event.tags?.find(tag => tag[0] === 'client')?.[1] || 'Nostr';
    const clientText = clientTag === 'Jolt' ? 'from Jolt' : `from ${clientTag}`;
    
    const mediaSettings = JSON.parse(localStorage.getItem('jolt_media_settings') || '{"showYouTubeEmbeds": true, "showTwitterEmbeds": true, "showImages": true}');
    
    const linkedContent = linkifyText(escapeHtml(event.content));
    const mediaHtml = extractMediaFromEvent(event, mediaSettings);
    
    const postEl = document.createElement('div');
    postEl.className = 'spark main-post';
    postEl.innerHTML = `
        <img src="${avatarUrl}" class="spark-avatar" alt="Avatar">
        <div class="spark-content">
            <a href="profile.html?npub=${await getNpubFromPubkey(event.pubkey)}" class="spark-author">${escapeHtml(displayName)}</a>
            <div class="spark-text">${linkedContent}</div>
            ${mediaHtml}
            <div class="spark-meta">${formatTimestamp(event.created_at)} ${clientText}</div>
            <div class="spark-actions">
                <a href="#" class="reply-link" data-event-id="${event.id}" data-author="${event.pubkey}" data-author-name="${escapeHtml(displayName)}">reply</a>
            </div>
        </div>
    `;
    
    mainPostContainer.appendChild(postEl);
    
    const replyLink = postEl.querySelector('.reply-link');
    replyLink.addEventListener('click', async (e) => {
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
            location.reload();
        } catch (error) {
            alert('Error posting reply: ' + error.message);
        }
    });
}

async function loadConversation(noteId) {
    const conversationLoading = document.getElementById('conversation-loading');
    const repliesList = document.getElementById('replies-list');
    
    conversationLoading.style.display = 'block';
    
    const replies = await getReplies(noteId);
    
    conversationLoading.style.display = 'none';
    
    if (replies.length === 0) {
        repliesList.innerHTML = '<div class="no-replies">No replies yet. Be the first to reply!</div>';
        return;
    }
    
    for (const reply of replies) {
        await displayReply(reply);
    }
}

async function displayReply(event) {
    const repliesList = document.getElementById('replies-list');
    
    const metadata = await getMetadata(event.pubkey);
    const displayName = metadata?.name || event.pubkey.substring(0, 8);
    const avatarUrl = metadata?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${event.pubkey}`;
    
    const clientTag = event.tags?.find(tag => tag[0] === 'client')?.[1] || 'Nostr';
    const clientText = clientTag === 'Jolt' ? 'from Jolt' : `from ${clientTag}`;
    
    const mediaSettings = JSON.parse(localStorage.getItem('jolt_media_settings') || '{"showYouTubeEmbeds": true, "showTwitterEmbeds": true, "showImages": true}');
    
    const linkedContent = linkifyText(escapeHtml(event.content));
    const mediaHtml = extractMediaFromEvent(event, mediaSettings);
    
    const replyEl = document.createElement('div');
    replyEl.className = 'spark reply-item';
    replyEl.innerHTML = `
        <img src="${avatarUrl}" class="reply-avatar" alt="Avatar">
        <div class="reply-content">
            <a href="profile.html?npub=${await getNpubFromPubkey(event.pubkey)}" class="spark-author">${escapeHtml(displayName)}</a>
            <div class="spark-text">${linkedContent}</div>
            ${mediaHtml}
            <div class="spark-meta">${formatTimestamp(event.created_at)} ${clientText}</div>
        </div>
    `;
    
    repliesList.appendChild(replyEl);
}

async function getNpubFromPubkey(pubkey) {
    const { nip19 } = await import('https://esm.sh/nostr-tools@2.7.2');
    return nip19.npubEncode(pubkey);
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
            return cleanUrl;
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

document.getElementById('copy-url-btn').addEventListener('click', () => {
    const urlInput = document.getElementById('share-url');
    urlInput.select();
    navigator.clipboard.writeText(urlInput.value);
    
    const btn = document.getElementById('copy-url-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
        btn.textContent = originalText;
    }, 2000);
});
