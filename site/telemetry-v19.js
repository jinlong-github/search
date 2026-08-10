(() => {
  const STORAGE_KEY = 'research-search:telemetry-v19';
  const MAX_EVENTS = 180;
  const MAX_AI_RUNS = 60;
  const empty = () => ({
    version:1,
    events:[],
    ai:{requests:0,success:0,failure:0,inputTokens:0,outputTokens:0,totalTokens:0,estimatedCostUsd:0,costSamples:0,runs:[]},
    cache:{hits:0,misses:0},
    updatedAt:0
  });
  const load = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return raw && raw.version === 1 ? {...empty(),...raw,ai:{...empty().ai,...raw.ai},cache:{...empty().cache,...raw.cache}} : empty();
    } catch { return empty(); }
  };
  const save = data => {
    data.updatedAt = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  };
  const classify = value => {
    const url = String(value || '');
    if (/api\.crossref\.org/i.test(url)) return {provider:'Crossref',kind:'论文'};
    if (/hn\.algolia\.com/i.test(url)) return {provider:'HN Algolia',kind:'技术文章'};
    if (/api\.openalex\.org/i.test(url)) return {provider:'OpenAlex',kind:'论文'};
    if (/search\.patentsview\.org/i.test(url)) return {provider:'PatentsView 直连',kind:'专利'};
    if (/\/api\/ai\/summaries/i.test(url)) return {provider:'Worker · AI',kind:'AI'};
    if (/\/api\/patents/i.test(url)) return {provider:'Worker · 专利',kind:'专利'};
    if (/\/api\/web/i.test(url)) return {provider:'Worker · Web',kind:'网页'};
    if (/\/api\/status/i.test(url)) return {provider:'Worker · 健康检查',kind:'系统'};
    if (/\.workers\.dev/i.test(url)) return {provider:'Cloudflare Worker',kind:'系统'};
    return null;
  };
  const record = event => {
    const data = load();
    data.events.push({at:Date.now(),...event});
    data.events = data.events.slice(-MAX_EVENTS);
    save(data);
    window.dispatchEvent(new CustomEvent('research-telemetry-changed',{detail:event}));
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function instrumentedFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const meta = classify(url);
    if (!meta) return originalFetch(input, init);
    const started = performance.now();
    try {
      const response = await originalFetch(input, init);
      record({type:'fetch',provider:meta.provider,kind:meta.kind,url:String(url).slice(0,600),method:String(init?.method || input?.method || 'GET').toUpperCase(),ok:response.ok,status:response.status,latencyMs:Math.max(0,Math.round(performance.now()-started))});
      return response;
    } catch (error) {
      record({type:'fetch',provider:meta.provider,kind:meta.kind,url:String(url).slice(0,600),method:String(init?.method || input?.method || 'GET').toUpperCase(),ok:false,status:0,latencyMs:Math.max(0,Math.round(performance.now()-started)),error:String(error?.message || error).slice(0,220)});
      throw error;
    }
  };

  function providerSummary() {
    const events = load().events.filter(event => event.type === 'fetch');
    const grouped = new Map();
    for (const event of events) {
      const list = grouped.get(event.provider) || [];
      list.push(event);
      grouped.set(event.provider,list);
    }
    return [...grouped.entries()].map(([provider,list]) => {
      const recent = list.slice(-30);
      const success = recent.filter(item => item.ok).length;
      const latencies = recent.map(item => Number(item.latencyMs)||0).filter(Number.isFinite).sort((a,b)=>a-b);
      const avg = latencies.length ? Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length) : null;
      const p95 = latencies.length ? latencies[Math.min(latencies.length-1,Math.floor(latencies.length*0.95))] : null;
      const last = recent[recent.length-1] || null;
      return {provider,kind:last?.kind || '',requests:recent.length,successRate:recent.length ? success/recent.length : null,avgLatencyMs:avg,p95LatencyMs:p95,lastStatus:last?.status ?? null,lastOk:last?.ok ?? null,lastAt:last?.at ?? null};
    }).sort((a,b)=>String(a.provider).localeCompare(String(b.provider),'zh-CN'));
  }

  function addAiUsage(payload={}) {
    const data = load();
    data.ai.requests += 1;
    if (payload.ok === false) data.ai.failure += 1; else data.ai.success += 1;
    const usage = payload.usage || {};
    data.ai.inputTokens += Number(usage.input_tokens || 0);
    data.ai.outputTokens += Number(usage.output_tokens || 0);
    data.ai.totalTokens += Number(usage.total_tokens || 0);
    const cost = Number(payload.estimatedCostUsd);
    if (Number.isFinite(cost) && cost >= 0) {
      data.ai.estimatedCostUsd += cost;
      data.ai.costSamples += 1;
    }
    data.ai.runs.push({at:Date.now(),ok:payload.ok !== false,model:payload.model || '',count:Number(payload.count || 0),inputTokens:Number(usage.input_tokens || 0),outputTokens:Number(usage.output_tokens || 0),totalTokens:Number(usage.total_tokens || 0),estimatedCostUsd:Number.isFinite(cost)?cost:null,error:payload.error || ''});
    data.ai.runs = data.ai.runs.slice(-MAX_AI_RUNS);
    save(data);
    window.dispatchEvent(new CustomEvent('research-telemetry-changed',{detail:{type:'ai'}}));
  }
  function cacheHit(count=1) { const data=load(); data.cache.hits += Math.max(0,Number(count)||0); save(data); }
  function cacheMiss(count=1) { const data=load(); data.cache.misses += Math.max(0,Number(count)||0); save(data); }
  function reset() { save(empty()); window.dispatchEvent(new CustomEvent('research-telemetry-changed',{detail:{type:'reset'}})); }

  window.ResearchTelemetry = {load,record,providerSummary,addAiUsage,cacheHit,cacheMiss,reset,storageKey:STORAGE_KEY};
})();
