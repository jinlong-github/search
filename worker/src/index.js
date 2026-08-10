const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const PATENT_ENDPOINT = 'https://search.patentsview.org/api/v1/patent/';
const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const SERVICE_VERSION = 'research-os-v19';
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
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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
function clean(value='') { return String(value ?? '').replace(/\s+/g,' ').trim(); }
function numberEnv(value) {
  const n = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function pricing(env) {
  const input = numberEnv(env.OPENAI_INPUT_USD_PER_1M);
  const output = numberEnv(env.OPENAI_OUTPUT_USD_PER_1M);
  return {configured:input !== null && output !== null,input_usd_per_million:input,output_usd_per_million:output};
}
function usageOf(data) {
  const usage = data?.usage || {};
  return {
    input_tokens:Number(usage.input_tokens || 0),
    output_tokens:Number(usage.output_tokens || 0),
    total_tokens:Number(usage.total_tokens || 0),
    cached_input_tokens:Number(usage.input_tokens_details?.cached_tokens || 0),
    reasoning_tokens:Number(usage.output_tokens_details?.reasoning_tokens || 0)
  };
}
function estimateCost(usage,rate) {
  if (!rate.configured) return null;
  return (usage.input_tokens / 1_000_000) * rate.input_usd_per_million + (usage.output_tokens / 1_000_000) * rate.output_usd_per_million;
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
  const response = await fetch(upstream, {headers:{'Accept':'application/json','X-Subscription-Token':env.BRAVE_SEARCH_API_KEY}});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json(request, env, {error:data.message || `Brave Search 请求失败 (${response.status})`, code:'BRAVE_ERROR'}, response.status);
  let results = (data.web?.results || []).map(item => {
    const domain = domainOf(item.url);
    return {title:item.title || '', url:item.url || '', description:item.description || '', age:item.age || item.page_age || '', domain, official:isOfficial(domain)};
  }).filter(x => x.url);
  if (officialOnly) results = results.filter(x => x.official);
  results.sort((a,b) => Number(b.official) - Number(a.official));
  return json(request, env, {query:q, results, total:results.length, more_results_available:Boolean(data.query?.more_results_available), official_only:officialOnly});
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
  upstream.searchParams.set('f', JSON.stringify(['patent_id','patent_title','patent_date','patent_year','patent_abstract','patent_num_total_documents_cited','assignees.assignee_organization']));
  upstream.searchParams.set('o', JSON.stringify({size:25}));
  if (url.searchParams.get('sort') === 'newest') upstream.searchParams.set('s', JSON.stringify([{patent_date:'desc'}]));
  const response = await fetch(upstream, {headers:{'Accept':'application/json','X-Api-Key':env.PATENTSVIEW_API_KEY}});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json(request, env, {error:data.error || `PatentsView 请求失败 (${response.status})`, code:'PATENT_ERROR'}, response.status);
  return json(request, env, data);
}

function outputText(data) {
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && content.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}
function parseModelJson(text='') {
  const raw = clean(text).replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start,end+1)); } catch {}
  }
  return null;
}

async function aiSummaries(request, env) {
  if (!env.OPENAI_API_KEY) return json(request, env, {error:'OPENAI_API_KEY 未配置', code:'OPENAI_KEY_MISSING'}, 503);
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) return json(request, env, {error:'请求体必须包含 items 数组', code:'BAD_BODY'}, 400);
  const style = ['brief','standard','detailed'].includes(body.style) ? body.style : 'standard';
  const items = body.items.slice(0,16).map(item => ({
    key:clean(item.key).slice(0,500), type:clean(item.type).slice(0,40), title:clean(item.title).slice(0,600),
    source:clean(item.source).slice(0,300), year:item.year || null,
    authors:Array.isArray(item.authors) ? item.authors.map(clean).filter(Boolean).slice(0,6) : [],
    text:clean(item.text).slice(0,1800)
  })).filter(item => item.key && item.title);
  if (!items.length) return json(request, env, {error:'没有可处理的结果', code:'EMPTY_ITEMS'}, 400);

  const lengthRule = style === 'brief' ? '每条 1 句，约 35–60 个中文字符' : style === 'detailed' ? '每条 2–3 句，约 90–150 个中文字符' : '每条 1–2 句，约 55–100 个中文字符';
  const prompt = `你是科研情报检索系统的中文摘要器。请基于提供的标题、来源和原始摘要/片段生成技术上谨慎的中文摘要。\n规则：\n1. ${lengthRule}。\n2. 保留关键英文技术术语、缩写、模型名、标准号。\n3. 不得补充输入中没有的实验结果、性能数字、机构关系、引用关系或专利关系。\n4. 如果信息只够判断主题，就明确写成“该条目主要涉及……”而不是虚构细节。\n5. 返回严格 JSON，不要 Markdown，不要解释。格式：{"summaries":[{"key":"原 key","summary":"中文摘要"}]}。\n\n输入：${JSON.stringify(items)}`;
  const model = clean(env.OPENAI_MODEL || 'gpt-5-mini');
  const started = Date.now();
  const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method:'POST',
    headers:{'Authorization':`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({model,input:prompt,store:false,max_output_tokens:1800})
  });
  const data = await response.json().catch(() => ({}));
  const usage = usageOf(data);
  const rate = pricing(env);
  const estimatedCostUsd = estimateCost(usage,rate);
  const diagnostics = {model,usage,estimated_cost_usd:estimatedCostUsd,pricing_configured:rate.configured,duration_ms:Math.max(0,Date.now()-started)};
  if (!response.ok) return json(request, env, {error:data?.error?.message || `OpenAI 请求失败 (${response.status})`, code:'OPENAI_ERROR',...diagnostics}, response.status);
  const parsed = parseModelJson(outputText(data));
  const summaries = Array.isArray(parsed?.summaries) ? parsed.summaries.map(entry => ({key:clean(entry.key),summary:clean(entry.summary)})).filter(entry => entry.key && entry.summary) : [];
  if (!summaries.length) return json(request, env, {error:'AI 返回内容无法解析为摘要', code:'AI_PARSE_ERROR',...diagnostics}, 502);
  return json(request, env, {summaries,count:summaries.length,response_id:clean(data.id || ''),...diagnostics});
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:cors(request, env)});
    const url = new URL(request.url);
    try {
      if ((url.pathname === '/' || url.pathname === '/api/status') && request.method === 'GET') {
        const model = clean(env.OPENAI_MODEL || 'gpt-5-mini');
        return json(request, env, {
          ok:true, service:'research-search-api', version:SERVICE_VERSION, timestamp:new Date().toISOString(),
          providers:{brave:Boolean(env.BRAVE_SEARCH_API_KEY), patentsview:Boolean(env.PATENTSVIEW_API_KEY), openai:Boolean(env.OPENAI_API_KEY)},
          ai:{model, endpoint:'/api/ai/summaries', key_location:'server', pricing:pricing(env)}
        });
      }
      if (url.pathname === '/api/web' && request.method === 'GET') return await webSearch(request, env, url);
      if (url.pathname === '/api/patents' && request.method === 'GET') return await patentSearch(request, env, url);
      if (url.pathname === '/api/ai/summaries' && request.method === 'POST') return await aiSummaries(request, env);
      if (!['GET','POST'].includes(request.method)) return json(request, env, {error:'Method not allowed'}, 405);
      return json(request, env, {error:'Not found'}, 404);
    } catch (error) {
      return json(request, env, {error:error?.message || 'Internal error', code:'INTERNAL_ERROR'}, 500);
    }
  }
};
