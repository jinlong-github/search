(() => {
  const results = document.querySelector('#results');
  if (!results) return;
  let working = false;
  let queued = false;

  function flattenResultSections() {
    if (working) return;
    const sections = [...results.querySelectorAll(':scope > .ux-section')];
    if (!sections.length) return;

    working = true;
    const cards = sections.flatMap(section => [...section.querySelectorAll('.ux-result')]);
    if (cards.length) {
      const stream = document.createElement('div');
      stream.className = 'ux-stream';
      cards.forEach(card => stream.appendChild(card));
      results.replaceChildren(stream);
    } else {
      results.innerHTML = '<div class="ux-empty-inline ux-empty-large">没有找到结果。</div>';
    }
    working = false;
  }

  function scheduleFlatten() {
    if (queued || working) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      flattenResultSections();
    });
  }

  new MutationObserver(scheduleFlatten).observe(results, { childList: true });
  document.addEventListener('click', event => {
    if (event.target.closest('.tab')) setTimeout(scheduleFlatten, 0);
  });
  scheduleFlatten();
})();
