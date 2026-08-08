(() => {
  const DENSITY_KEY = 'research-search:density';
  const workspace = document.querySelector('#searchWorkspace');
  const results = document.querySelector('#results');
  const densityButton = document.querySelector('#densityToggle');
  const queryInput = document.querySelector('#queryInput');

  function currentDensity() {
    const saved = localStorage.getItem(DENSITY_KEY);
    return saved === 'compact' ? 'compact' : 'comfortable';
  }

  function setDensity(mode) {
    const value = mode === 'compact' ? 'compact' : 'comfortable';
    document.documentElement.dataset.density = value;
    localStorage.setItem(DENSITY_KEY, value);
    if (densityButton) {
      densityButton.dataset.mode = value;
      densityButton.textContent = value === 'compact' ? '舒适视图' : '紧凑视图';
      densityButton.setAttribute('aria-pressed', value === 'compact' ? 'true' : 'false');
    }
  }

  function syncWorkspaceMode() {
    const active = workspace && !workspace.classList.contains('hidden');
    document.body.classList.toggle('workspace-mode', Boolean(active));
  }

  function activeTab() {
    return document.querySelector('.tab.active')?.dataset.tab || 'all';
  }

  function syncScopedFilters() {
    const tab = activeTab();
    const oaRow = document.querySelector('#oaOnly')?.closest('.check-row');
    const officialRow = document.querySelector('#officialOnly')?.closest('.check-row');
    const yearBlock = document.querySelector('#fromYear')?.closest('.filter-block');

    if (oaRow) oaRow.classList.toggle('ui-filter-hidden', !['all', 'papers'].includes(tab));
    if (officialRow) officialRow.classList.toggle('ui-filter-hidden', !['all', 'web'].includes(tab));
    if (yearBlock) yearBlock.classList.toggle('ui-filter-muted', tab === 'saved');
  }

  function enhanceDescriptions(root = document) {
    root.querySelectorAll('.ux-description').forEach(block => {
      if (block.dataset.enhanced === '1') return;
      block.dataset.enhanced = '1';
      const p = block.querySelector('p');
      if (!p || p.textContent.trim().length < 120) return;
      block.classList.add('is-collapsed');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ux-description-toggle';
      button.textContent = '展开原始摘要';
      button.addEventListener('click', () => {
        const expanded = block.classList.toggle('is-expanded');
        block.classList.toggle('is-collapsed', !expanded);
        button.textContent = expanded ? '收起原始摘要' : '展开原始摘要';
      });
      block.appendChild(button);
    });
  }

  setDensity(currentDensity());
  syncWorkspaceMode();
  syncScopedFilters();
  enhanceDescriptions(document);

  densityButton?.addEventListener('click', () => {
    setDensity(document.documentElement.dataset.density === 'compact' ? 'comfortable' : 'compact');
  });

  if (workspace) {
    new MutationObserver(syncWorkspaceMode).observe(workspace, {attributes:true, attributeFilter:['class']});
  }

  if (results) {
    new MutationObserver(() => enhanceDescriptions(results)).observe(results, {childList:true, subtree:true});
  }

  document.addEventListener('click', event => {
    if (event.target.closest('.tab')) setTimeout(syncScopedFilters, 0);
  });

  document.addEventListener('keydown', event => {
    if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
      event.preventDefault();
      queryInput?.focus();
    }
    if (event.key === 'Escape' && document.activeElement === queryInput) queryInput.blur();
  });
})();
