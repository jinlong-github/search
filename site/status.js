(() => {
  const BUILD = '2026.08.08-02';

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
    const paperLabel = state.paperBackend === 'crossref' ? '论文 · Crossref' : '论文';

    const paperFailed = errorText.includes('Crossref') || errorText.includes('论文数据源');
    const blogFailed = errorText.includes('技术文章') || errorText.includes('Algolia');
    const paperState = paperCount > 0 ? ['ok', `${paperCount} 条`] : [paperFailed ? 'fail' : 'warn', paperFailed ? '请求失败' : '本次 0 条'];
    const blogState = blogCount > 0 ? ['ok', `${blogCount} 条`] : [blogFailed ? 'fail' : 'warn', blogFailed ? '请求失败' : '本次 0 条'];
    const patentState = patentLive ? ['ok', `${state.patents?.length || 0} 条`] : ['neutral', '外部入口'];
    const webState = webLive ? ['ok', `${state.web?.length || 0} 条`] : ['neutral', '外部入口'];

    const bothEmpty = paperCount === 0 && blogCount === 0;
    const note = bothEmpty
      ? '<strong>本次论文和技术文章都没有命中。</strong> 点击“检测数据源”会用当前关键词重新请求，并显示每一路真实命中数。'
      : '这里显示当前这次查询实际拿到的数据；HTTP 200 只代表接口可访问，不等于当前关键词一定有命中。';

    box.innerHTML = `<div class="source-health-head"><div class="source-health-title"><strong>数据源状态</strong></div><span class="source-health-build">build ${BUILD}</span></div>
      <div class="source-health-grid">
        ${chip(paperLabel, paperState[0], paperState[1])}
        ${chip('技术文章 · HN', blogState[0], blogState[1])}
        ${chip('专利', patentState[0], patentState[1])}
        ${chip('官网 / Web', webState[0], webState[1])}
      </div>
      <p class="source-health-note">${note}</p>
      <div class="source-health-actions">
        <button type="button" id="diagnoseSources">检测当前查询</button>
        <button type="button" id="resetSiteCache">清缓存并重新加载</button>
      </div>
      <div id="sourceHealthDetail" class="source-health-detail">${esc(detail)}</div>`;
  }

  async function probeJson(url, label, countReader) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const started = performance.now();
      const res = await fetch(url, {headers:{Accept:'application/json'}, signal:controller.signal, cache:'no-store'});
      const ms = Math.round(performance.now() - started);
      if (!res.ok) return `${label}: HTTP ${res.status} · ${ms} ms · 异常`;
      const data = await res.json();
      const count = Number(countReader?.(data) || 0);
      return `${label}: HTTP ${res.status} · ${ms} ms · 当前查询匹配 ${fmtNumber(count)} 条`;
    } catch (error) {
      return `${label}: 失败 · ${error?.name || 'Error'} · ${error?.message || '请求被阻止'}`;
    } finally {
      clearTimeout(timer);
    }
  }

  async function diagnoseSources() {
    const btn = document.querySelector('#diagnoseSources');
    const detail = document.querySelector('#sourceHealthDetail');
    const query = String(state.query || els.query?.value || 'machine learning').trim() || 'machine learning';
    if (btn) { btn.disabled = true; btn.textContent = '检测中…'; }
    if (detail) detail.textContent = `正在用当前关键词“${query}”检测 Crossref 与 HN Algolia…`;

    const crossref = new URL('https://api.crossref.org/works');
    crossref.searchParams.set('query.bibliographic', query);
    crossref.searchParams.set('rows', '1');
    const hn = new URL('https://hn.algolia.com/api/v1/search');
    hn.searchParams.set('query', query);
    hn.searchParams.set('tags', 'story');
    hn.searchParams.set('hitsPerPage', '1');

    const [papers, blogs] = await Promise.all([
      probeJson(crossref, 'Crossref', data => data.message?.['total-results']),
      probeJson(hn, 'HN Algolia', data => data.nbHits)
    ]);
    const text = `${papers}\n${blogs}`;
    if (detail) detail.textContent = text;
    if (btn) { btn.disabled = false; btn.textContent = '重新检测当前查询'; }
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
