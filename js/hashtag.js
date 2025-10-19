import { 
    getKeysFromStorage,
    clearKeysFromStorage,
    pool,
    relays,
    formatTimestamp,
    getMetadata,
    getReactionCount
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
const hashtag = urlParams.get('tag');
const displayedNotes = new Set();
let showAllNostr = false;

if (!hashtag) {
    document.getElementById('hashtag-title').textContent = 'No hashtag specified';
    document.getElementById('timeline-loading').textContent = 'Please provide a hashtag.';
} else {
    document.getElementById('hashtag-title').textContent = `#${hashtag}`;
    document.getElementById('hashtag-name').textContent = `#${hashtag}`;
    loadHashtagPosts(hashtag);
}

document.getElementById('show-all-toggle').addEventListener('change', (e) => {
    showAllNostr = e.target.checked;
    displayedNotes.clear();
    document.getElementById('timeline').innerHTML = '';
    loadHashtagPosts(hashtag);
});

async function loadHashtagPosts(tag) {
    const timelineLoading = document.getElementById('timeline-loading');
    timelineLoading.style.display = 'block';
    timelineLoading.textContent = 'Loading posts...';
    
    try {
        const events = await pool.querySync(relays, {
            kinds: [1],
            '#t': [tag.toLowerCase()],
            limit: 100
        });
        
        events.sort((a, b) => b.created_at - a.created_at);
        
        timelineLoading.style.display = 'none';
        
        if (events.length === 0) {
            document.getElementById('timeline').innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No posts found with this hashtag.</div>';
            return;
        }
        
        let displayCount = 0;
        for (const event of events) {
            const shouldDisplay = showAllNostr || hasJoltClientTag(event);
            if (shouldDisplay) {
                await displayNote(event);
                displayCount++;
            }
        }
        
        if (displayCount === 0) {
            document.getElementById('timeline').innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No Jolt posts found with this hashtag. Try toggling to show all Nostr content.</div>';
        }
    } catch (error) {
        console.error('Error loading hashtag posts:', error);
        timelineLoading.textContent = 'Error loading posts.';
    }
}

function hasJoltClientTag(event) {
    return event.tags?.some(tag => tag[0] === 'client' && tag[1] === 'Jolt');
}

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
                <a href="post.html?id=${event.id}" class="reply-link">view</a>
                <span class="favorite-count" data-event-id="${event.id}"></span>
            </div>
        </div>
    `;
    
    timeline.insertBefore(sparkEl, timeline.firstChild);
    
    getReactionCount(event.id).then(count => {
        const countEl = sparkEl.querySelector('.favorite-count');
        if (count > 0 && countEl) {
            countEl.textContent = `★ ${count}`;
            countEl.style.color = '#ffcc00';
            countEl.style.marginLeft = '10px';
        }
    });
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

document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('spark-author') || e.target.classList.contains('clickable-avatar')) {
        e.preventDefault();
        const authorPubkey = e.target.dataset.author;
        const npub = await import('https://esm.sh/nostr-tools@2.7.2').then(m => m.nip19.npubEncode(authorPubkey));
        window.location.href = `profile.html?npub=${npub}`;
    }
});
