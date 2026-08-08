(() => {
  const pane = document.querySelector('#researchDetailPane');
  if (!pane) return;

  const placeholder = /当前数据源没有提供摘要|当前未获得.*摘要|可打开原始来源查看完整内容/;

  function enforce() {
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

  new MutationObserver(enforce).observe(pane, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class']});
  document.addEventListener('click', event => {
    if (event.target.closest('.research-preview-btn,.ux-result[data-key],[data-detail-prev],[data-detail-next]')) setTimeout(enforce, 0);
  });
  enforce();
})();
