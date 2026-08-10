(() => {
  const WORKER_KEY = 'research-search:worker-url';
  const AI_KEY = 'research-search:ai-settings-v1';
  const CACHE_KEY = 'research-search:ai-summary-cache-v1';
  const PROJECTS_KEY = 'research-search:projects-v19';
  const ACTIVE_PROJECT_KEY = 'research-search:active-project-v19';
  const PRESETS = {
    explore:{label:'技术探索',desc:'扩大召回范围，适合新主题摸底和跨领域发现。',style:'standard',batchSize:16,onlyWithSource:false},
    review:{label:'系统综述',desc:'优先有摘要的论文，生成更完整的技术概述。',style:'detailed',batchSize:16,onlyWithSource:true},
    engineering:{label:'工程落地',desc:'强调可验证的原始片段，适合方法、实现和工程路径研判。',style:'detailed',batchSize:10,onlyWithSource:true},
    patent:{label:'专利侦察',desc:'摘要更短，优先快速扫视专利与竞争情报信号。',style:'brief',batchSize:10,onlyWithSource:true}
  };
  const clean = value => String(value ?? '').replace(/\s+/g,' ').trim();
  const esc = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const loadJson = (key,fallback) => { try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; } };
  const saveJson = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); } catch {} };
  const telemetry = () => window.ResearchTelemetry || {load:()=>({ai:{},cache:{} }),providerSummary:()=>[],reset:()=>{},storageKey:'research-search:telemetry-v19'};
  const workerBase = () => clean(localStorage.getItem(WORKER_KEY) || '').replace(/\/+$/,'');
  const fmtInt = value => new Intl.NumberFormat('zh-CN').format(Number(value)||0);
  const fmtPct = value => Number.isFinite(value) ? `${Math.round(value*100)}%` : '—';
  const fmtMs = value => Number.isFinite(value) ? `${Math.round(value)} ms` : '—';
  const fmtUsd = value => Number.isFinite(value) ? `$${value < .01 ? value.toFixed(5) : value.toFixed(3)}` : '未配置估算';
  const fmtTime = value => value ? new Date(value).toLocaleString('zh-CN',{hour12:false}) : '—';
  const bytes = value => {
    const n=Number(value)||0;
    if (n<1024) return `${n} B`;
    if (n<1024*1024) return `${(n/1024).toFixed(1)} KB`;
    return `${(n/1024/1024).toFixed(2)} MB`;
  };
  function stateSafe() { try { return state; } catch { return null; } }
  function allItems() {
    const s=stateSafe();
    if (!s) return [];
    return [s.papers||[],s.patents||[],s.blogs||[],s.web||[]].flat().filter(Boolean);
  }
  function sourceText(item) { return clean(item.abstract || item.description || item.snippet || ''); }
  function liveDiagnostic() {
    const items=allItems();
    if (!items.length) return {score:0,total:0,kinds:0,textCoverage:0,summaryCoverage:0,duplicateRate:0,years:0,official:0,label:'暂无本轮结果'};
    const kinds=new Set(items.map(item=>item.type).filter(Boolean));
    const textCoverage=items.filter(item=>sourceText(item).length>=30).length/items.length;
    const summaryCoverage=items.filter(item=>{
      if (clean(item.summaryZh).length>=15) return true;
      const key=String(item.key||'');
      if (!key) return false;
      try { return Boolean(document.querySelector(`.ux-result[data-key="${CSS.escape(key)}"] .ux-zh-summary p`)?.textContent?.trim()); }
      catch { return false; }
    }).length/items.length;
    const titles=items.map(item=>clean(item.title).toLowerCase()).filter(Boolean);
    const duplicateRate=titles.length ? 1-(new Set(titles).size/titles.length) : 0;
    const years=new Set(items.map(item=>Number(item.year||item.publication_year)).filter(year=>year>1900&&year<2200));
    const official=items.filter(item=>item.official===true).length;
    const diversity=Math.min(kinds.size/4,1)*25;
    const evidence=textCoverage*25;
    const summaries=summaryCoverage*20;
    const dedupe=(1-Math.min(1,duplicateRate))*15;
    const temporal=Math.min(years.size/5,1)*15;
    const score=Math.round(diversity+evidence+summaries+dedupe+temporal);
    const label=score>=80?'信息结构完整':score>=60?'可用于初步研判':score>=40?'信息覆盖一般':'建议补充数据源';
    return {score,total:items.length,kinds:kinds.size,textCoverage,summaryCoverage,duplicateRate,years:years.size,official,label};
  }
  function aiCacheInfo() {
    const raw=localStorage.getItem(CACHE_KEY)||'';
    const cache=loadJson(CACHE_KEY,{});
    const values=Object.values(cache).filter(Boolean);
    return {entries:values.length,size:new Blob([raw]).size,lastAt:Math.max(0,...values.map(item=>Number(item.at)||0))};
  }
  function projects() {
    const list=loadJson(PROJECTS_KEY,[]);
    return Array.isArray(list) ? list : [];
  }
  function activeProject() {
    const id=localStorage.getItem(ACTIVE_PROJECT_KEY)||'';
    return id ? projects().find(item=>item.id===id) || null : null;
  }
  function providerStatusClass(row) {
    if (row.lastOk===true) return 'ok';
    if (row.lastOk===false) return 'fail';
    return 'idle';
  }

  const button=document.createElement('button');
  button.id='controlCenterBtn';
  button.className='ghost-btn';
  button.type='button';
  button.textContent='控制台';
  document.querySelector('#settingsBtn')?.before(button);

  const dialog=document.createElement('dialog');
  dialog.id='controlCenterDialog';
  dialog.className='control-v19-dialog';
  dialog.innerHTML=`
    <div class="control-v19-head">
      <div><p>系统控制中心</p><h2>科研情报运行状态</h2><span>只展示可验证的运行数据；本地诊断不等同于学术质量评价。</span></div>
      <div class="control-v19-head-actions"><button type="button" data-control-refresh>刷新</button><button type="button" data-control-settings>系统配置</button><button type="button" data-control-close aria-label="关闭">×</button></div>
    </div>
    <div class="control-v19-body">
      <section class="control-v19-hero" data-control-overview></section>
      <div class="control-v19-grid">
        <section class="control-v19-panel" data-control-ai></section>
        <section class="control-v19-panel" data-control-quality></section>
      </div>
      <section class="control-v19-panel" data-control-providers></section>
      <section class="control-v19-panel" data-control-projects></section>
      <section class="control-v19-panel compact" data-control-storage></section>
    </div>`;
  document.body.appendChild(dialog);

  let workerStatus=null;
  let workerStatusError='';
  let healthLatency=null;

  async function refreshWorker() {
    const base=workerBase();
    workerStatus=null; workerStatusError=''; healthLatency=null;
    if (!base) return;
    const started=performance.now();
    try {
      const response=await fetch(`${base}/api/status`,{headers:{Accept:'application/json'}});
      const data=await response.json().catch(()=>({}));
      healthLatency=Math.round(performance.now()-started);
      if (!response.ok) throw new Error(data.error||`HTTP ${response.status}`);
      workerStatus=data;
    } catch(error) {
      healthLatency=Math.round(performance.now()-started);
      workerStatusError=String(error?.message||error);
    }
  }
  function renderOverview() {
    const store=telemetry().load();
    const cache=aiCacheInfo();
    const diag=liveDiagnostic();
    const worker=workerBase();
    const aiReady=Boolean(workerStatus?.providers?.openai);
    dialog.querySelector('[data-control-overview]').innerHTML=`
      <div class="control-v19-title"><div><span>运行总览</span><h3>${worker ? (workerStatus?'系统在线':workerStatusError?'后端异常':'等待检测') : '本机模式'}</h3></div><i class="${workerStatus?'ok':workerStatusError?'fail':'idle'}">${workerStatus ? `${esc(workerStatus.version||'Worker')} · ${fmtMs(healthLatency)}` : workerStatusError ? '连接失败' : '未配置 Worker'}</i></div>
      <div class="control-v19-kpis">
        <article><span>当前检索结果</span><strong>${fmtInt(diag.total)}</strong><small>${diag.label}</small></article>
        <article><span>AI 服务</span><strong>${aiReady?'已就绪':worker?'未就绪':'未连接'}</strong><small>${aiReady?esc(workerStatus?.ai?.model||'服务器模型'):'本地摘要仍可使用'}</small></article>
        <article><span>本设备 Token</span><strong>${fmtInt(store.ai?.totalTokens)}</strong><small>输入 ${fmtInt(store.ai?.inputTokens)} · 输出 ${fmtInt(store.ai?.outputTokens)}</small></article>
        <article><span>估算 AI 成本</span><strong>${store.ai?.costSamples ? fmtUsd(Number(store.ai?.estimatedCostUsd||0)) : '未启用'}</strong><small>${store.ai?.costSamples ? '按 Worker 配置单价累计' : '可在 Worker 配置 Token 单价'}</small></article>
        <article><span>AI 摘要缓存</span><strong>${fmtInt(cache.entries)} 条</strong><small>${bytes(cache.size)} · ${cache.lastAt?`更新 ${fmtTime(cache.lastAt)}`:'暂无缓存'}</small></article>
      </div>`;
  }
  function renderAi() {
    const store=telemetry().load();
    const ai=store.ai||{};
    const cache=store.cache||{};
    const totalCache=(cache.hits||0)+(cache.misses||0);
    const pricing=workerStatus?.ai?.pricing;
    const lastRun=(ai.runs||[]).slice(-1)[0];
    dialog.querySelector('[data-control-ai]').innerHTML=`
      <div class="control-v19-panel-head"><div><span>AI 运行</span><h3>模型、Token 与缓存</h3></div><i>${workerStatus?.ai?.model?esc(workerStatus.ai.model):'未检测模型'}</i></div>
      <div class="control-v19-metric-row"><span>成功请求</span><strong>${fmtInt(ai.success)} / ${fmtInt(ai.requests)}</strong></div>
      <div class="control-v19-metric-row"><span>输入 / 输出 Token</span><strong>${fmtInt(ai.inputTokens)} / ${fmtInt(ai.outputTokens)}</strong></div>
      <div class="control-v19-metric-row"><span>缓存命中率</span><strong>${totalCache?fmtPct(cache.hits/totalCache):'暂无样本'}</strong></div>
      <div class="control-v19-metric-row"><span>价格估算</span><strong>${pricing?.configured ? `输入 $${pricing.input_usd_per_million}/M · 输出 $${pricing.output_usd_per_million}/M` : 'Worker 未配置单价'}</strong></div>
      <div class="control-v19-last-run"><span>最近一次 AI</span><p>${lastRun ? `${lastRun.ok?'成功':'失败'} · ${esc(lastRun.model||'模型未知')} · ${fmtInt(lastRun.totalTokens)} Token${Number.isFinite(lastRun.estimatedCostUsd)?` · ${fmtUsd(lastRun.estimatedCostUsd)}`:''}` : '本设备暂无 AI 调用记录'}</p></div>`;
  }
  function renderQuality() {
    const diag=liveDiagnostic();
    dialog.querySelector('[data-control-quality]').innerHTML=`
      <div class="control-v19-panel-head"><div><span>结果诊断</span><h3>本轮结果可用性</h3></div><b class="control-v19-score">${diag.score}<small>/100</small></b></div>
      <progress class="control-v19-scorebar" max="100" value="${diag.score}">${diag.score}%</progress>
      <div class="control-v19-metric-row"><span>来源类型覆盖</span><strong>${diag.kinds} / 4</strong></div>
      <div class="control-v19-metric-row"><span>原始摘要 / 片段覆盖</span><strong>${fmtPct(diag.textCoverage)}</strong></div>
      <div class="control-v19-metric-row"><span>中文摘要覆盖</span><strong>${fmtPct(diag.summaryCoverage)}</strong></div>
      <div class="control-v19-metric-row"><span>重复标题比例</span><strong>${fmtPct(diag.duplicateRate)}</strong></div>
      <div class="control-v19-metric-row"><span>可识别年份</span><strong>${diag.years} 个年份</strong></div>
      <p class="control-v19-disclaimer">评分只衡量来源多样性、信息完整度、重复率和时间覆盖，不代表论文真实质量、相关性、权威性或结论可信度。</p>`;
  }
  function renderProviders() {
    const rows=telemetry().providerSummary();
    const preferred=['Crossref','HN Algolia','Worker · 健康检查','Worker · Web','Worker · 专利','Worker · AI','PatentsView 直连'];
    const byName=new Map(rows.map(row=>[row.provider,row]));
    const all=[...new Set([...preferred,...rows.map(row=>row.provider)])];
    const html=all.map(name=>{
      const row=byName.get(name);
      return `<tr><td><i class="control-provider-dot ${providerStatusClass(row||{})}"></i><strong>${esc(name)}</strong></td><td>${row?fmtMs(row.avgLatencyMs):'暂无样本'}</td><td>${row?fmtMs(row.p95LatencyMs):'—'}</td><td>${row?fmtPct(row.successRate):'—'}</td><td>${row?.lastAt?fmtTime(row.lastAt):'未调用'}</td></tr>`;
    }).join('');
    dialog.querySelector('[data-control-providers]').innerHTML=`
      <div class="control-v19-panel-head"><div><span>数据源健康</span><h3>延迟、成功率与最近调用</h3></div><i>最近每源最多 30 次请求</i></div>
      <div class="control-v19-table-wrap"><table><thead><tr><th>数据源</th><th>平均延迟</th><th>P95</th><th>成功率</th><th>最近调用</th></tr></thead><tbody>${html}</tbody></table></div>`;
  }
  function renderProjects() {
    const list=projects();
    const active=activeProject();
    const currentAi={enabled:false,style:'standard',batchSize:10,onlyWithSource:true,...loadJson(AI_KEY,{})};
    const cards=list.length ? list.map(project=>`<button class="control-project-chip ${active?.id===project.id?'active':''}" type="button" data-project-id="${esc(project.id)}"><strong>${esc(project.name)}</strong><span>${esc(PRESETS[project.strategy]?.label||'自定义')}</span></button>`).join('') : '<p class="control-v19-empty">还没有保存研究项目。先给当前研究创建一个策略档案。</p>';
    dialog.querySelector('[data-control-projects]').innerHTML=`
      <div class="control-v19-panel-head"><div><span>研究项目</span><h3>每个项目使用自己的 AI 策略</h3></div><i>${active?`当前 · ${esc(active.name)}`:'当前未绑定项目'}</i></div>
      <div class="control-project-layout">
        <div class="control-project-form">
          <label><span>项目名称</span><input id="controlProjectName" type="text" maxlength="80" value="${esc(active?.name || clean(stateSafe()?.query) || '默认研究项目')}" /></label>
          <label><span>研究策略</span><select id="controlProjectStrategy">${Object.entries(PRESETS).map(([key,preset])=>`<option value="${key}" ${active?.strategy===key?'selected':''}>${preset.label}</option>`).join('')}</select></label>
          <div class="control-project-preset" data-project-preset></div>
          <label class="control-project-ai"><input id="controlProjectAiEnabled" type="checkbox" ${currentAi.enabled?'checked':''}/><span><strong>项目进入时启用 AI 摘要</strong><small>仍要求 Worker 已配置 OpenAI；否则自动保留本地摘要。</small></span></label>
          <div class="control-project-actions"><button type="button" data-project-save>保存并应用</button><button type="button" data-project-new>新建项目</button>${active?'<button type="button" data-project-delete class="danger">删除当前项目</button>':''}</div>
        </div>
        <div class="control-project-list"><h4>已保存项目</h4>${cards}</div>
      </div>`;
    renderPreset();
  }
  function renderPreset() {
    const select=dialog.querySelector('#controlProjectStrategy');
    const box=dialog.querySelector('[data-project-preset]');
    if (!select||!box) return;
    const preset=PRESETS[select.value]||PRESETS.explore;
    box.innerHTML=`<strong>${preset.label}</strong><p>${preset.desc}</p><div><span>摘要 ${preset.style==='brief'?'精简':preset.style==='detailed'?'详细':'标准'}</span><span>批量 ${preset.batchSize} 条</span><span>${preset.onlyWithSource?'优先原始片段':'允许标题级探索'}</span></div>`;
  }
  function renderStorage() {
    const cache=aiCacheInfo();
    const teleRaw=localStorage.getItem(telemetry().storageKey||'research-search:telemetry-v19')||'';
    dialog.querySelector('[data-control-storage]').innerHTML=`
      <div class="control-v19-panel-head"><div><span>本机数据</span><h3>缓存与诊断记录</h3></div><i>仅当前浏览器</i></div>
      <div class="control-storage-actions"><span>AI 摘要缓存 ${cache.entries} 条 · ${bytes(cache.size)}</span><span>运行诊断 ${bytes(new Blob([teleRaw]).size)}</span><button type="button" data-clear-ai-cache>清空 AI 缓存</button><button type="button" data-clear-telemetry>清空运行统计</button></div>`;
  }
  function renderAll() { renderOverview(); renderAi(); renderQuality(); renderProviders(); renderProjects(); renderStorage(); }

  async function openControl() {
    if (!dialog.open) dialog.showModal();
    renderAll();
    await refreshWorker();
    renderAll();
  }
  function saveProject() {
    const name=clean(dialog.querySelector('#controlProjectName')?.value).slice(0,80);
    const strategy=dialog.querySelector('#controlProjectStrategy')?.value || 'explore';
    const aiEnabled=Boolean(dialog.querySelector('#controlProjectAiEnabled')?.checked);
    if (!name) return;
    const preset=PRESETS[strategy]||PRESETS.explore;
    const list=projects();
    const active=activeProject();
    const id=active?.id || `project-${Date.now().toString(36)}`;
    const record={id,name,strategy,aiEnabled,updatedAt:Date.now(),createdAt:active?.createdAt||Date.now()};
    const next=[...list.filter(item=>item.id!==id),record].sort((a,b)=>Number(b.updatedAt)-Number(a.updatedAt));
    saveJson(PROJECTS_KEY,next);
    localStorage.setItem(ACTIVE_PROJECT_KEY,id);
    saveJson(AI_KEY,{...loadJson(AI_KEY,{}),enabled:aiEnabled,style:preset.style,batchSize:preset.batchSize,onlyWithSource:preset.onlyWithSource});
    window.dispatchEvent(new CustomEvent('research-ai-settings-changed'));
    renderAll();
  }
  function selectProject(id) {
    const project=projects().find(item=>item.id===id);
    if (!project) return;
    localStorage.setItem(ACTIVE_PROJECT_KEY,id);
    const preset=PRESETS[project.strategy]||PRESETS.explore;
    saveJson(AI_KEY,{...loadJson(AI_KEY,{}),enabled:Boolean(project.aiEnabled),style:preset.style,batchSize:preset.batchSize,onlyWithSource:preset.onlyWithSource});
    window.dispatchEvent(new CustomEvent('research-ai-settings-changed'));
    renderAll();
  }
  function newProject() { localStorage.removeItem(ACTIVE_PROJECT_KEY); renderProjects(); }
  function deleteProject() {
    const active=activeProject();
    if (!active) return;
    saveJson(PROJECTS_KEY,projects().filter(item=>item.id!==active.id));
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
    renderAll();
  }

  button.addEventListener('click',openControl);
  dialog.addEventListener('click',event=>{
    if (event.target===dialog) return;
    if (event.target.closest('[data-control-close]')) dialog.close();
    if (event.target.closest('[data-control-refresh]')) openControl();
    if (event.target.closest('[data-control-settings]')) { dialog.close(); document.querySelector('#settingsBtn')?.click(); }
    if (event.target.closest('[data-project-save]')) saveProject();
    if (event.target.closest('[data-project-new]')) newProject();
    if (event.target.closest('[data-project-delete]')) deleteProject();
    const projectButton=event.target.closest('[data-project-id]');
    if (projectButton) selectProject(projectButton.dataset.projectId);
    if (event.target.closest('[data-clear-ai-cache]')) { localStorage.removeItem(CACHE_KEY); renderAll(); }
    if (event.target.closest('[data-clear-telemetry]')) { telemetry().reset(); renderAll(); }
  });
  dialog.addEventListener('change',event=>{ if (event.target.matches('#controlProjectStrategy')) renderPreset(); });
  window.addEventListener('research-telemetry-changed',()=>{ if (dialog.open) renderAll(); });
  window.addEventListener('research-ai-settings-changed',()=>{ if (dialog.open) renderAll(); });
  const params=new URL(location.href).searchParams;
  if (params.get('control')==='1') setTimeout(openControl,80);
})();
