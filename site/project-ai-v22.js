(() => {
  const AI_KEY='research-search:ai-settings-v1';
  const clean=value=>String(value??'').trim();
  const load=()=>{try{return JSON.parse(localStorage.getItem(AI_KEY)||'{}')||{}}catch{return{}}};
  const save=value=>{try{localStorage.setItem(AI_KEY,JSON.stringify(value))}catch{}};
  const projectApi=()=>window.ResearchProjects||null;
  const profileApi=()=>window.ResearchProviderProfiles||null;
  const dialog=document.querySelector('#projectWorkspaceDialog');
  if(!dialog)return;

  function loadCopilot(){
    if(!document.querySelector('link[data-project-v24]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./project-copilot-v24.css?v=24';link.dataset.projectV24='';document.head.appendChild(link)}
    if(!document.querySelector('script[data-project-v24]')){const script=document.createElement('script');script.src='./project-copilot-v24.js?v=24';script.defer=true;script.dataset.projectV24='';document.body.appendChild(script)}
  }
  function active(){return projectApi()?.activeProject?.()||null}
  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function profileOptions(current=''){
    const local=profileApi()?.list?.()||[];
    const live=profileApi()?.live?.()||[];
    const map=new Map();
    live.forEach(p=>map.set(p.id,{id:p.id,name:p.name||p.provider||p.id,live:true}));
    local.forEach(p=>{if(!map.has(p.id))map.set(p.id,{id:p.id,name:p.name||p.provider||p.id,live:false})});
    if(current&&!map.has(current))map.set(current,{id:current,name:current,live:false});
    return '<option value="">继承全局 / Worker 默认档案</option>'+[...map.values()].map(p=>`<option value="${esc(p.id)}"${p.id===current?' selected':''}>${esc(p.name)} · ${esc(p.id)}${p.live?'':' · 草稿'}</option>`).join('');
  }
  function applyRuntime(project=active()){
    const current=load();
    const next={...current,activeProjectId:project?.id||'',projectProfile:clean(project?.aiProfile||'')};
    if(JSON.stringify(current)!==JSON.stringify(next)){
      save(next);window.dispatchEvent(new CustomEvent('research-ai-settings-changed'));
    }
  }
  function inject(){
    const project=active();
    const panel=dialog.querySelector('[data-project-ai-v21]');
    const grid=panel?.querySelector('.project-v21-ai-grid');
    if(!project||!grid)return;
    let field=grid.querySelector('[data-project-ai-profile-field]');
    if(!field){
      field=document.createElement('label');field.dataset.projectAiProfileField='';field.innerHTML='<span>Provider Profile</span><select data-project-ai-profile></select><small>绑定 Worker 中的一套 AI 上游档案；留空则继承全局选择。</small>';
      grid.insertBefore(field,grid.firstChild);
    }
    const select=field.querySelector('[data-project-ai-profile]');
    const value=clean(project.aiProfile||'');
    const options=profileOptions(value||select.value);
    if(select.innerHTML!==options)select.innerHTML=options;
    if(select.value!==value)select.value=value;
    const header=panel.querySelector('header small');
    const text=value?`当前绑定 Provider Profile：${value}。模型和提示词仍可在项目内继续覆盖。`:'项目可单独绑定 Provider Profile、模型和提示词；留空则继承全局设置。';
    if(header&&header.textContent!==text)header.textContent=text;
  }
  function saveProfile(){
    const project=active();const api=projectApi();if(!project||!api?.updateProject)return;
    const profile=clean(dialog.querySelector('[data-project-ai-profile]')?.value).slice(0,64);
    if(clean(project.aiProfile||'')===profile){applyRuntime(project);return}
    api.updateProject(project.id,draft=>{draft.aiProfile=profile},{activity:profile?`绑定 AI Provider Profile：${profile}`:'恢复继承全局 AI Provider Profile'});
    applyRuntime({...project,aiProfile:profile});
  }
  function refresh(){applyRuntime();setTimeout(inject,0)}
  dialog.addEventListener('click',event=>{if(event.target.closest('[data-project-ai-save]'))setTimeout(saveProfile,0)});
  dialog.addEventListener('change',event=>{if(event.target.matches('[data-project-ai-profile]'))saveProfile()});
  const canvas=dialog.querySelector('[data-project-canvas]');
  if(canvas)new MutationObserver(()=>setTimeout(inject,0)).observe(canvas,{childList:true});
  window.addEventListener('research-project-changed',refresh);
  window.addEventListener('research-project-updated',refresh);
  window.addEventListener('research-provider-profiles-changed',()=>setTimeout(inject,0));
  loadCopilot();
  [120,420,1000].forEach(delay=>setTimeout(refresh,delay));
})();
