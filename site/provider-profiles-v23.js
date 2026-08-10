(() => {
  const dialog=document.querySelector('#settingsDialog');
  if(!dialog)return;
  const PROFILES_KEY='research-search:ai-provider-profiles-v22';
  const WORKER_KEY='research-search:worker-url';
  const AI_KEY='research-search:ai-settings-v1';
  const clean=v=>String(v??'').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}};
  const workerBase=()=>clean(localStorage.getItem(WORKER_KEY)||'').replace(/\/+$/,'');

  const TEMPLATES=[
    {id:'openai-responses',label:'OpenAI · Responses API',note:'适合直接使用 Responses API 的服务。',profile:{provider:'OpenAI',baseUrl:'https://api.openai.com/v1',mode:'responses',path:'/responses',model:'gpt-5-mini',authHeader:'Authorization',authPrefix:'Bearer ',allowedModels:'gpt-5-mini',allowModelOverride:true,allowPromptOverride:true}},
    {id:'compatible-chat',label:'OpenAI-compatible · Chat Completions',note:'适合 Qwen、DeepSeek、内网网关等兼容 /chat/completions 的服务。请按服务商文档改 URL 和模型。',profile:{provider:'OpenAI-compatible',baseUrl:'https://api.example.com/v1',mode:'chat-completions',path:'/chat/completions',model:'your-model',authHeader:'Authorization',authPrefix:'Bearer ',allowedModels:'',allowModelOverride:true,allowPromptOverride:true}},
    {id:'x-api-key',label:'私有服务 · x-api-key',note:'适合使用 x-api-key 请求头的公司内网或自建服务。',profile:{provider:'Private AI',baseUrl:'https://ai.example.com/v1',mode:'chat-completions',path:'/chat/completions',model:'private-model',authHeader:'x-api-key',authPrefix:'',allowedModels:'',allowModelOverride:true,allowPromptOverride:true}}
  ];

  function selectedLocal(){
    const root=dialog.querySelector('[data-ai-v22-profiles]');
    if(!root)return null;
    const value=s=>clean(root.querySelector(s)?.value);
    const checked=s=>Boolean(root.querySelector(s)?.checked);
    const id=value('[data-ai-v22-id]');
    if(!id)return null;
    return {id,name:value('[data-ai-v22-name]'),provider:value('[data-ai-v22-provider]'),baseUrl:value('[data-ai-v22-base]').replace(/\/+$/,''),mode:value('[data-ai-v22-mode]'),path:value('[data-ai-v22-path]'),model:value('[data-ai-v22-model]'),keyBinding:value('[data-ai-v22-secret]'),authHeader:value('[data-ai-v22-auth-header]'),authPrefix:root.querySelector('[data-ai-v22-auth-prefix]')?.value??'',allowedModels:value('[data-ai-v22-models]'),allowModelOverride:checked('[data-ai-v22-model-override]'),allowPromptOverride:checked('[data-ai-v22-prompt-override]'),defaultPrompt:root.querySelector('[data-ai-v22-prompt]')?.value?.trim()||''};
  }
  function liveProfiles(data){
    const candidates=[data?.ai_profiles?.profiles,data?.provider_profiles?.profiles,data?.ai_profiles,data?.provider_profiles,data?.profiles,data?.ai?.profiles,data?.ai?.provider_profiles,data?.ai?.available_profiles];
    const list=candidates.find(Array.isArray)||[];
    return list.map(p=>({
      id:clean(p.id||p.profile||p.profile_id),name:clean(p.name||p.display_name||p.provider||p.id),provider:clean(p.provider||p.name),
      baseUrl:clean(p.base_url||p.baseUrl),mode:clean(p.protocol||p.mode||p.api_mode),path:clean(p.api_path||p.path),model:clean(p.model),
      keyBinding:clean(p.key_binding||p.keyBinding),authHeader:clean(p.auth_header||p.authHeader),allowedModels:Array.isArray(p.allowed_models)?p.allowed_models.join(','):clean(p.allowed_models||p.allowedModels),
      allowModelOverride:p.model_override_allowed??p.allowModelOverride,allowPromptOverride:p.prompt_override_allowed??p.allowPromptOverride,
      defaultPromptConfigured:Boolean(p.default_prompt_configured??p.defaultPromptConfigured),keyConfigured:Boolean(p.key_configured??p.keyConfigured)
    })).filter(p=>p.id);
  }
  function same(a,b){return clean(a)===clean(b)}
  function boolText(v){return v===undefined||v===null?'未公开':v?'允许':'禁止'}
  function listText(v){return clean(v).split(',').map(clean).filter(Boolean).sort().join(', ')}

  function fillTemplate(template){
    const root=dialog.querySelector('[data-ai-v22-profiles]');
    if(!root)return;
    const p=template.profile;
    const set=(s,v)=>{const el=root.querySelector(s);if(el)el.value=v};
    set('[data-ai-v22-provider]',p.provider);set('[data-ai-v22-base]',p.baseUrl);set('[data-ai-v22-mode]',p.mode);set('[data-ai-v22-path]',p.path);set('[data-ai-v22-model]',p.model);set('[data-ai-v22-auth-header]',p.authHeader);set('[data-ai-v22-auth-prefix]',p.authPrefix);set('[data-ai-v22-models]',p.allowedModels);
    const mo=root.querySelector('[data-ai-v22-model-override]');if(mo)mo.checked=p.allowModelOverride;
    const po=root.querySelector('[data-ai-v22-prompt-override]');if(po)po.checked=p.allowPromptOverride;
    root.querySelectorAll('input,select,textarea').forEach(el=>el.dispatchEvent(new Event('input',{bubbles:true})));
  }

  async function fetchStatus(){
    const base=workerBase();
    if(!base)throw new Error('请先在“服务地址”中配置 Worker 基础地址');
    const started=performance.now();
    const res=await fetch(`${base}/api/status`,{headers:{Accept:'application/json'}});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Worker 状态请求失败 (${res.status})`);
    return {data,latency:Math.round(performance.now()-started)};
  }

  let lastLive=[];
  let lastStatus=null;
  function diffRows(local,live){
    const rows=[
      ['提供方',local.provider,live?.provider],['Base URL',local.baseUrl,live?.baseUrl],['协议',local.mode,live?.mode],['API 路径',local.path,live?.path],['默认模型',local.model,live?.model],['鉴权 Header',local.authHeader,live?.authHeader],['模型白名单',listText(local.allowedModels),listText(live?.allowedModels)],['模型覆盖',boolText(local.allowModelOverride),boolText(live?.allowModelOverride)],['提示词覆盖',boolText(local.allowPromptOverride),boolText(live?.allowPromptOverride)]
    ];
    return rows.map(([name,a,b])=>{
      const unknown=!live||b===''||b===undefined||b===null||b==='未公开';
      const ok=!unknown&&same(a,b);
      return `<div class="ai-v23-diff-row"><span>${esc(name)}</span><code>${esc(a||'—')}</code><code>${esc(unknown?'未公开 / 未部署':b)}</code><strong class="${unknown?'unknown':ok?'same':'changed'}">${unknown?'待确认':ok?'一致':'有差异'}</strong></div>`;
    }).join('');
  }
  function renderDiff(message=''){
    const tools=dialog.querySelector('[data-ai-v23-tools]');if(!tools)return;
    const local=selectedLocal();
    const live=local?lastLive.find(p=>p.id===local.id):null;
    const state=tools.querySelector('[data-ai-v23-diff-state]');
    const box=tools.querySelector('[data-ai-v23-diff]');
    if(!local){state.textContent='没有本地档案';state.className='ai-v23-state warn';box.innerHTML='';return}
    const deployed=Boolean(live);
    const changed=deployed&&['provider','baseUrl','mode','path','model','authHeader'].some(key=>live[key]&&!same(local[key],live[key]));
    state.textContent=!deployed?'尚未部署':changed?'存在差异':'核心配置一致';state.className=`ai-v23-state ${!deployed||changed?'warn':'ok'}`;
    box.innerHTML='<div class="ai-v23-diff-row head"><span>配置项</span><span>本地草稿</span><span>Worker 已部署</span><span>状态</span></div>'+diffRows(local,live);
    const summary=tools.querySelector('[data-ai-v23-deploy-summary]');
    const keyText=live?(live.keyConfigured?'Secret 已配置':'Secret 状态未知/未配置'):'未找到同 ID 档案';
    summary.innerHTML=`<i>Profile：${esc(local.id)}</i><i>${esc(keyText)}</i>${lastStatus?'<i>Worker 状态已同步</i>':''}`;
    const note=tools.querySelector('[data-ai-v23-diff-note]');if(note)note.textContent=message||'差异比较只使用 Worker 公开状态，不读取 API Key，也不读取服务端提示词正文。';
  }

  async function syncAndDiff(){
    const tools=dialog.querySelector('[data-ai-v23-tools]');
    const state=tools?.querySelector('[data-ai-v23-diff-state]');
    if(state){state.textContent='同步中…';state.className='ai-v23-state'}
    try{
      const {data,latency}=await fetchStatus();lastStatus=data;lastLive=liveProfiles(data);renderDiff(`已同步 Worker · ${latency} ms · ${lastLive.length} 个公开档案。`);
    }catch(error){lastStatus=null;lastLive=[];renderDiff(error.message);if(state){state.textContent='同步失败';state.className='ai-v23-state fail'}}
  }

  async function testCurrent(){
    const tools=dialog.querySelector('[data-ai-v23-tools]');const out=tools?.querySelector('[data-ai-v23-test-result]');const local=selectedLocal();
    if(!out||!local)return;
    const base=workerBase();if(!base){out.textContent='请先配置 Worker 基础地址。';out.className='ai-v23-test-result fail';return}
    if(lastStatus&&!lastLive.some(p=>p.id===local.id)){out.textContent=`档案 ${local.id} 还没有部署到当前 Worker。先复制配置并部署，再测试。`;out.className='ai-v23-test-result fail';return}
    out.textContent=`正在通过 Worker 测试 ${local.id}…`;out.className='ai-v23-test-result';
    const started=performance.now();
    try{
      const res=await fetch(`${base}/api/ai/summaries`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({profile:local.id,style:'brief',items:[{key:'provider-profile-test',type:'test',title:'Provider Profile connection test',source:'Research OS',year:new Date().getFullYear(),authors:[],text:'This is a connectivity test. Summarize only that the AI provider profile connection succeeded.'}]})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Object.assign(new Error(data.error||`AI 测试失败 (${res.status})`),{data});
      const ms=Math.round(performance.now()-started);const total=Number(data.usage?.total_tokens||0);
      out.textContent=`✓ 测试成功 · ${data.provider||'AI'} · ${data.model||local.model||'默认模型'} · ${ms} ms${total?` · ${total} Token`:''}`;out.className='ai-v23-test-result ok';
    }catch(error){out.textContent=`测试失败：${error.message}`;out.className='ai-v23-test-result fail'}
  }

  function inject(){
    const panel=dialog.querySelector('[data-ai-v22-profiles]');if(!panel||panel.querySelector('[data-ai-v23-tools]'))return false;
    const tools=document.createElement('section');tools.className='ai-v23-tools';tools.dataset.aiV23Tools='';
    tools.innerHTML=`<div class="ai-v23-tools-head"><div><span>快速配置与部署诊断</span><h5>模板、部署差异与真实连通测试</h5><p>先用模板减少重复填写，再比较本地草稿与 Worker 已部署档案；最后用当前 Profile 发起一条最小真实 AI 请求。</p></div><div class="ai-v23-deploy-summary" data-ai-v23-deploy-summary></div></div>
      <div class="ai-v23-template-row"><label><span>Provider 模板</span><select data-ai-v23-template>${TEMPLATES.map(t=>`<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('')}</select><small class="ai-v23-template-note" data-ai-v23-template-note></small></label><button type="button" class="primary" data-ai-v23-apply-template>套用到当前草稿</button></div>
      <div class="ai-v23-block"><div class="ai-v23-block-head"><div><span>部署差异</span><h5>本地草稿 vs Worker 已部署</h5></div><i class="ai-v23-state" data-ai-v23-diff-state>尚未同步</i></div><div class="ai-v23-diff" data-ai-v23-diff></div><div class="ai-v23-actions"><button type="button" data-ai-v23-sync>刷新 Worker 状态</button><button type="button" class="primary" data-ai-v23-test>测试当前 Profile</button></div><div class="ai-v23-test-result" data-ai-v23-test-result>测试会产生少量 Token 消耗，并使用 Worker 中已部署的 Secret。</div><p class="ai-v23-mini" data-ai-v23-diff-note>差异比较只使用 Worker 公开状态，不读取 API Key，也不读取服务端提示词正文。</p></div>`;
    const head=panel.querySelector('.ai-v21-panel-head');if(head)head.insertAdjacentElement('afterend',tools);else panel.prepend(tools);
    const template=tools.querySelector('[data-ai-v23-template]');const note=tools.querySelector('[data-ai-v23-template-note]');
    const renderTemplateNote=()=>{note.textContent=TEMPLATES.find(t=>t.id===template.value)?.note||''};renderTemplateNote();template.addEventListener('change',renderTemplateNote);
    tools.querySelector('[data-ai-v23-apply-template]').addEventListener('click',()=>{const t=TEMPLATES.find(x=>x.id===template.value);if(t){fillTemplate(t);renderDiff('模板已套用到当前表单；确认 Profile ID、URL、模型和 Secret 绑定名后再保存。')}});
    tools.querySelector('[data-ai-v23-sync]').addEventListener('click',syncAndDiff);tools.querySelector('[data-ai-v23-test]').addEventListener('click',testCurrent);
    panel.addEventListener('input',()=>setTimeout(()=>renderDiff(),20));panel.addEventListener('change',()=>setTimeout(()=>renderDiff(),20));
    renderDiff();setTimeout(syncAndDiff,250);return true;
  }
  [80,240,700,1400].forEach(delay=>setTimeout(inject,delay));
  dialog.addEventListener('toggle',()=>{if(dialog.open){setTimeout(inject,20);setTimeout(syncAndDiff,350)}});
  window.addEventListener('research-provider-profiles-changed',()=>setTimeout(()=>{inject();renderDiff()},30));
})();
