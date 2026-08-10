(() => {
  const AI_KEY='research-search:ai-settings-v1';
  const clean=value=>String(value??'').trim();
  const load=()=>{try{return JSON.parse(localStorage.getItem(AI_KEY)||'{}')||{}}catch{return{}}};
  const save=value=>{try{localStorage.setItem(AI_KEY,JSON.stringify(value))}catch{}};
  const projectApi=()=>window.ResearchProjects||null;
  const dialog=document.querySelector('#projectWorkspaceDialog');
  if(!dialog) return;

  function active(){return projectApi()?.activeProject?.()||null}
  function applyRuntime(project=active()){
    const current=load();
    const next={...current,activeProjectId:project?.id||'',projectModel:clean(project?.aiModel||''),projectPrompt:String(project?.aiPrompt||'').trim().slice(0,6000)};
    if(JSON.stringify(current)!==JSON.stringify(next)){
      save(next);
      window.dispatchEvent(new CustomEvent('research-ai-settings-changed'));
    }
  }
  function inject(){
    const project=active();
    const canvas=dialog.querySelector('[data-project-canvas]');
    const hero=canvas?.querySelector('.project-v20-hero');
    if(!project||!hero||canvas.querySelector('[data-project-ai-v21]')) return;
    const panel=document.createElement('section');
    panel.className='project-v21-ai';
    panel.dataset.projectAiV21='';
    panel.innerHTML=`<header><div><span>项目 AI 策略</span><h3>当前项目的模型与提示词覆盖</h3></div><small>项目配置优先于全局模型/提示词；留空则继承系统设置。</small></header><div class="project-v21-ai-grid"><label>模型名称<input type="text" data-project-ai-model placeholder="继承全局 / Worker 默认模型" value="${String(project.aiModel||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}"/></label><label>项目附加提示词<textarea data-project-ai-prompt placeholder="例如：重点关注工程可实现性、输入输出、约束条件、失效边界。">${String(project.aiPrompt||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</textarea></label></div><div class="project-v21-ai-actions"><button type="button" data-project-ai-save>保存项目 AI 配置</button></div>`;
    hero.insertAdjacentElement('afterend',panel);
  }
  function refresh(){applyRuntime();setTimeout(inject,0)}
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('[data-project-ai-save]');
    if(!button) return;
    const project=active(); const api=projectApi(); if(!project||!api?.updateProject) return;
    const model=clean(dialog.querySelector('[data-project-ai-model]')?.value).slice(0,200);
    const prompt=String(dialog.querySelector('[data-project-ai-prompt]')?.value||'').trim().slice(0,6000);
    api.updateProject(project.id,draft=>{draft.aiModel=model;draft.aiPrompt=prompt},{activity:'更新项目 AI 模型 / 提示词'});
    setTimeout(refresh,20);
  });
  const canvas=dialog.querySelector('[data-project-canvas]');
  if(canvas)new MutationObserver(()=>setTimeout(inject,0)).observe(canvas,{childList:true});
  window.addEventListener('research-project-changed',refresh);
  window.addEventListener('research-project-updated',refresh);
  [60,250,900].forEach(delay=>setTimeout(refresh,delay));
})();
