(() => {
  const CROSSREF_API = 'https://api.crossref.org/works';
  const LOW_VALUE_TITLE = /^(index|subject index|author index|contents?|table of contents|front matter|back matter|preface|foreword|editorial|introduction|conclusion|references|bibliography)$/i;
  const TYPE_WEIGHT = new Map([
    ['journal-article', 24],
    ['proceedings-article', 22],
    ['posted-content', 18],
    ['dissertation', 15],
    ['report', 13],
    ['book-chapter', 6],
    ['book', 4]
  ]);

  state.paperBackend = 'crossref';
  state.__paperWriteSource = '';

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

  function normalized(value='') {
    return plainText(value).toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function queryTokens(query='') {
    return [...new Set(String(query).toLowerCase().match(/[a-z0-9][a-z0-9+.#-]{1,}|[\u3400-\u9fff]{2,}/g) || [])]
      .filter(x => !['the','and','for','with','from','into','using','based','study','analysis'].includes(x));
  }

  function relevanceScore(item, query) {
    const title = normalized(item.title);
    const abstract = normalized(item.abstract);
    const queryNorm = normalized(query);
    const tokens = queryTokens(query);
    const titleMatches = tokens.filter(t => title.includes(t)).length;
    const abstractMatches = tokens.filter(t => abstract.includes(t)).length;
    const coverage = tokens.length ? titleMatches / tokens.length : 0;
    const exactPhrase = queryNorm && title.includes(queryNorm) ? 38 : 0;
    const startsWithPhrase = queryNorm && title.startsWith(queryNorm) ? 10 : 0;
    const typeBonus = TYPE_WEIGHT.get(item.workType) || 0;
    const citationSignal = Math.min(30, Math.log10(Number(item.citations || 0) + 1) * 10);
    const currentYear = new Date().getFullYear();
    const recencySignal = item.year && item.year >= currentYear - 3 ? 4 : 0;
    const genericExactPenalty = title === queryNorm && ['book-chapter','book','reference-entry'].includes(item.workType) && Number(item.citations || 0) < 25 ? 34 : 0;
    const veryShortPenalty = title.split(' ').length <= 2 && tokens.length >= 2 && Number(item.citations || 0) < 10 ? 16 : 0;
    return Number(item.crossrefScore || 0)
      + titleMatches * 25
      + abstractMatches * 4
      + coverage * 42
      + exactPhrase
      + startsWithPhrase
      + typeBonus
      + citationSignal
      + recencySignal
      - genericExactPenalty
      - veryShortPenalty;
  }

  function normalizeCrossref(item) {
    const doi = item.DOI ? `https://doi.org/${item.DOI}` : '';
    const authors = (item.author || []).slice(0, 8).map(author => {
      const name = [author.given, author.family].filter(Boolean).join(' ').trim();
      return name || author.name || '';
    }).filter(Boolean);
    const {year, date} = crossrefDate(item);
    const venue = item['container-title']?.[0] || item.publisher || item.type || 'Crossref';
    const url = safeUrl(item.URL || doi || '');
    const title = plainText(item.title?.[0] || item['short-title']?.[0] || 'Untitled');
    const oa = Array.isArray(item.license) && item.license.length > 0;
    return {
      key: `paper:crossref:${item.DOI || item.URL || `${title}:${year || ''}`}`,
      type: 'paper',
      id: item.DOI || item.URL || title,
      title,
      url,
      authors,
      year,
      date,
      citations: item['is-referenced-by-count'] || 0,
      oa,
      venue,
      abstract: truncate(plainText(item.abstract || ''), 720),
      doi,
      workType: item.type || '',
      crossrefScore: Number(item.score || 0),
      indexSource: 'Crossref'
    };
  }

  function usefulPaper(item) {
    const title = plainText(item.title || '');
    if (!title || title === 'Untitled' || title.length < 7) return false;
    if (LOW_VALUE_TITLE.test(title)) return false;
    if (item.workType && ['component','reference-entry','dataset','other','journal-issue','journal-volume'].includes(item.workType)) return false;
    return item.url !== '#';
  }

  function paperIdentity(item) {
    const doi = String(item.doi || '').replace(/^https?:\/\/doi\.org\//i, '').toLowerCase();
    if (doi) return `doi:${doi}`;
    return `title:${normalized(item.title)}:${item.year || ''}`;
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

  async function requestCrossref(query, mode='title', rows=28) {
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
    const [titleResponse, broadResponse] = await Promise.all([
      requestCrossref(query, 'title', 30),
      requestCrossref(query, 'bibliographic', 30)
    ]);

    const raw = [...(titleResponse.message?.items || []), ...(broadResponse.message?.items || [])];
    const unique = new Map();
    for (const rawItem of raw) {
      const item = normalizeCrossref(rawItem);
      if (!usefulPaper(item)) continue;
      item.relevance = relevanceScore(item, query);
      const id = paperIdentity(item);
      const previous = unique.get(id);
      if (!previous || item.relevance > previous.relevance) unique.set(id, item);
    }

    let items = [...unique.values()];
    if (els.sort.value === 'cited') items.sort((a,b) => b.citations - a.citations || b.relevance - a.relevance);
    else if (els.sort.value === 'newest') items.sort((a,b) => String(b.date).localeCompare(String(a.date)) || b.relevance - a.relevance);
    else items.sort((a,b) => b.relevance - a.relevance);

    state.paperBackend = 'crossref';
    writePaperState(items.slice(0,20), items.length);
  }

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

  if (state.query) setTimeout(() => performSearch(state.query), 0);
})();
