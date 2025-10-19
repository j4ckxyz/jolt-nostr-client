export function loadTwemoji() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@twemoji/api@latest/dist/twemoji.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
        if (window.twemoji) {
            window.twemoji.parse(document.body, {
                folder: 'svg',
                ext: '.svg'
            });
            
            const observer = new MutationObserver(() => {
                window.twemoji.parse(document.body, {
                    folder: 'svg',
                    ext: '.svg'
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    };
    document.head.appendChild(script);
}
