(() => {
  const WORKER_KEY='research-search:worker-url';
  const clean=value=>String(value??'').trim();
  const workerBase=()=>clean(localStorage.getItem(WORKER_KEY)||'').replace(/\/+$/,'');
  const settingsBase=()=>clean(document.querySelector('#workerEndpoint')?.value||workerBase()).replace(/\/+$/,'');
  const readyFrom=data=>{
    const profiles=Array.isArray(data?.ai_profiles?.profiles)?data.ai_profiles.profiles:[];
    return Boolean(data?.providers?.ai||data?.providers?.openai||profiles.some(item=>item?.key_configured));
  };
  const profileFrom=data=>{
    const profiles=Array.isArray(data?.ai_profiles?.profiles)?data.ai_profiles.profiles:[];
    const selected=profiles.find(item=>item.id===data?.ai_profiles?.default_profile)||profiles.find(item=>item.key_configured)||profiles[0];
    return {provider:data?.ai?.provider||selected?.provider||selected?.name||'AI',model:data?.ai?.model||selected?.model||'默认模型'};
  };
  const fetchStatus=async base=>{
    const response=await fetch(`${base}/api/status`,{headers:{Accept:'application/json'}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
    return data;
  };
  let sequence=0;
  async function patchControl(){
    const dialog=document.querySelector('#controlCenterDialog');
    const base=workerBase();
    if(!dialog?.open||!base)return;
    const current=++sequence;
    try{
      const data=await fetchStatus(base);if(current!==sequence)return;
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
  async function patchSettings(){
    const dialog=document.querySelector('#settingsDialog');const base=settingsBase();
    if(!dialog?.open||!base)return;
    try{
      const data=await fetchStatus(base);const providers=data.providers||{};const ready=readyFrom(data);const profile=profileFrom(data);const copilot=Boolean(data.capabilities?.research_copilot);
      const status=dialog.querySelector('#workerStatus');
      if(status)status.textContent=`✓ Worker 可用 · Web ${providers.brave?'已配置':'未配置'} · 专利 ${providers.patentsview?'已配置':'未配置'} · AI ${ready?'已配置':'未配置'} · Copilot ${copilot?'已就绪':'版本未确认'}`;
      const aiStatus=dialog.querySelector('#aiStatus');if(aiStatus)aiStatus.textContent=ready?`AI 服务可用 · ${profile.provider} · ${profile.model}`:'Worker 已连接，但 AI Secret 未就绪。';
      const pill=dialog.querySelector('#aiProviderPill');if(pill){pill.textContent=ready?'AI 已就绪':'AI 未配置';pill.className=`settings-status-pill ${ready?'ok':'warn'}`}
      const model=dialog.querySelector('#aiModelDisplay');if(model)model.textContent=profile.model;
    }catch{}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('#controlCenterBtn,[data-control-refresh]'))setTimeout(patchControl,140);
    if(event.target.closest('#testWorker,#settingsBtn,[data-open-settings]'))setTimeout(patchSettings,220);
  });
  window.addEventListener('research-provider-profiles-changed',()=>{setTimeout(patchControl,40);setTimeout(patchSettings,40)});
  window.addEventListener('research-ai-settings-changed',()=>setTimeout(patchSettings,40));
  [700,1500].forEach(delay=>setTimeout(()=>{patchControl();patchSettings()},delay));
})();
