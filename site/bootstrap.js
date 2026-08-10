(() => {
  // Load the presentation layer from one stable bootstrap hook so the long-lived
  // application script order in index.html stays untouched.
  const sciFiCss = document.createElement('link');
  sciFiCss.rel = 'stylesheet';
  sciFiCss.href = './sci-fi-v23.css?v=23';
  document.head.appendChild(sciFiCss);

  const sciFiScript = document.createElement('script');
  sciFiScript.src = './sci-fi-v23.js?v=23';
  sciFiScript.async = false;
  document.head.appendChild(sciFiScript);

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
