(() => {
  const BUILD = '2026.08.08-01';

  function ensureHealthBox() {
    let box = document.querySelector('#sourceHealth');
    if (box) return box;
    const errorBox = document.querySelector('#errorBox');
    if (!errorBox) return null;
    box = document.createElement('div');
    box.id = 'sourceHealth';
    box.className = 'source-health';
    errorBox.parentNode.insertBefore(box, errorBox);
    return box;
  }

  function chip(label, stateName, text) {
    return `<span class="source-health-chip ${stateName}"><span class="source-health-dot"></span><strong>${esc(label)}</strong><span>${esc(text)}</span></span>`;
  }

  function renderHealth(detail='') {
    const box = ensureHealthBox();
    if (!box || !state.query) {
      if (box) box.hidden = true;
      return;
    }
    box.hidden = false;
    const errorText = (els.error && !els.error.classList.contains('hidden')) ? (els.error.textContent || '') : '';
    const paperCount = state.papers?.length || 0;
    const blogCount = state.blogs?.length || 0;
    const patentLive = state.patentMode === 'live';
    const webLive = state.webMode === 'live';

    const paperState = paperCount > 0 ? ['ok', `${paperCount} 条`] : [errorText.includes('OpenAlex') ? 'fail' : 'warn', errorText.includes('OpenAlex') ? '请求失败' : '0 条'];
    const blogState = blogCount > 0 ? ['ok', `${blogCount} 条`] : [errorText.includes('技术文章') || errorText.includes('Algolia') ? 'fail' : 'warn', errorText.includes('技术文章') || errorText.includes('Algolia') ? '请求失败' : '0 条'];
    const patentState = patentLive ? ['ok', `${state.patents?.length || 0} 条`] : ['neutral', '外部入口'];
    const webState = webLive ? ['ok', `${state.web?.length || 0} 条`] : ['neutral', '外部入口'];

    const bothEmpty = paperCount === 0 && blogCount === 0;
    const note = bothEmpty
      ? '<strong>论文和技术文章都没有返回。</strong> 这通常表示浏览器/网络拦截了跨站 API，或页面仍受旧缓存影响。'
      : '这里显示当前浏览器实际拿到的数据，不把“外部检索入口”算作搜索结果。';

    box.innerHTML = `<div class="source-health-head"><div class="source-health-title"><strong>数据源状态</strong></div><span class="source-health-build">build ${BUILD}</span></div>
      <div class="source-health-grid">
        ${chip('论文 · OpenAlex', paperState[0], paperState[1])}
        ${chip('技术文章 · HN', blogState[0], blogState[1])}
        ${chip('专利', patentState[0], patentState[1])}
        ${chip('官网 / Web', webState[0], webState[1])}
      </div>
      <p class="source-health-note">${note}</p>
      <div class="source-health-actions">
        <button type="button" id="diagnoseSources">检测数据源</button>
        <button type="button" id="resetSiteCache">清缓存并重新加载</button>
      </div>
      <div id="sourceHealthDetail" class="source-health-detail">${esc(detail)}</div>`;
  }

  async function probe(url, label) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const started = performance.now();
      const res = await fetch(url, {headers:{Accept:'application/json'}, signal:controller.signal, cache:'no-store'});
      const ms = Math.round(performance.now() - started);
      return `${label}: HTTP ${res.status} · ${ms} ms${res.ok ? ' · 正常' : ' · 异常'}`;
    } catch (error) {
      return `${label}: 失败 · ${error?.name || 'Error'} · ${error?.message || '请求被阻止'}`;
    } finally {
      clearTimeout(timer);
    }
  }

  async function diagnoseSources() {
    const btn = document.querySelector('#diagnoseSources');
    const detail = document.querySelector('#sourceHealthDetail');
    if (btn) { btn.disabled = true; btn.textContent = '检测中…'; }
    if (detail) detail.textContent = '正在从当前浏览器直接连接 OpenAlex 与 HN Algolia…';
    const [openalex, hn] = await Promise.all([
      probe('https://api.openalex.org/works?search=machine%20learning&per-page=1', 'OpenAlex'),
      probe('https://hn.algolia.com/api/v1/search?query=machine%20learning&tags=story&hitsPerPage=1', 'HN Algolia')
    ]);
    const text = `${openalex}\n${hn}`;
    if (detail) detail.textContent = text;
    if (btn) { btn.disabled = false; btn.textContent = '重新检测'; }
  }

  async function resetSiteCache() {
    const button = document.querySelector('#resetSiteCache');
    if (button) { button.disabled = true; button.textContent = '正在清理…'; }
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(reg => reg.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.startsWith('research-search-')).map(k => caches.delete(k)));
      }
    } catch {}
    const url = new URL(location.href);
    url.searchParams.set('fresh', Date.now().toString());
    location.replace(url.toString());
  }

  const previousPerformSearch = performSearch;
  performSearch = async function performSearchWithHealth(rawQuery) {
    await previousPerformSearch(rawQuery);
    renderHealth();
  };

  document.addEventListener('click', e => {
    if (e.target.closest('#diagnoseSources')) diagnoseSources();
    if (e.target.closest('#resetSiteCache')) resetSiteCache();
  });

  setTimeout(() => renderHealth(), 0);
})();
