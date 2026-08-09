(() => {
  const results = document.querySelector('#results');
  const workspace = document.querySelector('#searchWorkspace');
  const contentGrid = document.querySelector('.content-grid');
  const queryInput = document.querySelector('#queryInput');
  if (!results || !workspace || !contentGrid || !queryInput) return;

  const VIEW_KEY = 'research-os:view';
  const EVIDENCE_KEY = 'research-os:evidence-meta';
  const STOP = new Set([
    'the','and','for','with','from','into','using','based','study','analysis','this','that','these','those','method','methods','approach','results','paper','system','systems','model','models','research','application','applications','towards','through','design','data','new','via','toward','computer',
    '一种','方法','系统','基于','技术','研究','应用','用于','以及','通过','相关','进行','实现','结果','分析','模型','论文'
  ]);
  const VIEWS = [
    ['search','检索','SRCH'],['map','研究地图','MAP'],['timeline','时间演进','TIME'],['entities','实体情报','ENT'],['evidence','证据板','EVD'],['path','技术脉络','PATH']
  ];
  const LANES = [
    ['inbox','待研判'],['support','支持'],['counter','反证'],['method','方法'],['prior','先验 / Prior Art']
  ];
  const clean = value => String(value ?? '').replace(/\s+/g,' ').trim();
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const clamp = (value,min=0,max=100) => Math.max(min,Math.min(max,value));
  const load = (key,fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const save = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); } catch {} };
  const hash = value => {
    let h = 2166136261;
    for (const char of String(value || '')) { h ^= char.charCodeAt(0); h = Math.imul(h,16777619); }
    return h >>> 0;
  };

  let activeView = 'search';
  let stage = null;
  let rail = null;
  let statusbar = null;
  let viewbar = null;
  let palette = null;
  let evidenceMeta = load(EVIDENCE_KEY,{});
  let focusRegistry = new Map();
  let renderTimer = 0;
  let internalMutationDepth = 0;

  function stateSafe() {
    try { return state; } catch { return {query:'',papers:[],patents:[],blogs:[],web:[],saved:{}}; }
  }
  function queryText() {
    const current = stateSafe();
    return clean(current.query || queryInput.value);
  }
  function tokens(value='') {
    return [...new Set(clean(value).toLowerCase().match(/[a-z0-9][a-z0-9+.#-]{2,}|[\u3400-\u9fff]{2,6}/g) || [])]
      .filter(token => token.length > 1 && !STOP.has(token));
  }
  function typeLabel(type) {
    return ({paper:'论文',patent:'专利',blog:'技术文章',official:'官网',web:'Web'})[type] || '记录';
  }
  function cardType(card) {
    if (card.classList.contains('ux-paper')) return 'paper';
    if (card.classList.contains('ux-patent')) return 'patent';
    if (card.classList.contains('ux-blog')) return 'blog';
    if (card.classList.contains('ux-official')) return 'official';
    return 'web';
  }
  function stateMap() {
    const current = stateSafe();
    const map = new Map();
    [current.papers || [],current.patents || [],current.blogs || [],current.web || []].forEach(group => group.forEach(item => item?.key && map.set(item.key,item)));
    Object.entries(current.saved || {}).forEach(([key,item]) => { if (!map.has(key)) map.set(key,item); });
    return map;
  }
  function domRecord(card) {
    const type = cardType(card);
    const metrics = [...card.querySelectorAll('.ux-metrics span')].map(node => clean(node.textContent));
    const yearValue = metrics.find(value => /^\d{4}$/.test(value));
    const citationValue = metrics.find(value => /^引用\s/.test(value));
    const pointValue = metrics.find(value => /^HN\s/i.test(value));
    const authorsText = clean(card.querySelector('.ux-authors')?.textContent);
    const source = clean(card.querySelector('.ux-source-name')?.textContent);
    return {
      key:card.dataset.key || '',type,title:clean(card.querySelector('.ux-title')?.textContent),
      url:card.querySelector('.ux-title a')?.href || '',summaryZh:clean(card.querySelector('.ux-zh-summary p')?.textContent),
      abstract:clean(card.querySelector('.ux-description p')?.textContent),source,
      venue:type === 'paper' ? source : '',domain:['blog','official','web'].includes(type) ? source : '',
      authors:authorsText ? authorsText.split(/[、,]/).map(clean).filter(Boolean) : [],
      year:yearValue ? Number(yearValue) : null,citations:citationValue ? Number(citationValue.replace(/[^\d]/g,'')) || 0 : 0,
      points:pointValue ? Number(pointValue.replace(/[^\d]/g,'')) || 0 : 0,
      signal:Number(card.dataset.researchSignal || 0) || 0
    };
  }
  function normalizeItem(item,key='') {
    if (!item) return null;
    const type = item.type || (String(key).startsWith('paper:') ? 'paper' : String(key).startsWith('patent:') ? 'patent' : String(key).startsWith('blog:') ? 'blog' : 'web');
    let year = Number(item.year || item.publication_year || 0) || null;
    if (!year && item.date) {
      const parsed = new Date(item.date);
      if (!Number.isNaN(parsed.getTime())) year = parsed.getFullYear();
    }
    return {
      ...item,key:item.key || key,type,title:clean(item.title || item.display_name || 'Untitled'),
      summaryZh:clean(item.summaryZh || ''),abstract:clean(item.abstract || item.description || item.snippet || ''),
      authors:Array.isArray(item.authors) ? item.authors.filter(Boolean) : item.author ? [item.author] : [],
      assignees:Array.isArray(item.assignees) ? item.assignees.filter(Boolean) : [],
      venue:clean(item.venue || ''),domain:clean(item.domain || ''),source:clean(item.source || item.venue || item.domain || ''),
      year,citations:Number(item.citations || item.cited_by_count || 0) || 0,points:Number(item.points || 0) || 0,
      references:Number(item.references || 0) || 0,signal:Number(item.signal || 0) || 0,url:item.url || item.doi || ''
    };
  }
  function records() {
    const cards = [...results.querySelectorAll('.ux-result[data-key]')];
    const domMap = new Map(cards.map(card => [card.dataset.key,domRecord(card)]));
    const current = stateSafe();
    const list = [];
    const seen = new Set();
    [current.papers || [],current.patents || [],current.blogs || [],current.web || []].flat().forEach(item => {
      const base = normalizeItem(item,item?.key || '');
      if (!base?.key || seen.has(base.key)) return;
      const dom = domMap.get(base.key);
      list.push({...base,...(dom || {}),authors:base.authors?.length ? base.authors : dom?.authors || [],summaryZh:base.summaryZh || dom?.summaryZh || '',abstract:base.abstract || dom?.abstract || '',signal:dom?.signal || base.signal || 0});
      seen.add(base.key);
    });
    cards.forEach(card => {
      if (!seen.has(card.dataset.key)) { list.push(domRecord(card)); seen.add(card.dataset.key); }
    });
    return list.filter(item => item.key && item.title);
  }
  function savedRecords() {
    const current = stateSafe();
    return Object.entries(current.saved || {}).map(([key,item]) => normalizeItem(item,key)).filter(Boolean);
  }
  function sourceFor(item) {
    if (item.type === 'paper') return clean(item.venue || item.source || 'Crossref');
    if (item.type === 'patent') return clean(item.assignees?.[0] || (item.id ? `US${item.id}` : 'Patent'));
    return clean(item.domain || item.source || (() => { try { return new URL(item.url).hostname.replace(/^www\./,''); } catch { return ''; } })());
  }
  function impactFor(item) {
    if (item.signal) return clamp(item.signal);
    const raw = item.type === 'paper' ? item.citations : item.type === 'blog' ? item.points : item.type === 'patent' ? item.references : 0;
    return clamp(Math.round(Math.log10(Number(raw || 0) + 1) / 2.2 * 100));
  }
  function queryScore(item) {
    const query = tokens(queryText());
    if (!query.length) return impactFor(item);
    const title = clean(item.title).toLowerCase();
    const body = clean(`${item.summaryZh || ''} ${item.abstract || ''}`).toLowerCase();
    let score = 0;
    query.forEach(token => { if (title.includes(token)) score += 12; else if (body.includes(token)) score += 4; });
    return score + impactFor(item) * .18;
  }
  function conceptTerms(list,limit=6) {
    const freq = new Map();
    list.forEach(item => {
      const seen = new Set();
      tokens(`${item.title} ${item.summaryZh || ''} ${item.abstract || ''}`).slice(0,35).forEach(token => {
        if (seen.has(token)) return;
        seen.add(token);
        freq.set(token,(freq.get(token) || 0) + 1);
      });
    });
    const minimum = list.length >= 12 ? 2 : 1;
    return [...freq.entries()].filter(([,count]) => count >= minimum).sort((a,b) => b[1]-a[1] || b[0].length-a[0].length).slice(0,limit).map(([term,count]) => ({term,count}));
  }
  function itemConcept(item,concepts) {
    const title = clean(item.title).toLowerCase();
    const body = clean(`${item.summaryZh || ''} ${item.abstract || ''}`).toLowerCase();
    let best = null;
    concepts.forEach(concept => {
      let score = 0;
      if (title.includes(concept.term)) score += 4;
      if (body.includes(concept.term)) score += 1;
      if (!best || score > best.score) best = {...concept,score};
    });
    return best?.score > 0 ? best.term : '其他';
  }

  function writeText(node,value) {
    if (!node) return;
    const next = String(value ?? '');
    if (node.textContent !== next) node.textContent = next;
  }
  function withInternalMutation(callback) {
    internalMutationDepth += 1;
    try { return callback(); }
    finally { queueMicrotask(() => { internalMutationDepth = Math.max(0,internalMutationDepth - 1); }); }
  }

  function ensureShell() {
    if (document.querySelector('#researchOsRail')) return;
    document.body.classList.add('research-os-ready');
    const brandSmall = document.querySelector('.brand-copy small');
    writeText(brandSmall,'INTELLIGENCE OPERATING SYSTEM');

    rail = document.createElement('aside');
    rail.id = 'researchOsRail';
    rail.className = 'research-os-rail';
    rail.setAttribute('aria-label','Research OS 导航');
    rail.innerHTML = `<div class="research-os-rail-brand"><span>R</span></div><nav class="research-os-nav">${VIEWS.map(([view,label,icon],index) => `<button type="button" data-os-view="${view}" aria-label="${label}" title="${label}"><span class="os-icon">${icon}</span><span class="os-label">${label} · Alt+${index+1}</span>${view === 'evidence' ? '<span class="os-badge" data-os-evidence-count hidden></span>' : ''}</button>`).join('')}</nav><div class="research-os-rail-foot"><span class="research-os-cmd-key">⌘K</span></div>`;
    document.body.appendChild(rail);

    statusbar = document.createElement('div');
    statusbar.id = 'researchOsStatusbar';
    statusbar.className = 'research-os-statusbar';
    statusbar.innerHTML = '<i class="research-os-status-dot"></i><span>SESSION</span><strong data-os-status-query>READY</strong><span data-os-status-results>0 records</span><span data-os-status-sources>0 sources</span><span data-os-status-evidence>0 evidence</span><span class="os-status-push">LOCAL HEURISTICS · SOURCE-FIRST</span>';
    document.body.appendChild(statusbar);

    const controlbar = document.querySelector('.research-controlbar');
    viewbar = document.createElement('div');
    viewbar.id = 'researchOsViewbar';
    viewbar.className = 'research-os-viewbar';
    viewbar.innerHTML = VIEWS.map(([view,label]) => `<button type="button" data-os-view="${view}">${label}</button>`).join('') + '<span class="os-viewbar-spacer"></span><span class="research-os-session-chip">SESSION <b data-os-viewbar-count>0</b></span>';
    if (controlbar) controlbar.insertAdjacentElement('afterend',viewbar); else contentGrid.prepend(viewbar);

    stage = document.createElement('section');
    stage.id = 'researchOsStage';
    stage.className = 'research-os-stage';
    const resultsPane = document.querySelector('.results-pane');
    if (resultsPane) resultsPane.insertAdjacentElement('beforebegin',stage); else contentGrid.appendChild(stage);

    palette = document.createElement('div');
    palette.id = 'researchCommandPalette';
    palette.className = 'research-command-palette';
    palette.setAttribute('aria-hidden','true');
    palette.innerHTML = '<div class="research-command-box" role="dialog" aria-modal="true" aria-label="命令面板"><div class="research-command-search"><span>⌘K</span><input type="text" autocomplete="off" placeholder="跳转视图或执行命令…" aria-label="搜索命令"></div><div class="research-command-results"></div></div>';
    document.body.appendChild(palette);

    rail.addEventListener('click',event => { const button = event.target.closest('[data-os-view]'); if (button) setView(button.dataset.osView); });
    viewbar.addEventListener('click',event => { const button = event.target.closest('[data-os-view]'); if (button) setView(button.dataset.osView); });
    stage.addEventListener('click',handleStageClick);
    stage.addEventListener('change',handleStageChange);
    palette.addEventListener('click',event => {
      if (event.target === palette) closePalette();
      const button = event.target.closest('[data-os-command]');
      if (button) runCommand(button.dataset.osCommand);
    });
    palette.querySelector('input').addEventListener('input',renderCommands);
    palette.querySelector('input').addEventListener('keydown',event => {
      if (event.key === 'Enter') {
        const first = palette.querySelector('.research-command-item');
        if (first) { event.preventDefault(); runCommand(first.dataset.osCommand); }
      }
    });
  }

  function updateChrome() {
    const list = records();
    const saved = savedRecords();
    const sourceCount = new Set(list.map(item => sourceFor(item)).filter(Boolean)).size;
    document.querySelectorAll('[data-os-view]').forEach(button => button.classList.toggle('active',button.dataset.osView === activeView));
    document.querySelectorAll('[data-os-evidence-count]').forEach(node => {
      writeText(node,saved.length);
      node.hidden = !saved.length;
    });
    writeText(statusbar?.querySelector('[data-os-status-query]'),queryText() || 'READY');
    writeText(statusbar?.querySelector('[data-os-status-results]'),`${list.length} records`);
    writeText(statusbar?.querySelector('[data-os-status-sources]'),`${sourceCount} sources`);
    writeText(statusbar?.querySelector('[data-os-status-evidence]'),`${saved.length} evidence`);
    writeText(viewbar?.querySelector('[data-os-viewbar-count]'),`${list.length} records · ${saved.length} evidence`);
  }

  function setView(view,{historyMode=true}={}) {
    if (!VIEWS.some(([name]) => name === view)) view = 'search';
    activeView = view;
    document.body.dataset.researchOsView = view;
    save(VIEW_KEY,view);
    updateChrome();
    if (view !== 'search') renderView();
    if (historyMode) {
      const url = new URL(location.href);
      if (view === 'search') url.searchParams.delete('view'); else url.searchParams.set('view',view);
      history.replaceState(null,'',url);
    }
  }

  function stageShell(kicker,title,description,metrics,body,integrity='') {
    withInternalMutation(() => {
      stage.innerHTML = `<header class="research-os-stage-head"><div><p class="research-os-stage-kicker">${esc(kicker)}</p><h2>${esc(title)}</h2><p>${esc(description)}</p></div><div class="research-os-stage-metrics">${metrics.map(([value,label]) => `<div class="research-os-metric"><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join('')}</div></header><div class="research-os-stage-body">${body}${integrity ? `<p class="research-os-integrity">${esc(integrity)}</p>` : ''}</div>`;
    });
  }
  function emptyView(title,text) {
    return `<div class="research-os-empty"><div><strong>${esc(title)}</strong><p>${esc(text)}</p></div></div>`;
  }

  function renderMap() {
    const list = records();
    if (!list.length) {
      stageShell('RESEARCH MAP','研究地图','把当前检索结果投影为本地主题邻域。',[],emptyView('还没有研究对象','先完成一次检索，Research Map 会根据标题、摘要、来源与年份生成本地启发式地图。'));
      return;
    }
    let concepts = conceptTerms(list,5);
    if (!concepts.length) concepts = [{term:'当前主题',count:list.length}];
    const groups = new Map(concepts.map(item => [item.term,[]]));
    groups.set('其他',[]);
    list.forEach(item => groups.get(itemConcept(item,concepts))?.push(item));
    const orderedGroups = [...groups.entries()].filter(([,items]) => items.length).sort((a,b) => b[1].length-a[1].length).slice(0,6);
    const centers = [[28,28],[70,24],[25,70],[72,69],[50,48],[50,80]];
    const nodes = [];
    const lines = [];
    const labels = [];
    focusRegistry = new Map();
    orderedGroups.forEach(([term,items],clusterIndex) => {
      const [cx,cy] = centers[clusterIndex] || [50,50];
      labels.push(`<div class="research-map-cluster-label" style="left:${cx}%;top:${cy}%"><b>${esc(term)}</b><span>${items.length} records</span></div>`);
      const clusterId = `cluster-${clusterIndex}`;
      focusRegistry.set(clusterId,items.map(item => item.key));
      items.forEach((item,index) => {
        const seed = hash(`${item.key}:${index}`);
        const angle = ((seed % 360) / 180) * Math.PI;
        const ring = 10 + ((seed >>> 8) % 15) + Math.min(10,index * .9);
        const x = clamp(cx + Math.cos(angle) * ring,6,94);
        const y = clamp(cy + Math.sin(angle) * ring * .72,8,92);
        lines.push(`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"></line>`);
        const impact = impactFor(item);
        const impactLevel = impact >= 65 ? 'high' : impact >= 35 ? 'medium' : 'low';
        nodes.push(`<button type="button" class="research-map-node type-${esc(item.type)}" data-impact="${impactLevel}" data-os-key="${esc(item.key)}" style="left:${x}%;top:${y}%" aria-label="${esc(item.title)}" data-os-tooltip="${esc(`${typeLabel(item.type)} · ${item.year || '年份未知'} · ${sourceFor(item)}`)}"></button>`);
      });
    });
    const clusterList = orderedGroups.map(([term,items],index) => `<button type="button" data-os-focus-id="cluster-${index}"><i></i><span>${esc(term)}</span><small>${items.length}</small></button>`).join('');
    const body = `<div class="research-map-layout"><div class="research-map-canvas"><svg class="research-map-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>${labels.join('')}${nodes.join('')}<div class="research-map-tooltip" data-os-map-tooltip></div></div><aside class="research-map-legend"><section><h3>主题簇</h3><div class="research-map-cluster-list">${clusterList}</div></section><section><h3>来源编码</h3><div class="os-source-key"><span>论文</span><span class="patent">专利</span><span class="blog">技术文章</span><span class="web">Web / 官网</span></div></section><section><h3>当前空间</h3><div class="research-map-cluster-list"><button type="button"><i></i><span>节点大小 ≈ 本地信号</span></button><button type="button"><i></i><span>距离 ≈ 主题归属扰动</span></button></div></section></aside></div>`;
    stageShell('RESEARCH MAP','研究地图',`围绕“${queryText()}”观察主题簇、来源分布与高信号对象。`,[[String(list.length),'records'],[String(orderedGroups.length),'clusters'],[String(new Set(list.map(item => item.type)).size),'types']],body,'地图由当前结果的标题/摘要词项、来源和年份做本地启发式投影；节点距离不代表真实引用、合作或语义向量距离。');
    bindMapInteractions();
  }
  function bindMapInteractions() {
    const canvas = stage.querySelector('.research-map-canvas');
    const tooltip = stage.querySelector('[data-os-map-tooltip]');
    if (!canvas || !tooltip) return;
    const list = records();
    stage.querySelectorAll('.research-map-node').forEach(node => {
      const show = () => {
        const rect = canvas.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const item = list.find(record => record.key === node.dataset.osKey);
        tooltip.innerHTML = `<strong>${esc(item?.title || '')}</strong><span>${esc(node.dataset.osTooltip || '')}</span>`;
        tooltip.style.left = `${clamp(nodeRect.left - rect.left + 14,8,Math.max(8,rect.width-230))}px`;
        tooltip.style.top = `${clamp(nodeRect.top - rect.top + 14,8,Math.max(8,rect.height-90))}px`;
        tooltip.classList.add('show');
      };
      node.addEventListener('mouseenter',show);
      node.addEventListener('focus',show);
      node.addEventListener('mouseleave',() => tooltip.classList.remove('show'));
      node.addEventListener('blur',() => tooltip.classList.remove('show'));
    });
  }

  function renderTimeline() {
    const list = records().filter(item => item.year && item.year >= 1900 && item.year <= 2100);
    if (!list.length) {
      stageShell('TIMELINE','研究演进','按年份查看本轮研究对象的出现密度与来源组成。',[],emptyView('缺少年份数据','当前结果没有足够的可用年份，无法生成时间演进视图。'));
      return;
    }
    const buckets = new Map();
    list.forEach(item => { if (!buckets.has(item.year)) buckets.set(item.year,[]); buckets.get(item.year).push(item); });
    const years = [...buckets.keys()].sort((a,b) => a-b);
    const maxCount = Math.max(...[...buckets.values()].map(items => items.length));
    focusRegistry = new Map();
    const columns = years.map(year => {
      const items = buckets.get(year);
      const height = Math.max(5,Math.round(items.length/maxCount*210));
      const counts = {paper:0,patent:0,blog:0,web:0};
      items.forEach(item => { const key = item.type === 'official' ? 'web' : item.type; if (counts[key] !== undefined) counts[key]++; });
      const total = items.length || 1;
      const id = `year-${year}`;
      focusRegistry.set(id,items.map(item => item.key));
      const segment = type => counts[type] ? `<span class="${type}" style="height:${counts[type]/total*100}%"></span>` : '';
      return `<button type="button" class="research-year-column" data-os-focus-id="${id}" aria-label="${year} 年 ${items.length} 条"><span class="research-year-count" style="bottom:${height+7}px">${items.length}</span><span class="research-year-bar" style="height:${height}px">${segment('paper')}${segment('patent')}${segment('blog')}${segment('web')}</span><span class="research-year-label">${year}</span></button>`;
    }).join('');
    const peak = [...buckets.entries()].sort((a,b) => b[1].length-a[1].length)[0];
    const newest = Math.max(...years);
    const oldest = Math.min(...years);
    const notes = `<div class="research-timeline-notes"><article><small>FIRST SIGNAL</small><strong>${oldest}</strong><p>${buckets.get(oldest).slice(0,2).map(item => esc(item.title)).join(' · ')}</p></article><article><small>PEAK DENSITY</small><strong>${peak[0]} · ${peak[1].length} records</strong><p>${conceptTerms(peak[1],3).map(item => esc(item.term)).join(' · ') || '主题分散'}</p></article><article><small>LATEST SIGNAL</small><strong>${newest}</strong><p>${buckets.get(newest).slice(0,2).map(item => esc(item.title)).join(' · ')}</p></article></div>`;
    stageShell('TIMELINE','研究演进',`查看“${queryText()}”在本轮检索中的年份密度、来源组合与时间跨度。`,[[String(oldest),'first'],[String(newest),'latest'],[String(peak[1].length),'peak']],`<div class="research-timeline-chart">${columns}</div>${notes}`,'时间轴只描述当前检索结果的年份分布，不等同于完整领域发展史；缺失数据源会直接影响峰值和起始年份。');
  }

  function entityBuckets(list) {
    const people = new Map();
    const sources = new Map();
    const orgs = new Map();
    const add = (map,name,item) => {
      name = clean(name);
      if (!name) return;
      if (!map.has(name)) map.set(name,{name,keys:new Set(),impact:0,types:new Set()});
      const entry = map.get(name);
      entry.keys.add(item.key);
      entry.impact += impactFor(item);
      entry.types.add(item.type);
    };
    list.forEach(item => {
      (item.authors || []).slice(0,8).forEach(author => add(people,author,item));
      add(sources,sourceFor(item),item);
      (item.assignees || []).forEach(org => add(orgs,org,item));
    });
    const top = map => [...map.values()].sort((a,b) => b.keys.size-a.keys.size || b.impact-a.impact).slice(0,12);
    return {people:top(people),sources:top(sources),orgs:top(orgs)};
  }
  function renderEntityPanel(title,label,entries,prefix) {
    const max = Math.max(1,...entries.map(entry => entry.keys.size));
    const rows = entries.length ? entries.map((entry,index) => {
      const id = `${prefix}-${index}`;
      focusRegistry.set(id,[...entry.keys]);
      return `<button type="button" class="research-entity-row" data-os-focus-id="${id}" style="--weight:${Math.max(8,entry.keys.size/max*100)}%"><strong>${esc(entry.name)}</strong><small>${entry.keys.size}</small><p>${[...entry.types].map(typeLabel).join(' · ')} · signal ${Math.round(entry.impact/entry.keys.size)}</p></button>`;
    }).join('') : '<div class="research-os-empty" style="min-height:180px"><div><strong>暂无实体</strong><p>当前数据源没有返回该类实体字段。</p></div></div>';
    return `<section class="research-entity-panel"><header class="research-entity-panel-head"><h3>${esc(title)}</h3><span>${esc(label)}</span></header><div class="research-entity-list">${rows}</div></section>`;
  }
  function renderEntities() {
    const list = records();
    if (!list.length) {
      stageShell('ENTITY INTELLIGENCE','实体情报','从作者、机构和来源切入当前技术主题。',[],emptyView('还没有实体','先检索一个主题，再从作者、来源和申请人三个维度观察集中度。'));
      return;
    }
    focusRegistry = new Map();
    const buckets = entityBuckets(list);
    const body = `<div class="research-entity-grid">${renderEntityPanel('AUTHORS','论文作者 / 内容作者',buckets.people,'people')}${renderEntityPanel('VENUES & DOMAINS','期刊 · 会议 · 域名',buckets.sources,'source')}${renderEntityPanel('ORGANIZATIONS','专利申请人 / 受让人',buckets.orgs,'org')}</div>`;
    stageShell('ENTITY INTELLIGENCE','实体情报',`观察“${queryText()}”当前结果中的作者、来源与机构集中度。`,[[String(buckets.people.length),'authors'],[String(buckets.sources.length),'sources'],[String(buckets.orgs.length),'orgs']],body,'实体统计仅基于当前数据源返回字段；作者同名、机构别名和域名归属尚未做权威消歧。');
  }

  function laneFor(key) {
    return LANES.some(([id]) => id === evidenceMeta[key]?.lane) ? evidenceMeta[key].lane : 'inbox';
  }
  function renderEvidence() {
    const saved = savedRecords();
    const groups = new Map(LANES.map(([id]) => [id,[]]));
    saved.forEach(item => groups.get(laneFor(item.key)).push(item));
    const options = key => LANES.map(([id,label]) => `<option value="${id}" ${laneFor(key) === id ? 'selected' : ''}>${esc(label)}</option>`).join('');
    const lanes = LANES.map(([id,label]) => {
      const items = groups.get(id);
      return `<section class="research-evidence-lane"><header class="research-evidence-lane-head"><strong>${esc(label)}</strong><span>${items.length}</span></header><div class="research-evidence-list">${items.map(item => `<article class="research-evidence-card" data-evidence-key="${esc(item.key)}"><span class="type">${esc(typeLabel(item.type))} · ${esc(item.year || sourceFor(item) || '')}</span><h4>${esc(item.title)}</h4><p>${esc(clean(item.summaryZh || item.abstract).slice(0,150) || '尚无摘要；进入原始来源核对证据。')}</p><select data-os-evidence-lane="${esc(item.key)}" aria-label="证据分类">${options(item.key)}</select><button type="button" data-os-evidence-remove="${esc(item.key)}">移出证据板</button></article>`).join('')}</div></section>`;
    }).join('');
    const body = saved.length ? `<div class="research-evidence-board">${lanes}</div>` : emptyView('证据板还是空的','回到检索视图，在结果卡片上点击“证据”即可加入。之后可以标记为支持、反证、方法或 Prior Art。');
    stageShell('EVIDENCE BOARD','证据板','把收藏从“稍后看”升级成可研判、可分类的证据集合。',[[String(saved.length),'evidence'],[String(groups.get('support').length),'support'],[String(groups.get('counter').length),'counter']],body,'证据分类完全由本地浏览器状态维护，不会自动断言某篇材料真的支持或反驳你的技术判断。');
  }

  function topByType(list,typeSet,limit=4) {
    return list.filter(item => typeSet.includes(item.type)).sort((a,b) => queryScore(b)-queryScore(a)).slice(0,limit);
  }
  function pathItems(items) {
    return items.map(item => `<button type="button" class="research-path-item" data-os-key="${esc(item.key)}"><span>${esc(typeLabel(item.type))} · ${esc(item.year || sourceFor(item) || '')}</span><strong>${esc(item.title)}</strong><small>query ${Math.round(queryScore(item))} · signal ${Math.round(impactFor(item))}</small></button>`).join('');
  }
  function renderPath() {
    const list = records();
    if (!list.length) {
      stageShell('TECHNOLOGY PATH','技术脉络','从问题到论文、专利与工程信号的连续阅读路径。',[],emptyView('还没有技术链路','先执行一次检索，系统会在当前结果中提取代表性学术、专利与工程对象。'));
      return;
    }
    const papers = topByType(list,['paper'],4);
    const patents = topByType(list,['patent'],4);
    const engineering = topByType(list,['blog','official','web'],4);
    const concepts = conceptTerms(list,4).map(item => item.term);
    const queryNode = `<section class="research-path-node"><header class="research-path-node-head"><small>01 / QUERY</small><strong>${esc(queryText())}</strong></header><div class="research-path-items"><div class="research-path-item"><span>主题词</span><strong>${esc(concepts.join(' · ') || queryText())}</strong><small>来自当前结果的词项共现</small></div><div class="research-path-item"><span>session</span><strong>${list.length} records</strong><small>${new Set(list.map(item => typeLabel(item.type))).size} source types</small></div></div></section>`;
    const paperNode = `<section class="research-path-node"><header class="research-path-node-head"><small>02 / RESEARCH</small><strong>学术研究</strong></header><div class="research-path-items">${papers.length ? pathItems(papers) : '<div class="research-path-gap">本轮没有论文记录</div>'}</div></section>`;
    const patentNode = `<section class="research-path-node"><header class="research-path-node-head"><small>03 / IP</small><strong>专利布局</strong></header><div class="research-path-items">${patents.length ? pathItems(patents) : '<div class="research-path-gap">未检测到实时专利记录。当前只能确认专利检索入口存在，不能据此推断专利空白。</div>'}</div></section>`;
    const engineeringNode = `<section class="research-path-node"><header class="research-path-node-head"><small>04 / ENGINEERING</small><strong>工程落地信号</strong></header><div class="research-path-items">${engineering.length ? pathItems(engineering) : '<div class="research-path-gap">当前没有技术文章 / 官网 / Web 工程信号。</div>'}</div></section>`;
    const body = `<div class="research-path-flow">${queryNode}<div class="research-path-arrow"></div>${paperNode}<div class="research-path-arrow"></div>${patentNode}<div class="research-path-arrow"></div>${engineeringNode}</div>`;
    stageShell('TECHNOLOGY PATH','技术脉络',`把“${queryText()}”组织成 Query → Research → IP → Engineering 的连续研判路径。`,[[String(papers.length),'papers'],[String(patents.length),'patents'],[String(engineering.length),'engineering']],body,'箭头表示阅读/研判顺序与本轮主题连续性，不代表引用、专利族、技术转让、公司合作或真实因果关系；缺失专利源时明确视为“未知”，而不是“没有专利”。');
  }

  function renderView() {
    updateChrome();
    if (!stage) return;
    if (activeView === 'map') renderMap();
    else if (activeView === 'timeline') renderTimeline();
    else if (activeView === 'entities') renderEntities();
    else if (activeView === 'evidence') renderEvidence();
    else if (activeView === 'path') renderPath();
  }

  function focusKeys(keys,label='已聚焦相关记录') {
    const set = new Set(keys || []);
    setView('search');
    const cards = [...results.querySelectorAll('.ux-result[data-key]')];
    cards.forEach(card => {
      card.classList.toggle('os-focus-hit',set.has(card.dataset.key));
      card.classList.toggle('os-focus-dim',!set.has(card.dataset.key));
    });
    let banner = document.querySelector('#researchOsFocusBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'researchOsFocusBanner';
      banner.className = 'research-os-focus-banner';
      results.insertAdjacentElement('beforebegin',banner);
    }
    banner.innerHTML = `${esc(label)} · ${set.size} 条 <button type="button" data-os-clear-focus>清除聚焦</button>`;
    banner.querySelector('[data-os-clear-focus]')?.addEventListener('click',clearFocus,{once:true});
    cards.find(card => set.has(card.dataset.key))?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }
  function clearFocus() {
    results.querySelectorAll('.ux-result').forEach(card => card.classList.remove('os-focus-hit','os-focus-dim'));
    document.querySelector('#researchOsFocusBanner')?.remove();
  }
  function openRecord(key) {
    const card = [...results.querySelectorAll('.ux-result[data-key]')].find(node => node.dataset.key === key);
    if (!card) { focusKeys([key],'该记录当前不在可见结果中'); return; }
    setView('search');
    clearFocus();
    card.classList.add('os-focus-hit');
    card.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    setTimeout(() => card.querySelector('.research-preview-btn')?.click(),160);
  }

  function handleStageClick(event) {
    const keyNode = event.target.closest('[data-os-key]');
    if (keyNode) { openRecord(keyNode.dataset.osKey); return; }
    const focusNode = event.target.closest('[data-os-focus-id]');
    if (focusNode) {
      const keys = focusRegistry.get(focusNode.dataset.osFocusId) || [];
      focusKeys(keys,clean(focusNode.textContent));
      return;
    }
    const remove = event.target.closest('[data-os-evidence-remove]');
    if (remove) {
      const key = remove.dataset.osEvidenceRemove;
      try { if (stateSafe().saved?.[key] && typeof toggleSave === 'function') toggleSave(key); } catch {}
      delete evidenceMeta[key];
      save(EVIDENCE_KEY,evidenceMeta);
      scheduleRefresh(50);
    }
  }
  function handleStageChange(event) {
    const select = event.target.closest('[data-os-evidence-lane]');
    if (!select) return;
    const key = select.dataset.osEvidenceLane;
    evidenceMeta[key] = {...(evidenceMeta[key] || {}),lane:select.value,updatedAt:new Date().toISOString()};
    save(EVIDENCE_KEY,evidenceMeta);
    renderEvidence();
    updateChrome();
  }

  function enhanceEvidenceButtons() {
    withInternalMutation(() => {
      [...results.querySelectorAll('.ux-result[data-key]')].forEach(card => {
        const actions = card.querySelector('.ux-actions');
        if (!actions) return;
        let button = actions.querySelector('.research-evidence-add');
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.className = 'research-evidence-add';
          button.dataset.osEvidence = card.dataset.key;
          actions.appendChild(button);
        }
        const saved = Boolean(stateSafe().saved?.[card.dataset.key]);
        button.classList.toggle('saved',saved);
        const label = saved ? '证据 ✓' : '证据';
        writeText(button,label);
      });
    });
  }
  results.addEventListener('click',event => {
    const button = event.target.closest('[data-os-evidence]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const key = button.dataset.osEvidence;
    try {
      if (!stateSafe().saved?.[key] && typeof toggleSave === 'function') {
        toggleSave(key);
        if (!evidenceMeta[key]) evidenceMeta[key] = {lane:'inbox',addedAt:new Date().toISOString()};
        save(EVIDENCE_KEY,evidenceMeta);
      } else setView('evidence');
    } catch {}
    scheduleRefresh(60);
  });

  const commands = [
    {id:'view-search',icon:'S',title:'检索工作区',desc:'回到统一结果列表',key:'Alt+1',run:() => setView('search')},
    {id:'view-map',icon:'M',title:'研究地图',desc:'主题簇与高信号对象',key:'Alt+2',run:() => setView('map')},
    {id:'view-timeline',icon:'T',title:'时间演进',desc:'年份密度与来源组合',key:'Alt+3',run:() => setView('timeline')},
    {id:'view-entities',icon:'E',title:'实体情报',desc:'作者、来源、机构',key:'Alt+4',run:() => setView('entities')},
    {id:'view-evidence',icon:'V',title:'证据板',desc:'支持、反证、方法、Prior Art',key:'Alt+5',run:() => setView('evidence')},
    {id:'view-path',icon:'P',title:'技术脉络',desc:'Query → Research → IP → Engineering',key:'Alt+6',run:() => setView('path')},
    {id:'focus-search',icon:'/',title:'聚焦搜索框',desc:'继续检索新的技术问题',key:'/',run:() => { setView('search'); queryInput.focus(); queryInput.select(); }},
    {id:'export',icon:'EX',title:'导出当前情报',desc:'使用现有 JSON 导出',key:'',run:() => document.querySelector('#exportBtn')?.click()},
    {id:'settings',icon:'⚙',title:'数据源设置',desc:'Worker / PatentsView',key:'',run:() => document.querySelector('#settingsBtn')?.click()},
    {id:'clear-focus',icon:'×',title:'清除结果聚焦',desc:'恢复完整结果列表',key:'',run:clearFocus}
  ];
  function renderCommands() {
    if (!palette) return;
    const query = clean(palette.querySelector('input')?.value).toLowerCase();
    const visible = commands.filter(command => !query || `${command.title} ${command.desc} ${command.id}`.toLowerCase().includes(query));
    palette.querySelector('.research-command-results').innerHTML = visible.map(command => `<button type="button" class="research-command-item" data-os-command="${command.id}"><span class="icon">${esc(command.icon)}</span><span><strong>${esc(command.title)}</strong><small>${esc(command.desc)}</small></span>${command.key ? `<kbd>${esc(command.key)}</kbd>` : '<span></span>'}</button>`).join('');
  }
  function openPalette() {
    ensureShell();
    palette.classList.add('open');
    palette.setAttribute('aria-hidden','false');
    const input = palette.querySelector('input');
    input.value = '';
    renderCommands();
    setTimeout(() => input.focus(),0);
  }
  function closePalette() {
    if (!palette) return;
    palette.classList.remove('open');
    palette.setAttribute('aria-hidden','true');
  }
  function runCommand(id) {
    const command = commands.find(item => item.id === id);
    if (!command) return;
    closePalette();
    command.run();
  }

  document.addEventListener('keydown',event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      palette?.classList.contains('open') ? closePalette() : openPalette();
      return;
    }
    if (event.key === 'Escape' && palette?.classList.contains('open')) {
      event.preventDefault();
      closePalette();
      return;
    }
    if (event.altKey && /^[1-6]$/.test(event.key)) {
      event.preventDefault();
      setView(VIEWS[Number(event.key)-1][0]);
    }
  });

  function scheduleRefresh(delay=0) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      enhanceEvidenceButtons();
      updateChrome();
      if (activeView !== 'search') renderView();
    },delay);
  }
  function wrapSearch() {
    try {
      if (typeof performSearch !== 'function' || performSearch.__researchOsWrapped) return;
      const previous = performSearch;
      const wrapped = async function researchOsSearch(...args) {
        clearFocus();
        const value = await previous(...args);
        scheduleRefresh(0);
        return value;
      };
      wrapped.__researchOsWrapped = true;
      performSearch = wrapped;
    } catch {}
  }

  ensureShell();
  wrapSearch();
  const initialView = new URLSearchParams(location.search).get('view') || load(VIEW_KEY,'search');
  setView(initialView,{historyMode:false});
  new MutationObserver(() => {
    if (internalMutationDepth === 0) scheduleRefresh(35);
  }).observe(results,{childList:true,subtree:true});
  [0,180,700,1800,4200,7800].forEach(delay => setTimeout(() => { wrapSearch(); scheduleRefresh(0); },delay));
})();
