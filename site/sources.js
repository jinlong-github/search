(() => {
  const CROSSREF_API = 'https://api.crossref.org/works';
  const LOW_VALUE_TITLE = /^(index|subject index|author index|contents?|table of contents|front matter|back matter|preface|foreword|editorial|introduction|conclusion|references|bibliography)$/i;
  const PREFERRED_TYPES = new Set(['journal-article','proceedings-article','posted-content','book-chapter','report','dissertation']);

  state.paperBackend = 'crossref';
  state.__paperWriteSource = '';

  // Guard paper state so any OpenAlex request that started before this adapter loaded
  // cannot overwrite newer Crossref results when it finishes later.
  let paperStore = state.papers;
  let paperTotalStore = state.paperTotal;
  Object.defineProperty(state, 'papers', {
    configurable: true,
    enumerable: true,
    get() { return paperStore; },
    set(value) {
      if (state.paperBackend === 'crossref' && state.__paperWriteSource !== 'crossref') return;
      paperStore = value;
    }
  });
  Object.defineProperty(state, 'paperTotal', {
    configurable: true,
    enumerable: true,
    get() { return paperTotalStore; },
    set(value) {
      if (state.paperBackend === 'crossref' && state.__paperWriteSource !== 'crossref') return;
      paperTotalStore = value;
    }
  });

  function crossrefDate(item) {
    const candidates = [item.published, item['published-print'], item['published-online'], item.issued, item.created];
    for (const candidate of candidates) {
      const parts = candidate?.['date-parts']?.[0];
      if (!parts?.length) continue;
      const [y, m=1, d=1] = parts;
      if (!y) continue;
      return {
        year: Number(y),
        date: `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      };
    }
    return {year: null, date: ''};
  }

  function plainText(value='') {
    return String(value)
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function queryTokens(query='') {
    return [...new Set(String(query).toLowerCase().match(/[a-z0-9][a-z0-9+.#-]{1,}|[\u3400-\u9fff]{2,}/g) || [])]
      .filter(x => !['the','and','for','with','from','into','using','based'].includes(x));
  }

  function relevanceScore(item, query) {
    const title = String(item.title || '').toLowerCase();
    const abstract = String(item.abstract || '').toLowerCase();
    const tokens = queryTokens(query);
    const titleMatches = tokens.filter(t => title.includes(t)).length;
    const abstractMatches = tokens.filter(t => abstract.includes(t)).length;
    const coverage = tokens.length ? titleMatches / tokens.length : 0;
    const typeBonus = PREFERRED_TYPES.has(item.workType) ? 16 : 0;
    const citationSignal = Math.min(18, Math.log10(Number(item.citations || 0) + 1) * 7);
    return Number(item.crossrefScore || 0) + titleMatches * 22 + abstractMatches * 3 + coverage * 35 + typeBonus + citationSignal;
  }

  function normalizeCrossref(item) {
    const doi = item.DOI ? `https://doi.org/${item.DOI}` : '';
    const authors = (item.author || []).slice(0, 6).map(author => {
      const name = [author.given, author.family].filter(Boolean).join(' ').trim();
      return name || author.name || '';
    }).filter(Boolean);
    const {year, date} = crossrefDate(item);
    const venue = item['container-title']?.[0] || item.publisher || item.type || 'Crossref';
    const url = safeUrl(item.URL || doi || '');
    const title = plainText(item.title?.[0] || item['short-title']?.[0] || 'Untitled');
    return {
      key: `paper:crossref:${item.DOI || item.URL || title}`,
      type: 'paper',
      id: item.DOI || item.URL || title,
      title,
      url,
      authors,
      year,
      date,
      citations: item['is-referenced-by-count'] || 0,
      oa: false,
      venue,
      abstract: truncate(plainText(item.abstract || ''), 520),
      doi,
      workType: item.type || '',
      crossrefScore: Number(item.score || 0),
      indexSource: 'Crossref'
    };
  }

  function usefulPaper(item) {
    const title = String(item.title || '').trim();
    if (!title || title === 'Untitled' || title.length < 7) return false;
    if (LOW_VALUE_TITLE.test(title)) return false;
    if (item.workType && ['component','reference-entry','dataset','other'].includes(item.workType)) return false;
    return item.url !== '#';
  }

  function writePaperState(items, total) {
    state.__paperWriteSource = 'crossref';
    try {
      state.paperTotal = total;
      state.papers = items;
    } finally {
      state.__paperWriteSource = '';
    }
  }

  async function requestCrossref(query, mode='title', rows=36) {
    const url = new URL(CROSSREF_API);
    url.searchParams.set(mode === 'title' ? 'query.title' : 'query.bibliographic', query);
    url.searchParams.set('rows', String(rows));
    const year = Number(els.year.value);
    if (year >= 1900 && year <= 2100) url.searchParams.set('filter', `from-pub-date:${year}-01-01`);
    const res = await fetch(url, {headers:{Accept:'application/json'}, cache:'no-store'});
    if (!res.ok) throw new Error(`Crossref 请求失败 (${res.status})`);
    return res.json();
  }

  async function searchCrossref(query) {
    const primary = await requestCrossref(query, 'title', 36);
    let raw = primary.message?.items || [];

    // For narrow engineering phrases, title search can be sparse. Only then widen the query.
    if (raw.length < 8) {
      const broad = await requestCrossref(query, 'bibliographic', 24);
      const seen = new Set(raw.map(item => item.DOI || item.URL || item.title?.[0]));
      for (const item of broad.message?.items || []) {
        const key = item.DOI || item.URL || item.title?.[0];
        if (!seen.has(key)) raw.push(item);
      }
    }

    let items = raw.map(normalizeCrossref).filter(usefulPaper);
    items.forEach(item => { item.relevance = relevanceScore(item, query); });

    if (els.sort.value === 'cited') items.sort((a,b) => b.citations - a.citations || b.relevance - a.relevance);
    else if (els.sort.value === 'newest') items.sort((a,b) => String(b.date).localeCompare(String(a.date)) || b.relevance - a.relevance);
    else items.sort((a,b) => b.relevance - a.relevance);

    state.paperBackend = 'crossref';
    writePaperState(items.slice(0,20), items.length);
  }

  // OpenAlex requires an API key for production use as of 2026-02-13.
  // Keep the UI useful without credentials by using Crossref as the default paper source.
  searchPapers = async function searchPapersKeyless(query) {
    try {
      await searchCrossref(query);
    } catch (error) {
      state.paperBackend = 'crossref';
      writePaperState([], 0);
      state.paperBackend = 'crossref-error';
      throw new Error(error?.message || '论文数据源请求失败');
    }
  };

  const previousUpdateCounts = updateCounts;
  updateCounts = function updateCountsWithPaperSource() {
    previousUpdateCounts();
    const label = document.querySelector('#paperSourceLabel');
    if (label) label.textContent = state.paperBackend === 'crossref-error' ? '论文 · Crossref（异常）' : '论文 · Crossref';
  };

  // app.js may have already started a URL-based query before this adapter loaded.
  // Re-run after all deferred scripts install their wrappers.
  if (state.query) setTimeout(() => performSearch(state.query), 0);
})();
