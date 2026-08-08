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

  let activeKey = '';
  let filterOpen = false;

  function escHtml(value='') {
    return String(value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function text(value='') {
    return String(value || '').replace(/\s+/g,' ').trim();
  }

  function allItems() {
    const map = new Map();
    [state.papers || [], state.patents || [], state.blogs || [], state.web || []].forEach(group => {
      group.forEach(item => { if (item?.key) map.set(item.key, item); });
    });
    Object.entries(state.saved || {}).forEach(([key, item]) => {
      if (!map.has(key)) map.set(key, item);
    });
    return map;
  }

  function itemType(item) {
    if (item?.type === 'paper') return '论文';
    if (item?.type === 'patent') return '专利';
    if (item?.type === 'blog') return '技术文章';
    if (item?.type === 'web' && item?.official) return '官网';
    if (item?.type === 'web') return 'Web';
    return '资料';
  }

  function sourceName(item) {
    if (!item) return '';
    if (item.type === 'paper') return item.venue || 'Crossref';
    if (item.type === 'patent') return item.assignees?.[0] || (item.id ? `US${item.id}` : 'Patent');
    return item.domain || (item.url ? (() => { try { return new URL(item.url).hostname.replace(/^www\./,''); } catch { return ''; } })() : '');
  }

  function metadata(item) {
    const bits = [];
    if (item?.year) bits.push(String(item.year));
    if (item?.type === 'paper' && Number(item.citations || 0) >= 0) bits.push(`引用 ${fmtNumber(item.citations || 0)}`);
    if (item?.type === 'patent' && item?.date) bits.push(fmtDate(item.date));
    if (item?.type === 'blog' && Number(item.points || 0) > 0) bits.push(`HN ${fmtNumber(item.points)} points`);
    if (item?.type === 'web' && item?.age) bits.push(item.age);
    return bits;
  }

  function queryTokens() {
    return [...new Set(text(state.query).toLowerCase().match(/[a-z0-9][a-z0-9+.#-]{1,}|[\u3400-\u9fff]{2,}/g) || [])]
      .filter(token => !['the','and','for','with','from','into','using','based'].includes(token));
  }

  function relevanceReason(item) {
    const tokens = queryTokens();
    if (!tokens.length || !item) return '按当前排序与来源信号展示。';
    const title = text(item.title).toLowerCase();
    const body = text(item.abstract || item.description || item.summaryZh || '').toLowerCase();
    const titleHits = tokens.filter(token => title.includes(token));
    const bodyHits = tokens.filter(token => body.includes(token) && !titleHits.includes(token));
    const parts = [];
    if (titleHits.length) parts.push(`标题命中 ${titleHits.length}/${tokens.length}`);
    if (bodyHits.length) parts.push(`摘要补充命中 ${bodyHits.length}`);
    if (item.type === 'paper' && Number(item.citations || 0) > 0) parts.push(`引用 ${fmtNumber(item.citations)}`);
    if (item.type === 'blog' && Number(item.points || 0) > 0) parts.push(`社区热度 ${fmtNumber(item.points)}`);
    return parts.length ? parts.join(' · ') : '语义与来源信号相关，建议结合原文核对。';
  }

  function citationText(item) {
    const authors = (item.authors || []).join(', ');
    const year = item.year ? ` (${item.year})` : '';
    const venue = item.venue ? `. ${item.venue}` : '';
    const doi = item.doi ? `. ${String(item.doi).replace(/^https?:\/\/doi\.org\//i,'https://doi.org/')}` : '';
    return `${authors || 'Unknown author'}${year}. ${text(item.title)}${venue}${doi}`;
  }

  function bibtexText(item) {
    const first = text(item.authors?.[0] || 'paper').split(/\s+/).pop()?.replace(/[^a-z0-9]/gi,'') || 'paper';
    const year = item.year || 'nd';
    const word = text(item.title).split(/\s+/).find(x => x.length > 4)?.replace(/[^a-z0-9]/gi,'') || 'work';
    const key = `${first}${year}${word}`;
    const authors = (item.authors || []).join(' and ');
    const doi = String(item.doi || '').replace(/^https?:\/\/doi\.org\//i,'');
    const fields = [
      `  title = {${text(item.title)}}`,
      authors ? `  author = {${authors}}` : '',
      item.venue ? `  journal = {${text(item.venue)}}` : '',
      item.year ? `  year = {${item.year}}` : '',
      doi ? `  doi = {${doi}}` : ''
    ].filter(Boolean).join(',\n');
    return `@article{${key},\n${fields}\n}`;
  }

  async function copy(value, message='已复制') {
    try {
      await navigator.clipboard.writeText(value);
      toast(message);
    } catch {
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      toast(message);
    }
  }

  let toastTimer;
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
    toastTimer = setTimeout(() => node.classList.remove('show'), 1500);
  }

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
  filterToggle.setAttribute('aria-expanded','false');
  filterToggle.textContent = '筛选';
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
    const year = Number(yearInput?.value || 0);
    if (year >= 1900) count += 1;
    if (oaOnly?.checked) count += 1;
    if (officialOnly?.checked) count += 1;
    return count;
  }

  function syncFilterToggle() {
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
    syncFilterToggle();
    applyBtn?.click();
    setFilterOpen(false);
  });
  applyBtn?.addEventListener('click', () => {
    setTimeout(() => {
      syncFilterToggle();
      setFilterOpen(false);
    }, 0);
  });
  sortSelect?.addEventListener('change', () => {
    if (state.query) applyBtn?.click();
  });
  [yearInput, oaOnly, officialOnly].forEach(el => el?.addEventListener('change', syncFilterToggle));
  document.addEventListener('click', event => {
    if (!filterOpen) return;
    if (filters.contains(event.target) || filterToggle.contains(event.target)) return;
    setFilterOpen(false);
  });

  const pane = document.createElement('aside');
  pane.id = 'researchDetailPane';
  pane.className = 'research-detail-pane';
  pane.setAttribute('aria-hidden','true');
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
    return [...results.querySelectorAll('.ux-result[data-key]')].filter(card => card.offsetParent !== null);
  }

  function currentItem() {
    return allItems().get(activeKey);
  }

  function openDetailByCard(card) {
    const key = card?.dataset.key;
    const item = allItems().get(key);
    if (!item) return;
    activeKey = key;
    cards().forEach(node => node.classList.toggle('research-active-result', node === card));
    renderDetail(item, card);
    pane.classList.add('open');
    pane.setAttribute('aria-hidden','false');
    document.body.classList.add('research-detail-open');
  }

  function renderDetail(item, card) {
    const visible = cards();
    const index = Math.max(0, visible.indexOf(card));
    pane.querySelector('[data-detail-position]').textContent = `${index + 1} / ${visible.length}`;
    pane.querySelector('[data-detail-prev]').disabled = index <= 0;
    pane.querySelector('[data-detail-next]').disabled = index >= visible.length - 1;

    const source = sourceName(item);
    pane.querySelector('[data-detail-type]').textContent = `${itemType(item)}${source ? ` · ${source}` : ''}`;
    pane.querySelector('[data-detail-title]').textContent = text(item.title) || 'Untitled';
    const authors = item.type === 'paper' ? (item.authors || []).join('、') : '';
    pane.querySelector('[data-detail-authors]').textContent = authors;
    pane.querySelector('[data-detail-authors]').hidden = !authors;
    pane.querySelector('[data-detail-meta]').textContent = metadata(item).join(' · ');
    pane.querySelector('[data-detail-summary]').textContent = text(item.summaryZh) || '暂无中文摘要。';
    pane.querySelector('[data-detail-relevance]').textContent = relevanceReason(item);

    const original = text(item.abstract || item.description || item.snippet || '');
    const originalSection = pane.querySelector('[data-detail-original-section]');
    originalSection.hidden = !original;
    pane.querySelector('[data-detail-original-title]').textContent = item.type === 'blog' || item.type === 'web' ? '来源片段' : '原始摘要';
    pane.querySelector('[data-detail-original]').textContent = original;

    const actions = pane.querySelector('[data-detail-actions]');
    const url = item.url && item.url !== '#' ? item.url : '';
    actions.innerHTML = `${url ? `<a class="research-primary-action" href="${escHtml(url)}" target="_blank" rel="noreferrer">打开原始来源 ↗</a>` : ''}`;
    if (item.type === 'paper') {
      const citeBtn = document.createElement('button');
      citeBtn.type = 'button';
      citeBtn.textContent = '复制引用';
      citeBtn.addEventListener('click', () => copy(citationText(item), '引用已复制'));
      actions.appendChild(citeBtn);
      const bibBtn = document.createElement('button');
      bibBtn.type = 'button';
      bibBtn.textContent = '复制 BibTeX';
      bibBtn.addEventListener('click', () => copy(bibtexText(item), 'BibTeX 已复制'));
      actions.appendChild(bibBtn);
    }
  }

  function closeDetail() {
    activeKey = '';
    pane.classList.remove('open');
    pane.setAttribute('aria-hidden','true');
    document.body.classList.remove('research-detail-open');
    results.querySelectorAll('.research-active-result').forEach(card => card.classList.remove('research-active-result'));
  }

  function stepDetail(delta) {
    const visible = cards();
    const current = visible.findIndex(card => card.dataset.key === activeKey);
    const next = visible[current + delta];
    if (next) openDetailByCard(next);
  }

  pane.querySelector('[data-detail-close]').addEventListener('click', closeDetail);
  pane.querySelector('[data-detail-prev]').addEventListener('click', () => stepDetail(-1));
  pane.querySelector('[data-detail-next]').addEventListener('click', () => stepDetail(1));

  function enhanceResults() {
    const map = allItems();
    const visibleCards = [...results.querySelectorAll('.ux-result[data-key]')];
    visibleCards.forEach(card => {
      if (card.dataset.researchEnhanced === '1') return;
      const item = map.get(card.dataset.key);
      if (!item) return;
      card.dataset.researchEnhanced = '1';
      card.tabIndex = 0;
      card.setAttribute('role','article');
      card.setAttribute('aria-label', `${itemType(item)}：${text(item.title)}`);

      const actions = card.querySelector('.ux-actions');
      if (actions && !actions.querySelector('.research-preview-btn')) {
        const preview = document.createElement('button');
        preview.type = 'button';
        preview.className = 'research-preview-btn';
        preview.textContent = '详情';
        preview.addEventListener('click', event => {
          event.stopPropagation();
          openDetailByCard(card);
        });
        actions.prepend(preview);
      }

      card.addEventListener('click', event => {
        if (event.target.closest('a,button,input,select,label')) return;
        openDetailByCard(card);
      });
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.target.closest('a,button,input,select')) {
          event.preventDefault();
          openDetailByCard(card);
        }
      });
    });
    syncQueryMeta();
  }

  function syncQueryMeta() {
    const queryText = controlbar.querySelector('#researchQueryText');
    const countText = controlbar.querySelector('#researchQueryCount');
    if (!state.query) {
      controlbar.hidden = true;
      return;
    }
    controlbar.hidden = false;
    queryText.textContent = `“${state.query}”`;
    const count = cards().length;
    const pieces = [];
    if (state.papers?.length) pieces.push(`论文 ${state.papers.length}`);
    if (state.patents?.length) pieces.push(`专利 ${state.patents.length}`);
    if (state.blogs?.length) pieces.push(`技术文章 ${state.blogs.length}`);
    if (state.web?.length) pieces.push(`Web ${state.web.length}`);
    countText.textContent = `${count} 条${pieces.length ? ` · ${pieces.join(' · ')}` : ''}`;
  }

  const observer = new MutationObserver(() => requestAnimationFrame(enhanceResults));
  observer.observe(results, {childList:true, subtree:true});
  document.querySelector('#statusLine') && new MutationObserver(syncQueryMeta).observe(document.querySelector('#statusLine'), {childList:true, characterData:true, subtree:true});

  document.addEventListener('click', event => {
    if (event.target.closest('.tab')) {
      setTimeout(() => {
        closeDetail();
        syncFilterToggle();
        enhanceResults();
      }, 0);
    }
  });

  document.addEventListener('keydown', event => {
    if (!pane.classList.contains('open')) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (event.key === 'Escape') closeDetail();
    if (event.key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault();
      stepDetail(1);
    }
    if (event.key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault();
      stepDetail(-1);
    }
    if (event.key === 'o') {
      const item = currentItem();
      if (item?.url && item.url !== '#') window.open(item.url, '_blank', 'noopener');
    }
  });

  queryInput?.addEventListener('input', () => { if (!queryInput.value.trim()) closeDetail(); });
  syncFilterToggle();
  enhanceResults();
})();
