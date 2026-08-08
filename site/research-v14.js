(() => {
  const results = document.querySelector('#results');
  const queryInput = document.querySelector('#queryInput');
  const searchBox = document.querySelector('.search-box');
  const searchBtn = document.querySelector('.search-btn');
  const pane = document.querySelector('#researchDetailPane');
  if (!results || !queryInput || !searchBox) return;

  const STOP = new Set(['the','and','for','with','from','into','using','based','study','analysis','this','that','these','those','method','methods','approach','results','paper','system']);
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const clamp = (value, min=0, max=100) => Math.max(min, Math.min(max, value));
  const escRx = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let scanTimer = null;
  let scanToken = 0;
  let neighborhoodFrame = 0;

  function queryText() {
    try { return clean(state.query || queryInput.value); } catch { return clean(queryInput.value); }
  }

  function queryTokens() {
    return [...new Set(queryText().toLowerCase().match(/[a-z0-9][a-z0-9+.#-]{1,}|[\u3400-\u9fff]{2,}/g) || [])]
      .filter(token => token.length > 1 && !STOP.has(token));
  }

  function conceptTokens(value='') {
    return [...new Set(clean(value).toLowerCase().match(/[a-z][a-z0-9+.#-]{3,}|[\u3400-\u9fff]{2,}/g) || [])]
      .filter(token => !STOP.has(token))
      .slice(0, 28);
  }

  function typeOf(card) {
    if (card.classList.contains('ux-paper')) return 'paper';
    if (card.classList.contains('ux-patent')) return 'patent';
    if (card.classList.contains('ux-blog')) return 'blog';
    if (card.classList.contains('ux-official')) return 'official';
    return 'web';
  }

  function cardRecord(card) {
    const title = clean(card.querySelector('.ux-title')?.textContent);
    const summary = clean(card.querySelector('.ux-zh-summary p')?.textContent);
    const source = clean(card.querySelector('.ux-source-name')?.textContent);
    const metrics = [...card.querySelectorAll('.ux-metrics span')].map(node => clean(node.textContent));
    const year = Number(metrics.find(value => /^\d{4}$/.test(value)) || 0) || null;
    const citations = Number((metrics.find(value => /^引用\s/.test(value)) || '').replace(/[^\d]/g,'')) || 0;
    const points = Number((metrics.find(value => /^HN\s/i.test(value)) || '').replace(/[^\d]/g,'')) || 0;
    return {card, title, summary, source, year, citations, points, type:typeOf(card)};
  }

  function signalsFor(record) {
    const tokens = queryTokens();
    const title = record.title.toLowerCase();
    const summary = record.summary.toLowerCase();
    const query = queryText().toLowerCase();
    const titleHits = tokens.filter(token => title.includes(token)).length;
    const bodyHits = tokens.filter(token => !title.includes(token) && summary.includes(token)).length;
    const coverage = tokens.length ? titleHits / tokens.length : 0;
    let titleSignal = coverage * 78 + Math.min(18, bodyHits * 6);
    if (query && title.includes(query)) titleSignal += 22;
    titleSignal = clamp(Math.round(titleSignal));

    let impactRaw = record.type === 'paper' ? record.citations : record.type === 'blog' ? record.points : 0;
    if (record.type === 'official') impactRaw = Math.max(impactRaw, 60);
    const divisor = record.type === 'blog' ? 3.2 : 2.2;
    const impactSignal = clamp(Math.round(Math.log10(impactRaw + 1) / divisor * 100));

    const year = record.year || 0;
    const now = new Date().getFullYear();
    let recencySignal = 24;
    if (year) {
      const age = Math.max(0, now - year);
      recencySignal = clamp(Math.round(100 - Math.min(82, age * 8.5)), 18, 100);
    }

    const total = clamp(Math.round(titleSignal * .62 + impactSignal * .23 + recencySignal * .15));
    return {title:titleSignal, impact:impactSignal, recency:recencySignal, total};
  }

  function level(value) {
    return `lv-${clamp(Math.round(value / 10), 0, 10)}`;
  }

  function unhighlight(root) {
    root.querySelectorAll('mark.research-query-mark').forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent || '')));
    root.normalize();
  }

  function highlight(root, tokens) {
    if (!root || !tokens.length) return;
    const rx = new RegExp(`(${tokens.sort((a,b) => b.length-a.length).map(escRx).join('|')})`, 'gi');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!clean(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest('mark,.ux-type-label,.ux-source-name')) return NodeFilter.FILTER_REJECT;
        return rx.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      rx.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      String(node.nodeValue).replace(rx, (match, _capture, offset) => {
        if (offset > cursor) fragment.appendChild(document.createTextNode(node.nodeValue.slice(cursor, offset)));
        const mark = document.createElement('mark');
        mark.className = 'research-query-mark';
        mark.textContent = match;
        fragment.appendChild(mark);
        cursor = offset + match.length;
        return match;
      });
      if (cursor < node.nodeValue.length) fragment.appendChild(document.createTextNode(node.nodeValue.slice(cursor)));
      node.replaceWith(fragment);
    });
  }

  function signalNode(record, signals) {
    const node = document.createElement('div');
    node.className = 'research-signal-row';
    node.setAttribute('aria-label', `本地检索信号 ${signals.total}：标题 ${signals.title}，影响力 ${signals.impact}，新近度 ${signals.recency}`);
    node.title = '本地启发式信号，仅用于快速扫读，不代表论文质量或真实引用关系';
    node.innerHTML = `
      <span class="research-signal-score"><b>${signals.total}</b><small>信号</small></span>
      <span class="research-micro-signal"><em>T</em><i class="${level(signals.title)}"></i></span>
      <span class="research-micro-signal"><em>I</em><i class="${level(signals.impact)}"></i></span>
      <span class="research-micro-signal"><em>N</em><i class="${level(signals.recency)}"></i></span>`;
    return node;
  }

  function enhanceCard(card, index=0) {
    const signature = queryText();
    if (card.dataset.researchV14 === signature) return;
    card.dataset.researchV14 = signature;
    card.classList.remove(...[...card.classList].filter(name => /^research-enter-\d+$/.test(name)));
    card.classList.add(`research-enter-${index % 10}`);

    card.querySelector('.research-signal-row')?.remove();
    const record = cardRecord(card);
    const signals = signalsFor(record);
    card.dataset.researchSignal = String(signals.total);
    const footer = card.querySelector('.ux-footer');
    if (footer) footer.prepend(signalNode(record, signals));

    const tokens = queryTokens();
    const title = card.querySelector('.ux-title');
    const summary = card.querySelector('.ux-zh-summary p');
    if (title) { unhighlight(title); highlight(title, tokens); }
    if (summary) { unhighlight(summary); highlight(summary, tokens); }
  }

  function ensureLiveBadge() {
    const control = document.querySelector('.research-controlbar');
    if (!control) return null;
    let badge = control.querySelector('.research-live-scan');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'research-live-scan';
      badge.innerHTML = '<i></i><span>LIVE SOURCES</span>';
      const meta = control.querySelector('.research-query-meta');
      meta?.appendChild(badge);
    }
    return badge;
  }

  function enhanceResults() {
    const cards = [...results.querySelectorAll('.ux-result[data-key]')];
    cards.forEach(enhanceCard);
    ensureLiveBadge();
    if (pane?.classList.contains('open')) scheduleNeighborhood();
  }

  function setSearching(active) {
    document.body.classList.toggle('research-searching', active);
    const badge = ensureLiveBadge();
    if (badge) badge.classList.toggle('scanning', active);
  }

  function beginScan() {
    const token = ++scanToken;
    const labels = ['Crossref','技术文章','专利源','Web'];
    let step = 0;
    setSearching(true);
    if (searchBtn) {
      searchBtn.dataset.label = searchBtn.textContent;
      searchBtn.textContent = '扫描中';
    }
    const badge = ensureLiveBadge();
    clearInterval(scanTimer);
    scanTimer = setInterval(() => {
      if (token !== scanToken) return clearInterval(scanTimer);
      if (badge) badge.querySelector('span').textContent = `SCAN · ${labels[step++ % labels.length]}`;
    }, 520);
    return token;
  }

  function endScan(token) {
    if (token !== scanToken) return;
    clearInterval(scanTimer);
    scanTimer = null;
    setSearching(false);
    const badge = ensureLiveBadge();
    if (badge) {
      badge.classList.add('synced');
      badge.querySelector('span').textContent = 'SOURCES SYNCED';
      setTimeout(() => {
        badge.classList.remove('synced');
        badge.querySelector('span').textContent = 'LIVE SOURCES';
      }, 1600);
    }
    if (searchBtn) searchBtn.textContent = searchBtn.dataset.label || '检索';
  }

  function similarity(a, b) {
    const aConcepts = conceptTokens(`${a.title} ${a.summary}`);
    const bSet = new Set(conceptTokens(`${b.title} ${b.summary}`));
    let shared = aConcepts.filter(token => bSet.has(token)).length;
    let score = shared * 4;
    if (a.source && b.source && a.source === b.source) score += 2;
    if (a.year && b.year) score += Math.max(0, 2 - Math.abs(a.year - b.year) / 2);
    if (a.type === b.type) score += .6;
    return score;
  }

  function neighborhoodCandidates(active) {
    return [...results.querySelectorAll('.ux-result[data-key]')]
      .filter(card => card !== active)
      .map(card => cardRecord(card))
      .map(record => ({record, score:similarity(cardRecord(active), record)}))
      .sort((a,b) => b.score - a.score)
      .slice(0,5);
  }

  function renderNeighborhood() {
    if (!pane?.classList.contains('open')) return;
    const active = results.querySelector('.research-active-result[data-key]');
    if (!active) return;
    const existing = pane.querySelector('.research-neighborhood-section');
    existing?.remove();

    const candidates = neighborhoodCandidates(active);
    if (!candidates.length) return;
    const section = document.createElement('section');
    section.className = 'research-detail-section research-neighborhood-section';
    section.innerHTML = `
      <div class="research-neighborhood-head"><h3>研究邻域</h3><span>LOCAL MAP</span></div>
      <p class="research-neighborhood-note">按标题概念、来源与年份相似度估算 · 非引用关系</p>
      <div class="research-neighborhood-map" role="group" aria-label="相似结果邻域">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
        <button class="research-neighborhood-center" type="button" aria-label="当前文献"><i></i><span>当前</span></button>
      </div>`;
    const map = section.querySelector('.research-neighborhood-map');
    const svg = section.querySelector('svg');
    const positions = [[16,25],[80,20],[12,73],[84,70],[50,84]];
    candidates.forEach(({record,score}, index) => {
      const [x,y] = positions[index];
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1','50'); line.setAttribute('y1','50'); line.setAttribute('x2',String(x)); line.setAttribute('y2',String(y));
      line.setAttribute('class', score > 5 ? 'strong' : '');
      svg.appendChild(line);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `research-neighborhood-node pos-${index} type-${record.type}`;
      button.dataset.key = record.card.dataset.key || '';
      button.setAttribute('aria-label', `打开相似结果：${record.title}`);
      button.title = record.title;
      button.innerHTML = `<i></i><span>${clean(record.title).slice(0,34)}</span>`;
      button.addEventListener('click', () => {
        record.card.querySelector('.research-preview-btn')?.click();
        record.card.scrollIntoView({block:'center', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
      });
      map.appendChild(button);
    });
    const relevance = pane.querySelector('.research-detail-relevance');
    relevance?.insertAdjacentElement('afterend', section);
  }

  function scheduleNeighborhood() {
    cancelAnimationFrame(neighborhoodFrame);
    neighborhoodFrame = requestAnimationFrame(renderNeighborhood);
  }

  function ensureCommandHud() {
    if (!pane || document.querySelector('#researchCommandHud')) return;
    const hud = document.createElement('div');
    hud.id = 'researchCommandHud';
    hud.className = 'research-command-hud';
    hud.innerHTML = '<span><kbd>J</kbd><kbd>K</kbd> 切换</span><span><kbd>O</kbd> 原文</span><span><kbd>Esc</kbd> 关闭</span>';
    document.body.appendChild(hud);
  }

  if (typeof performSearch === 'function') {
    const previousSearch = performSearch;
    performSearch = async function researchV14Search(...args) {
      const token = beginScan();
      try {
        const value = await previousSearch(...args);
        enhanceResults();
        return value;
      } finally {
        endScan(token);
      }
    };
  }

  new MutationObserver(() => queueMicrotask(enhanceResults)).observe(results, {childList:true, subtree:true});
  if (pane) new MutationObserver(scheduleNeighborhood).observe(pane, {attributes:true, childList:true, subtree:true, attributeFilter:['class']});
  document.addEventListener('click', event => {
    if (event.target.closest('.research-preview-btn,.ux-result[data-key],[data-detail-prev],[data-detail-next]')) setTimeout(scheduleNeighborhood, 0);
  });

  ensureCommandHud();
  [0,200,900,3000].forEach(delay => setTimeout(enhanceResults, delay));
})();