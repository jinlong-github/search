(() => {
  // Keep one deterministic presentation bootstrap. Business scripts remain in index.html.
  const loadStyle = (href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  };

  const loadScript = (src) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  };

  // AI configuration remains intentionally limited to URL / API / Name.
  loadStyle('./simple-ai-v28.css?v=28');
  loadScript('./simple-ai-v28.js?v=28');
  loadStyle('./simple-settings-v29.css?v=29');

  // v31 replaces the former v30/v26 visual shells with one reference-driven layout.
  // It restructures existing DOM while preserving all stable IDs and business handlers.
  loadStyle('./reference-v31.css?v=31');

  window.addEventListener('load', () => {
    loadScript('./simple-settings-v29.js?v=29');
    loadScript('./reference-v31.js?v=31');
  }, {once:true});

  // Live research depends on current APIs; stale service-worker caches are counterproductive.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => Promise.all(regs.map(reg => reg.unregister())))
      .catch(() => {});
    try {
      navigator.serviceWorker.register = () => Promise.resolve(null);
    } catch {}
  }

  if ('caches' in window) {
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('research-search-')).map(k => caches.delete(k))))
      .catch(() => {});
  }
})();
