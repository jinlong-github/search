(() => {
  const WORKER_KEY='research-search:worker-url';
  const clean=value=>String(value??'').trim();
  const workerBase=()=>clean(localStorage.getItem(WORKER_KEY)||'').replace(/\/+$/,'');
  const readyFrom=data=>{
    const profiles=Array.isArray(data?.ai_profiles?.profiles)?data.ai_profiles.profiles:[];
    return Boolean(data?.providers?.ai||data?.providers?.openai||profiles.some(item=>item?.key_configured));
  };
  const profileFrom=data=>{
    const profiles=Array.isArray(data?.ai_profiles?.profiles)?data.ai_profiles.profiles:[];
    const selected=profiles.find(item=>item.id===data?.ai_profiles?.default_profile)||profiles.find(item=>item.key_configured)||profiles[0];
    return {provider:data?.ai?.provider||selected?.provider||selected?.name||'AI',model:data?.ai?.model||selected?.model||'默认模型'};
  };
  let sequence=0;
  async function patch(){
    const dialog=document.querySelector('#controlCenterDialog');
    const base=workerBase();
    if(!dialog?.open||!base)return;
    const current=++sequence;
    try{
      const response=await fetch(`${base}/api/status`,{headers:{Accept:'application/json'}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||current!==sequence)return;
      const ready=readyFrom(data);const profile=profileFrom(data);
      const cards=[...dialog.querySelectorAll('[data-control-overview] article')];
      const aiCard=cards.find(card=>clean(card.querySelector('span')?.textContent)==='AI 服务');
      if(aiCard){
        const strong=aiCard.querySelector('strong');const small=aiCard.querySelector('small');
        if(strong)strong.textContent=ready?'已就绪':'未就绪';
        if(small)small.textContent=ready?`${profile.provider} · ${profile.model}`:'本地摘要仍可使用';
      }
      const aiHead=dialog.querySelector('[data-control-ai] .control-v19-panel-head i');
      if(aiHead&&ready)aiHead.textContent=`${profile.provider} · ${profile.model}`;
      dialog.dataset.aiReady=ready?'1':'0';
    }catch{}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('#controlCenterBtn,[data-control-refresh]'))setTimeout(patch,120);
  });
  window.addEventListener('research-provider-profiles-changed',()=>setTimeout(patch,40));
  [700,1500].forEach(delay=>setTimeout(patch,delay));
})();
