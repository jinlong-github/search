(() => {
  'use strict';

  // Presentation assets now live directly in index.html so the browser has one
  // deterministic first paint. Bootstrap is deliberately limited to cache hygiene.
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
