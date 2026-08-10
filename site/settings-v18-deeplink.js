(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('settings') !== '1') return;
  const open = () => {
    const dialog = document.querySelector('#settingsDialog');
    if (!dialog || typeof dialog.showModal !== 'function') return;
    if (!dialog.open) dialog.showModal();
  };
  [80,260,800].forEach(delay => setTimeout(open,delay));
})();
