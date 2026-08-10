(() => {
  function loadProviderTools() {
    if (!document.querySelector('link[data-provider-v23]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './provider-profiles-v23.css?v=23';
      link.dataset.providerV23 = '';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-provider-v23]')) {
      const script = document.createElement('script');
      script.src = './provider-profiles-v23.js?v=23';
      script.dataset.providerV23 = '';
      document.body.appendChild(script);
    }
  }

  function activateSection(dialog, target) {
    const body = dialog.querySelector('.settings-center-body');
    let found = false;
    dialog.querySelectorAll('[data-settings-section]').forEach(section => {
      const active = section.dataset.settingsSection === target;
      section.hidden = !active;
      section.classList.toggle('settings-section-active', active);
      if (active) found = true;
    });
    if (!found) return false;
    dialog.querySelectorAll('[data-settings-jump]').forEach(button => button.classList.toggle('active', button.dataset.settingsJump === target));
    if (body) body.scrollTop = 0;
    dialog.dataset.settingsActive = target;
    return true;
  }

  function installTabs(dialog) {
    if (dialog.dataset.settingsTabsV23 === '1') return;
    dialog.dataset.settingsTabsV23 = '1';
    dialog.addEventListener('click', event => {
      const button = event.target.closest('[data-settings-jump]');
      if (!button || !dialog.contains(button)) return;
      activateSection(dialog, button.dataset.settingsJump);
    });
    activateSection(dialog, dialog.dataset.settingsActive || 'ai');
  }

  loadProviderTools();

  const params = new URLSearchParams(location.search);
  const target = params.get('settings');
  const requested = target === 'provider' ? 'provider' : 'ai';
  const prepare = () => {
    const dialog = document.querySelector('#settingsDialog');
    if (!dialog) return;
    installTabs(dialog);
    if (target === '1' || target === 'provider') {
      if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
      [30,140,420].forEach(delay => setTimeout(() => activateSection(dialog, requested), delay));
    }
  };
  [60,220,700].forEach(delay => setTimeout(prepare, delay));
})();
