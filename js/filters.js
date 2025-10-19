export const CHIRP_CLIENT_TAG = 'Jolt';

export const CRYPTO_BLOCKLIST = {
    emojis: [
        '₿', '🪙', '💰', '⚡', '🚀', '📈', '📉', '💎', '🙌', '🌕', '🔥'
    ],
    
    hashtags: [
        '#bitcoin', '#btc', '#crypto', '#cryptocurrency', '#blockchain',
        '#ethereum', '#eth', '#defi', '#nft', '#web3', '#hodl', '#lambo',
        '#moon', '#sats', '#satoshi', '#lightning', '#ln', '#zap', '#zaps',
        '#stackingsats', '#bitcoinmining', '#cryptomining', '#altcoin',
        '#coinbase', '#binance', '#kraken', '#trading', '#cryptotrading',
        '#investing', '#profit', '#gains', '#bullish', '#bearish', '#pump',
        '#dump', '#shitcoin', '#memecoin', '#dogecoin', '#doge', '#shib',
        '#matic', '#ada', '#cardano', '#solana', '#sol', '#polygon',
        '#bitcoiner', '#nocoiner', '#hyperbitcoinization', '#onlyzaps',
        '#plebs', '#plebchain', '#value4value', '#v4v', '#coffeechain',
        '#21million', '#fixtheproblems', '#stackharder'
    ],
    
    keywords: [
        'bitcoin', 'btc', 'satoshi', 'sats', 'cryptocurrency', 'crypto',
        'blockchain', 'ethereum', 'hodl', 'lambo', 'moon', 'mooning',
        'lightning network', 'lightning', 'zap', 'zapped', 'zapping',
        'stacking sats', 'stacking', 'mining', 'cryptomining', 'altcoin',
        'shitcoin', 'memecoin', 'dogecoin', 'defi', 'nft', 'web3',
        'coinbase', 'binance', 'kraken', 'exchange', 'wallet',
        'cold storage', 'hardware wallet', 'seed phrase', 'private key',
        'public key', 'nocoiner', 'hyperbitcoinization', 'circular economy',
        'freedom money', 'sound money', 'hard money', 'fiat', 'inflation',
        'central bank', 'fed', 'dollar milkshake', 'cantillon effect',
        'plebs', 'plebchain', 'value4value', 'v4v', 'coffeechain',
        '21 million', 'fix the money', 'stack harder', 'proof of work',
        'proof of stake', 'consensus', 'node', 'full node', 'mining rig',
        'nsfw', 'porn', 'pornography', 'xxx', 'nude', 'nudes', 'naked',
        'boobs', 'tits', 'ass', 'pussy', 'dick', 'cock', 'sex', 'sexy',
        'onlyfans', 'adult', 'explicit', '18+', 'nsfl'
    ],
    
    patterns: [
        /\b(btc|eth|doge|shib|ada|sol|matic)\b/gi,
        /\b\d+\s*(sats?|satoshis?)\b/gi,
        /\b(buy|sell|trading?|invest(ing)?)\s+(bitcoin|crypto|btc)/gi,
        /₿/g,
        /⚡\s*\d+/g,
        /\$\d+k?\s*(bitcoin|btc|eth)/gi,
        /to\s+the\s+moon/gi,
        /wen\s+(moon|lambo)/gi,
        /not\s+your\s+keys/gi,
        /\bhyperbitcoinization\b/gi,
        /\bstacksats\b/gi,
        /\bhodl\b/gi,
        /\bplebchain\b/gi
    ],
    
    domains: [
        'coinbase.com', 'binance.com', 'kraken.com', 'bitcoin.org',
        'blockchain.com', 'lightning.network', 'strike.me',
        'cash.app/bitcoin', 'river.com', 'swan.com'
    ]
};

export function containsCryptoContent(text) {
    if (!text || typeof text !== 'string') return false;
    
    const lowerText = text.toLowerCase();
    
    for (const emoji of CRYPTO_BLOCKLIST.emojis) {
        if (text.includes(emoji)) return true;
    }
    
    for (const hashtag of CRYPTO_BLOCKLIST.hashtags) {
        if (lowerText.includes(hashtag.toLowerCase())) return true;
    }
    
    for (const keyword of CRYPTO_BLOCKLIST.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(text)) return true;
    }
    
    for (const pattern of CRYPTO_BLOCKLIST.patterns) {
        if (pattern.test(text)) return true;
    }
    
    for (const domain of CRYPTO_BLOCKLIST.domains) {
        if (lowerText.includes(domain)) return true;
    }
    
    return false;
}

export function getClientFromEvent(event) {
    if (!event || !event.tags || !Array.isArray(event.tags)) return null;
    
    const clientTag = event.tags.find(tag => 
        Array.isArray(tag) && 
        tag.length >= 2 && 
        tag[0] === 'client'
    );
    
    return clientTag ? clientTag[1] : null;
}

export function isFromJoltClient(event) {
    const client = getClientFromEvent(event);
    return client === CHIRP_CLIENT_TAG || client === 'Chirp';
}

export function isReply(event) {
    if (!event || !event.tags || !Array.isArray(event.tags)) return false;
    
    return event.tags.some(tag => 
        Array.isArray(tag) && 
        tag.length >= 2 && 
        tag[0] === 'e'
    );
}

export function shouldDisplayEvent(event, options = {}) {
    const {
        onlyJoltClient = false,
        filterCrypto = true,
        maxLength = 140,
        hideReplies = true
    } = options;
    
    if (!event || !event.content) return false;
    
    if (event.content.length > maxLength) {
        return false;
    }
    
    if (hideReplies && isReply(event)) {
        return false;
    }
    
    if (filterCrypto && containsCryptoContent(event.content)) {
        return false;
    }
    
    if (event.tags) {
        for (const tag of event.tags) {
            if (Array.isArray(tag) && tag.length > 1) {
                const tagContent = tag.join(' ');
                if (filterCrypto && containsCryptoContent(tagContent)) {
                    return false;
                }
            }
        }
    }
    
    if (onlyJoltClient && !isFromJoltClient(event)) {
        return false;
    }
    
    return true;
}
