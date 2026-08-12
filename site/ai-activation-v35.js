(()=>{
  'use strict';

  if(document.documentElement.dataset.aiActivationV35==='1')return;
  document.documentElement.dataset.aiActivationV35='1';

  const SIMPLE_KEY='research-search:simple-ai-v28';
  const AI_KEY='research-search:ai-settings-v1';
  const WORKER_KEY='research-search:worker-url';
  const clean=value=>String(value??'').trim();
  const readJson=(key,fallback={})=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const simple=()=>({url:'',api:'',name:'',...readJson(SIMPLE_KEY,{})});
  const configured=value=>Boolean(clean(value?.url)&&clean(value?.api)&&clean(value?.name));
  const workerBase=()=>clean(localStorage.getItem(WORKER_KEY)||'').replace(/\/+$/,'');

  function normalizeRuntime(){
    const value=simple();
    if(!configured(value))return false;
    const current=readJson(AI_KEY,{});
    const next={
      ...current,
      enabled:true,
      style:current.style||'standard',
      batchSize:Number(current.batchSize)||10,
      // The simplified UI has no evidence-filter control. Let the model receive
      // title/source-only records when an upstream abstract is unavailable; the
      // Worker prompt explicitly requires stating the evidence boundary.
      onlyWithSource:false,
      requestProfile:'',requestModel:'',customPrompt:'',
      projectProfile:'',projectModel:'',projectPrompt:''
    };
    if(JSON.stringify(current)!==JSON.stringify(next))writeJson(AI_KEY,next);
    return true;
  }

  function runtimeNode(){
    let node=document.querySelector('[data-ai-runtime-status]');
    if(node)return node;
    node=document.createElement('span');
    node.className='ai-runtime-status ai-v35-runtime-status';
    node.dataset.aiRuntimeStatus='';
    const host=document.querySelector('.research-controlbar')||document.querySelector('.results-head');
    host?.appendChild(node);
    return node;
  }

  function setRuntime(text,stateName=''){
    const node=runtimeNode();
    if(!node)return;
    node.textContent=text;
    node.dataset.state=stateName;
  }

  function allItems(){
    try{
      if(typeof state==='undefined'||!state)return[];
      return [state.papers||[],state.patents||[],state.blogs||[],state.web||[]].flat().filter(Boolean);
    }catch{return[]}
  }

  function explainIfSilent(delay=520){
    setTimeout(()=>{
      const value=simple();
      if(!configured(value))return;
      const current=runtimeNode();
      if(current?.textContent?.trim())return;
      const worker=workerBase();
      if(!worker){
        setRuntime('AI 已配置，但系统服务尚未连接。打开“AI 配置”连接一次服务地址即可。','error');
        return;
      }
      const items=allItems();
      if(!items.length){
        setRuntime('AI 已就绪，正在等待可处理的搜索结果。','idle');
        return;
      }
      setRuntime(`AI 已配置 · ${value.name} · 正在等待摘要任务…`,'loading');
    },delay);
  }

  function validWorker(value){
    try{
      const url=new URL(clean(value));
      return (url.protocol==='https:'||url.hostname==='localhost'||url.hostname==='127.0.0.1')?url.href.replace(/\/+$/,''):'';
    }catch{return''}
  }

  function mountService(){
    const section=document.querySelector('[data-settings-section="ai"][data-simple-ai-v28="1"]');
    if(!section)return false;
    if(section.querySelector('[data-ai-v35-service]'))return true;

    const actions=section.querySelector('.simple-ai-v28-actions');
    if(!actions)return false;

    const block=document.createElement('div');
    block.className='ai-v35-service';
    block.dataset.aiV35Service='';
    block.innerHTML=`
      <div class="ai-v35-service-row">
        <div><span>系统服务</span><strong data-ai-v35-service-state>检查中</strong></div>
        <button type="button" data-ai-v35-service-toggle>连接</button>
      </div>
      <div class="ai-v35-service-detail" data-ai-v35-service-detail hidden>
        <label><span>Worker URL</span><input data-ai-v35-worker type="url" autocomplete="off" placeholder="https://research-search-api.xxxxx.workers.dev" /></label>
        <div class="ai-v35-service-actions"><button type="button" data-ai-v35-worker-save>保存连接</button><button type="button" data-ai-v35-worker-test>测试服务</button></div>
        <p data-ai-v35-worker-status></p>
      </div>`;
    actions.before(block);

    const note=section.querySelector('.simple-ai-v28-note');
    if(note)note.innerHTML='<strong>模型配置仍然只有三个字段。</strong> 系统服务是站点自己的转发通道，只需连接一次；如果未连接，页面现在会明确提示，不再静默失效。';

    const stateNode=block.querySelector('[data-ai-v35-service-state]');
    const toggle=block.querySelector('[data-ai-v35-service-toggle]');
    const detail=block.querySelector('[data-ai-v35-service-detail]');
    const input=block.querySelector('[data-ai-v35-worker]');
    const status=block.querySelector('[data-ai-v35-worker-status]');

    function render(expandMissing=true){
      const worker=workerBase();
      input.value=worker;
      stateNode.textContent=worker?'已连接':'未连接';
      stateNode.dataset.state=worker?'ok':'error';
      toggle.textContent=worker?'更改':'连接';
      if(!worker&&expandMissing)detail.hidden=false;
    }

    function saveWorker(show=true){
      const value=validWorker(input.value);
      if(!value){
        status.textContent='请输入有效的 Worker 基础地址。';
        status.dataset.state='error';
        return'';
      }
      localStorage.setItem(WORKER_KEY,value);
      input.value=value;
      render(false);
      if(show){status.textContent='✓ 服务地址已保存。';status.dataset.state='ok';}
      normalizeRuntime();
      window.dispatchEvent(new CustomEvent('research-ai-settings-changed'));
      explainIfSilent(700);
      return value;
    }

    async function testWorker(){
      const value=saveWorker(false);
      if(!value)return;
      status.textContent='正在检查系统服务…';status.dataset.state='loading';
      try{
        const response=await fetch(`${value}/api/status`,{headers:{Accept:'application/json'},cache:'no-store'});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
        if(data.capabilities?.simple_ai_config!==true)throw new Error('Worker 版本过旧，请重新部署当前 worker 目录');
        status.textContent='✓ 系统服务可用，支持当前三字段 AI 配置。';status.dataset.state='ok';
        stateNode.textContent='可用';stateNode.dataset.state='ok';
      }catch(error){
        status.textContent=`连接失败：${error.message}`;status.dataset.state='error';
        stateNode.textContent='异常';stateNode.dataset.state='error';
      }
    }

    toggle.addEventListener('click',()=>{detail.hidden=!detail.hidden;if(!detail.hidden)input.focus()});
    block.querySelector('[data-ai-v35-worker-save]').addEventListener('click',()=>saveWorker(true));
    block.querySelector('[data-ai-v35-worker-test]').addEventListener('click',testWorker);
    render(true);
    return true;
  }

  function wrapSearch(){
    if(document.documentElement.dataset.aiActivationV35Search==='1')return;
    if(typeof performSearch!=='function')return;
    document.documentElement.dataset.aiActivationV35Search='1';
    const previous=performSearch;
    performSearch=async function performSearchWithAiActivationV35(...args){
      normalizeRuntime();
      const node=runtimeNode();
      if(node)node.textContent='';
      const result=await previous.apply(this,args);
      explainIfSilent();
      return result;
    };
  }

  function boot(){
    normalizeRuntime();
    mountService();
    wrapSearch();
    if(configured(simple())&&!workerBase())explainIfSilent(100);
  }

  window.addEventListener('research-ai-settings-changed',()=>{
    normalizeRuntime();
    mountService();
    explainIfSilent(420);
  });
  window.addEventListener('load',boot,{once:true});
  if(document.readyState==='complete')boot();

  let attempts=0;
  const timer=setInterval(()=>{
    boot();
    if(document.querySelector('[data-ai-v35-service]')&&typeof performSearch==='function'||attempts++>80)clearInterval(timer);
  },100);
})();
