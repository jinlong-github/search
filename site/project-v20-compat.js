(() => {
  const PROJECTS_KEY='research-search:projects-v19';
  const ACTIVE_KEY='research-search:active-project-v19';
  const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')??fallback}catch{return fallback}};
  const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const enrichedKeys=['status','question','description','queries','evidence','library','claims','tasks','activity','schemaVersion'];
  const stateSafe=()=>{try{return state}catch{return null}};

  function localizeWorkspace(){
    const workspace=document.querySelector('#projectWorkspaceDialog');
    const brand=workspace?.querySelector('.project-v20-brand strong');
    if (brand&&brand.textContent!=='持续研究空间') brand.textContent='持续研究空间';
    const launch=workspace?.querySelector('.project-v20-launch>span');
    if (launch&&launch.textContent!=='研究项目工作区') launch.textContent='研究项目工作区';
    const evidence=workspace?.querySelector('[data-project-evidence-view]');
    if(evidence&&evidence.textContent!=='打开全局证据板')evidence.textContent='打开全局证据板';
    const saved=workspace?.querySelector('[data-project-saved-view]');
    if(saved&&saved.textContent!=='打开全局收藏')saved.textContent='打开全局收藏';
  }
  new MutationObserver(localizeWorkspace).observe(document.querySelector('#projectWorkspaceDialog')||document.body,{childList:true,subtree:true});
  localizeWorkspace();

  function recordCurrentQuery(){
    const projectId=localStorage.getItem(ACTIVE_KEY)||'';
    const current=stateSafe();
    const query=clean(current?.query);
    if (!projectId||!query) return;
    const counts={paper:(current?.papers||[]).length,patent:(current?.patents||[]).length,blog:(current?.blogs||[]).length,web:(current?.web||[]).length};
    const total=Object.values(counts).reduce((a,b)=>a+b,0);
    const list=load(PROJECTS_KEY,[]);
    const index=Array.isArray(list)?list.findIndex(item=>item.id===projectId):-1;
    if(index<0)return;
    const project=list[index];
    project.queries=Array.isArray(project.queries)?project.queries:[];
    const same=project.queries.find(item=>clean(item.q).toLowerCase()===query.toLowerCase());
    if(same){same.at=new Date().toISOString();same.counts=counts;same.total=total;}
    else project.queries.unshift({id:`query-${Date.now().toString(36)}`,q:query,at:new Date().toISOString(),counts,total});
    project.queries=project.queries.slice(0,80);
    if(!clean(project.question))project.question=query;
    project.updatedAt=new Date().toISOString();
    list[index]=project;save(PROJECTS_KEY,list);
    window.dispatchEvent(new CustomEvent('research-project-updated',{detail:{projectId}}));
  }

  document.addEventListener('click',event=>{
    const saveBtn=event.target.closest('[data-project-save]');
    if (!saveBtn) return;
    const project=window.ResearchProjects?.activeProject?.();
    if (!project) return;
    const snapshot=Object.fromEntries(enrichedKeys.map(key=>[key,project[key]]));
    const projectId=project.id;
    setTimeout(()=>{
      const list=load(PROJECTS_KEY,[]);
      const index=Array.isArray(list)?list.findIndex(item=>item.id===projectId):-1;
      if (index<0) return;
      list[index]={...list[index],...snapshot,updatedAt:list[index].updatedAt||new Date().toISOString()};
      save(PROJECTS_KEY,list);
      window.dispatchEvent(new CustomEvent('research-project-updated',{detail:{projectId}}));
    },40);
  },true);

  document.querySelector('#results')?.addEventListener('click',event=>{
    const evidence=event.target.closest('[data-os-evidence]');
    if (!evidence) return;
    setTimeout(()=>window.ResearchProjects?.syncLibrary?.(evidence.dataset.osEvidence,true),40);
  });

  document.addEventListener('click',event=>{
    const remove=event.target.closest('[data-os-evidence-remove]');
    if(!remove)return;
    setTimeout(()=>window.ResearchProjects?.syncLibrary?.(remove.dataset.osEvidenceRemove,false),50);
  });

  const workspace=document.querySelector('#projectWorkspaceDialog');
  workspace?.addEventListener('click',event=>{
    const record=event.target.closest('[data-project-record]');
    if (!record) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const key=record.dataset.projectRecord;
    workspace.close();
    const url=new URL(location.href); url.searchParams.delete('project'); history.replaceState(null,'',url);
    document.querySelector('.tab[data-tab="saved"]')?.click();
    setTimeout(()=>{
      const card=[...document.querySelectorAll('.ux-result[data-key]')].find(node=>node.dataset.key===key);
      card?.scrollIntoView({block:'center',behavior:'auto'});
      card?.querySelector('.research-preview-btn')?.click();
    },180);
  },true);

  window.addEventListener('research-project-changed',()=>setTimeout(recordCurrentQuery,1200));
  [1800,4800,9000].forEach(delay=>setTimeout(recordCurrentQuery,delay));

  const params=new URLSearchParams(location.search);
  if (params.get('project')==='new') {
    setTimeout(()=>{
      if (!window.ResearchProjects) return;
      window.ResearchProjects.create();
      window.ResearchProjects.open();
      setTimeout(recordCurrentQuery,1800);
    },160);
  }
})();