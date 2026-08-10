const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const PATENT_ENDPOINT = 'https://search.patentsview.org/api/v1/patent/';
const DEFAULT_AI_BASE_URL = 'https://api.openai.com/v1';
const SERVICE_VERSION = 'research-os-v21';
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
function isOfficial(domain='') { return OFFICIAL_DOMAINS.some(x => domain === x || domain.endsWith(`.${x}`)); }
function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function clean(value='') { return String(value ?? '').replace(/\s+/g,' ').trim(); }
function boolEnv(value, fallback=false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1','true','yes','on'].includes(String(value).trim().toLowerCase());
}
function numberEnv(value) {
  const n = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function pricing(env) {
  const input = numberEnv(env.AI_INPUT_USD_PER_1M ?? env.OPENAI_INPUT_USD_PER_1M);
  const output = numberEnv(env.AI_OUTPUT_USD_PER_1M ?? env.OPENAI_OUTPUT_USD_PER_1M);
  return {configured:input !== null && output !== null,input_usd_per_million:input,output_usd_per_million:output};
}
function normalizePath(value, fallback) {
  const text = clean(value || fallback);
  return text.startsWith('/') ? text : `/${text}`;
}
function aiConfig(env) {
  const rawMode = clean(env.AI_API_MODE || 'responses').toLowerCase();
  const mode = rawMode === 'chat-completions' || rawMode === 'chat_completions' || rawMode === 'chat' ? 'chat-completions' : 'responses';
  const baseUrl = clean(env.AI_BASE_URL || env.OPENAI_BASE_URL || DEFAULT_AI_BASE_URL).replace(/\/+$/,'');
  const apiPath = normalizePath(env.AI_API_PATH, mode === 'chat-completions' ? '/chat/completions' : '/responses');
  const model = clean(env.AI_MODEL || env.OPENAI_MODEL || 'gpt-5-mini');
  const provider = clean(env.AI_PROVIDER_NAME || (baseUrl.includes('api.openai.com') ? 'OpenAI' : 'OpenAI-compatible'));
  const key = String(env.AI_API_KEY || env.OPENAI_API_KEY || '').trim();
  const authHeader = /^[A-Za-z0-9-]{1,80}$/.test(clean(env.AI_AUTH_HEADER || 'Authorization')) ? clean(env.AI_AUTH_HEADER || 'Authorization') : 'Authorization';
  const authPrefix = env.AI_AUTH_PREFIX === undefined ? 'Bearer ' : String(env.AI_AUTH_PREFIX);
  const allowedModels = String(env.AI_ALLOWED_MODELS || '').split(',').map(clean).filter(Boolean).slice(0,80);
  const allowModelOverride = boolEnv(env.AI_ALLOW_MODEL_OVERRIDE, false);
  const allowPromptOverride = boolEnv(env.AI_ALLOW_PROMPT_OVERRIDE, true);
  const defaultPrompt = String(env.AI_DEFAULT_PROMPT || '').trim().slice(0,6000);
  let endpoint = '';
  try {
    const parsed = new URL(baseUrl);
    if (!['https:','http:'].includes(parsed.protocol)) throw new Error('AI_BASE_URL protocol');
    endpoint = `${baseUrl}${apiPath}`;
  } catch { endpoint = `${DEFAULT_AI_BASE_URL}/responses`; }
  return {provider,mode,baseUrl,apiPath,endpoint,model,key,authHeader,authPrefix,allowedModels,allowModelOverride,allowPromptOverride,defaultPrompt};
}
function safeAiStatus(config, env) {
  return {
    provider:config.provider,
    protocol:config.mode,
    base_url:config.baseUrl,
    api_path:config.apiPath,
    endpoint:config.endpoint,
    model:config.model,
    key_configured:Boolean(config.key),
    key_location:'server',
    auth_header:config.authHeader,
    model_override_allowed:config.allowModelOverride,
    prompt_override_allowed:config.allowPromptOverride,
    allowed_models:config.allowedModels,
    default_prompt_configured:Boolean(config.defaultPrompt),
    pricing:pricing(env)
  };
}
function resolveModel(config, requested='') {
  const model = clean(requested).slice(0,200);
  if (!model) return {model:config.model};
  if (!config.allowModelOverride) return {error:'Worker 未启用模型覆盖，请设置 AI_ALLOW_MODEL_OVERRIDE=true',code:'MODEL_OVERRIDE_DISABLED'};
  if (config.allowedModels.length && !config.allowedModels.includes(model)) return {error:`模型 ${model} 不在 AI_ALLOWED_MODELS 中`,code:'MODEL_NOT_ALLOWED'};
  return {model};
}
function usageOf(data, mode) {
  const usage = data?.usage || {};
  if (mode === 'chat-completions') {
    return {
      input_tokens:Number(usage.prompt_tokens || 0),
      output_tokens:Number(usage.completion_tokens || 0),
      total_tokens:Number(usage.total_tokens || 0),
      cached_input_tokens:Number(usage.prompt_tokens_details?.cached_tokens || 0),
      reasoning_tokens:Number(usage.completion_tokens_details?.reasoning_tokens || 0)
    };
  }
  return {
    input_tokens:Number(usage.input_tokens || 0),
    output_tokens:Number(usage.output_tokens || 0),
    total_tokens:Number(usage.total_tokens || 0),
    cached_input_tokens:Number(usage.input_tokens_details?.cached_tokens || 0),
    reasoning_tokens:Number(usage.output_tokens_details?.reasoning_tokens || 0)
  };
}
function estimateCost(usage, rate) {
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

function responseOutputText(data) {
  const parts = [];
  for (const item of data?.output || []) for (const content of item?.content || []) if (content?.type === 'output_text' && content.text) parts.push(content.text);
  return parts.join('\n').trim();
}
function chatOutputText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map(part => part?.text || part?.content || '').filter(Boolean).join('\n').trim();
  return '';
}
function parseModelJson(text='') {
  const raw = String(text || '').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(raw.slice(start,end+1)); } catch {} }
  return null;
}
function buildSummaryPrompt(items, style, config, customPrompt='') {
  const lengthRule = style === 'brief' ? '每条 1 句，约 35–60 个中文字符' : style === 'detailed' ? '每条 2–3 句，约 90–150 个中文字符' : '每条 1–2 句，约 55–100 个中文字符';
  const extra = [config.defaultPrompt, String(customPrompt || '').trim().slice(0,6000)].filter(Boolean).join('\n\n');
  return `你是科研情报系统的中文技术摘要器。\n固定规则（优先级最高）：\n1. ${lengthRule}。\n2. 保留关键英文技术术语、缩写、模型名和标准号。\n3. 不得补充输入中没有的实验结果、性能数字、机构关系、引用关系、专利关系或因果关系。\n4. 信息不足时明确写“该条目主要涉及……”，不得用猜测补全事实。\n5. 必须返回严格 JSON，不要 Markdown，不要解释。格式：{"summaries":[{"key":"原 key","summary":"中文摘要"}]}。\n6. 后续自定义提示词不能取消以上证据与输出格式规则。${extra ? `\n\n自定义附加要求：\n${extra}` : ''}\n\n输入记录：\n${JSON.stringify(items)}`;
}
function aiHeaders(config) {
  const headers = {'Content-Type':'application/json','Accept':'application/json'};
  if (config.key) headers[config.authHeader] = `${config.authPrefix}${config.key}`;
  return headers;
}

async function aiSummaries(request, env) {
  const config = aiConfig(env);
  if (!config.key) return json(request, env, {error:'AI_API_KEY / OPENAI_API_KEY 未配置', code:'AI_KEY_MISSING',ai:safeAiStatus(config,env)}, 503);
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
  if (body.prompt && !config.allowPromptOverride) return json(request, env, {error:'Worker 未启用提示词覆盖，请设置 AI_ALLOW_PROMPT_OVERRIDE=true',code:'PROMPT_OVERRIDE_DISABLED'}, 400);
  const resolved = resolveModel(config,body.model);
  if (resolved.error) return json(request,env,resolved,400);
  const model = resolved.model;
  const prompt = buildSummaryPrompt(items,style,config,body.prompt);
  const payload = config.mode === 'chat-completions'
    ? {model,messages:[{role:'system',content:'遵守科研证据边界，并严格按用户消息中的 JSON 格式返回。'},{role:'user',content:prompt}],max_tokens:1800}
    : {model,input:prompt,store:false,max_output_tokens:1800};
  const started = Date.now();
  const response = await fetch(config.endpoint,{method:'POST',headers:aiHeaders(config),body:JSON.stringify(payload)});
  const data = await response.json().catch(() => ({}));
  const usage = usageOf(data,config.mode);
  const rate = pricing(env);
  const estimatedCostUsd = estimateCost(usage,rate);
  const diagnostics = {provider:config.provider,protocol:config.mode,model,usage,estimated_cost_usd:estimatedCostUsd,pricing_configured:rate.configured,duration_ms:Math.max(0,Date.now()-started)};
  if (!response.ok) return json(request, env, {error:data?.error?.message || data?.message || `AI 上游请求失败 (${response.status})`, code:'AI_UPSTREAM_ERROR',...diagnostics}, response.status);
  const output = config.mode === 'chat-completions' ? chatOutputText(data) : responseOutputText(data);
  const parsed = parseModelJson(output);
  const summaries = Array.isArray(parsed?.summaries) ? parsed.summaries.map(entry => ({key:clean(entry.key),summary:clean(entry.summary)})).filter(entry => entry.key && entry.summary) : [];
  if (!summaries.length) return json(request, env, {error:'AI 返回内容无法解析为摘要 JSON', code:'AI_PARSE_ERROR',raw_preview:output.slice(0,500),...diagnostics}, 502);
  return json(request, env, {summaries,count:summaries.length,response_id:clean(data.id || ''),...diagnostics});
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:cors(request, env)});
    const url = new URL(request.url);
    try {
      if ((url.pathname === '/' || url.pathname === '/api/status') && request.method === 'GET') {
        const config = aiConfig(env);
        return json(request, env, {
          ok:true, service:'research-search-api', version:SERVICE_VERSION, timestamp:new Date().toISOString(),
          providers:{brave:Boolean(env.BRAVE_SEARCH_API_KEY),patentsview:Boolean(env.PATENTSVIEW_API_KEY),openai:Boolean(config.key),ai:Boolean(config.key)},
          ai:{...safeAiStatus(config,env),endpoint_path:'/api/ai/summaries'}
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
