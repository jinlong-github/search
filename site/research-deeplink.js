(() => {
  const results = document.querySelector('#results');
  if (!results) return;

  const params = () => new URLSearchParams(location.search);

  function writeDetail(value='') {
    const url = new URL(location.href);
    if (value) url.searchParams.set('detail', value);
    else url.searchParams.delete('detail');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
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
    if (!document.querySelector('#researchDetailPane.open')) button.click();
    if (value === 'first') writeDetail(card.dataset.key || '');
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (tryOpenFromUrl() || attempts >= 80) clearInterval(timer);
  }, 125);
  setTimeout(tryOpenFromUrl, 0);

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
      return;
    }

    const card = event.target.closest('.ux-result[data-key]');
    if (!card || event.target.closest('a,button,input,select,label')) return;
    if (card.dataset.key) writeDetail(card.dataset.key);
  });

  document.addEventListener('keydown', event => {
    if (!document.querySelector('#researchDetailPane.open')) return;
    if (!['j','k','ArrowDown','ArrowUp'].includes(event.key)) return;
    setTimeout(() => {
      const active = results.querySelector('.research-active-result[data-key]');
      if (active?.dataset.key) writeDetail(active.dataset.key);
    }, 0);
  });
})();
