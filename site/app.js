const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  query: '',
  activeTab: 'all',
  papers: [],
  blogs: [],
  paperTotal: 0,
  blogTotal: 0,
  saved: loadJSON('research-search:saved', {}),
  history: loadJSON('research-search:history', [])
};

const els = {
  form: $('#searchForm'), query: $('#queryInput'), workspace: $('#searchWorkspace'),
  results: $('#results'), loading: $('#loading'), error: $('#errorBox'), status: $('#statusLine'),
  title: $('#resultsTitle'), paperCount: $('#paperCount'), blogCount: $('#blogCount'), savedCount: $('#savedCount'),
  sort: $('#sortSelect'), year: $('#fromYear'), oa: $('#oaOnly'), historyDialog: $('#historyDialog'), historyList: $('#historyList')
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

async function performSearch(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (!query) { els.query.focus(); return; }
  state.query = query;
  els.query.value = query;
  els.workspace.classList.remove('hidden');
  els.loading.classList.remove('hidden');
  els.error.classList.add('hidden');
  els.results.innerHTML = '';
  els.status.textContent = '正在同时查询学术与技术数据源…';
  els.title.textContent = `“${query}”`;
  addHistory(query);
  const url = new URL(location.href); url.searchParams.set('q', query); history.replaceState(null,'',url);

  const settled = await Promise.allSettled([searchPapers(query), searchBlogs(query)]);
  const errors = settled.filter(x => x.status === 'rejected').map(x => x.reason?.message || '数据源请求失败');
  els.loading.classList.add('hidden');
  if (errors.length) { els.error.textContent = errors.join('；'); els.error.classList.remove('hidden'); }
  updateCounts();
  render();
}

function updateCounts() {
  els.paperCount.textContent = state.paperTotal ? fmtNumber(state.paperTotal) : '';
  els.blogCount.textContent = state.blogTotal ? fmtNumber(state.blogTotal) : '';
  els.savedCount.textContent = Object.keys(state.saved).length ? String(Object.keys(state.saved).length) : '';
}

function patentPortal(query) {
  const q = encodeURIComponent(query);
  return `<article class="portal-card">
    <span class="type-badge patent">PATENT</span>
    <h3>专利深度检索：${esc(query)}</h3>
    <p>GitHub Pages 是纯静态托管，不能安全保存 EPO / PatentsView 等服务端密钥。这里直接把同一查询送入专业专利数据库；后续接入独立 API 代理后，可在本页聚合专利族、权利要求、CPC/IPC 和法律状态。</p>
    <div class="portal-links">
      <a target="_blank" rel="noreferrer" href="https://patents.google.com/?q=${q}">Google Patents ↗</a>
      <a target="_blank" rel="noreferrer" href="https://worldwide.espacenet.com/patent/search?q=${q}">Espacenet ↗</a>
      <a target="_blank" rel="noreferrer" href="https://scholar.google.com/scholar?q=${q}">Google Scholar ↗</a>
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
function blogCard(b) {
  const saved = !!state.saved[b.key];
  return `<article class="result-card" data-key="${esc(b.key)}">
    <div class="result-top"><span class="type-badge blog">BLOG / WEB</span><button class="save-btn ${saved?'saved':''}" data-save="${esc(b.key)}" aria-label="收藏">${saved?'★':'☆'}</button></div>
    <h3><a href="${esc(b.url)}" target="_blank" rel="noreferrer">${esc(b.title)}</a></h3>
    <div class="meta"><span>${esc(b.domain)}</span><span>${fmtDate(b.date)}</span><span>HN ${fmtNumber(b.points)} points</span><span>${fmtNumber(b.comments)} comments</span></div>
    <div class="result-actions"><a href="${esc(b.url)}" target="_blank" rel="noreferrer">阅读原文 ↗</a><a href="${esc(b.hnUrl)}" target="_blank" rel="noreferrer">讨论 ↗</a></div>
  </article>`;
}

function render() {
  const tab = state.activeTab;
  $$('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
  let html = '';
  if (tab === 'patents') html = state.query ? patentPortal(state.query) : empty('先输入一个技术主题。');
  else if (tab === 'papers') html = state.papers.length ? state.papers.map(paperCard).join('') : empty('没有找到论文结果。');
  else if (tab === 'blogs') html = state.blogs.length ? state.blogs.map(blogCard).join('') : empty('没有找到技术文章结果。');
  else if (tab === 'saved') {
    const savedItems = Object.values(state.saved);
    html = savedItems.length ? savedItems.map(x => x.type === 'paper' ? paperCard(x) : blogCard(x)).join('') : empty('还没有收藏内容。搜索后点击 ☆ 即可收藏。');
  } else {
    const mixed = interleave(state.papers, state.blogs);
    html = state.query ? patentPortal(state.query) : '';
    html += mixed.length ? mixed.map(x => x.type === 'paper' ? paperCard(x) : blogCard(x)).join('') : empty('输入关键词开始搜索。');
  }
  els.results.innerHTML = html;
  const shown = tab === 'papers' ? state.papers.length : tab === 'blogs' ? state.blogs.length : tab === 'saved' ? Object.keys(state.saved).length : state.papers.length + state.blogs.length;
  els.status.textContent = state.query ? `当前展示 ${shown} 条聚合结果 · 论文总匹配 ${fmtNumber(state.paperTotal)} · 技术文章索引匹配 ${fmtNumber(state.blogTotal)}` : '准备搜索';
}
function empty(text) { return `<div class="empty-state">${esc(text)}</div>`; }
function interleave(a,b) {
  const out=[]; const max=Math.max(a.length,b.length);
  for(let i=0;i<max;i++){ if(a[i]) out.push(a[i]); if(b[i]) out.push(b[i]); }
  return out;
}

function findItem(key) { return state.papers.find(x=>x.key===key) || state.blogs.find(x=>x.key===key) || state.saved[key]; }
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
  const payload = { exportedAt:new Date().toISOString(), query:state.query, papers:state.papers, blogs:state.blogs, saved:Object.values(state.saved) };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`research-search-${Date.now()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

els.form.addEventListener('submit', e => { e.preventDefault(); performSearch(els.query.value); });
$$('[data-query]').forEach(btn => btn.addEventListener('click', () => performSearch(btn.dataset.query)));
$$('.tab').forEach(btn => btn.addEventListener('click', () => { state.activeTab=btn.dataset.tab; render(); }));
$('#applyFilters').addEventListener('click', () => state.query && performSearch(state.query));
els.results.addEventListener('click', e => { const btn=e.target.closest('[data-save]'); if(btn){ e.preventDefault(); toggleSave(btn.dataset.save); } });
$('#historyBtn').addEventListener('click', () => { renderHistory(); els.historyDialog.showModal(); });
$('#closeHistory').addEventListener('click', () => els.historyDialog.close());
$('#clearHistory').addEventListener('click', () => { state.history=[]; saveJSON('research-search:history',[]); renderHistory(); });
els.historyList.addEventListener('click', e => { const b=e.target.closest('[data-history-index]'); if(!b)return; const h=state.history[Number(b.dataset.historyIndex)]; els.historyDialog.close(); if(h) performSearch(h.q); });
$('#exportBtn').addEventListener('click', exportData);
$('#copyQueryBtn').addEventListener('click', async () => { if(!state.query)return; try{await navigator.clipboard.writeText(state.query); $('#copyQueryBtn').textContent='已复制'; setTimeout(()=>$('#copyQueryBtn').textContent='复制查询',1200);}catch{} });

updateCounts();
const initialQuery = new URLSearchParams(location.search).get('q');
if (initialQuery) performSearch(initialQuery);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
