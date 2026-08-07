const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const PATENT_API = 'https://search.patentsview.org/api/v1/patent/';
const PATENT_KEY_LOCAL = 'research-search:patentsview-key';
const PATENT_KEY_SESSION = 'research-search:patentsview-key-session';

const state = {
  query: '',
  activeTab: 'all',
  papers: [],
  patents: [],
  blogs: [],
  paperTotal: 0,
  patentTotal: 0,
  blogTotal: 0,
  patentMode: 'portal',
  saved: loadJSON('research-search:saved', {}),
  history: loadJSON('research-search:history', [])
};

const els = {
  form: $('#searchForm'), query: $('#queryInput'), workspace: $('#searchWorkspace'),
  results: $('#results'), loading: $('#loading'), error: $('#errorBox'), status: $('#statusLine'),
  title: $('#resultsTitle'), paperCount: $('#paperCount'), patentCount: $('#patentCount'),
  blogCount: $('#blogCount'), savedCount: $('#savedCount'), overview: $('#overviewBox'),
  sort: $('#sortSelect'), year: $('#fromYear'), oa: $('#oaOnly'),
  historyDialog: $('#historyDialog'), historyList: $('#historyList'),
  settingsDialog: $('#settingsDialog'), patentApiKey: $('#patentApiKey'),
  rememberPatentKey: $('#rememberPatentKey'), patentKeyStatus: $('#patentKeyStatus'),
  patentSourceLabel: $('#patentSourceLabel')
};

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function esc(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function safeUrl(value='') {
  try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; }
}
function fmtNumber(n) { return Number(n || 0).toLocaleString('zh-CN'); }
function fmtDate(value) {
  if (!value) return '日期未知';
  try { return new Intl.DateTimeFormat('zh-CN', {year:'numeric',month:'short',day:'numeric'}).format(new Date(value)); } catch { return value; }
}
function domainOf(url) { try { return new URL(url).hostname.replace(/^www\./,''); } catch { return '网页'; } }
function abstractFromInverted(inv) {
  if (!inv || typeof inv !== 'object') return '';
  const pairs = [];
  for (const [word, positions] of Object.entries(inv)) for (const pos of positions || []) pairs.push([pos, word]);
  pairs.sort((a,b) => a[0]-b[0]);
  return pairs.map(p => p[1]).join(' ');
}
function truncate(text, max=420) { const s = String(text || '').trim(); return s.length > max ? `${s.slice(0,max).trim()}…` : s; }
function words(value='') {
  return String(value).toLowerCase().match(/[a-z][a-z0-9-]{2,}|[\u4e00-\u9fff]{2,6}/g) || [];
}
function getPatentKey() {
  return sessionStorage.getItem(PATENT_KEY_SESSION) || localStorage.getItem(PATENT_KEY_LOCAL) || '';
}
function hasPatentKey() { return !!getPatentKey(); }

function paperUrl(p) { return safeUrl(p.doi || p.primary_location?.landing_page_url || p.id); }
function normalizePaper(p) {
  const authors = (p.authorships || []).slice(0,5).map(a => a.author?.display_name).filter(Boolean);
  return {
    key: `paper:${p.id}`, type:'paper', id:p.id, title:p.display_name || p.title || 'Untitled',
    url: paperUrl(p), authors, year:p.publication_year, date:p.publication_date,
    citations:p.cited_by_count || 0, oa:!!p.open_access?.is_oa,
    venue:p.primary_location?.source?.display_name || p.type || 'Paper',
    abstract:truncate(abstractFromInverted(p.abstract_inverted_index)), doi:p.doi || ''
  };
}
function normalizeBlog(h) {
  const url = safeUrl(h.url || '');
  return {
    key:`blog:${h.objectID}`, type:'blog', id:h.objectID, title:h.title || h.story_title || 'Untitled',
    url, author:h.author || '', date:h.created_at, points:h.points || 0, comments:h.num_comments || 0,
    domain:domainOf(url), hnUrl:`https://news.ycombinator.com/item?id=${encodeURIComponent(h.objectID)}`
  };
}
function normalizePatent(p, query) {
  const assignees = (p.assignees || []).map(a => a.assignee_organization).filter(Boolean).slice(0,4);
  const title = p.patent_title || 'Untitled patent';
  const abstract = truncate(p.patent_abstract || '', 520);
  const qTokens = words(query).filter(x => x.length > 2);
  const titleText = title.toLowerCase();
  const abstractText = abstract.toLowerCase();
  let relevance = 0;
  for (const token of qTokens) {
    if (titleText.includes(token)) relevance += 4;
    if (abstractText.includes(token)) relevance += 1;
  }
  const id = String(p.patent_id || '').replace(/^US/i,'');
  return {
    key:`patent:${id}`, type:'patent', id, title, abstract,
    url:`https://patents.google.com/patent/US${encodeURIComponent(id)}/en`,
    date:p.patent_date, year:p.patent_year, assignees,
    references:p.patent_num_total_documents_cited || 0, relevance
  };
}

async function searchPapers(query) {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', query);
  url.searchParams.set('per-page', '20');
  const filters = [];
  const year = Number(els.year.value);
  if (year >= 1900 && year <= 2100) filters.push(`from_publication_date:${year}-01-01`);
  if (els.oa.checked) filters.push('is_oa:true');
  if (filters.length) url.searchParams.set('filter', filters.join(','));
  if (els.sort.value === 'cited') url.searchParams.set('sort', 'cited_by_count:desc');
  if (els.sort.value === 'newest') url.searchParams.set('sort', 'publication_date:desc');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenAlex 请求失败 (${res.status})`);
  const data = await res.json();
  state.paperTotal = data.meta?.count || 0;
  state.papers = (data.results || []).map(normalizePaper);
}

async function searchBlogs(query) {
  const url = new URL('https://hn.algolia.com/api/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('tags', 'story');
  url.searchParams.set('hitsPerPage', '30');
  if (els.sort.value === 'newest') url.pathname = '/api/v1/search_by_date';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`技术文章请求失败 (${res.status})`);
  const data = await res.json();
  let items = (data.hits || []).filter(h => h.url).map(normalizeBlog);
  const year = Number(els.year.value);
  if (year >= 1900 && year <= 2100) items = items.filter(x => new Date(x.date).getFullYear() >= year);
  if (els.sort.value === 'cited') items.sort((a,b) => b.points - a.points);
  state.blogTotal = data.nbHits || items.length;
  state.blogs = items.slice(0,20);
}

async function searchPatents(query) {
  const apiKey = getPatentKey();
  if (!apiKey) {
    state.patents = [];
    state.patentTotal = 0;
    state.patentMode = 'portal';
    return;
  }

  const textCriterion = {
    _or: [
      {_text_any: {patent_title: query}},
      {_text_any: {patent_abstract: query}}
    ]
  };
  const year = Number(els.year.value);
  const criteria = [textCriterion];
  if (year >= 1900 && year <= 2100) criteria.push({_gte: {patent_date: `${year}-01-01`}});
  const q = criteria.length > 1 ? {_and: criteria} : criteria[0];

  const url = new URL(PATENT_API);
  url.searchParams.set('q', JSON.stringify(q));
  url.searchParams.set('f', JSON.stringify([
    'patent_id','patent_title','patent_date','patent_year','patent_abstract',
    'patent_num_total_documents_cited','assignees.assignee_organization'
  ]));
  url.searchParams.set('o', JSON.stringify({size:25}));
  if (els.sort.value === 'newest') url.searchParams.set('s', JSON.stringify([{patent_date:'desc'}]));

  const res = await fetch(url, {headers:{'X-Api-Key': apiKey, 'Accept':'application/json'}});
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('PatentsView Key 无效或无权限，请在“设置”中检查');
    throw new Error(`PatentsView 请求失败 (${res.status})`);
  }
  const data = await res.json();
  let items = (data.patents || []).map(p => normalizePatent(p, query));
  if (els.sort.value === 'relevance') items.sort((a,b) => b.relevance - a.relevance || String(b.date).localeCompare(String(a.date)));
  if (els.sort.value === 'cited') items.sort((a,b) => b.references - a.references);
  state.patentTotal = data.total_hits || items.length;
  state.patents = items.slice(0,20);
  state.patentMode = 'live';
}

async function performSearch(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (!query) { els.query.focus(); return; }
  state.query = query;
  els.query.value = query;
  els.workspace.classList.remove('hidden');
  els.loading.classList.remove('hidden');
  els.error.classList.add('hidden');
  els.overview.classList.add('hidden');
  els.results.innerHTML = '';
  els.status.textContent = hasPatentKey() ? '正在同时查询论文、专利与技术文章…' : '正在查询论文与技术文章；专利使用专业库入口…';
  els.title.textContent = `“${query}”`;
  addHistory(query);
  const url = new URL(location.href); url.searchParams.set('q', query); history.replaceState(null,'',url);

  const settled = await Promise.allSettled([searchPapers(query), searchPatents(query), searchBlogs(query)]);
  const errors = settled.filter(x => x.status === 'rejected').map(x => x.reason?.message || '数据源请求失败');
  els.loading.classList.add('hidden');
  if (errors.length) { els.error.textContent = errors.join('；'); els.error.classList.remove('hidden'); }
  updateCounts();
  renderOverview();
  render();
}

function updateCounts() {
  els.paperCount.textContent = state.paperTotal ? fmtNumber(state.paperTotal) : '';
  els.patentCount.textContent = state.patentMode === 'live' && state.patentTotal ? fmtNumber(state.patentTotal) : '';
  els.blogCount.textContent = state.blogTotal ? fmtNumber(state.blogTotal) : '';
  els.savedCount.textContent = Object.keys(state.saved).length ? String(Object.keys(state.saved).length) : '';
  els.patentSourceLabel.textContent = state.patentMode === 'live' ? '专利 · PatentsView（实时）' : '专利 · Google Patents / Espacenet';
}

function patentPortal(query, compact=false) {
  const q = encodeURIComponent(query);
  return `<article class="portal-card ${compact?'compact-portal':''}">
    <div class="portal-head"><span class="type-badge patent">PATENT</span><span class="source-state">${hasPatentKey()?'实时接口暂不可用':'未配置 PatentsView Key'}</span></div>
    <h3>专利深度检索：${esc(query)}</h3>
    <p>${hasPatentKey() ? '本次未获得 PatentsView 实时结果，你仍可继续使用专业专利库。' : '配置 PatentsView API Key 后，专利将直接聚合到本页；不配置也可以继续使用下面的专业数据库入口。'}</p>
    <div class="portal-links">
      <a target="_blank" rel="noreferrer" href="https://patents.google.com/?q=${q}">Google Patents ↗</a>
      <a target="_blank" rel="noreferrer" href="https://worldwide.espacenet.com/patent/search?q=${q}">Espacenet ↗</a>
      <button class="inline-link" type="button" data-open-settings>配置专利 API</button>
    </div>
  </article>`;
}

function paperCard(p) {
  const saved = !!state.saved[p.key];
  const authors = p.authors.length ? p.authors.join(', ') + (p.authors.length >= 5 ? ' 等' : '') : '作者未知';
  return `<article class="result-card" data-key="${esc(p.key)}">
    <div class="result-top"><span class="type-badge">PAPER</span><button class="save-btn ${saved?'saved':''}" data-save="${esc(p.key)}" aria-label="收藏">${saved?'★':'☆'}</button></div>
    <h3><a href="${esc(p.url)}" target="_blank" rel="noreferrer">${esc(p.title)}</a></h3>
    <div class="meta"><span>${esc(authors)}</span><span>${esc(p.venue)}</span><span>${esc(p.year || '年份未知')}</span><span>引用 ${fmtNumber(p.citations)}</span>${p.oa?'<span>开放获取</span>':''}</div>
    ${p.abstract?`<p class="abstract">${esc(p.abstract)}</p>`:''}
    <div class="result-actions"><a href="${esc(p.url)}" target="_blank" rel="noreferrer">打开论文 ↗</a>${p.doi?`<a href="${esc(safeUrl(p.doi))}" target="_blank" rel="noreferrer">DOI</a>`:''}</div>
  </article>`;
}
function patentCard(p) {
  const saved = !!state.saved[p.key];
  const assignees = p.assignees.length ? p.assignees.join(' · ') : '申请人/受让人未知';
  return `<article class="result-card patent-card" data-key="${esc(p.key)}">
    <div class="result-top"><span class="type-badge patent">PATENT</span><button class="save-btn ${saved?'saved':''}" data-save="${esc(p.key)}" aria-label="收藏">${saved?'★':'☆'}</button></div>
    <h3><a href="${esc(p.url)}" target="_blank" rel="noreferrer">${esc(p.title)}</a></h3>
    <div class="meta"><span>US${esc(p.id)}</span><span>${esc(assignees)}</span><span>${fmtDate(p.date)}</span><span>参考文献 ${fmtNumber(p.references)}</span></div>
    ${p.abstract?`<p class="abstract">${esc(p.abstract)}</p>`:''}
    <div class="result-actions"><a href="${esc(p.url)}" target="_blank" rel="noreferrer">Google Patents ↗</a><a href="https://ppubs.uspto.gov/pubwebapp/" target="_blank" rel="noreferrer">USPTO ↗</a></div>
  </article>`;
}
function blogCard(b) {
  const saved = !!state.saved[b.key];
  return `<article class="result-card" data-key="${esc(b.key)}">
    <div class="result-top"><span class="type-badge blog">BLOG / WEB</span><button class="save-btn ${saved?'saved':''}" data-save="${esc(b.key)}" aria-label="收藏">${saved?'★':'☆'}</button></div>
    <h3><a href="${esc(b.url)}" target="_blank" rel="noreferrer">${esc(b.title)}</a></h3>
    <div class="meta"><span>${esc(b.domain)}</span><span>${fmtDate(b.date)}</span><span>HN ${fmtNumber(b.points)} points</span><span>${fmtNumber(b.comments)} comments</span></div>
    <div class="result-actions"><a href="${esc(b.url)}" target="_blank" rel="noreferrer">阅读原文 ↗</a><a href="${esc(b.hnUrl)}" target="_blank" rel="noreferrer">讨论 ↗</a></div>
  </article>`;
}
function cardFor(x) {
  if (x.type === 'paper') return paperCard(x);
  if (x.type === 'patent') return patentCard(x);
  return blogCard(x);
}

function render() {
  const tab = state.activeTab;
  $$('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
  let html = '';
  if (tab === 'patents') {
    if (state.patents.length) html = state.patents.map(patentCard).join('');
    else html = state.query ? patentPortal(state.query) : empty('先输入一个技术主题。');
  } else if (tab === 'papers') html = state.papers.length ? state.papers.map(paperCard).join('') : empty('没有找到论文结果。');
  else if (tab === 'blogs') html = state.blogs.length ? state.blogs.map(blogCard).join('') : empty('没有找到技术文章结果。');
  else if (tab === 'saved') {
    const savedItems = Object.values(state.saved);
    html = savedItems.length ? savedItems.map(cardFor).join('') : empty('还没有收藏内容。搜索后点击 ☆ 即可收藏。');
  } else {
    const mixed = interleaveThree(state.papers, state.patents, state.blogs);
    if (!state.patents.length && state.query) html += patentPortal(state.query, true);
    html += mixed.length ? mixed.map(cardFor).join('') : empty('输入关键词开始搜索。');
  }
  els.results.innerHTML = html;
  const shown = tab === 'papers' ? state.papers.length :
    tab === 'patents' ? state.patents.length :
    tab === 'blogs' ? state.blogs.length :
    tab === 'saved' ? Object.keys(state.saved).length :
    state.papers.length + state.patents.length + state.blogs.length;
  const patentStatus = state.patentMode === 'live' ? `专利总匹配 ${fmtNumber(state.patentTotal)}` : '专利未启用实时 API';
  els.status.textContent = state.query ? `当前展示 ${shown} 条 · 论文 ${fmtNumber(state.paperTotal)} · ${patentStatus} · 技术文章 ${fmtNumber(state.blogTotal)}` : '准备搜索';
}
function empty(text) { return `<div class="empty-state">${esc(text)}</div>`; }
function interleaveThree(a,b,c) {
  const out=[]; const max=Math.max(a.length,b.length,c.length);
  for(let i=0;i<max;i++){ if(a[i]) out.push(a[i]); if(b[i]) out.push(b[i]); if(c[i]) out.push(c[i]); }
  return out;
}

const STOP = new Set([
  'the','and','for','with','from','using','based','into','method','methods','system','systems',
  'model','models','study','analysis','approach','towards','through','this','that','these','those',
  'computer','research','design','data','paper','new','via','toward','application','applications',
  '一种','方法','系统','基于','技术','研究','应用','用于','以及','通过','相关','进行','实现'
]);
function topTerms() {
  const freq = new Map();
  const docs = [
    ...state.papers.map(x => `${x.title} ${x.abstract}`),
    ...state.patents.map(x => `${x.title} ${x.abstract}`),
    ...state.blogs.map(x => x.title)
  ];
  docs.forEach(text => {
    const seen = new Set();
    words(text).forEach(w => {
      if (w.length < 3 || STOP.has(w) || seen.has(w)) return;
      seen.add(w);
      freq.set(w, (freq.get(w) || 0) + 1);
    });
  });
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w])=>w);
}
function mostCommon(values) {
  const m = new Map();
  values.filter(Boolean).forEach(v => m.set(v,(m.get(v)||0)+1));
  return [...m.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || '';
}
function renderOverview() {
  if (!state.query) return;
  const terms = topTerms();
  const topVenue = mostCommon(state.papers.map(x=>x.venue));
  const topAssignee = mostCommon(state.patents.flatMap(x=>x.assignees));
  const dates = [...state.papers, ...state.patents, ...state.blogs].map(x=>x.date).filter(Boolean).sort().reverse();
  const newest = dates[0] ? fmtDate(dates[0]) : '未知';
  const patentSignal = state.patentMode === 'live'
    ? `已接入 ${fmtNumber(state.patentTotal)} 条专利匹配`
    : '专利实时聚合尚未启用';
  const chips = terms.length ? terms.map(t=>`<span>${esc(t)}</span>`).join('') : '<span>等待更多结果</span>';
  els.overview.innerHTML = `<div class="overview-top">
      <div><span class="overview-label">TECH INTELLIGENCE</span><h3>技术情报概览</h3></div>
      <span class="overview-mode">本地聚合 · 无需 AI Key</span>
    </div>
    <p class="overview-summary">围绕“${esc(state.query)}”，当前同时观察学术、专利与工程社区信号。${esc(patentSignal)}；本轮最新结果日期为 ${esc(newest)}。</p>
    <div class="overview-grid">
      <div><small>高频主题</small><div class="topic-chips">${chips}</div></div>
      <div><small>论文主要来源</small><strong>${esc(topVenue || '暂无')}</strong></div>
      <div><small>专利主要申请人</small><strong>${esc(topAssignee || (state.patentMode === 'live' ? '暂无' : '配置 API 后显示'))}</strong></div>
    </div>`;
  els.overview.classList.remove('hidden');
}

function findItem(key) {
  return state.papers.find(x=>x.key===key) || state.patents.find(x=>x.key===key) || state.blogs.find(x=>x.key===key) || state.saved[key];
}
function toggleSave(key) {
  if (state.saved[key]) delete state.saved[key]; else { const item=findItem(key); if(item) state.saved[key]=item; }
  saveJSON('research-search:saved', state.saved); updateCounts(); render();
}
function addHistory(query) {
  state.history = [{q:query,at:new Date().toISOString()}, ...state.history.filter(x=>x.q.toLowerCase()!==query.toLowerCase())].slice(0,20);
  saveJSON('research-search:history', state.history);
}
function renderHistory() {
  els.historyList.innerHTML = state.history.length ? state.history.map((h,i)=>`<div class="history-item"><button data-history-index="${i}">${esc(h.q)}</button><time>${fmtDate(h.at)}</time></div>`).join('') : '<div class="empty-state">暂无搜索历史</div>';
}
function exportData() {
  const payload = {
    exportedAt:new Date().toISOString(), query:state.query,
    papers:state.papers, patents:state.patents, blogs:state.blogs,
    patentMode:state.patentMode, saved:Object.values(state.saved)
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`research-search-${Date.now()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function openSettings() {
  const local = localStorage.getItem(PATENT_KEY_LOCAL) || '';
  const session = sessionStorage.getItem(PATENT_KEY_SESSION) || '';
  els.patentApiKey.value = session || local;
  els.rememberPatentKey.checked = !!local;
  els.patentKeyStatus.textContent = hasPatentKey() ? '✓ 已配置 PatentsView Key' : '未配置；专利将使用外部专业库入口';
  els.settingsDialog.showModal();
}
function saveSettings() {
  const key = els.patentApiKey.value.trim();
  localStorage.removeItem(PATENT_KEY_LOCAL);
  sessionStorage.removeItem(PATENT_KEY_SESSION);
  if (key) {
    if (els.rememberPatentKey.checked) localStorage.setItem(PATENT_KEY_LOCAL, key);
    else sessionStorage.setItem(PATENT_KEY_SESSION, key);
  }
  els.settingsDialog.close();
  state.patentMode = key ? 'live' : 'portal';
  updateCounts();
  if (state.query) performSearch(state.query);
}
function clearPatentKey() {
  localStorage.removeItem(PATENT_KEY_LOCAL);
  sessionStorage.removeItem(PATENT_KEY_SESSION);
  els.patentApiKey.value = '';
  els.rememberPatentKey.checked = false;
  els.patentKeyStatus.textContent = '已清除';
  state.patents = [];
  state.patentTotal = 0;
  state.patentMode = 'portal';
  updateCounts();
  if (state.query) { renderOverview(); render(); }
}

els.form.addEventListener('submit', e => { e.preventDefault(); performSearch(els.query.value); });
$$('[data-query]').forEach(btn => btn.addEventListener('click', () => performSearch(btn.dataset.query)));
$$('.tab').forEach(btn => btn.addEventListener('click', () => { state.activeTab=btn.dataset.tab; render(); }));
$('#applyFilters').addEventListener('click', () => state.query && performSearch(state.query));
els.results.addEventListener('click', e => {
  const saveBtn=e.target.closest('[data-save]');
  if(saveBtn){ e.preventDefault(); toggleSave(saveBtn.dataset.save); return; }
  if(e.target.closest('[data-open-settings]')) openSettings();
});
$('#settingsBtn').addEventListener('click', openSettings);
$('#closeSettings').addEventListener('click', () => els.settingsDialog.close());
$('#saveSettings').addEventListener('click', saveSettings);
$('#clearPatentKey').addEventListener('click', clearPatentKey);
$('#historyBtn').addEventListener('click', () => { renderHistory(); els.historyDialog.showModal(); });
$('#closeHistory').addEventListener('click', () => els.historyDialog.close());
$('#clearHistory').addEventListener('click', () => { state.history=[]; saveJSON('research-search:history',[]); renderHistory(); });
els.historyList.addEventListener('click', e => {
  const b=e.target.closest('[data-history-index]');
  if(!b)return;
  const h=state.history[Number(b.dataset.historyIndex)];
  els.historyDialog.close();
  if(h) performSearch(h.q);
});
$('#exportBtn').addEventListener('click', exportData);
$('#copyQueryBtn').addEventListener('click', async () => {
  if(!state.query)return;
  try{
    await navigator.clipboard.writeText(state.query);
    $('#copyQueryBtn').textContent='已复制';
    setTimeout(()=>$('#copyQueryBtn').textContent='复制查询',1200);
  }catch{}
});

state.patentMode = hasPatentKey() ? 'live' : 'portal';
updateCounts();
const initialQuery = new URLSearchParams(location.search).get('q');
if (initialQuery) performSearch(initialQuery);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
