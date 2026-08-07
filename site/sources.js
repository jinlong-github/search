(() => {
  const CROSSREF_API = 'https://api.crossref.org/works';

  state.paperBackend = 'crossref';

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

  function normalizeCrossref(item) {
    const doi = item.DOI ? `https://doi.org/${item.DOI}` : '';
    const authors = (item.author || []).slice(0, 5).map(author => {
      const name = [author.given, author.family].filter(Boolean).join(' ').trim();
      return name || author.name || '';
    }).filter(Boolean);
    const {year, date} = crossrefDate(item);
    const venue = item['container-title']?.[0] || item.publisher || item.type || 'Crossref';
    const url = safeUrl(item.URL || doi || '');
    const title = item.title?.[0] || item['short-title']?.[0] || 'Untitled';
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
      indexSource: 'Crossref'
    };
  }

  async function searchCrossref(query) {
    const url = new URL(CROSSREF_API);
    url.searchParams.set('query.bibliographic', query);
    url.searchParams.set('rows', '20');
    const year = Number(els.year.value);
    if (year >= 1900 && year <= 2100) url.searchParams.set('filter', `from-pub-date:${year}-01-01`);
    const res = await fetch(url, {headers:{Accept:'application/json'}, cache:'no-store'});
    if (!res.ok) throw new Error(`Crossref 请求失败 (${res.status})`);
    const data = await res.json();
    let items = (data.message?.items || []).map(normalizeCrossref).filter(item => item.url !== '#');
    if (els.sort.value === 'cited') items.sort((a,b) => b.citations - a.citations);
    if (els.sort.value === 'newest') items.sort((a,b) => String(b.date).localeCompare(String(a.date)));
    state.paperTotal = Number(data.message?.['total-results'] || items.length);
    state.papers = items.slice(0,20);
    state.paperBackend = 'crossref';
  }

  // OpenAlex requires an API key for production use as of 2026-02-13.
  // Keep the UI useful without credentials by using Crossref as the default paper source.
  searchPapers = async function searchPapersKeyless(query) {
    try {
      await searchCrossref(query);
    } catch (error) {
      state.papers = [];
      state.paperTotal = 0;
      state.paperBackend = 'crossref-error';
      throw new Error(error?.message || '论文数据源请求失败');
    }
  };

  const previousUpdateCounts = updateCounts;
  updateCounts = function updateCountsWithPaperSource() {
    previousUpdateCounts();
    const label = document.querySelector('#paperSourceLabel');
    if (label) label.textContent = state.paperBackend === 'crossref-error' ? '论文 · Crossref（异常）' : '论文 · Crossref（无需 Key）';
  };

  // app.js may have already started a URL-based query before this adapter loaded.
  // Re-run after the current script turn; by then web/UX/status wrappers are installed,
  // so the visible results are guaranteed to use the current source stack.
  if (state.query) {
    setTimeout(() => performSearch(state.query), 0);
  }
})();
