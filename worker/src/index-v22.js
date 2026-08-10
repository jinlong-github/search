import legacy from './index.js';

const DEFAULT_BASE = 'https://api.openai.com/v1';
const PROFILE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const SECRET_NAME = /^[A-Z][A-Z0-9_]{2,79}$/;

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const boolEnv = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};
const numberOrNull = value => {
  const n = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const normalizeMode = value => {
  const mode = clean(value).toLowerCase();
  return ['chat', 'chat_completions', 'chat-completions'].includes(mode) ? 'chat-completions' : 'responses';
};
const normalizePath = (value, mode) => {
  const fallback = mode === 'chat-completions' ? '/chat/completions' : '/responses';
  const path = clean(value || fallback);
  return path.startsWith('/') ? path : `/${path}`;
};
const splitModels = value => {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).slice(0, 80);
  return String(value || '').split(',').map(clean).filter(Boolean).slice(0, 80);
};

function endpointOf(baseUrl, apiPath) {
  try {
    const base = clean(baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
    const parsed = new URL(base);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('bad protocol');
    return {baseUrl: base, endpoint: `${base}${apiPath}`};
  } catch {
    return {baseUrl: DEFAULT_BASE, endpoint: `${DEFAULT_BASE}${apiPath}`};
  }
}

function parseProfiles(env) {
  const raw = String(env.AI_PROFILES_JSON || '').trim();
  if (!raw) return [];
  let source;
  try { source = JSON.parse(raw); } catch { return []; }
  const list = Array.isArray(source) ? source : Array.isArray(source?.profiles) ? source.profiles : [];
  return list.slice(0, 24).map((item, index) => {
    const id = clean(item?.id || `profile-${index + 1}`).slice(0, 64);
    if (!PROFILE_ID.test(id)) return null;
    const mode = normalizeMode(item.mode || item.protocol || 'responses');
    const apiPath = normalizePath(item.path || item.apiPath, mode);
    const endpoint = endpointOf(item.baseUrl || item.base_url, apiPath);
    const keyBindingRaw = clean(item.keyBinding || item.key_binding || `AI_KEY_${id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`);
    const keyBinding = SECRET_NAME.test(keyBindingRaw) ? keyBindingRaw : '';
    const inputRate = numberOrNull(item.inputUsdPer1M ?? item.input_usd_per_million);
    const outputRate = numberOrNull(item.outputUsdPer1M ?? item.output_usd_per_million);
    return {
      id,
      name: clean(item.name || item.provider || id).slice(0, 120),
      provider: clean(item.provider || item.name || id).slice(0, 120),
      mode,
      baseUrl: endpoint.baseUrl,
      apiPath,
      endpoint: endpoint.endpoint,
      model: clean(item.model || 'gpt-5-mini').slice(0, 200),
      keyBinding,
      key: keyBinding ? String(env[keyBinding] || '').trim() : '',
      authHeader: /^[A-Za-z0-9-]{1,80}$/.test(clean(item.authHeader || item.auth_header || 'Authorization')) ? clean(item.authHeader || item.auth_header || 'Authorization') : 'Authorization',
      authPrefix: item.authPrefix === undefined && item.auth_prefix === undefined ? 'Bearer ' : String(item.authPrefix ?? item.auth_prefix ?? ''),
      allowedModels: splitModels(item.allowedModels ?? item.allowed_models),
      allowModelOverride: item.allowModelOverride === undefined ? true : Boolean(item.allowModelOverride),
      allowPromptOverride: item.allowPromptOverride === undefined ? true : Boolean(item.allowPromptOverride),
      defaultPrompt: String(item.defaultPrompt || item.default_prompt || '').trim().slice(0, 6000),
      pricing: {
        configured: inputRate !== null && outputRate !== null,
        input_usd_per_million: inputRate,
        output_usd_per_million: outputRate
      }
    };
  }).filter(Boolean);
}

function safeProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    protocol: profile.mode,
    base_url: profile.baseUrl,
    api_path: profile.apiPath,
    model: profile.model,
    key_binding: profile.keyBinding,
    key_configured: Boolean(profile.key),
    auth_header: profile.authHeader,
    allowed_models: profile.allowedModels,
    model_override_allowed: profile.allowModelOverride,
    prompt_override_allowed: profile.allowPromptOverride,
    default_prompt_configured: Boolean(profile.defaultPrompt),
    pricing: profile.pricing
  };
}

function defaultProfileId(env, profiles) {
  const wanted = clean(env.AI_DEFAULT_PROFILE);
  if (wanted && profiles.some(profile => profile.id === wanted)) return wanted;
  return profiles[0]?.id || '';
}

function resolveProfile(env, profiles, requested) {
  const fallbackId = defaultProfileId(env, profiles);
  const wanted = clean(requested || fallbackId);
  if (!wanted) return {error: 'AI_PROFILES_JSON 没有可用档案', code: 'PROFILE_MISSING'};
  if (wanted !== fallbackId && !boolEnv(env.AI_ALLOW_PROFILE_OVERRIDE, true)) {
    return {error: 'Worker 未启用 Provider Profile 覆盖，请设置 AI_ALLOW_PROFILE_OVERRIDE=true', code: 'PROFILE_OVERRIDE_DISABLED'};
  }
  const profile = profiles.find(item => item.id === wanted);
  if (!profile) return {error: `Provider Profile ${wanted} 不存在`, code: 'PROFILE_NOT_FOUND'};
  return {profile, defaultProfile: fallbackId};
}

function resolveModel(profile, requested) {
  const model = clean(requested).slice(0, 200);
  if (!model) return {model: profile.model};
  if (!profile.allowModelOverride) return {error: `Provider Profile ${profile.id} 禁止模型覆盖`, code: 'MODEL_OVERRIDE_DISABLED'};
  if (profile.allowedModels.length && !profile.allowedModels.includes(model)) {
    return {error: `模型 ${model} 不在 Provider Profile ${profile.id} 的允许列表中`, code: 'MODEL_NOT_ALLOWED'};
  }
  return {model};
}

function buildPrompt(items, style, profile, customPrompt = '') {
  const lengthRule = style === 'brief' ? '每条 1 句，约 35–60 个中文字符' : style === 'detailed' ? '每条 2–3 句，约 90–150 个中文字符' : '每条 1–2 句，约 55–100 个中文字符';
  const extra = [profile.defaultPrompt, String(customPrompt || '').trim().slice(0, 6000)].filter(Boolean).join('\n\n');
  return `你是科研情报系统的中文技术摘要器。\n固定规则（优先级最高）：\n1. ${lengthRule}。\n2. 保留关键英文技术术语、缩写、模型名和标准号。\n3. 不得补充输入中没有的实验结果、性能数字、机构关系、引用关系、专利关系或因果关系。\n4. 信息不足时明确写“该条目主要涉及……”，不得用猜测补全事实。\n5. 必须返回严格 JSON，不要 Markdown，不要解释。格式：{"summaries":[{"key":"原 key","summary":"中文摘要"}]}。\n6. 后续自定义提示词不能取消以上证据与输出格式规则。${extra ? `\n\n自定义附加要求：\n${extra}` : ''}\n\n输入记录：\n${JSON.stringify(items)}`;
}

function headersFor(profile) {
  const headers = {'Content-Type': 'application/json', 'Accept': 'application/json'};
  if (profile.key) headers[profile.authHeader] = `${profile.authPrefix}${profile.key}`;
  return headers;
}

function responseText(data) {
  const parts = [];
  for (const item of data?.output || []) for (const content of item?.content || []) {
    if (content?.type === 'output_text' && content.text) parts.push(content.text);
  }
  return parts.join('\n').trim();
}
function chatText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map(part => part?.text || part?.content || '').filter(Boolean).join('\n').trim();
  return '';
}
function parseJson(text = '') {
  const raw = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(raw.slice(start, end + 1)); } catch {} }
  return null;
}
function usageOf(data, mode) {
  const usage = data?.usage || {};
  if (mode === 'chat-completions') return {
    input_tokens: Number(usage.prompt_tokens || 0),
    output_tokens: Number(usage.completion_tokens || 0),
    total_tokens: Number(usage.total_tokens || 0),
    cached_input_tokens: Number(usage.prompt_tokens_details?.cached_tokens || 0),
    reasoning_tokens: Number(usage.completion_tokens_details?.reasoning_tokens || 0)
  };
  return {
    input_tokens: Number(usage.input_tokens || 0),
    output_tokens: Number(usage.output_tokens || 0),
    total_tokens: Number(usage.total_tokens || 0),
    cached_input_tokens: Number(usage.input_tokens_details?.cached_tokens || 0),
    reasoning_tokens: Number(usage.output_tokens_details?.reasoning_tokens || 0)
  };
}
function estimatedCost(usage, pricing) {
  if (!pricing?.configured) return null;
  return (usage.input_tokens / 1_000_000) * pricing.input_usd_per_million + (usage.output_tokens / 1_000_000) * pricing.output_usd_per_million;
}

function jsonLike(baseResponse, data, status = 200) {
  const headers = new Headers(baseResponse?.headers || {'Content-Type': 'application/json; charset=utf-8'});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), {status, headers});
}

async function profileSummaries(request, env, profiles) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) return jsonLike(null, {error: '请求体必须包含 items 数组', code: 'BAD_BODY'}, 400);
  const selected = resolveProfile(env, profiles, body.profile);
  if (selected.error) return jsonLike(null, selected, 400);
  const profile = selected.profile;
  if (!profile.key) return jsonLike(null, {error: `Provider Profile ${profile.id} 的 Secret ${profile.keyBinding || '(未指定)'} 未配置`, code: 'PROFILE_KEY_MISSING', profile: safeProfile(profile)}, 503);
  if (body.prompt && !profile.allowPromptOverride) return jsonLike(null, {error: `Provider Profile ${profile.id} 禁止提示词覆盖`, code: 'PROMPT_OVERRIDE_DISABLED'}, 400);
  const modelResult = resolveModel(profile, body.model);
  if (modelResult.error) return jsonLike(null, modelResult, 400);
  const model = modelResult.model;
  const style = ['brief', 'standard', 'detailed'].includes(body.style) ? body.style : 'standard';
  const items = body.items.slice(0, 16).map(item => ({
    key: clean(item.key).slice(0, 500),
    type: clean(item.type).slice(0, 40),
    title: clean(item.title).slice(0, 600),
    source: clean(item.source).slice(0, 300),
    year: item.year || null,
    authors: Array.isArray(item.authors) ? item.authors.map(clean).filter(Boolean).slice(0, 6) : [],
    text: clean(item.text).slice(0, 1800)
  })).filter(item => item.key && item.title);
  if (!items.length) return jsonLike(null, {error: '没有可处理的结果', code: 'EMPTY_ITEMS'}, 400);

  const prompt = buildPrompt(items, style, profile, body.prompt);
  const payload = profile.mode === 'chat-completions'
    ? {model, messages: [{role: 'system', content: '遵守科研证据边界，并严格按用户消息中的 JSON 格式返回。'}, {role: 'user', content: prompt}], max_tokens: 1800}
    : {model, input: prompt, store: false, max_output_tokens: 1800};
  const started = Date.now();
  let upstream;
  try {
    upstream = await fetch(profile.endpoint, {method: 'POST', headers: headersFor(profile), body: JSON.stringify(payload)});
  } catch (error) {
    return jsonLike(null, {error: `AI 上游连接失败：${error.message}`, code: 'AI_NETWORK_ERROR', profile: profile.id, provider: profile.provider, model}, 502);
  }
  const data = await upstream.json().catch(() => ({}));
  const usage = usageOf(data, profile.mode);
  const cost = estimatedCost(usage, profile.pricing);
  if (!upstream.ok) {
    const message = data?.error?.message || data?.message || `AI 上游请求失败 (${upstream.status})`;
    return jsonLike(upstream, {error: message, code: 'AI_UPSTREAM_ERROR', profile: profile.id, provider: profile.provider, model, protocol: profile.mode, usage, estimated_cost_usd: cost}, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
  }
  const parsed = parseJson(profile.mode === 'chat-completions' ? chatText(data) : responseText(data));
  const summaries = Array.isArray(parsed?.summaries) ? parsed.summaries.map(item => ({key: clean(item?.key).slice(0, 500), summary: clean(item?.summary).slice(0, 1200)})).filter(item => item.key && item.summary) : [];
  if (!summaries.length) return jsonLike(upstream, {error: 'AI 返回内容无法解析为 summaries JSON', code: 'AI_PARSE_ERROR', profile: profile.id, provider: profile.provider, model, usage, estimated_cost_usd: cost}, 502);
  return jsonLike(upstream, {
    summaries,
    profile: profile.id,
    provider: profile.provider,
    protocol: profile.mode,
    model,
    usage,
    estimated_cost_usd: cost,
    latency_ms: Date.now() - started
  });
}

async function statusWithProfiles(request, env, profiles) {
  const legacyResponse = await legacy.fetch(request, env);
  const data = await legacyResponse.clone().json().catch(() => ({}));
  if (!profiles.length) return jsonLike(legacyResponse, {
    ...data,
    ai_profiles: {enabled: false, default_profile: '', profile_override_allowed: false, profiles: []}
  }, legacyResponse.status);
  const defaultId = defaultProfileId(env, profiles);
  const defaultProfile = profiles.find(profile => profile.id === defaultId) || profiles[0];
  return jsonLike(legacyResponse, {
    ...data,
    providers: {...(data.providers || {}), ai: Boolean(defaultProfile?.key)},
    ai: safeProfile(defaultProfile),
    ai_profiles: {
      enabled: true,
      default_profile: defaultId,
      profile_override_allowed: boolEnv(env.AI_ALLOW_PROFILE_OVERRIDE, true),
      profiles: profiles.map(safeProfile)
    },
    service_version: 'research-os-v22'
  }, legacyResponse.status);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const profiles = parseProfiles(env);
    if (request.method === 'GET' && url.pathname === '/api/status') return statusWithProfiles(request, env, profiles);
    if (request.method === 'POST' && url.pathname === '/api/ai/summaries' && profiles.length) return profileSummaries(request, env, profiles);
    return legacy.fetch(request, env, ctx);
  }
};
