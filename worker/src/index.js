const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const PATENT_ENDPOINT = 'https://search.patentsview.org/api/v1/patent/';
const OFFICIAL_DOMAINS = [
  'openai.com','anthropic.com','deepmind.google','ai.google','research.google',
  'microsoft.com','nvidia.com','siemens.com','sw.siemens.com','autodesk.com',
  '3ds.com','ptc.com','arxiv.org','nature.com','science.org','ieee.org','acm.org',
  'epo.org','uspto.gov'
];

function cors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const configured = String(env.ALLOWED_ORIGINS || 'https://jinlong-github.github.io,http://localhost:8000').split(',').map(x => x.trim()).filter(Boolean);
  const allowed = configured.includes(origin) || (!origin && configured[0]) ? (origin || configured[0]) : configured[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(request, env, data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8',...cors(request, env)}});
}
function domainOf(value='') {
  try { return new URL(value).hostname.replace(/^www\./,'').toLowerCase(); } catch { return ''; }
}
function isOfficial(domain='') {
  return OFFICIAL_DOMAINS.some(x => domain === x || domain.endsWith(`.${x}`));
}
function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

async function webSearch(request, env, url) {
  if (!env.BRAVE_SEARCH_API_KEY) return json(request, env, {error:'BRAVE_SEARCH_API_KEY 未配置', code:'BRAVE_KEY_MISSING'}, 503);
  const q = String(url.searchParams.get('q') || '').trim().slice(0,400);
  if (!q) return json(request, env, {error:'缺少 q', code:'BAD_QUERY'}, 400);
  const count = clampInt(url.searchParams.get('count'), 1, 20, 20);
  const officialOnly = url.searchParams.get('official') === '1';
  const upstream = new URL(BRAVE_ENDPOINT);
  upstream.searchParams.set('q', q);
  upstream.searchParams.set('count', String(count));
  upstream.searchParams.set('safesearch', 'moderate');
  upstream.searchParams.set('spellcheck', '1');
  const response = await fetch(upstream, {
    headers:{'Accept':'application/json','X-Subscription-Token':env.BRAVE_SEARCH_API_KEY}
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json(request, env, {error:data.message || `Brave Search 请求失败 (${response.status})`, code:'BRAVE_ERROR'}, response.status);
  let results = (data.web?.results || []).map(item => {
    const domain = domainOf(item.url);
    return {
      title:item.title || '', url:item.url || '', description:item.description || '',
      age:item.age || item.page_age || '', domain, official:isOfficial(domain)
    };
  }).filter(x => x.url);
  if (officialOnly) results = results.filter(x => x.official);
  results.sort((a,b) => Number(b.official) - Number(a.official));
  return json(request, env, {
    query:q, results, total:results.length,
    more_results_available:Boolean(data.query?.more_results_available),
    official_only:officialOnly
  });
}

async function patentSearch(request, env, url) {
  if (!env.PATENTSVIEW_API_KEY) return json(request, env, {error:'PATENTSVIEW_API_KEY 未配置', code:'PATENT_KEY_MISSING'}, 503);
  const qText = String(url.searchParams.get('q') || '').trim();
  if (!qText) return json(request, env, {error:'缺少 q', code:'BAD_QUERY'}, 400);
  const criteria = [{_or:[{_text_any:{patent_title:qText}},{_text_any:{patent_abstract:qText}}]}];
  const year = clampInt(url.searchParams.get('fromYear'), 1900, 2100, 0);
  if (year) criteria.push({_gte:{patent_date:`${year}-01-01`}});
  const q = criteria.length > 1 ? {_and:criteria} : criteria[0];
  const upstream = new URL(PATENT_ENDPOINT);
  upstream.searchParams.set('q', JSON.stringify(q));
  upstream.searchParams.set('f', JSON.stringify([
    'patent_id','patent_title','patent_date','patent_year','patent_abstract',
    'patent_num_total_documents_cited','assignees.assignee_organization'
  ]));
  upstream.searchParams.set('o', JSON.stringify({size:25}));
  if (url.searchParams.get('sort') === 'newest') upstream.searchParams.set('s', JSON.stringify([{patent_date:'desc'}]));
  const response = await fetch(upstream, {headers:{'Accept':'application/json','X-Api-Key':env.PATENTSVIEW_API_KEY}});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json(request, env, {error:data.error || `PatentsView 请求失败 (${response.status})`, code:'PATENT_ERROR'}, response.status);
  return json(request, env, data);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:cors(request, env)});
    if (request.method !== 'GET') return json(request, env, {error:'Method not allowed'}, 405);
    const url = new URL(request.url);
    try {
      if (url.pathname === '/' || url.pathname === '/api/status') {
        return json(request, env, {
          ok:true,
          service:'research-search-api',
          providers:{brave:Boolean(env.BRAVE_SEARCH_API_KEY), patentsview:Boolean(env.PATENTSVIEW_API_KEY)}
        });
      }
      if (url.pathname === '/api/web') return await webSearch(request, env, url);
      if (url.pathname === '/api/patents') return await patentSearch(request, env, url);
      return json(request, env, {error:'Not found'}, 404);
    } catch (error) {
      return json(request, env, {error:error?.message || 'Internal error', code:'INTERNAL_ERROR'}, 500);
    }
  }
};
