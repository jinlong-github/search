(() => {
  const results = document.querySelector('#results');
  const pane = document.querySelector('#researchDetailPane');
  if (!results || !pane) return;

  const params = () => new URLSearchParams(location.search);
  const placeholder = /当前数据源没有提供摘要|当前未获得.*摘要|可打开原始来源查看完整内容/;

  function writeDetail(value='') {
    const url = new URL(location.href);
    if (value) url.searchParams.set('detail', value);
    else url.searchParams.delete('detail');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function enforceSourceIntegrity() {
    const section = pane.querySelector('[data-detail-original-section]');
    const text = pane.querySelector('[data-detail-original]');
    if (!section || !text) return;
    const value = String(text.textContent || '').trim();
    if (placeholder.test(value)) {
      text.textContent = '';
      section.hidden = true;
      section.dataset.integrity = 'placeholder-hidden';
    } else if (value) {
      section.dataset.integrity = 'original-present';
    }
  }

  function targetCard(value) {
    const cards = [...results.querySelectorAll('.ux-result[data-key]')];
    if (!cards.length) return null;
    if (!value || value === 'first') return cards[0];
    return cards.find(card => card.dataset.key === value) || null;
  }

  function tryOpenFromUrl() {
    const value = params().get('detail');
    if (!value) return true;
    const card = targetCard(value);
    if (!card) return false;
    const button = card.querySelector('.research-preview-btn');
    if (!button) return false;
    if (!pane.classList.contains('open')) button.click();
    if (value === 'first') writeDetail(card.dataset.key || '');
    setTimeout(enforceSourceIntegrity, 0);
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (tryOpenFromUrl() || attempts >= 80) clearInterval(timer);
  }, 125);
  setTimeout(tryOpenFromUrl, 0);

  new MutationObserver(enforceSourceIntegrity).observe(pane, {
    childList:true,
    subtree:true,
    characterData:true,
    attributes:true,
    attributeFilter:['class']
  });

  document.addEventListener('click', event => {
    const close = event.target.closest('[data-detail-close]');
    if (close) {
      writeDetail('');
      return;
    }

    const preview = event.target.closest('.research-preview-btn');
    if (preview) {
      const card = preview.closest('.ux-result[data-key]');
      if (card?.dataset.key) writeDetail(card.dataset.key);
      setTimeout(enforceSourceIntegrity, 0);
      return;
    }

    const card = event.target.closest('.ux-result[data-key]');
    if (!card || event.target.closest('a,button,input,select,label')) return;
    if (card.dataset.key) writeDetail(card.dataset.key);
    setTimeout(enforceSourceIntegrity, 0);
  });

  document.addEventListener('keydown', event => {
    if (!pane.classList.contains('open')) return;
    if (!['j','k','ArrowDown','ArrowUp'].includes(event.key)) return;
    setTimeout(() => {
      const active = results.querySelector('.research-active-result[data-key]');
      if (active?.dataset.key) writeDetail(active.dataset.key);
      enforceSourceIntegrity();
    }, 0);
  });

  enforceSourceIntegrity();
})();
