(() => {
  const SOURCE_META = {
    paper: { label: '学术论文', short: 'PAPER', icon: 'P', tone: 'paper', index: 'OpenAlex' },
    patent: { label: '专利', short: 'PATENT', icon: 'PT', tone: 'patent', index: 'PatentsView / Google Patents' },
    blog: { label: '技术文章', short: 'BLOG', icon: 'B', tone: 'blog', index: 'HN Algolia' },
    official: { label: '官方网站', short: 'OFFICIAL', icon: 'O', tone: 'official', index: 'Brave Search' },
    web: { label: 'Web 网页', short: 'WEB', icon: 'W', tone: 'web', index: 'Brave Search' }
  };

  const OFFICIAL_DOMAINS = [
    'openai.com','anthropic.com','deepmind.google','ai.google','research.google',
    'microsoft.com','nvidia.com','siemens.com','sw.siemens.com','autodesk.com',
    '3ds.com','ptc.com','arxiv.org','epo.org','uspto.gov'
  ];

  function isOfficialDomain(domain='') {
    const d = String(domain).toLowerCase().replace(/^www\./,'');
    return OFFICIAL_DOMAINS.some(x => d === x || d.endsWith(`.${x}`));
  }

  function sourceKind(item) {
    if (item.type === 'web') return item.official || isOfficialDomain(item.domain) ? 'official' : 'web';
    if (item.type === 'blog' && isOfficialDomain(item.domain)) return 'official';
    return item.type;
  }

  function sourceName(item) {
    if (item.type === 'paper') return item.venue || '学术来源未知';
    if (item.type === 'patent') return item.assignees?.[0] || `US${item.id || ''}` || '专利来源未知';
    if (item.type === 'blog' || item.type === 'web') return item.domain || domainOf(item.url) || '网页来源未知';
    return '来源未知';
  }

  function indexName(item) {
    return SOURCE_META[sourceKind(item)]?.index || 'Search index';
  }

  function itemDescription(item) {
    if (item.type === 'paper' || item.type === 'patent') return item.abstract || '';
    if (item.type === 'web') return item.description || '';
    if (item.type === 'blog') return item.description || '';
    return '';
  }

  function primaryMeta(item) {
    const bits = [];
    if (item.type === 'paper') {
      if (item.year) bits.push(String(item.year));
      bits.push(`引用 ${fmtNumber(item.citations || 0)}`);
      if (item.oa) bits.push('开放获取');
    } else if (item.type === 'patent') {
      if (item.id) bits.push(`US${item.id}`);
      if (item.date) bits.push(fmtDate(item.date));
      bits.push(`参考文献 ${fmtNumber(item.references || 0)}`);
    } else if (item.type === 'blog') {
      if (item.date) bits.push(fmtDate(item.date));
      bits.push(`HN ${fmtNumber(item.points || 0)} points`);
      if (item.comments !== undefined) bits.push(`${fmtNumber(item.comments || 0)} comments`);
    } else if (item.type === 'web') {
      if (item.age) bits.push(item.age);
      bits.push(item.official || isOfficialDomain(item.domain) ? '官方来源' : 'Web 来源');
    }
    return bits;
  }

  function authorsLine(item) {
    if (item.type !== 'paper') return '';
    const authors = item.authors || [];
    if (!authors.length) return '';
    const shown = authors.slice(0,4).join('、');
    return authors.length > 4 ? `${shown} 等` : shown;
  }

  function actionLinks(item) {
    const main = `<a class="ux-open" href="${esc(item.url)}" target="_blank" rel="noreferrer">打开原始来源 <span>↗</span></a>`;
    const extra = [];
    if (item.type === 'paper' && item.doi) extra.push(`<a href="${esc(safeUrl(item.doi))}" target="_blank" rel="noreferrer">DOI</a>`);
    if (item.type === 'patent') extra.push(`<a href="https://ppubs.uspto.gov/pubwebapp/" target="_blank" rel="noreferrer">USPTO</a>`);
    if (item.type === 'blog' && item.hnUrl) extra.push(`<a href="${esc(item.hnUrl)}" target="_blank" rel="noreferrer">HN 讨论</a>`);
    return [main, ...extra].join('');
  }

  function resultCard(item) {
    const kind = sourceKind(item);
    const meta = SOURCE_META[kind] || SOURCE_META.web;
    const saved = !!state.saved[item.key];
    const desc = itemDescription(item);
    const authorText = authorsLine(item);
    const metrics = primaryMeta(item);
    const source = sourceName(item);
    const sourceClass = kind === 'official' ? 'official-source' : '';
    return `<article class="ux-result ux-${meta.tone}" data-key="${esc(item.key || '')}">
      <div class="ux-result-rail"><span class="ux-type-icon">${esc(meta.icon)}</span></div>
      <div class="ux-result-body">
        <div class="ux-source-row">
          <div class="ux-source-main">
            <span class="ux-type-label">${esc(meta.label)}</span>
            <span class="ux-source-dot">·</span>
            <span class="ux-source-name ${sourceClass}">${esc(source)}</span>
            ${kind === 'official' ? '<span class="ux-verified">官网</span>' : ''}
          </div>
          ${item.key ? `<button class="save-btn ux-save ${saved?'saved':''}" data-save="${esc(item.key)}" aria-label="收藏">${saved?'★':'☆'}</button>` : ''}
        </div>
        <h3 class="ux-title"><a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.title || 'Untitled')}</a></h3>
        ${authorText ? `<div class="ux-authors">${esc(authorText)}</div>` : ''}
        <div class="ux-metrics">${metrics.map(x => `<span>${esc(x)}</span>`).join('')}</div>
        <div class="ux-description">
          <span class="ux-description-label">${desc ? (item.type === 'web' || item.type === 'blog' ? '页面摘要' : '摘要') : '内容说明'}</span>
          <p>${desc ? esc(truncate(desc, 560)) : '当前数据源没有提供摘要。可打开原始来源查看完整内容。'}</p>
        </div>
        <div class="ux-footer">
          <div class="ux-index-source"><span>索引来源</span><strong>${esc(indexName(item))}</strong></div>
          <div class="ux-actions">${actionLinks(item)}</div>
        </div>
      </div>
    </article>`;
  }

  function patentFallbackCard() {
    if (!state.query) return '';
    const q = encodeURIComponent(state.query);
    return `<article class="ux-result ux-patent ux-fallback">
      <div class="ux-result-rail"><span class="ux-type-icon">PT</span></div>
      <div class="ux-result-body">
        <div class="ux-source-row"><div class="ux-source-main"><span class="ux-type-label">专利数据库</span><span class="ux-source-dot">·</span><span class="ux-source-name">外部专业检索</span></div></div>
        <h3 class="ux-title">在专业专利数据库中继续检索“${esc(state.query)}”</h3>
        <div class="ux-description"><span class="ux-description-label">说明</span><p>当前未获得站内专利结果。你仍可用相同查询直接进入 Google Patents 或 Espacenet，查看专利族、权利要求和法律状态。</p></div>
        <div class="ux-footer"><div class="ux-index-source"><span>来源类型</span><strong>Patent database</strong></div><div class="ux-actions"><a class="ux-open" href="https://patents.google.com/?q=${q}" target="_blank" rel="noreferrer">Google Patents ↗</a><a href="https://worldwide.espacenet.com/patent/search?q=${q}" target="_blank" rel="noreferrer">Espacenet</a></div></div>
      </div>
    </article>`;
  }

  function webFallbackCard() {
    if (!state.query) return '';
    const q = encodeURIComponent(state.query);
    return `<article class="ux-result ux-web ux-fallback">
      <div class="ux-result-rail"><span class="ux-type-icon">W</span></div>
      <div class="ux-result-body">
        <div class="ux-source-row"><div class="ux-source-main"><span class="ux-type-label">Web 搜索</span><span class="ux-source-dot">·</span><span class="ux-source-name">外部搜索入口</span></div></div>
        <h3 class="ux-title">搜索官网与全网：${esc(state.query)}</h3>
        <div class="ux-description"><span class="ux-description-label">说明</span><p>${state.webError ? `站内 Web 后端暂不可用：${esc(state.webError)}。` : 'Cloudflare Worker 尚未配置或未返回结果。'}你仍可直接在外部搜索引擎继续搜索。</p></div>
        <div class="ux-footer"><div class="ux-index-source"><span>来源类型</span><strong>Web search</strong></div><div class="ux-actions"><a class="ux-open" href="https://search.brave.com/search?q=${q}" target="_blank" rel="noreferrer">Brave Search ↗</a><a href="https://www.google.com/search?q=${q}" target="_blank" rel="noreferrer">Google</a></div></div>
      </div>
    </article>`;
  }

  function section({kind, title, subtitle, items, total, tab, limit=4, fallback=''}) {
    const shown = items.slice(0, limit);
    const meta = SOURCE_META[kind] || SOURCE_META.web;
    const countText = total ? fmtNumber(total) : String(items.length || 0);
    return `<section class="ux-section ux-section-${meta.tone}">
      <div class="ux-section-head">
        <div class="ux-section-title-wrap">
          <span class="ux-section-marker"></span>
          <div><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div>
        </div>
        <div class="ux-section-tools"><span class="ux-section-count">${countText}</span>${tab ? `<button type="button" data-jump-tab="${esc(tab)}">查看全部</button>` : ''}</div>
      </div>
      <div class="ux-section-list">${shown.length ? shown.map(resultCard).join('') : fallback}</div>
    </section>`;
  }

  function splitWeb() {
    const all = state.web || [];
    return {
      official: all.filter(x => x.official || isOfficialDomain(x.domain)),
      general: all.filter(x => !(x.official || isOfficialDomain(x.domain)))
    };
  }

  function allView() {
    const web = splitWeb();
    const parts = [];
    parts.push(section({
      kind:'official', title:'官方网站', subtitle:'优先查看厂商、研究机构和标准组织的原始发布',
      items:web.official, total:web.official.length, tab:'web', limit:4,
      fallback: state.webMode === 'live' ? '<div class="ux-empty-inline">本轮未发现明确的官网结果。</div>' : webFallbackCard()
    }));
    parts.push(section({
      kind:'paper', title:'学术论文', subtitle:'研究方法、实验结果与引用影响力',
      items:state.papers || [], total:state.paperTotal, tab:'papers', limit:4,
      fallback:'<div class="ux-empty-inline">没有找到论文结果。</div>'
    }));
    parts.push(section({
      kind:'patent', title:'专利', subtitle:'申请人、专利文献与技术保护范围线索',
      items:state.patents || [], total:state.patentTotal, tab:'patents', limit:4,
      fallback:patentFallbackCard()
    }));
    parts.push(section({
      kind:'blog', title:'技术文章', subtitle:'工程实践、产品团队文章与社区技术讨论',
      items:state.blogs || [], total:state.blogTotal, tab:'blogs', limit:4,
      fallback:'<div class="ux-empty-inline">没有找到技术文章结果。</div>'
    }));
    if (web.general.length) parts.push(section({
      kind:'web', title:'其他 Web', subtitle:'补充网页结果，用于发现文档、媒体和相关页面',
      items:web.general, total:web.general.length, tab:'web', limit:4
    }));
    return `<div class="ux-all-intro"><div><span>RESULT MAP</span><strong>按来源分组</strong></div><p>先看官网和原始资料，再看论文、专利与工程文章。不同来源不再混排。</p></div>${parts.join('')}`;
  }

  function listView(items, fallback) {
    if (!items.length) return fallback || '<div class="ux-empty-inline">没有结果。</div>';
    return `<div class="ux-list-view">${items.map(resultCard).join('')}</div>`;
  }

  function webView() {
    const web = splitWeb();
    const parts = [];
    if (web.official.length) parts.push(section({kind:'official', title:'官方网站', subtitle:'官方域名结果', items:web.official, total:web.official.length, limit:50}));
    if (web.general.length) parts.push(section({kind:'web', title:'其他 Web', subtitle:'普通网页与补充来源', items:web.general, total:web.general.length, limit:50}));
    if (!parts.length) return webFallbackCard();
    return parts.join('');
  }

  function savedView() {
    const items = Object.values(state.saved || {});
    if (!items.length) return '<div class="ux-empty-inline ux-empty-large">还没有收藏内容。搜索后点击 ☆ 即可收藏。</div>';
    const groups = [
      ['official','官方网站'],['paper','学术论文'],['patent','专利'],['blog','技术文章'],['web','Web 网页']
    ];
    return groups.map(([kind,title]) => {
      const matching = items.filter(x => sourceKind(x) === kind);
      return matching.length ? section({kind,title,subtitle:'已收藏',items:matching,total:matching.length,limit:100}) : '';
    }).join('');
  }

  const legacyRender = render;
  render = function renderClassified() {
    const tab = state.activeTab;
    $$('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
    if (!state.query && tab !== 'saved') {
      legacyRender();
      return;
    }

    if (tab === 'all') els.results.innerHTML = allView();
    else if (tab === 'papers') els.results.innerHTML = listView(state.papers || [], '<div class="ux-empty-inline ux-empty-large">没有找到论文结果。</div>');
    else if (tab === 'patents') els.results.innerHTML = listView(state.patents || [], patentFallbackCard());
    else if (tab === 'blogs') els.results.innerHTML = listView(state.blogs || [], '<div class="ux-empty-inline ux-empty-large">没有找到技术文章结果。</div>');
    else if (tab === 'web') els.results.innerHTML = webView();
    else if (tab === 'saved') els.results.innerHTML = savedView();
    else legacyRender();

    const currentCount = tab === 'papers' ? (state.papers?.length || 0) :
      tab === 'patents' ? (state.patents?.length || 0) :
      tab === 'blogs' ? (state.blogs?.length || 0) :
      tab === 'web' ? (state.web?.length || 0) :
      tab === 'saved' ? Object.keys(state.saved || {}).length :
      (state.papers?.length || 0) + (state.patents?.length || 0) + (state.blogs?.length || 0) + (state.web?.length || 0);
    els.status.textContent = state.query ? `当前显示 ${currentCount} 条本轮结果 · 已按来源与内容类型分类` : '准备搜索';
  };

  document.addEventListener('click', e => {
    const jump = e.target.closest('[data-jump-tab]');
    if (!jump) return;
    state.activeTab = jump.dataset.jumpTab;
    render();
    document.querySelector('.tabs')?.scrollIntoView({behavior:'smooth', block:'start'});
  });

  setTimeout(() => {
    if (state.query || state.activeTab === 'saved') render();
  }, 0);
})();
