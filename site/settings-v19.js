(() => {
  const dialog=document.querySelector('#settingsDialog');
  if(!dialog)return;
  const AI_KEY='research-search:ai-settings-v1';
  const WORKER_KEY='research-search:worker-url';
  const clean=value=>String(value??'').trim();
  const loadJson=(key,fallback={})=>{try{return JSON.parse(localStorage.getItem(key)||'{}')||fallback}catch{return fallback}};
  const normalizeWorker=value=>{
    const raw=clean(value).replace(/\/+$/,'');if(!raw)return'';
    try{const u=new URL(raw);if(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))return u.origin+u.pathname.replace(/\/+$/,'')}catch{}
    return'';
  };

  const configList=dialog.querySelector('.settings-config-list');
  if(configList&&!configList.querySelector('[data-v19-pricing]')){
    const block=document.createElement('div');block.dataset.v19Pricing='';block.innerHTML='<span>可选 · 输入成本估算</span><code>OPENAI_INPUT_USD_PER_1M</code><small>填写当前模型每百万输入 Token 的美元单价；不配置则控制中心只统计 Token，不估算费用。</small>';configList.appendChild(block);
    const output=document.createElement('div');output.dataset.v19Pricing='';output.innerHTML='<span>可选 · 输出成本估算</span><code>OPENAI_OUTPUT_USD_PER_1M</code><small>填写当前模型每百万输出 Token 的美元单价。价格变化时只改 Worker 环境变量，不需要改前端代码。</small>';configList.appendChild(output);
  }
  const security=dialog.querySelector('[data-settings-section="security"]');
  if(security&&!security.querySelector('.settings-v19-cost-note')){
    const note=document.createElement('div');note.className='settings-info-card settings-v19-cost-note';note.innerHTML='<strong>为什么价格不写死在网页里？</strong><p>模型价格会变化，而且不同模型、缓存与服务层的计价可能不同。系统只读取你在 Worker 中明确配置的估算单价，避免把旧价格当成事实。</p>';security.querySelector('.settings-security-note')?.before(note);
  }
  const endpoints=dialog.querySelector('.settings-endpoints');
  if(endpoints&&!endpoints.querySelector('[data-v25-research-endpoint]')){
    const row=document.createElement('div');row.dataset.v25ResearchEndpoint='';row.innerHTML='<span>研究 Copilot</span><code data-endpoint-path="/api/ai/research">/api/ai/research</code><small>项目证据分析、反证发现、下一轮检索与阶段结论审查。</small>';endpoints.appendChild(row);
  }
  const service=dialog.querySelector('[data-settings-section="service"]');
  if(service&&!service.querySelector('[data-v25-env-status]')){
    const card=document.createElement('div');card.className='settings-info-card';card.dataset.v25EnvStatus='';card.innerHTML='<strong>环境配置状态</strong><p data-v25-env-status-text>等待检测。</p>';service.querySelector('.settings-url-overview')?.after(card);
  }
  const footer=dialog.querySelector('.settings-center-footer');
  if(footer&&!footer.querySelector('[data-open-control-center]')){
    const button=document.createElement('button');button.type='button';button.className='ghost-btn';button.dataset.openControlCenter='';button.textContent='打开系统控制中心';footer.insertBefore(button,footer.firstChild);
    button.addEventListener('click',()=>{dialog.close();setTimeout(()=>document.querySelector('#controlCenterBtn')?.click(),20)});
  }

  function selectSection(name){
    const target=dialog.querySelector(`[data-settings-section="${name}"]`);if(!target)return;
    dialog.querySelectorAll('[data-settings-section]').forEach(section=>{section.hidden=section!==target});
    dialog.querySelectorAll('[data-settings-jump]').forEach(button=>button.classList.toggle('active',button.dataset.settingsJump===name));
    const body=dialog.querySelector('.settings-center-body');if(body)body.scrollTop=0;
  }
  function showDefaultSection(){
    const active=dialog.querySelector('[data-settings-jump].active')?.dataset.settingsJump||'ai';selectSection(active);
  }
  function mergeSave(){
    const before=loadJson(AI_KEY,{});
    const workerInput=dialog.querySelector('#workerEndpoint');
    const worker=normalizeWorker(workerInput?.value||'');
    const runtimeModel=clean(dialog.querySelector('[data-ai-v21-model]')?.value||before.requestModel||'');
    const runtimePrompt=String(dialog.querySelector('[data-ai-v21-prompt]')?.value??before.customPrompt??'').trim();
    const runtimeProfile=clean(dialog.querySelector('[data-ai-v22-runtime-profile]')?.value||before.requestProfile||'');
    setTimeout(()=>{
      const after=loadJson(AI_KEY,{});
      const merged={...before,...after,requestModel:runtimeModel,customPrompt:runtimePrompt,requestProfile:runtimeProfile};
      try{localStorage.setItem(AI_KEY,JSON.stringify(merged));if(worker)localStorage.setItem(WORKER_KEY,worker);else localStorage.removeItem(WORKER_KEY)}catch{}
      window.dispatchEvent(new CustomEvent('research-ai-settings-changed'));
      renderEnvStatus();
    },0);
  }
  async function renderEnvStatus(){
    const text=dialog.querySelector('[data-v25-env-status-text]');if(!text)return;
    const base=normalizeWorker(dialog.querySelector('#workerEndpoint')?.value||localStorage.getItem(WORKER_KEY)||'');
    const ai=loadJson(AI_KEY,{});
    if(!base){text.textContent=`未配置 Worker · Provider ${ai.requestProfile||'继承默认'} · 模型 ${ai.requestModel||'继承默认'}`;return}
    text.textContent=`正在检测 ${base} …`;
    try{
      const response=await fetch(`${base}/api/status`,{headers:{Accept:'application/json'}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
      const profiles=Array.isArray(data.ai_profiles?.profiles)?data.ai_profiles.profiles:[];
      const aiReady=Boolean(data.providers?.ai||data.providers?.openai||profiles.some(item=>item.key_configured));
      const providerName=data.ai?.provider||profiles.find(item=>item.id===data.ai_profiles?.default_profile)?.provider||'AI';
      const model=data.ai?.model||'默认模型';
      text.textContent=`Worker 已连接 · ${data.service_version||'服务版本未知'} · ${profiles.length||1} 个 AI 档案 · ${aiReady?`${providerName} / ${model} 可用`:'AI Secret 未就绪'}`;
      const pill=dialog.querySelector('#aiProviderPill');if(pill){pill.textContent=aiReady?'AI 已就绪':'AI 未配置';pill.className=`settings-status-pill ${aiReady?'ok':'warn'}`}
      const modelNode=dialog.querySelector('#aiModelDisplay');if(modelNode)modelNode.textContent=model;
    }catch(error){text.textContent=`Worker 连接失败：${error.message}`}
  }

  dialog.addEventListener('click',event=>{
    const nav=event.target.closest('[data-settings-jump]');if(nav){selectSection(nav.dataset.settingsJump);return}
    if(event.target.closest('#saveSettings'))mergeSave();
    if(event.target.closest('#testWorker'))setTimeout(renderEnvStatus,80);
  },true);
  document.addEventListener('click',event=>{
    if(event.target.closest('#settingsBtn,[data-open-settings]'))setTimeout(()=>{showDefaultSection();renderEnvStatus()},80);
  });
  window.addEventListener('research-provider-profiles-changed',renderEnvStatus);
  window.addEventListener('research-ai-settings-changed',()=>setTimeout(renderEnvStatus,0));
  [180,700].forEach(delay=>setTimeout(()=>{showDefaultSection();renderEnvStatus()},delay));
})();
