(() => {
  const WORKER_URL_KEY = 'research-search:worker-url';
  const OFFICIAL_DOMAINS = [
    'openai.com','anthropic.com','deepmind.google','ai.google','research.google',
    'microsoft.com','nvidia.com','siemens.com','sw.siemens.com','autodesk.com',
    '3ds.com','ptc.com','arxiv.org','nature.com','science.org','ieee.org','acm.org',
    'epo.org','uspto.gov'
  ];

  state.web = [];
  state.webTotal = 0;
  state.webMode = 'portal';
  state.webError = '';
  state.patentBackend = '';

  Object.assign(els, {
    webCount: $('#webCount'),
    officialOnly: $('#officialOnly'),
    webSourceLabel: $('#webSourceLabel'),
    workerEndpoint: $('#workerEndpoint'),
    workerStatus: $('#workerStatus')
  });

  function normalizeWorkerUrl(raw='') {
    const value = String(raw).trim().replace(/\/+$/, '');
    if (!value) return '';
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost','127.0.0.1'].includes(u.hostname))) return '';
      return u.origin + u.pathname.replace(/\/+$/, '');
    } catch { return ''; }
  }
  function getWorkerUrl() { return normalizeWorkerUrl(localStorage.getItem(WORKER_URL_KEY) || ''); }
  function isOfficialDomain(domain='') {
    const d = String(domain).toLowerCase().replace(/^www\./,'');
    return OFFICIAL_DOMAINS.some(x => d === x || d.endsWith(`.${x}`));
  }
  async function workerGet(path, params={}) {
    const base = getWorkerUrl();
    if (!base) {
      const error = new Error('未配置 Cloudflare Worker');
      error.code = 'WORKER_NOT_CONFIGURED';
      throw error;
    }
    const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
    Object.entries(params).forEach(([k,v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
    const res = await fetch(url, {headers:{Accept:'application/json'}});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || data.message || `Worker 请求失败 (${res.status})`);
      error.status = res.status;
      error.code = data.code || 'WORKER_ERROR';
      throw error;
    }
    return data;
  }
  function normalizeWeb(item) {
    const url = safeUrl(item.url || '');
    const domain = item.domain || domainOf(url);
    return {
      key:`web:${url}`, type:'web', title:item.title || 'Untitled', url,
      description:truncate(item.description || '', 520), domain,
      age:item.age || '', official:item.official === true || isOfficialDomain(domain)
    };
  }
  async function searchWeb(query) {
    state.webError = '';
    if (!getWorkerUrl()) {
      state.web = [];
      state.webTotal = 0;
      state.webMode = 'portal';
      return;
    }
    try {
      const data = await workerGet('/api/web', {
        q: query,
        official: els.officialOnly?.checked ? '1' : '0',
        count: 20
      });
      state.web = (data.results || []).map(normalizeWeb);
      state.webTotal = data.total || state.web.length;
      state.webMode = 'live';
    } catch (error) {
      state.web = [];
      state.webTotal = 0;
      state.webMode = 'portal';
      state.webError = error.message || 'Web 搜索暂不可用';
    }
  }

  const browserPatentSearch = searchPatents;
  searchPatents = async function searchPatentsViaWorker(query) {
    if (!getWorkerUrl()) return browserPatentSearch(query);
    try {
      const data = await workerGet('/api/patents', {
        q: query,
        fromYear: Number(els.year.value) || '',
        sort: els.sort.value
      });
      let items = (data.patents || []).map(p => normalizePatent(p, query));
      if (els.sort.value === 'relevance') items.sort((a,b) => b.relevance - a.relevance || String(b.date).localeCompare(String(a.date)));
      if (els.sort.value === 'cited') items.sort((a,b) => b.references - a.references);
      state.patents = items.slice(0,20);
      state.patentTotal = data.total_hits || items.length;
      state.patentMode = 'live';
      state.patentBackend = 'worker';
      return;
    } catch (error) {
      if (error.code !== 'PATENT_KEY_MISSING' && error.status !== 503) {
        console.warn('Worker patent proxy failed, falling back to browser mode:', error);
      }
      state.patentBackend = '';
      return browserPatentSearch(query);
    }
  };

  function webPortal(query, compact=false) {
    const q = encodeURIComponent(query || '');
    const officialQ = encodeURIComponent(`${query || ''} (site:openai.com OR site:nvidia.com OR site:siemens.com OR site:autodesk.com OR site:3ds.com)`);
    const msg = state.webError
      ? `Worker 暂不可用：${esc(state.webError)}。你仍可直接打开外部搜索。`
      : '配置 Cloudflare Worker + Brave Search API 后，官网和全网结果会直接聚合到本站。';
    return `<article class="portal-card web-portal ${compact?'compact-portal':''}">
      <div class="portal-head"><span class="type-badge web">WEB</span><span class="source-state portal">${getWorkerUrl()?'Worker 已配置':'未配置 Worker'}</span></div>
      <h3>官网 / Web 搜索：${esc(query || '')}</h3>
      <p>${msg}</p>
      <div class="portal-links">
        <a target="_blank" rel="noreferrer" href="https://search.brave.com/search?q=${q}">Brave Search ↗</a>
        <a target="_blank" rel="noreferrer" href="https://www.google.com/search?q=${officialQ}">官网优先 Google ↗</a>
        <button class="inline-link" type="button" data-open-settings>配置 Worker</button>
      </div>
    </article>`;
  }
  function webCard(item) {
    return `<article class="result-card web-card">
      <div class="result-top"><div class="site-line"><span class="type-badge ${item.official?'official':'web'}">${item.official?'OFFICIAL':'WEB'}</span>${item.official?'<span class="official-mark">官网</span>':''}</div></div>
      <h3><a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.title)}</a></h3>
      <div class="meta"><span>${esc(item.domain)}</span>${item.age?`<span>${esc(item.age)}</span>`:''}</div>
      ${item.description?`<p class="abstract">${esc(item.description)}</p>`:''}
      <div class="result-actions"><a href="${esc(item.url)}" target="_blank" rel="noreferrer">打开网页 ↗</a></div>
    </article>`;
  }
  function webSection() {
    if (!state.query) return '';
    if (!state.web.length) return webPortal(state.query, true);
    const top = state.web.slice(0,6);
    return `<div class="source-section web-source-section"><div class="source-section-head"><strong>官网 / Web</strong><span>${state.web.length} 条本轮结果</span></div>${top.map(webCard).join('')}</div>`;
  }

  const baseUpdateCounts = updateCounts;
  updateCounts = function updateCountsWithWeb() {
    baseUpdateCounts();
    if (els.webCount) els.webCount.textContent = state.webMode === 'live' && state.webTotal ? fmtNumber(state.webTotal) : '';
    if (els.webSourceLabel) els.webSourceLabel.textContent = state.webMode === 'live' ? 'Web · Brave Search（Worker）' : 'Web · 外部搜索入口';
    if (state.patentBackend === 'worker' && els.patentSourceLabel) els.patentSourceLabel.textContent = '专利 · PatentsView（Worker）';
  };

  const baseRender = render;
  render = function renderWithWeb() {
    if (state.activeTab === 'web') {
      $$('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === 'web'));
      els.results.innerHTML = state.web.length ? state.web.map(webCard).join('') : (state.query ? webPortal(state.query) : empty('先输入一个技术主题。'));
      els.status.textContent = state.query
        ? `官网 / Web：当前展示 ${state.web.length} 条${els.officialOnly?.checked ? ' · 仅官网模式' : ''}`
        : '准备搜索';
      return;
    }
    baseRender();
    if (state.activeTab === 'all' && state.query) {
      els.results.insertAdjacentHTML('afterbegin', webSection());
      const baseShown = state.papers.length + state.patents.length + state.blogs.length;
      els.status.textContent = `当前展示 ${baseShown + state.web.length} 条 · 论文 ${fmtNumber(state.paperTotal)} · 专利 ${state.patentMode === 'live' ? fmtNumber(state.patentTotal) : '外部入口'} · 博客 ${fmtNumber(state.blogTotal)} · Web ${state.webMode === 'live' ? fmtNumber(state.webTotal) : '外部入口'}`;
    }
  };

  const baseOverview = renderOverview;
  renderOverview = function renderOverviewWithWeb() {
    baseOverview();
    if (!state.query || !els.overview) return;
    const grid = els.overview.querySelector('.overview-grid');
    if (!grid) return;
    const officialCount = state.web.filter(x => x.official).length;
    const topOfficial = state.web.find(x => x.official)?.domain || '';
    grid.insertAdjacentHTML('beforeend', `<div><small>官网 / Web 信号</small><strong>${state.webMode === 'live' ? `${officialCount} 个官网结果${topOfficial?` · ${esc(topOfficial)}`:''}` : '配置 Worker 后显示'}</strong></div>`);
  };

  const basePerformSearch = performSearch;
  performSearch = async function performSearchWithWeb(rawQuery) {
    const query = String(rawQuery || '').trim();
    if (!query) return basePerformSearch(rawQuery);
    const webPromise = searchWeb(query);
    await Promise.allSettled([basePerformSearch(query), webPromise]);
    updateCounts();
    renderOverview();
    render();
  };

  function syncWorkerSettings() {
    if (!els.workerEndpoint) return;
    els.workerEndpoint.value = getWorkerUrl();
    els.workerStatus.textContent = getWorkerUrl() ? '✓ 已配置 Worker' : '未配置；官网 / Web 将使用外部搜索入口';
  }
  async function testWorker() {
    const raw = els.workerEndpoint?.value || '';
    const normalized = normalizeWorkerUrl(raw);
    if (!normalized) {
      els.workerStatus.textContent = '请输入有效的 https://*.workers.dev 地址';
      return;
    }
    const previous = localStorage.getItem(WORKER_URL_KEY);
    localStorage.setItem(WORKER_URL_KEY, normalized);
    try {
      const data = await workerGet('/api/status');
      els.workerStatus.textContent = `✓ Worker 可用 · Web ${data.providers?.brave?'已配置':'未配置'} · PatentsView ${data.providers?.patentsview?'已配置':'未配置'}`;
    } catch (error) {
      els.workerStatus.textContent = `连接失败：${error.message}`;
      if (previous) localStorage.setItem(WORKER_URL_KEY, previous); else localStorage.removeItem(WORKER_URL_KEY);
    }
  }

  document.addEventListener('click', e => {
    if (e.target.closest('#settingsBtn,[data-open-settings]')) setTimeout(syncWorkerSettings, 0);
  });
  $('#testWorker')?.addEventListener('click', testWorker);
  $('#clearWorker')?.addEventListener('click', () => {
    localStorage.removeItem(WORKER_URL_KEY);
    if (els.workerEndpoint) els.workerEndpoint.value = '';
    if (els.workerStatus) els.workerStatus.textContent = '已清除 Worker';
    state.web = []; state.webTotal = 0; state.webMode = 'portal'; state.patentBackend = '';
    updateCounts(); render();
  });
  $('#saveSettings')?.addEventListener('click', () => {
    const value = normalizeWorkerUrl(els.workerEndpoint?.value || '');
    if (value) localStorage.setItem(WORKER_URL_KEY, value); else localStorage.removeItem(WORKER_URL_KEY);
    if (state.query) setTimeout(() => performSearch(state.query), 0);
  });

  syncWorkerSettings();
  updateCounts();
  if (state.query) searchWeb(state.query).then(() => { updateCounts(); renderOverview(); render(); });
})();
