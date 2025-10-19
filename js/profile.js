import { 
    getKeysFromStorage,
    clearKeysFromStorage,
    getMetadata,
    decodeNpub,
    getFollowList,
    pool,
    relays,
    formatTimestamp,
    publishMetadata,
    getPrivateKeyFromNsec,
    followUser,
    unfollowUser,
    isFollowing
} from './nostr.js';

import { shouldDisplayEvent } from './filters.js';

const keys = getKeysFromStorage();

if (!keys) {
    window.location.href = 'index.html';
}

const urlParams = new URLSearchParams(window.location.search);
const viewingNpub = urlParams.get('npub');
const isOwnProfile = !viewingNpub || viewingNpub === keys.npub;

const displayedNotes = new Set();
let filterSettings = {
    onlyJoltClient: false,
    filterCrypto: true,
    maxLength: 140,
    hideReplies: true
};

document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    clearKeysFromStorage();
    window.location.href = 'index.html';
});

document.getElementById('copy-npub-btn').addEventListener('click', () => {
    const npubInput = document.getElementById('profile-npub');
    npubInput.select();
    navigator.clipboard.writeText(npubInput.value);
    
    const btn = document.getElementById('copy-npub-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
        btn.textContent = originalText;
    }, 2000);
});

async function loadProfile() {
    try {
        const targetNpub = viewingNpub || keys.npub;
        const publicKey = decodeNpub(targetNpub);
        const metadata = await getMetadata(publicKey);
        
        if (metadata) {
            document.getElementById('profile-name').textContent = metadata.name || 'Anonymous';
            document.getElementById('profile-bio').textContent = metadata.about || 'No bio yet.';
            
            if (metadata.picture) {
                document.getElementById('profile-avatar').src = metadata.picture;
            } else {
                document.getElementById('profile-avatar').src = `https://api.dicebear.com/7.x/identicon/svg?seed=${publicKey}`;
            }

            if (metadata.sparkBgColor) {
                document.querySelector('.profile-header').style.backgroundColor = metadata.sparkBgColor;
            }
        } else {
            document.getElementById('profile-name').textContent = 'Anonymous';
            document.getElementById('profile-bio').textContent = 'No bio yet.';
            document.getElementById('profile-avatar').src = `https://api.dicebear.com/7.x/identicon/svg?seed=${publicKey}`;
        }
        
        const followList = await getFollowList(publicKey);
        document.getElementById('profile-following-count').textContent = followList.length;
        
        document.getElementById('profile-npub').value = targetNpub;

        if (!isOwnProfile) {
            const myPublicKey = decodeNpub(keys.npub);
            const following = await isFollowing(myPublicKey, publicKey);
            
            const followBtnContainer = document.createElement('div');
            followBtnContainer.style.marginTop = '10px';
            followBtnContainer.innerHTML = `
                <button id="follow-profile-btn" class="follow-btn" style="background: ${following ? '#ccc' : '#007bff'}; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px; font-size: 16px;">
                    ${following ? 'Following' : 'Follow'}
                </button>
            `;
            
            const profileKeyBox = document.getElementById('profile-key-box');
            if (profileKeyBox) {
                profileKeyBox.parentNode.insertBefore(followBtnContainer, profileKeyBox);
                
                document.getElementById('follow-profile-btn').addEventListener('click', async () => {
                    const button = document.getElementById('follow-profile-btn');
                    const isCurrentlyFollowing = button.textContent.trim() === 'Following';
                    
                    try {
                        const privateKey = getPrivateKeyFromNsec(keys.nsec);
                        
                        if (isCurrentlyFollowing) {
                            await unfollowUser(privateKey, publicKey);
                            button.textContent = 'Follow';
                            button.style.background = '#007bff';
                        } else {
                            await followUser(privateKey, publicKey);
                            button.textContent = 'Following';
                            button.style.background = '#ccc';
                        }
                    } catch (error) {
                        alert('Error updating follow: ' + error.message);
                    }
                });
            }
            
            if (profileKeyBox) {
                const strongTag = profileKeyBox.querySelector('strong');
                if (strongTag) {
                    strongTag.textContent = `${metadata?.name || 'User'}'s Public Key (npub):`;
                }
            }
            const timelineH3 = document.querySelector('.timeline h3');
            if (timelineH3) {
                timelineH3.textContent = `${metadata?.name || 'User'}'s Jolts`;
            }
            document.getElementById('copy-npub-btn').textContent = 'View Profile';
        } else {
            document.getElementById('bg-color-box').style.display = 'block';
            document.getElementById('edit-profile-box').style.display = 'block';
            document.getElementById('npub-box').style.display = 'block';
            
            if (metadata?.sparkBgColor) {
                document.getElementById('bg-color-picker').value = metadata.sparkBgColor;
            }
            
            document.getElementById('edit-name').value = metadata?.name || '';
            document.getElementById('edit-bio').value = metadata?.about || '';
            document.getElementById('edit-picture').value = metadata?.picture || '';
            
            const npubDisplay = document.getElementById('npub-display');
            if (npubDisplay) {
                npubDisplay.value = keys.npub;
            }
        }
        
        loadUserTimeline(publicKey);
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function loadUserTimeline(publicKey) {
    try {
        const events = await pool.querySync(relays, {
            kinds: [1],
            authors: [publicKey],
            limit: 50
        });
        
        events.sort((a, b) => b.created_at - a.created_at);
        
        const timeline = document.getElementById('user-timeline');
        const loading = document.getElementById('timeline-loading');
        
        if (events.length === 0) {
            loading.textContent = 'No sparks yet. Start posting!';
            return;
        }
        
        loading.style.display = 'none';
        
        for (const event of events) {
            if (shouldDisplayEvent(event, filterSettings)) {
                displayNote(event);
            }
        }
    } catch (error) {
        console.error('Error loading timeline:', error);
        document.getElementById('timeline-loading').textContent = 'Error loading sparks.';
    }
}

function displayNote(event) {
    if (displayedNotes.has(event.id)) return;
    displayedNotes.add(event.id);
    
    const timeline = document.getElementById('user-timeline');
    
    const sparkEl = document.createElement('div');
    sparkEl.className = 'spark';
    sparkEl.dataset.id = event.id;
    sparkEl.style.cursor = 'pointer';
    
    const clientTag = event.tags?.find(tag => tag[0] === 'client')?.[1] || 'Nostr';
    const clientText = clientTag === 'Jolt' ? 'from Jolt' : `from ${clientTag}`;
    
    sparkEl.innerHTML = `
        <div class="spark-content">
            <div class="spark-text">${escapeHtml(event.content)}</div>
            <div class="spark-meta">${formatTimestamp(event.created_at)} ${clientText}</div>
        </div>
    `;
    
    sparkEl.addEventListener('click', () => {
        window.location.href = `post.html?id=${event.id}`;
    });
    
    timeline.insertBefore(sparkEl, timeline.firstChild);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.getElementById('save-bg-color-btn')?.addEventListener('click', async () => {
    const color = document.getElementById('bg-color-picker').value;
    
    try {
        const publicKey = decodeNpub(keys.npub);
        const currentMetadata = await getMetadata(publicKey);
        
        const updatedMetadata = {
            ...currentMetadata,
            sparkBgColor: color
        };
        
        const privateKey = getPrivateKeyFromNsec(keys.nsec);
        await publishMetadata(privateKey, updatedMetadata);
        
        document.querySelector('.profile-header').style.backgroundColor = color;
        
        alert('Background color saved successfully!');
    } catch (error) {
        alert('Error saving background color: ' + error.message);
    }
});

document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('edit-name').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const picture = document.getElementById('edit-picture').value.trim();
    
    try {
        const publicKey = decodeNpub(keys.npub);
        const currentMetadata = await getMetadata(publicKey);
        
        const updatedMetadata = {
            ...currentMetadata,
            name: name || currentMetadata?.name,
            about: bio || currentMetadata?.about,
            picture: picture || currentMetadata?.picture
        };
        
        const privateKey = getPrivateKeyFromNsec(keys.nsec);
        await publishMetadata(privateKey, updatedMetadata);
        
        document.getElementById('profile-name').textContent = updatedMetadata.name || 'Anonymous';
        document.getElementById('profile-bio').textContent = updatedMetadata.about || 'No bio yet.';
        if (updatedMetadata.picture) {
            document.getElementById('profile-avatar').src = updatedMetadata.picture;
        }
        
        alert('Profile updated successfully!');
    } catch (error) {
        alert('Error updating profile: ' + error.message);
    }
});

document.getElementById('copy-npub-sidebar-btn')?.addEventListener('click', () => {
    const npubInput = document.getElementById('npub-display');
    if (npubInput) {
        npubInput.select();
        navigator.clipboard.writeText(npubInput.value);
        
        const btn = document.getElementById('copy-npub-sidebar-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }
});

loadProfile();
