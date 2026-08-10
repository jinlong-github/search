(() => {
  const dialog=document.querySelector('#settingsDialog');
  if(!dialog)return;
  const WORKER_KEY='research-search:worker-url';
  const clean=value=>String(value??'').trim();
  const base=()=>clean(localStorage.getItem(WORKER_KEY)||'').replace(/\/+$/,'');

  function rewriteLegacy(){
    const ai=dialog.querySelector('[data-settings-section="ai"]');
    const info=ai?.querySelector('.settings-info-card.important');
    if(info){
      const strong=info.querySelector('strong');if(strong)strong.textContent='API Key 不会保存在浏览器';
      const p=info.querySelector('p');if(p)p.textContent='网页只调用你自己的 Worker。AI_API_KEY 保存在 Worker Secret；上游可以是 OpenAI，也可以是兼容 Responses / Chat Completions 的自定义 AI 服务。';
    }
    const provider=ai?.querySelector('.settings-endpoint-card div:first-child strong');
    if(provider)provider.textContent='可配置 AI 服务 · Worker 代理';
    const test=dialog.querySelector('#testAi');if(test)test.textContent='检查 AI 服务';

    dialog.querySelectorAll('.settings-config-list>div').forEach(row=>{
      const code=row.querySelector('code');const small=row.querySelector('small');if(!code)return;
      if(code.textContent==='OPENAI_API_KEY'){code.textContent='AI_API_KEY';if(small)small.textContent='AI 上游 API Secret，仅 Worker 可见；OPENAI_API_KEY 仍兼容。';}
      if(code.textContent.startsWith('OPENAI_MODEL=')){code.textContent='AI_MODEL=gpt-5-mini';if(small)small.textContent='AI 默认模型名称，可替换成你的上游服务支持的模型；OPENAI_MODEL 仍兼容。';}
      if(code.textContent==='OPENAI_INPUT_USD_PER_1M'){
        code.textContent='AI_INPUT_USD_PER_1M';
        if(small)small.textContent='输入 Token 成本估算；兼容旧名 OPENAI_INPUT_USD_PER_1M。';
      }
      if(code.textContent==='OPENAI_OUTPUT_USD_PER_1M'){
        code.textContent='AI_OUTPUT_USD_PER_1M';
        if(small)small.textContent='输出 Token 成本估算；兼容旧名 OPENAI_OUTPUT_USD_PER_1M。';
      }
    });
    const command=dialog.querySelector('#workerCommandPreview');
    if(command){
      const origin=location.origin;
      command.textContent=[
        'cd worker',
        'npx wrangler secret put AI_API_KEY',
        'npx wrangler secret put BRAVE_SEARCH_API_KEY',
        'npx wrangler secret put PATENTSVIEW_API_KEY   # 可选',
        '# AI_BASE_URL / AI_API_MODE / AI_API_PATH / AI_MODEL 在 Worker 环境变量中设置',
        `# ALLOWED_ORIGINS=${origin}`,
        'npm run deploy'
      ].join('\n');
    }
  }

  async function genericAiStatus(){
    const node=dialog.querySelector('#aiStatus');
    if(!node||!base())return;
    try{
      const response=await fetch(`${base()}/api/status`,{headers:{Accept:'application/json'}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
      const ready=Boolean(data.providers?.ai||data.providers?.openai);
      node.textContent=ready?`✓ AI 服务可用 · ${data.ai?.provider||'AI'} · ${data.ai?.model||'服务器模型'}`:'Worker 已连接，但 AI_API_KEY 尚未配置。';
    }catch(error){node.textContent=`AI 状态检查失败：${error.message}`;}
  }

  rewriteLegacy();
  document.addEventListener('click',event=>{
    if(event.target.closest('#settingsBtn,[data-open-settings]'))setTimeout(rewriteLegacy,30);
    if(event.target.closest('#testAi'))setTimeout(genericAiStatus,180);
  });
})();
