(() => {
  // Load the final presentation layer from one stable bootstrap hook.
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

  // v30 deliberately retires the fabricated sci-fi/HUD layers from v23/v26/v27.
  // Technology should feel credible through hierarchy, motion and real data—not fake telemetry.
  loadStyle('./product-v30.css?v=30');
  loadScript('./product-v30.js?v=30');

  // AI configuration remains intentionally limited to URL / API / Name.
  loadStyle('./simple-ai-v28.css?v=28');
  loadScript('./simple-ai-v28.js?v=28');
  loadStyle('./simple-settings-v29.css?v=29');

  // v29 intentionally mounts after every legacy deferred settings script has run.
  window.addEventListener('load', () => loadScript('./simple-settings-v29.js?v=29'), {once:true});

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
