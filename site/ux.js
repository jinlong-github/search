(() => {
  const SOURCE_META = {
    paper: { label: '学术论文', short: 'PAPER', tone: 'paper' },
    patent: { label: '专利', short: 'PATENT', tone: 'patent' },
    blog: { label: '技术文章', short: 'ARTICLE', tone: 'blog' },
    official: { label: '官方网站', short: 'OFFICIAL', tone: 'official' },
    web: { label: 'Web 网页', short: 'WEB', tone: 'web' }
  };

  const OFFICIAL_DOMAINS = [
    'openai.com','anthropic.com','deepmind.google','ai.google','research.google',
    'microsoft.com','nvidia.com','siemens.com','sw.siemens.com','autodesk.com',
    '3ds.com','ptc.com','arxiv.org','nature.com','science.org','ieee.org','acm.org',
    'epo.org','uspto.gov'
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
    if (item.type === 'patent') {
      if (item.assignees?.[0]) return item.assignees[0];
      if (item.id) return `US${item.id}`;
      return '专利来源未知';
    }
    if (item.type === 'blog' || item.type === 'web') return item.domain || domainOf(item.url) || '网页来源未知';
    return '来源未知';
  }

  function indexName(item) {
    if (item.type === 'paper') return item.indexSource || 'Crossref';
    if (item.type === 'patent') return item.indexSource || 'PatentsView / Google Patents';
    if (item.type === 'blog') return 'HN Algolia';
    if (item.type === 'web') return 'Brave Search';
    return 'Search index';
  }

  function itemDescription(item) {
    if (item.type === 'paper' || item.type === 'patent') return item.abstract || '';
    if (item.type === 'web' || item.type === 'blog') return item.description || '';
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
      if (item.references !== undefined) bits.push(`参考文献 ${fmtNumber(item.references || 0)}`);
    } else if (item.type === 'blog') {
      if (item.date) bits.push(fmtDate(item.date));
      if (item.points !== undefined) bits.push(`HN ${fmtNumber(item.points || 0)} points`);
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
    const shown = authors.slice(0, 5).join('、');
    return authors.length > 5 ? `${shown} 等` : shown;
  }

  function actionLinks(item) {
    const main = `<a class="ux-open" href="${esc(item.url)}" target="_blank" rel="noreferrer">查看原文 ↗</a>`;
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
      <div class="ux-result-rail" aria-hidden="true"></div>
      <div class="ux-result-body">
        <div class="ux-source-row">
          <div class="ux-source-main">
            <span class="ux-type-label">${esc(meta.label)}</span>
            <span class="ux-source-dot">·</span>
            <span class="ux-source-name ${sourceClass}">${esc(source)}</span>
            ${kind === 'official' ? '<span class="ux-verified">官网</span>' : ''}
          </div>
          ${item.key ? `<button class="save-btn ux-save ${saved ? 'saved' : ''}" data-save="${esc(item.key)}" aria-label="收藏">${saved ? '★' : '☆'}</button>` : ''}
        </div>
        <h3 class="ux-title"><a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.title || 'Untitled')}</a></h3>
        ${authorText ? `<div class="ux-authors">${esc(authorText)}</div>` : ''}
        ${metrics.length ? `<div class="ux-metrics">${metrics.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
        <div class="ux-description">
          <span class="ux-description-label">${desc ? (item.type === 'web' || item.type === 'blog' ? '来源片段' : '原始摘要') : '内容说明'}</span>
          <p>${desc ? esc(truncate(desc, 560)) : '当前数据源没有提供摘要。可打开原始来源查看完整内容。'}</p>
        </div>
        <div class="ux-footer">
          <div class="ux-index-source"><span>索引</span><strong>${esc(indexName(item))}</strong></div>
          <div class="ux-actions">${actionLinks(item)}</div>
        </div>
      </div>
    </article>`;
  }

  function patentFallbackCard() {
    if (!state.query) return '';
    const q = encodeURIComponent(state.query);
    return `<article class="ux-result ux-patent ux-fallback">
      <div class="ux-result-rail" aria-hidden="true"></div>
      <div class="ux-result-body">
        <div class="ux-source-row"><div class="ux-source-main"><span class="ux-type-label">专利数据库</span><span class="ux-source-dot">·</span><span class="ux-source-name">外部专业检索</span></div></div>
        <h3 class="ux-title">在专业专利数据库中继续检索“${esc(state.query)}”</h3>
        <div class="ux-description"><span class="ux-description-label">说明</span><p>当前没有站内专利结果。可使用相同查询进入 Google Patents 或 Espacenet，进一步查看专利族、权利要求与法律状态。</p></div>
        <div class="ux-footer"><div class="ux-index-source"><span>类型</span><strong>Patent database</strong></div><div class="ux-actions"><a class="ux-open" href="https://patents.google.com/?q=${q}" target="_blank" rel="noreferrer">Google Patents ↗</a><a href="https://worldwide.espacenet.com/patent/search?q=${q}" target="_blank" rel="noreferrer">Espacenet</a></div></div>
      </div>
    </article>`;
  }

  function webFallbackCard() {
    if (!state.query) return '';
    const q = encodeURIComponent(state.query);
    return `<article class="ux-result ux-web ux-fallback">
      <div class="ux-result-rail" aria-hidden="true"></div>
      <div class="ux-result-body">
        <div class="ux-source-row"><div class="ux-source-main"><span class="ux-type-label">Web 搜索</span><span class="ux-source-dot">·</span><span class="ux-source-name">外部搜索入口</span></div></div>
        <h3 class="ux-title">继续搜索官网与全网：${esc(state.query)}</h3>
        <div class="ux-description"><span class="ux-description-label">说明</span><p>${state.webError ? `站内 Web 后端暂不可用：${esc(state.webError)}。` : 'Cloudflare Worker 尚未配置或未返回结果。'}可直接在外部搜索引擎继续查询。</p></div>
        <div class="ux-footer"><div class="ux-index-source"><span>类型</span><strong>Web search</strong></div><div class="ux-actions"><a class="ux-open" href="https://search.brave.com/search?q=${q}" target="_blank" rel="noreferrer">Brave Search ↗</a><a href="https://www.google.com/search?q=${q}" target="_blank" rel="noreferrer">Google</a></div></div>
      </div>
    </article>`;
  }

  function splitWeb() {
    const all = state.web || [];
    return {
      official: all.filter(x => x.official || isOfficialDomain(x.domain)),
      general: all.filter(x => !(x.official || isOfficialDomain(x.domain)))
    };
  }

  function listView(items, fallback='') {
    if (!items.length) return fallback || '<div class="ux-empty-inline ux-empty-large">没有找到结果。</div>';
    return `<div class="ux-list-view">${items.map(resultCard).join('')}</div>`;
  }

  function interleaveAll() {
    const web = splitWeb();
    const queues = {
      paper: [...(state.papers || [])],
      official: [...web.official],
      patent: [...(state.patents || [])],
      blog: [...(state.blogs || [])],
      web: [...web.general]
    };
    const pattern = ['paper', 'paper', 'official', 'blog', 'patent', 'paper', 'blog', 'web'];
    const mixed = [];

    while (Object.values(queues).some(q => q.length)) {
      let progressed = false;
      for (const key of pattern) {
        if (!queues[key].length) continue;
        mixed.push(queues[key].shift());
        progressed = true;
      }
      if (!progressed) break;
    }
    return mixed;
  }

  function allView() {
    return listView(interleaveAll(), '<div class="ux-empty-inline ux-empty-large">没有找到结果。</div>');
  }

  function webView() {
    const web = splitWeb();
    const items = [...web.official, ...web.general];
    return listView(items, webFallbackCard());
  }

  function savedView() {
    return listView(Object.values(state.saved || {}), '<div class="ux-empty-inline ux-empty-large">还没有收藏内容。搜索后点击 ☆ 即可收藏。</div>');
  }

  function statusText(tab, count) {
    if (!state.query && tab !== 'saved') return '准备搜索';
    if (tab === 'all') {
      return `共 ${count} 条 · 论文 ${state.papers?.length || 0} · 专利 ${state.patents?.length || 0} · 技术文章 ${state.blogs?.length || 0} · Web ${state.web?.length || 0}`;
    }
    const labels = {papers:'论文', patents:'专利', blogs:'技术文章', web:'Web', saved:'收藏'};
    return `${labels[tab] || '结果'} ${count} 条`;
  }

  const legacyRender = render;
  render = function renderResearchStream() {
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

    els.status.textContent = statusText(tab, currentCount);
  };

  setTimeout(() => {
    if (state.query || state.activeTab === 'saved') render();
  }, 0);
})();
