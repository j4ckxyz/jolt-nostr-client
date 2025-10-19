import { 
    getKeysFromStorage,
    clearKeysFromStorage
} from './nostr.js';

const keys = getKeysFromStorage();

if (!keys) {
    window.location.href = 'index.html';
}

const DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.nostr.band',
    'wss://nostr.wine'
];

document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    clearKeysFromStorage();
    window.location.href = 'index.html';
});

const filterSettings = JSON.parse(localStorage.getItem('jolt_filters') || '{"onlyJoltClient": false, "hideReplies": true, "showAllNostr": false}');

document.getElementById('filter-spark-client').checked = filterSettings.onlyJoltClient || false;
document.getElementById('filter-replies').checked = filterSettings.hideReplies !== false;
document.getElementById('show-all-nostr').checked = filterSettings.showAllNostr || false;

const customRelays = JSON.parse(localStorage.getItem('jolt_relays') || 'null');
if (customRelays) {
    document.getElementById('custom-relays').value = customRelays.join('\n');
} else {
    document.getElementById('custom-relays').value = DEFAULT_RELAYS.join('\n');
}

document.getElementById('save-filters-btn').addEventListener('click', () => {
    const newSettings = {
        onlyJoltClient: document.getElementById('filter-spark-client').checked,
        hideReplies: document.getElementById('filter-replies').checked,
        showAllNostr: document.getElementById('show-all-nostr').checked,
        filterCrypto: !document.getElementById('show-all-nostr').checked
    };
    
    localStorage.setItem('jolt_filters', JSON.stringify(newSettings));
    
    alert('Filter settings saved! Refresh your timeline to see changes.');
});

document.getElementById('save-relays-btn').addEventListener('click', () => {
    const relaysText = document.getElementById('custom-relays').value;
    const relays = relaysText.split('\n')
        .map(r => r.trim())
        .filter(r => r.startsWith('wss://') || r.startsWith('ws://'));
    
    if (relays.length === 0) {
        alert('Please enter at least one valid relay URL (starting with wss:// or ws://)');
        return;
    }
    
    localStorage.setItem('jolt_relays', JSON.stringify(relays));
    alert('Relays saved! Refresh the page to connect to new relays.');
});

document.getElementById('reset-relays-btn').addEventListener('click', () => {
    localStorage.removeItem('jolt_relays');
    document.getElementById('custom-relays').value = DEFAULT_RELAYS.join('\n');
    alert('Relays reset to defaults! Refresh the page to reconnect.');
});

const mediaSettings = JSON.parse(localStorage.getItem('jolt_media_settings') || '{"showYouTubeEmbeds": true, "showTwitterEmbeds": true, "showImages": true, "lowDataMode": false}');

document.getElementById('low-data-mode').checked = mediaSettings.lowDataMode || false;
document.getElementById('show-images').checked = mediaSettings.showImages !== false;
document.getElementById('show-youtube-embeds').checked = mediaSettings.showYouTubeEmbeds !== false;
document.getElementById('show-twitter-embeds').checked = mediaSettings.showTwitterEmbeds !== false;

document.getElementById('low-data-mode').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.getElementById('show-images').checked = false;
        document.getElementById('show-images').disabled = true;
    } else {
        document.getElementById('show-images').disabled = false;
    }
});

if (mediaSettings.lowDataMode) {
    document.getElementById('show-images').disabled = true;
}

document.getElementById('save-media-btn').addEventListener('click', () => {
    const newMediaSettings = {
        lowDataMode: document.getElementById('low-data-mode').checked,
        showImages: document.getElementById('low-data-mode').checked ? false : document.getElementById('show-images').checked,
        showYouTubeEmbeds: document.getElementById('show-youtube-embeds').checked,
        showTwitterEmbeds: document.getElementById('show-twitter-embeds').checked
    };
    
    localStorage.setItem('jolt_media_settings', JSON.stringify(newMediaSettings));
    alert('Media settings saved! Refresh your timeline to see changes.');
});
