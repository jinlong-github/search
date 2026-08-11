(() => {
  // Load presentation layers from one stable bootstrap hook so the long-lived
  // application script order in index.html stays untouched.
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

  loadStyle('./sci-fi-v23.css?v=23');
  loadScript('./sci-fi-v23.js?v=23');
  loadStyle('./ultimate-v26.css?v=26');
  loadScript('./ultimate-v26.js?v=26');
  loadStyle('./clarity-v27.css?v=27');
  loadScript('./clarity-v27.js?v=27');
  loadStyle('./simple-ai-v28.css?v=28');
  loadScript('./simple-ai-v28.js?v=28');

  // Reliability-first bootstrap: this search app depends on live APIs, so stale
  // service-worker caches are more harmful than offline support during development.
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