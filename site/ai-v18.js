(() => {
  const AI_KEY = 'research-search:ai-settings-v1';
  const WORKER_KEY = 'research-search:worker-url';
  const CACHE_KEY = 'research-search:ai-summary-cache-v1';
  const DEFAULTS = {enabled:false,style:'standard',batchSize:10,onlyWithSource:true,requestProfile:'',requestModel:'',customPrompt:'',projectProfile:'',projectModel:'',projectPrompt:''};
  let generation = 0;

  const clean = value => String(value ?? '').replace(/\s+/g,' ').trim();
  const loadJson = (key,fallback) => { try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; } };
  const saveJson = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); } catch {} };
  const settings = () => ({...DEFAULTS,...loadJson(AI_KEY,{})});
  const workerBase = () => clean(localStorage.getItem(WORKER_KEY) || '').replace(/\/+$/,'');
  const telemetry = () => window.ResearchTelemetry || null;

  function stateSafe() { try { return state; } catch { return null; } }
  function allItems() {
    const current = stateSafe();
    if (!current) return [];
    return [current.papers || [],current.patents || [],current.blogs || [],current.web || []].flat().filter(Boolean);
  }
  function keyFor(item) { return clean(item.key || `${item.type || 'item'}:${item.url || item.doi || item.title || ''}`); }
  function sourceFor(item) { return clean(item.venue || item.domain || item.source || item.assignees?.[0] || ''); }
  function sourceText(item) { return clean(item.abstract || item.description || item.snippet || ''); }
  function eligibleItems(config) {
    const list = allItems().filter(item => keyFor(item) && clean(item.title));
    const filtered = config.onlyWithSource ? list.filter(item => sourceText(item).length >= 30) : list;
    return filtered.slice(0, Math.max(1, Math.min(16, Number(config.batchSize) || 10)));
  }
  function resolvedProfile(config) { return clean(config.projectProfile || config.requestProfile || ''); }
  function resolvedModel(config) { return clean(config.projectModel || config.requestModel || ''); }
  function resolvedPrompt(config) { return [config.customPrompt,config.projectPrompt].map(value=>String(value||'').trim()).filter(Boolean).join('\n\n').slice(0,6000); }

  function cache() { return loadJson(CACHE_KEY,{}); }
  function cacheFingerprint(item,config) {
    return `${clean(item.title)}|${sourceText(item).slice(0,280)}|${config.style}|${resolvedProfile(config)}|${resolvedModel(config)}|${resolvedPrompt(config).slice(0,500)}`;
  }
  function applySummary(key,summary,mode='AI 生成') {
    if (!key || !summary) return;
    const current = stateSafe();
    if (current) {
      [current.papers || [],current.patents || [],current.blogs || [],current.web || []].forEach(group => {
        const item = group.find(entry => keyFor(entry) === key);
        if (item) { item.summaryZh = summary; item.summaryMode = mode; }
      });
    }
    const card = [...document.querySelectorAll('.ux-result[data-key]')].find(node => node.dataset.key === key);
    if (!card) return;
    const p = card.querySelector('.ux-zh-summary p');
    const modeNode = card.querySelector('.ux-zh-summary-head small');
    if (p) p.textContent = summary;
    if (modeNode) modeNode.textContent = mode;
    card.dataset.aiSummary = '1';
  }

  function setUiStatus(text,stateName='') {
    document.querySelectorAll('[data-ai-runtime-status]').forEach(node => { node.textContent = text; node.dataset.state = stateName; });
  }

  async function enhance() {
    const config = settings();
    const base = workerBase();
    if (!config.enabled || !base) return;
    const run = ++generation;
    const candidates = eligibleItems(config);
    if (!candidates.length) return;

    const saved = cache();
    const pending = [];
    let cacheHits = 0;
    candidates.forEach(item => {
      const key = keyFor(item);
      const fingerprint = cacheFingerprint(item,config);
      const hit = saved[key];
      if (hit?.fingerprint === fingerprint && hit?.summary) { applySummary(key,hit.summary,'AI 缓存'); cacheHits += 1; }
      else pending.push(item);
    });
    if (cacheHits) telemetry()?.cacheHit(cacheHits);
    if (pending.length) telemetry()?.cacheMiss(pending.length);
    if (!pending.length) { setUiStatus(`AI 缓存命中 ${cacheHits} 条摘要`,'ok'); return; }

    const profile=resolvedProfile(config);
    const model=resolvedModel(config);
    const prompt=resolvedPrompt(config);
    const target=[profile&&`档案 ${profile}`,model].filter(Boolean).join(' · ');
    setUiStatus(`AI 正在增强 ${pending.length} 条摘要${target?` · ${target}`:''}…`,'loading');
    try {
      const response = await fetch(`${base}/api/ai/summaries`, {
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({
          style:config.style,profile,model,prompt,
          items:pending.map(item => ({
            key:keyFor(item),type:item.type || 'record',title:clean(item.title),source:sourceFor(item),
            year:item.year || item.publication_year || null,authors:Array.isArray(item.authors) ? item.authors.slice(0,6) : [],
            text:sourceText(item).slice(0,1800)
          }))
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || `AI 请求失败 (${response.status})`),{data});
      if (run !== generation) return;
      const summaries = Array.isArray(data.summaries) ? data.summaries : [];
      summaries.forEach(entry => {
        const key = clean(entry.key); const summary = clean(entry.summary);
        if (!key || !summary) return;
        applySummary(key,summary,'AI 生成');
        const item = pending.find(candidate => keyFor(candidate) === key);
        if (item) saved[key] = {fingerprint:cacheFingerprint(item,config),summary,at:Date.now(),profile:data.profile||profile||'',model:data.model||model||''};
      });
      const trimmed = Object.entries(saved).sort((a,b) => Number(b[1]?.at || 0)-Number(a[1]?.at || 0)).slice(0,120);
      saveJson(CACHE_KEY,Object.fromEntries(trimmed));
      telemetry()?.addAiUsage({ok:true,profile:data.profile || profile || '',model:data.model || model || '',count:summaries.length,usage:data.usage || {},estimatedCostUsd:data.estimated_cost_usd});
      const usedProfile=data.profile||profile||'';
      setUiStatus(`${data.provider||'AI'}${usedProfile?` · ${usedProfile}`:''} · ${data.model||model||'默认模型'} 已增强 ${summaries.length} 条${cacheHits ? ` · 缓存 ${cacheHits}` : ''}`,'ok');
    } catch (error) {
      console.warn('AI summary enhancement failed:', error);
      telemetry()?.addAiUsage({ok:false,error:error.message || 'AI 请求失败',profile:error?.data?.profile || profile || '',model:error?.data?.model || model || '',count:0,usage:error?.data?.usage || {},estimatedCostUsd:error?.data?.estimated_cost_usd});
      setUiStatus(`AI 暂不可用：${error.message}`,'error');
    }
  }

  function schedule(delay=120) { setTimeout(enhance,delay); }
  const basePerformSearch = typeof performSearch === 'function' ? performSearch : null;
  if (basePerformSearch) {
    performSearch = async function performSearchWithAi(rawQuery) { const result = await basePerformSearch(rawQuery); schedule(180); return result; };
  }
  const status = document.createElement('span');
  status.className = 'ai-runtime-status'; status.dataset.aiRuntimeStatus = ''; status.textContent = '';
  document.querySelector('.research-controlbar')?.appendChild(status);
  window.addEventListener('research-ai-settings-changed',() => schedule(20));
  if (stateSafe()?.query) schedule(900);
})();
