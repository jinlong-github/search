(()=>{
  'use strict';

  const SIMPLE_KEY='research-search:simple-ai-v28';
  const AI_KEY='research-search:ai-settings-v1';
  const WORKER_KEY='research-search:worker-url';
  const CACHE_KEY='research-search:ai-summary-cache-v1';
  const clean=value=>String(value??'').trim();
  const loadJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}};
  const saveJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const simple=()=>({url:'',api:'',name:'',...loadJson(SIMPLE_KEY,{})});
  const complete=value=>Boolean(clean(value?.url)&&clean(value?.api)&&clean(value?.name));

  function applyRuntime(value){
    const current=loadJson(AI_KEY,{});
    saveJson(AI_KEY,{
      ...current,
      enabled:complete(value),
      style:'standard',batchSize:10,onlyWithSource:true,
      requestProfile:'',requestModel:'',customPrompt:'',
      projectProfile:'',projectModel:'',projectPrompt:''
    });
    window.dispatchEvent(new CustomEvent('research-ai-settings-changed'));
  }

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    try{
      const url=typeof input==='string'?input:input?.url||'';
      if(/\/api\/ai\/summaries(?:\?|$)/.test(url)&&init?.body&&String(init.method||'GET').toUpperCase()==='POST'){
        const value=simple();
        if(complete(value)){
          const body=JSON.parse(String(init.body));
          body.ai={url:clean(value.url),api:clean(value.api),name:clean(value.name)};
          init={...init,body:JSON.stringify(body)};
        }
      }
    }catch{}
    return nativeFetch(input,init);
  };

  function hideLegacyAiDeployment(dialog){
    dialog.querySelectorAll('.settings-config-list>div').forEach(row=>{
      const text=row.textContent||'';
      if(/OPENAI_API_KEY|OPENAI_MODEL|AI_API_KEY|AI_MODEL/.test(text))row.dataset.simpleAiHidden='1';
    });
    const note=dialog.querySelector('.settings-security-note');
    if(note)note.textContent='AI 的 URL、API Key 和 Name 在“AI 能力”中配置；这里仅保留搜索后端与部署相关设置。';
    const serviceAi=[...dialog.querySelectorAll('.settings-endpoints>div')].find(row=>(row.textContent||'').includes('AI 摘要'));
    if(serviceAi){const small=serviceAi.querySelector('small');if(small)small.textContent='AI 请求经你的 Worker 转发到所填写的 OpenAI-compatible URL。'}
  }

  function mount(){
    const dialog=document.querySelector('#settingsDialog.settings-center');
    const aiSection=dialog?.querySelector('[data-settings-section="ai"]');
    if(!dialog||!aiSection||aiSection.dataset.simpleAiV28==='1')return false;
    aiSection.dataset.simpleAiV28='1';
    document.body.classList.add('simple-ai-v28');

    const headCopy=dialog.querySelector('.settings-center-head>div>p:last-child');
    if(headCopy)headCopy.textContent='AI 只配置 URL、API Key 和 Name；其他运行参数由系统自动处理。';
    const navProvider=dialog.querySelector('[data-settings-jump="provider"]');if(navProvider)navProvider.hidden=true;
    const provider=dialog.querySelector('[data-settings-section="provider"]');if(provider)provider.hidden=true;

    aiSection.innerHTML=`
      <div class="simple-ai-v28-head"><div><span>AI</span><h3>AI 配置</h3></div><i class="simple-ai-v28-pill" data-simple-ai-pill>未配置</i></div>
      <div class="simple-ai-v28-form">
        <label class="simple-ai-v28-field"><span>URL</span><input data-simple-ai-url type="url" autocomplete="off" placeholder="https://api.openai.com/v1" /></label>
        <label class="simple-ai-v28-field"><span>API</span><div class="simple-ai-v28-api-wrap"><input data-simple-ai-api type="password" autocomplete="off" placeholder="sk-..." /><button class="simple-ai-v28-reveal" data-simple-ai-reveal type="button">显示</button></div></label>
        <label class="simple-ai-v28-field"><span>Name</span><input data-simple-ai-name type="text" autocomplete="off" placeholder="gpt-5-mini" /></label>
      </div>
      <p class="simple-ai-v28-note"><strong>就这三个。</strong> URL 支持 OpenAI-compatible 接口；API Key 仅保存在当前浏览器，并随 AI 请求通过你的 Worker 转发，不写入 GitHub。</p>
      <div class="simple-ai-v28-actions"><button class="primary" data-simple-ai-save type="button">保存</button><button class="secondary" data-simple-ai-test type="button">测试</button></div>
      <div class="simple-ai-v28-status" data-simple-ai-status></div>`;

    hideLegacyAiDeployment(dialog);
    const urlInput=aiSection.querySelector('[data-simple-ai-url]'),apiInput=aiSection.querySelector('[data-simple-ai-api]'),nameInput=aiSection.querySelector('[data-simple-ai-name]');
    const pill=aiSection.querySelector('[data-simple-ai-pill]'),status=aiSection.querySelector('[data-simple-ai-status]'),reveal=aiSection.querySelector('[data-simple-ai-reveal]');

    function load(){
      const value=simple();urlInput.value=value.url||'';apiInput.value=value.api||'';nameInput.value=value.name||'';
      const ready=complete(value);pill.textContent=ready?'已配置':'未配置';pill.className=`simple-ai-v28-pill ${ready?'ok':''}`;
    }
    function read(){return{url:clean(urlInput.value).replace(/\/+$/,''),api:clean(apiInput.value),name:clean(nameInput.value)}}
    function save(show=true){
      const value=read();const previous=simple();
      if(previous.url!==value.url||previous.api!==value.api||previous.name!==value.name){try{localStorage.removeItem(CACHE_KEY)}catch{}}
      saveJson(SIMPLE_KEY,value);applyRuntime(value);
      const ready=complete(value);pill.textContent=ready?'已配置':'未配置';pill.className=`simple-ai-v28-pill ${ready?'ok':''}`;
      if(show){status.textContent=ready?'✓ 已保存。下一次搜索直接使用这套 AI 配置。':'请把 URL、API、Name 三项填完整。';status.className=`simple-ai-v28-status ${ready?'ok':'fail'}`;}
      return value;
    }
    async function test(){
      const value=save(false);const worker=clean(localStorage.getItem(WORKER_KEY)||'').replace(/\/+$/,'');
      if(!complete(value)){status.textContent='请先把 URL、API、Name 三项填完整。';status.className='simple-ai-v28-status fail';return;}
      if(!worker){status.textContent='AI 三项已填写，但系统还需要“服务地址”中的 Worker URL 来转发请求。';status.className='simple-ai-v28-status fail';return;}
      status.textContent='正在测试…';status.className='simple-ai-v28-status';
      try{
        const response=await nativeFetch(`${worker}/api/ai/summaries`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({style:'brief',ai:value,items:[{key:'test:1',type:'test',title:'三字段 AI 配置连接测试',source:'local test',year:new Date().getFullYear(),authors:[],text:'只需要返回一句简短中文摘要，用于确认接口可以正常调用。'}]})});
        const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
        status.textContent=`✓ 连接成功 · ${data.model||value.name}`;status.className='simple-ai-v28-status ok';pill.textContent='可用';pill.className='simple-ai-v28-pill ok';
      }catch(error){status.textContent=`连接失败：${error.message}`;status.className='simple-ai-v28-status fail';pill.textContent='失败';pill.className='simple-ai-v28-pill fail';}
    }

    aiSection.querySelector('[data-simple-ai-save]').addEventListener('click',()=>save(true));
    aiSection.querySelector('[data-simple-ai-test]').addEventListener('click',test);
    reveal.addEventListener('click',()=>{const show=apiInput.type==='password';apiInput.type=show?'text':'password';reveal.textContent=show?'隐藏':'显示';});
    dialog.querySelector('#saveSettings')?.addEventListener('click',()=>setTimeout(()=>save(false),0));
    load();return true;
  }

  let tries=0;const boot=()=>{if(mount())return;if(tries++<80)setTimeout(boot,100)};boot();
})();
