(() => {
  const results = document.querySelector('#results');
  const contentGrid = document.querySelector('.content-grid');
  const filters = document.querySelector('.filters');
  const resultsPane = document.querySelector('.results-pane');
  const sortSelect = document.querySelector('#sortSelect');
  const yearInput = document.querySelector('#fromYear');
  const oaOnly = document.querySelector('#oaOnly');
  const officialOnly = document.querySelector('#officialOnly');
  const applyBtn = document.querySelector('#applyFilters');
  const queryInput = document.querySelector('#queryInput');
  if (!results || !contentGrid || !filters || !resultsPane) return;

  let activeCard = null;
  let filterOpen = false;
  let toastTimer = null;

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const formatNumber = value => typeof fmtNumber === 'function' ? fmtNumber(value) : String(value ?? 0);
  const formatDate = value => typeof fmtDate === 'function' ? fmtDate(value) : String(value || '');

  function stateItems() {
    const map = new Map();
    try {
      [state.papers || [], state.patents || [], state.blogs || [], state.web || []].forEach(group => {
        group.forEach(item => { if (item?.key) map.set(item.key, item); });
      });
      Object.entries(state.saved || {}).forEach(([key, item]) => {
        if (!map.has(key)) map.set(key, item);
      });
    } catch {}
    return map;
  }

  function cardType(card) {
    if (card.classList.contains('ux-paper')) return 'paper';
    if (card.classList.contains('ux-patent')) return 'patent';
    if (card.classList.contains('ux-blog')) return 'blog';
    if (card.classList.contains('ux-official')) return 'official';
    return 'web';
  }

  function domItem(card) {
    const type = cardType(card);
    const titleLink = card.querySelector('.ux-title a');
    const metrics = [...card.querySelectorAll('.ux-metrics span')].map(node => clean(node.textContent));
    const yearText = metrics.find(value => /^\d{4}$/.test(value));
    const citationText = metrics.find(value => /^引用\s/.test(value));
    const pointText = metrics.find(value => /HN\s[\d,.]+\spoints/i.test(value));
    const doiLink = [...card.querySelectorAll('.ux-actions a')].find(a => clean(a.textContent) === 'DOI');
    const authorsText = clean(card.querySelector('.ux-authors')?.textContent);
    const source = clean(card.querySelector('.ux-source-name')?.textContent);
    return {
      key: card.dataset.key || '',
      type: type === 'official' ? 'web' : type,
      official: type === 'official',
      title: clean(titleLink?.textContent || card.querySelector('.ux-title')?.textContent),
      url: titleLink?.href || '',
      venue: type === 'paper' ? source : '',
      domain: ['blog','web','official'].includes(type) ? source : '',
      authors: authorsText ? authorsText.split(/[、,]/).map(clean).filter(Boolean) : [],
      year: yearText ? Number(yearText) : null,
      citations: citationText ? Number(citationText.replace(/[^\d]/g, '')) || 0 : 0,
      points: pointText ? Number(pointText.replace(/[^\d]/g, '')) || 0 : 0,
      summaryZh: clean(card.querySelector('.ux-zh-summary p')?.textContent),
      abstract: clean(card.querySelector('.ux-description p')?.textContent),
      description: clean(card.querySelector('.ux-description p')?.textContent),
      doi: doiLink?.href || ''
    };
  }

  function resolveItem(card) {
    const dom = domItem(card);
    const fromState = stateItems().get(card.dataset.key || '');
    if (!fromState) return dom;
    return {
      ...dom,
      ...fromState,
      title: clean(fromState.title || dom.title),
      url: fromState.url || dom.url,
      summaryZh: clean(fromState.summaryZh || dom.summaryZh),
      abstract: clean(fromState.abstract || dom.abstract),
      description: clean(fromState.description || dom.description),
      authors: fromState.authors?.length ? fromState.authors : dom.authors,
      venue: fromState.venue || dom.venue,
      domain: fromState.domain || dom.domain,
      doi: fromState.doi || dom.doi
    };
  }

  function labelFor(item) {
    if (item.type === 'paper') return '论文';
    if (item.type === 'patent') return '专利';
    if (item.type === 'blog') return '技术文章';
    if (item.type === 'web' && item.official) return '官网';
    return 'Web';
  }

  function sourceFor(item) {
    if (item.type === 'paper') return item.venue || 'Crossref';
    if (item.type === 'patent') return item.assignees?.[0] || (item.id ? `US${item.id}` : 'Patent');
    return item.domain || (() => { try { return new URL(item.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  }

  function metadataFor(item) {
    const bits = [];
    if (item.year) bits.push(String(item.year));
    if (item.type === 'paper') bits.push(`引用 ${formatNumber(item.citations || 0)}`);
    if (item.type === 'patent' && item.date) bits.push(formatDate(item.date));
    if (item.type === 'blog' && Number(item.points || 0) > 0) bits.push(`HN ${formatNumber(item.points)} points`);
    if (item.type === 'web' && item.age) bits.push(item.age);
    return bits;
  }

  function queryTokens() {
    let q = '';
    try { q = state.query || queryInput?.value || ''; } catch { q = queryInput?.value || ''; }
    return [...new Set(clean(q).toLowerCase().match(/[a-z0-9][a-z0-9+.#-]{1,}|[\u3400-\u9fff]{2,}/g) || [])]
      .filter(token => !['the','and','for','with','from','into','using','based'].includes(token));
  }

  function relevanceFor(item) {
    const tokens = queryTokens();
    if (!tokens.length) return '按当前排序与来源信号展示。';
    const title = clean(item.title).toLowerCase();
    const body = clean(item.abstract || item.description || item.summaryZh).toLowerCase();
    const titleHits = tokens.filter(token => title.includes(token));
    const bodyHits = tokens.filter(token => body.includes(token) && !titleHits.includes(token));
    const signals = [];
    if (titleHits.length) signals.push(`标题命中 ${titleHits.length}/${tokens.length}`);
    if (bodyHits.length) signals.push(`摘要补充命中 ${bodyHits.length}`);
    if (item.type === 'paper' && Number(item.citations || 0) > 0) signals.push(`引用 ${formatNumber(item.citations)}`);
    if (item.type === 'blog' && Number(item.points || 0) > 0) signals.push(`社区热度 ${formatNumber(item.points)}`);
    return signals.length ? signals.join(' · ') : '主题相关度较弱，建议结合原文快速核对。';
  }

  function citationFor(item) {
    const authors = (item.authors || []).join(', ') || 'Unknown author';
    const year = item.year ? ` (${item.year})` : '';
    const venue = item.venue ? `. ${clean(item.venue)}` : '';
    const doi = item.doi ? `. ${String(item.doi).replace(/^https?:\/\/doi\.org\//i, 'https://doi.org/')}` : '';
    return `${authors}${year}. ${clean(item.title)}${venue}${doi}`;
  }

  function bibtexFor(item) {
    const first = clean(item.authors?.[0] || 'paper').split(/\s+/).pop()?.replace(/[^a-z0-9]/gi, '') || 'paper';
    const year = item.year || 'nd';
    const word = clean(item.title).split(/\s+/).find(part => part.length > 4)?.replace(/[^a-z0-9]/gi, '') || 'work';
    const key = `${first}${year}${word}`;
    const doi = String(item.doi || '').replace(/^https?:\/\/doi\.org\//i, '');
    const fields = [
      `  title = {${clean(item.title)}}`,
      item.authors?.length ? `  author = {${item.authors.join(' and ')}}` : '',
      item.venue ? `  journal = {${clean(item.venue)}}` : '',
      item.year ? `  year = {${item.year}}` : '',
      doi ? `  doi = {${doi}}` : ''
    ].filter(Boolean).join(',\n');
    return `@article{${key},\n${fields}\n}`;
  }

  function toast(message) {
    let node = document.querySelector('#researchToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'researchToast';
      node.className = 'research-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 1400);
  }

  async function copy(value, message) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    toast(message);
  }

  /* Query toolbar */
  const controlbar = document.createElement('div');
  controlbar.className = 'research-controlbar';
  controlbar.innerHTML = `
    <div class="research-query-meta">
      <span class="research-query-kicker">检索</span>
      <strong id="researchQueryText">—</strong>
      <span id="researchQueryCount"></span>
    </div>
    <div class="research-control-actions"></div>`;
  contentGrid.insertBefore(controlbar, filters);
  const controlActions = controlbar.querySelector('.research-control-actions');

  const sortBlock = sortSelect?.closest('.filter-block');
  if (sortBlock) {
    sortBlock.classList.add('research-sort-block');
    controlActions.appendChild(sortBlock);
  }

  const filterToggle = document.createElement('button');
  filterToggle.type = 'button';
  filterToggle.className = 'research-filter-toggle';
  filterToggle.setAttribute('aria-expanded', 'false');
  controlActions.appendChild(filterToggle);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'research-filter-clear';
  clearBtn.textContent = '清除';
  filters.appendChild(clearBtn);
  filters.classList.add('research-filter-panel');
  filters.hidden = true;

  function activeFilterCount() {
    let count = 0;
    if (Number(yearInput?.value || 0) >= 1900) count += 1;
    if (oaOnly?.checked) count += 1;
    if (officialOnly?.checked) count += 1;
    return count;
  }

  function syncFilter() {
    const count = activeFilterCount();
    filterToggle.textContent = count ? `筛选 ${count}` : '筛选';
    clearBtn.hidden = count === 0;
  }

  function setFilterOpen(open) {
    filterOpen = Boolean(open);
    filters.hidden = !filterOpen;
    filterToggle.classList.toggle('active', filterOpen);
    filterToggle.setAttribute('aria-expanded', filterOpen ? 'true' : 'false');
  }

  filterToggle.addEventListener('click', () => setFilterOpen(!filterOpen));
  clearBtn.addEventListener('click', () => {
    if (yearInput) yearInput.value = '';
    if (oaOnly) oaOnly.checked = false;
    if (officialOnly) officialOnly.checked = false;
    syncFilter();
    applyBtn?.click();
    setFilterOpen(false);
  });
  applyBtn?.addEventListener('click', () => setTimeout(() => { syncFilter(); setFilterOpen(false); }, 0));
  sortSelect?.addEventListener('change', () => { if (queryInput?.value.trim()) applyBtn?.click(); });
  [yearInput, oaOnly, officialOnly].forEach(node => node?.addEventListener('change', syncFilter));
  document.addEventListener('click', event => {
    if (filterOpen && !filters.contains(event.target) && !filterToggle.contains(event.target)) setFilterOpen(false);
  });

  /* Detail pane */
  const pane = document.createElement('aside');
  pane.id = 'researchDetailPane';
  pane.className = 'research-detail-pane';
  pane.setAttribute('aria-hidden', 'true');
  pane.innerHTML = `
    <div class="research-detail-head">
      <div class="research-detail-nav">
        <button type="button" data-detail-prev aria-label="上一条">←</button>
        <span data-detail-position>—</span>
        <button type="button" data-detail-next aria-label="下一条">→</button>
      </div>
      <button type="button" class="research-detail-close" data-detail-close aria-label="关闭详情">×</button>
    </div>
    <div class="research-detail-scroll">
      <div class="research-detail-type" data-detail-type></div>
      <h2 data-detail-title></h2>
      <div class="research-detail-authors" data-detail-authors></div>
      <div class="research-detail-meta" data-detail-meta></div>
      <section class="research-detail-section">
        <h3>中文摘要</h3>
        <p data-detail-summary></p>
      </section>
      <section class="research-detail-section research-detail-relevance">
        <h3>检索匹配</h3>
        <p data-detail-relevance></p>
      </section>
      <section class="research-detail-section" data-detail-original-section>
        <h3 data-detail-original-title>原始摘要</h3>
        <p data-detail-original></p>
      </section>
      <div class="research-detail-actions" data-detail-actions></div>
    </div>`;
  document.body.appendChild(pane);

  function cards() {
    return [...results.querySelectorAll('.ux-result[data-key]')];
  }

  function renderDetail(card) {
    const item = resolveItem(card);
    const list = cards();
    const index = Math.max(0, list.indexOf(card));
    activeCard = card;
    list.forEach(node => node.classList.toggle('research-active-result', node === card));

    pane.querySelector('[data-detail-position]').textContent = `${index + 1} / ${list.length}`;
    pane.querySelector('[data-detail-prev]').disabled = index <= 0;
    pane.querySelector('[data-detail-next]').disabled = index >= list.length - 1;
    const source = sourceFor(item);
    pane.querySelector('[data-detail-type]').textContent = `${labelFor(item)}${source ? ` · ${source}` : ''}`;
    pane.querySelector('[data-detail-title]').textContent = clean(item.title) || 'Untitled';
    const authors = item.type === 'paper' ? (item.authors || []).join('、') : '';
    const authorsNode = pane.querySelector('[data-detail-authors]');
    authorsNode.textContent = authors;
    authorsNode.hidden = !authors;
    pane.querySelector('[data-detail-meta]').textContent = metadataFor(item).join(' · ');
    pane.querySelector('[data-detail-summary]').textContent = clean(item.summaryZh) || '暂无中文摘要。';
    pane.querySelector('[data-detail-relevance]').textContent = relevanceFor(item);

    const original = clean(item.abstract || item.description || item.snippet || '');
    const originalSection = pane.querySelector('[data-detail-original-section]');
    originalSection.hidden = !original;
    pane.querySelector('[data-detail-original-title]').textContent = item.type === 'blog' || item.type === 'web' ? '来源片段' : '原始摘要';
    pane.querySelector('[data-detail-original]').textContent = original;

    const actions = pane.querySelector('[data-detail-actions]');
    actions.replaceChildren();
    if (item.url && item.url !== '#') {
      const open = document.createElement('a');
      open.className = 'research-primary-action';
      open.href = item.url;
      open.target = '_blank';
      open.rel = 'noreferrer';
      open.textContent = '打开原始来源 ↗';
      actions.appendChild(open);
    }
    if (item.type === 'paper') {
      const cite = document.createElement('button');
      cite.type = 'button';
      cite.textContent = '复制引用';
      cite.addEventListener('click', () => copy(citationFor(item), '引用已复制'));
      actions.appendChild(cite);
      const bib = document.createElement('button');
      bib.type = 'button';
      bib.textContent = '复制 BibTeX';
      bib.addEventListener('click', () => copy(bibtexFor(item), 'BibTeX 已复制'));
      actions.appendChild(bib);
    }

    pane.classList.add('open');
    pane.setAttribute('aria-hidden', 'false');
    document.body.classList.add('research-detail-open');
  }

  function closeDetail() {
    activeCard = null;
    pane.classList.remove('open');
    pane.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('research-detail-open');
    cards().forEach(card => card.classList.remove('research-active-result'));
  }

  function stepDetail(delta) {
    const list = cards();
    const index = activeCard ? list.indexOf(activeCard) : -1;
    const next = list[index + delta];
    if (next) renderDetail(next);
  }

  pane.querySelector('[data-detail-close]').addEventListener('click', closeDetail);
  pane.querySelector('[data-detail-prev]').addEventListener('click', () => stepDetail(-1));
  pane.querySelector('[data-detail-next]').addEventListener('click', () => stepDetail(1));

  function enhanceCard(card) {
    if (card.dataset.researchEnhanced === '1') return;
    const item = resolveItem(card);
    card.dataset.researchEnhanced = '1';
    card.tabIndex = 0;
    card.setAttribute('aria-label', `${labelFor(item)}：${clean(item.title) || '未命名结果'}`);

    const actions = card.querySelector('.ux-actions');
    if (actions && !actions.querySelector('.research-preview-btn')) {
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'research-preview-btn';
      preview.textContent = '详情';
      preview.addEventListener('click', event => {
        event.stopPropagation();
        renderDetail(card);
      });
      actions.prepend(preview);
    }

    card.addEventListener('click', event => {
      if (event.target.closest('a,button,input,select,label')) return;
      renderDetail(card);
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.target.closest('a,button,input,select')) {
        event.preventDefault();
        renderDetail(card);
      }
    });
  }

  function syncQueryMeta() {
    const queryText = controlbar.querySelector('#researchQueryText');
    const countText = controlbar.querySelector('#researchQueryCount');
    const query = clean((typeof state !== 'undefined' && state.query) || queryInput?.value || '');
    if (!query) {
      controlbar.hidden = true;
      return;
    }
    controlbar.hidden = false;
    queryText.textContent = `“${query}”`;
    const visible = cards().length;
    const composition = [];
    try {
      if (state.papers?.length) composition.push(`论文 ${state.papers.length}`);
      if (state.patents?.length) composition.push(`专利 ${state.patents.length}`);
      if (state.blogs?.length) composition.push(`技术文章 ${state.blogs.length}`);
      if (state.web?.length) composition.push(`Web ${state.web.length}`);
    } catch {}
    countText.textContent = `${visible} 条${composition.length ? ` · ${composition.join(' · ')}` : ''}`;
  }

  function enhanceResults() {
    cards().forEach(enhanceCard);
    syncQueryMeta();
  }

  new MutationObserver(() => requestAnimationFrame(enhanceResults)).observe(results, {childList:true, subtree:true});
  document.addEventListener('click', event => {
    if (event.target.closest('.tab')) setTimeout(() => { closeDetail(); enhanceResults(); }, 0);
  });
  document.addEventListener('keydown', event => {
    if (!pane.classList.contains('open')) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (event.key === 'Escape') closeDetail();
    if (event.key === 'j' || event.key === 'ArrowDown') { event.preventDefault(); stepDetail(1); }
    if (event.key === 'k' || event.key === 'ArrowUp') { event.preventDefault(); stepDetail(-1); }
    if (event.key === 'o' && activeCard) {
      const item = resolveItem(activeCard);
      if (item.url && item.url !== '#') window.open(item.url, '_blank', 'noopener');
    }
  });
  queryInput?.addEventListener('input', () => { if (!queryInput.value.trim()) closeDetail(); });

  syncFilter();
  enhanceResults();
})();
