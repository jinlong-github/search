(() => {
  const results=document.querySelector('#results');
  if(!results)return;
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  let internal=false;
  function active(){return window.ResearchProjects?.activeProject?.()||null;}
  function inLibrary(project,key){return Boolean(project?.library?.some(item=>item.key===key));}
  function enhance(){
    if(internal)return;
    internal=true;
    try{
      const project=active();
      [...results.querySelectorAll('.ux-result[data-key]')].forEach(card=>{
        const actions=card.querySelector('.ux-actions');
        if(!actions)return;
        let button=actions.querySelector('.project-v20-add');
        if(!button){
          button=document.createElement('button');
          button.type='button';
          button.className='project-v20-add';
          button.dataset.projectLibrary=card.dataset.key;
          actions.appendChild(button);
        }
        const added=inLibrary(project,card.dataset.key);
        const label=project ? (added?'项目 ✓':'加入项目') : '加入项目';
        if(button.textContent!==label)button.textContent=label;
        button.classList.toggle('added',added);
        button.title=project?`当前项目：${clean(project.name)}`:'先创建或选择研究项目';
      });
    } finally {queueMicrotask(()=>{internal=false;});}
  }
  results.addEventListener('click',event=>{
    const button=event.target.closest('[data-project-library]');
    if(!button)return;
    event.preventDefault();event.stopPropagation();
    let project=active();
    if(!project){
      window.ResearchProjects?.create?.();
      project=active();
    }
    if(!project)return;
    const key=button.dataset.projectLibrary;
    if(inLibrary(project,key)){
      window.ResearchProjects?.updateProject?.(project.id,draft=>{
        draft.library=(draft.library||[]).filter(item=>item.key!==key);
      },{activity:'从当前项目资料库移出一条资料'});
    }else window.ResearchProjects?.syncLibrary?.(key,true);
    setTimeout(enhance,30);
  });
  new MutationObserver(()=>{if(!internal)setTimeout(enhance,20);}).observe(results,{childList:true,subtree:true});
  window.addEventListener('research-project-changed',enhance);
  window.addEventListener('research-project-updated',enhance);
  [0,250,900,2400,6000].forEach(delay=>setTimeout(enhance,delay));
})();