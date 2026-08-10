(() => {
  const WORKER_KEY='research-search:worker-url';
  const AI_KEY='research-search:ai-settings-v1';
  const dialog=document.querySelector('#projectWorkspaceDialog');
  if(!dialog)return;
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
  const projectApi=()=>window.ResearchProjects||null;
  const profileApi=()=>window.ResearchProviderProfiles||null;
  const active=()=>projectApi()?.activeProject?.()||null;
  const loadAi=()=>{try{return JSON.parse(localStorage.getItem(AI_KEY)||'{}')||{}}catch{return{}}};
  const workerBase=()=>clean(localStorage.getItem(WORKER_KEY)||'').replace(/\/+$/,'');
  const state={busy:false,status:null,error:''};
  const ACTIONS={
    evidence:{label:'证据分析',hint:'看支持、反证、方法、先验与缺口'},
    counter:{label:'找反证',hint:'只认现有反证；没有就生成反证检索方向'},
    queries:{label:'下一轮检索',hint:'生成高信息增益检索式'},
    claims:{label:'审查阶段结论',hint:'逐条检查是否真的有证据支撑'}
  };

  function runtimeProfile(project){const ai=loadAi();return clean(project?.aiProfile||ai.projectProfile||ai.requestProfile||'')}
  function runtimeModel(project){const ai=loadAi();return clean(project?.aiModel||ai.projectModel||ai.requestModel||'')}
  function runtimePrompt(project){const ai=loadAi();return String(project?.aiPrompt||ai.projectPrompt||ai.customPrompt||'').trim().slice(0,6000)}
  function liveProfile(project){
    const live=profileApi()?.live?.()||[];const status=state.status?.ai_profiles||{};const wanted=runtimeProfile(project)||status.default_profile||'';
    return live.find(item=>item.id===wanted)||status.profiles?.find?.(item=>item.id===wanted)||null;
  }
  function providerLabel(project){
    const profile=liveProfile(project);const wanted=runtimeProfile(project)||state.status?.ai_profiles?.default_profile||'';
    if(profile)return `${profile.name||profile.provider||profile.id} · ${profile.model||'默认模型'}`;
    if(wanted)return `${wanted} · 等待 Worker`;
    return '继承 Worker 默认档案';
  }
  function providerReady(project){const profile=liveProfile(project);return Boolean(profile?.key_configured||profile?.keyConfigured)}
  async function refreshStatus(){
    const base=workerBase();if(!base){state.status=null;renderBadge();renderPanelMeta();return null}
    try{const response=await fetch(`${base}/api/status`,{headers:{Accept:'application/json'}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);state.status=data;renderBadge();renderPanelMeta();return data}
    catch{state.status=null;renderBadge();renderPanelMeta();return null}
  }
  function projectPayload(project){return{
    name:project.name||'',question:project.question||'',description:project.description||'',status:project.status||'',
    queries:(project.queries||[]).slice(0,16).map(item=>({q:item.q||'',at:item.at||''})),
    evidence:(project.evidence||[]).slice(0,28).map(item=>({key:item.key||'',lane:item.lane||'inbox',type:item.type||'',title:item.title||'',source:item.source||'',year:item.year||null,summary:item.summary||''})),
    claims:(project.claims||[]).slice(0,20).map(item=>({id:item.id||'',state:item.state||'open',text:item.text||''})),
    tasks:(project.tasks||[]).slice(0,16).map(item=>({text:item.text||'',done:Boolean(item.done)}))
  }}
  const latest=project=>Array.isArray(project?.aiAnalyses)&&project.aiAnalyses.length?project.aiAnalyses[0]:null;
  const statusName=value=>({supported:'有支持',mixed:'证据混合',counter:'存在反证',insufficient:'证据不足'})[value]||value;
  function resultHtml(entry){
    if(!entry?.result)return '<div class="project-v24-empty"><strong>还没有 Copilot 分析</strong><p>它只读取当前项目里的研究问题、检索轨迹、证据、阶段结论与任务，不会把外部未知信息伪装成已知事实。</p></div>';
    const result=entry.result;const action=ACTIONS[entry.action]||{label:'分析'};
    return `<div class="project-v24-result-head"><div><span>${esc(action.label)} · ${esc(new Date(entry.at).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}))}</span><h4>${esc(result.headline||'研究助手分析')}</h4></div><small>${esc(entry.profile||'默认 Profile')} · ${esc(entry.model||'默认模型')}${entry.latency_ms?` · ${esc(entry.latency_ms)} ms`:''}</small></div>
      ${result.summary?`<p class="project-v24-summary">${esc(result.summary)}</p>`:''}
      ${result.signals?.length?`<div class="project-v24-signals">${result.signals.map(item=>`<article><span>${esc(item.label||'信号')}</span><p>${esc(item.text)}</p>${item.evidence_keys?.length?`<small>证据：${item.evidence_keys.map(key=>`<code>${esc(key)}</code>`).join(' ')}</small>`:'<small>未绑定具体证据 key</small>'}</article>`).join('')}</div>`:''}
      ${result.claim_reviews?.length?`<div class="project-v24-claims"><h5>阶段结论审查</h5>${result.claim_reviews.map(item=>`<article class="${esc(item.status)}"><span>${esc(statusName(item.status))}</span><p>${esc(item.reason)}</p>${item.evidence_keys?.length?`<small>${item.evidence_keys.map(key=>`<code>${esc(key)}</code>`).join(' ')}</small>`:''}</article>`).join('')}</div>`:''}
      ${result.queries?.length?`<div class="project-v24-next"><h5>建议检索</h5>${result.queries.map(query=>`<button type="button" data-v24-query="${esc(query)}"><span>检索</span><strong>${esc(query)}</strong></button>`).join('')}</div>`:''}
      ${result.tasks?.length?`<div class="project-v24-next"><h5>建议任务</h5>${result.tasks.map(task=>`<button type="button" data-v24-task="${esc(task)}"><span>＋任务</span><strong>${esc(task)}</strong></button>`).join('')}</div>`:''}`;
  }
  function ensureBadge(){
    const topbar=dialog.querySelector('.project-v20-topbar');if(!topbar)return null;
    let badge=topbar.querySelector('[data-v24-provider-badge]');
    if(!badge){badge=document.createElement('button');badge.type='button';badge.className='project-v24-provider-badge';badge.dataset.v24ProviderBadge='';badge.title='打开 AI Provider 配置';const actions=topbar.lastElementChild;actions?.insertBefore(badge,actions.firstChild)}
    return badge;
  }
  function renderBadge(){const project=active();const badge=ensureBadge();if(!badge||!project)return;const ready=providerReady(project);badge.className=`project-v24-provider-badge ${ready?'ready':'warn'}`;badge.innerHTML=`<i></i><span>AI</span><strong>${esc(providerLabel(project))}</strong>`}
  function ensurePanel(){
    const project=active();const canvas=dialog.querySelector('[data-project-canvas]');const hero=canvas?.querySelector('.project-v20-hero');if(!project||!hero)return null;
    let panel=canvas.querySelector('[data-project-copilot-v24]');
    if(!panel){
      panel=document.createElement('section');panel.className='project-v24-copilot';panel.dataset.projectCopilotV24='';
      panel.innerHTML=`<header class="project-v24-head"><div><span>Research Copilot</span><h3>让当前项目的证据驱动下一步研究</h3><p>只基于项目内材料分析；检索建议是建议，不会被当成已经存在的证据。</p></div><div class="project-v24-live" data-v24-live></div></header><div class="project-v24-actions">${Object.entries(ACTIONS).map(([key,item])=>`<button type="button" data-v24-action="${key}"><strong>${item.label}</strong><small>${item.hint}</small></button>`).join('')}</div><div class="project-v24-output" data-v24-output></div>`;
      const aiPanel=canvas.querySelector('[data-project-ai-v21]');(aiPanel||hero).insertAdjacentElement('afterend',panel);
    }
    return panel;
  }
  function renderPanelMeta(){const project=active();const panel=ensurePanel();if(!project||!panel)return;const live=panel.querySelector('[data-v24-live]');const ready=providerReady(project);const base=workerBase();live.className=`project-v24-live ${ready?'ready':base?'warn':'off'}`;live.innerHTML=`<i></i><span>${ready?'已连接':base?'待确认':'未配置 Worker'}</span><strong>${esc(providerLabel(project))}</strong>`}
  function renderOutput(){
    const project=active();const output=ensurePanel()?.querySelector('[data-v24-output]');if(!project||!output)return;
    if(state.busy){output.innerHTML='<div class="project-v24-thinking"><span></span><span></span><span></span><strong>正在按项目证据分析…</strong></div>';return}
    if(state.error){output.innerHTML=`<div class="project-v24-error"><strong>Copilot 请求失败</strong><p>${esc(state.error)}</p></div>`;return}
    output.innerHTML=resultHtml(latest(project));
  }
  function render(){ensurePanel();renderBadge();renderPanelMeta();renderOutput()}

  async function run(action){
    const project=active();const api=projectApi();const base=workerBase();if(!project||!api?.updateProject)return;
    state.error='';
    if(!base){state.error='还没有 Worker 地址。先到“配置 → AI 接口”连接并部署 Provider Profile。';renderOutput();return}
    state.busy=true;renderOutput();const started=Date.now();
    try{
      const response=await fetch(`${base}/api/ai/research`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({action,profile:runtimeProfile(project),model:runtimeModel(project),prompt:runtimePrompt(project),project:projectPayload(project)})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
      const entry={id:`analysis-${Date.now().toString(36)}`,action,result:data.result||{},profile:data.profile||runtimeProfile(project)||'',provider:data.provider||'',model:data.model||runtimeModel(project)||'',usage:data.usage||null,estimated_cost_usd:data.estimated_cost_usd??null,latency_ms:data.latency_ms||Date.now()-started,at:new Date().toISOString()};
      api.updateProject(project.id,draft=>{draft.aiAnalyses=[entry,...(Array.isArray(draft.aiAnalyses)?draft.aiAnalyses:[])].slice(0,12)},{activity:`Research Copilot：${ACTIONS[action]?.label||action}`});
    }catch(error){state.error=error.message||'未知错误'}
    finally{state.busy=false;setTimeout(render,30)}
  }
  function runQuery(query){if(!query)return;state.error='';dialog.close();const input=document.querySelector('#queryInput');if(input)input.value=query;setTimeout(()=>{try{if(typeof performSearch==='function')performSearch(query);else document.querySelector('#searchForm')?.requestSubmit()}catch{}},60)}
  function addTask(text){const project=active();const api=projectApi();if(!project||!api?.updateProject||!text)return;state.error='';api.updateProject(project.id,draft=>{const exists=(draft.tasks||[]).some(item=>clean(item.text).toLowerCase()===clean(text).toLowerCase());if(!exists)draft.tasks=[{id:`task-${Date.now().toString(36)}`,text:clean(text).slice(0,500),done:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},...(draft.tasks||[])]},{activity:'从 Research Copilot 加入下一步任务'});setTimeout(render,30)}

  dialog.addEventListener('click',event=>{
    const action=event.target.closest('[data-v24-action]');if(action){run(action.dataset.v24Action);return}
    const query=event.target.closest('[data-v24-query]');if(query){runQuery(query.dataset.v24Query);return}
    const task=event.target.closest('[data-v24-task]');if(task){addTask(task.dataset.v24Task);return}
    if(event.target.closest('[data-v24-provider-badge]')){dialog.close();setTimeout(()=>document.querySelector('#settingsBtn')?.click(),40);setTimeout(()=>document.querySelector('[data-settings-jump="provider"]')?.click(),180)}
  });
  const canvas=dialog.querySelector('[data-project-canvas]');if(canvas)new MutationObserver(()=>setTimeout(render,0)).observe(canvas,{childList:true});
  window.addEventListener('research-project-changed',()=>{state.error='';setTimeout(render,0);setTimeout(refreshStatus,40)});
  window.addEventListener('research-project-updated',()=>setTimeout(render,0));
  window.addEventListener('research-provider-profiles-changed',()=>{setTimeout(render,0);setTimeout(refreshStatus,20)});
  window.addEventListener('research-ai-settings-changed',()=>setTimeout(render,0));
  [180,700,1600].forEach(delay=>setTimeout(()=>{render();refreshStatus()},delay));
})();
