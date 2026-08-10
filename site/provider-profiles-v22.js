(() => {
  const dialog=document.querySelector('#settingsDialog');
  if(!dialog) return;
  const AI_KEY='research-search:ai-settings-v1';
  const WORKER_KEY='research-search:worker-url';
  const PROFILES_KEY='research-search:ai-provider-profiles-v22';
  const LEGACY_DRAFT_KEY='research-search:ai-provider-draft-v21';
  const clean=value=>String(value??'').trim();
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const loadJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}};
  const saveJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const slug=value=>clean(value).toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64)||'profile';
  const secretFor=id=>`AI_KEY_${slug(id).toUpperCase().replace(/[^A-Z0-9]+/g,'_')}`.slice(0,80);
  const runtime=()=>loadJson(AI_KEY,{});
  const saveRuntime=patch=>{saveJson(AI_KEY,{...runtime(),...patch});window.dispatchEvent(new CustomEvent('research-ai-settings-changed'))};
  const workerBase=()=>clean(localStorage.getItem(WORKER_KEY)||'').replace(/\/+$/,'');

  function migrate(){
    const existing=loadJson(PROFILES_KEY,null);
    if(existing?.profiles?.length) return existing;
    const legacy=loadJson(LEGACY_DRAFT_KEY,null);
    const profile={
      id:'primary',name:clean(legacy?.provider)||'Primary AI',provider:clean(legacy?.provider)||'OpenAI',
      baseUrl:clean(legacy?.baseUrl)||'https://api.openai.com/v1',mode:legacy?.mode==='chat-completions'?'chat-completions':'responses',
      path:clean(legacy?.path)||'/responses',model:clean(legacy?.model)||'gpt-5-mini',keyBinding:'AI_API_KEY',
      authHeader:clean(legacy?.authHeader)||'Authorization',authPrefix:legacy?.authPrefix===undefined?'Bearer ':String(legacy.authPrefix),
      allowedModels:clean(legacy?.allowedModels),allowModelOverride:legacy?.allowModelOverride!==false,
      allowPromptOverride:legacy?.allowPromptOverride!==false,defaultPrompt:String(legacy?.defaultPrompt||'').trim(),inputUsdPer1M:'',outputUsdPer1M:''
    };
    const data={version:1,defaultId:'primary',allowProfileOverride:true,profiles:[profile]};
    saveJson(PROFILES_KEY,data);return data;
  }
  const data=()=>{
    const value=loadJson(PROFILES_KEY,migrate());
    return {version:1,defaultId:value.defaultId||value.profiles?.[0]?.id||'',allowProfileOverride:value.allowProfileOverride!==false,profiles:Array.isArray(value.profiles)?value.profiles:[]};
  };
  const saveData=value=>{saveJson(PROFILES_KEY,value);window.dispatchEvent(new CustomEvent('research-provider-profiles-changed',{detail:value}))};

  const providerSection=dialog.querySelector('[data-settings-section="provider"]');
  if(!providerSection) return;
  const firstPanel=providerSection.querySelector('.ai-v21-panel');
  if(!firstPanel) return;

  const runtimeGrid=firstPanel.querySelector('.ai-v21-grid');
  if(runtimeGrid&&!runtimeGrid.querySelector('[data-ai-v22-runtime-profile]')){
    const field=document.createElement('label');
    field.className='ai-v21-field ai-v22-profile-runtime';
    field.innerHTML='<span>Provider Profile</span><select data-ai-v22-runtime-profile><option value="">继承 Worker 默认档案</option></select><small data-ai-v22-runtime-note>档案选择只传 profile ID，不会把 URL 或密钥发给浏览器。</small>';
    runtimeGrid.insertBefore(field,runtimeGrid.firstChild);
  }

  let panel=providerSection.querySelector('[data-ai-v22-profiles]');
  if(!panel){
    panel=document.createElement('div');
    panel.className='ai-v21-panel ai-v22-panel';
    panel.dataset.aiV22Profiles='';
    panel.innerHTML=`
      <div class="ai-v21-panel-head">
        <div><span>Provider Profiles</span><h4>多 AI 服务档案</h4><p>一个 Worker 可配置多套上游。项目和全局运行时只绑定档案 ID；URL、协议、默认模型与 Secret 映射全部由 Worker 控制。</p></div>
        <i class="ai-v21-live" data-ai-v22-live>等待 Worker</i>
      </div>
      <div class="ai-v22-toolbar">
        <label><span>编辑档案</span><select data-ai-v22-profile-list></select></label>
        <button type="button" data-ai-v22-new>新建</button><button type="button" data-ai-v22-duplicate>复制</button><button type="button" data-ai-v22-delete>删除</button>
      </div>
      <div class="ai-v21-grid three ai-v22-editor">
        <label class="ai-v21-field"><span>Profile ID</span><input data-ai-v22-id autocomplete="off" placeholder="openai"/><small>请求和项目只保存这个稳定 ID。</small></label>
        <label class="ai-v21-field"><span>显示名称</span><input data-ai-v22-name placeholder="OpenAI Research"/></label>
        <label class="ai-v21-field"><span>提供方</span><input data-ai-v22-provider placeholder="OpenAI / Qwen / 内网模型"/></label>
        <label class="ai-v21-field wide"><span>Base URL</span><input data-ai-v22-base type="url" autocomplete="off" placeholder="https://api.openai.com/v1"/></label>
        <label class="ai-v21-field"><span>协议</span><select data-ai-v22-mode><option value="responses">Responses API</option><option value="chat-completions">Chat Completions</option></select></label>
        <label class="ai-v21-field"><span>API 路径</span><input data-ai-v22-path placeholder="/responses"/></label>
        <label class="ai-v21-field"><span>默认模型</span><input data-ai-v22-model placeholder="gpt-5-mini"/></label>
        <label class="ai-v21-field"><span>Secret 绑定名</span><input data-ai-v22-secret autocomplete="off" placeholder="AI_KEY_OPENAI"/><small>这里只保存变量名，不保存真实 Key。</small></label>
        <label class="ai-v21-field"><span>鉴权 Header</span><input data-ai-v22-auth-header placeholder="Authorization"/></label>
        <label class="ai-v21-field"><span>鉴权前缀</span><input data-ai-v22-auth-prefix placeholder="Bearer "/></label>
        <label class="ai-v21-field wide"><span>允许覆盖的模型</span><input data-ai-v22-models placeholder="gpt-5-mini,gpt-5"/></label>
        <label class="ai-v21-field"><span>输入价格 / 1M Token</span><input data-ai-v22-input-price inputmode="decimal" placeholder="可选"/></label>
        <label class="ai-v21-field"><span>输出价格 / 1M Token</span><input data-ai-v22-output-price inputmode="decimal" placeholder="可选"/></label>
        <label class="ai-v21-field wide"><span>档案默认提示词</span><textarea data-ai-v22-prompt placeholder="该 Provider 的服务端默认研究要求，可留空。"></textarea></label>
      </div>
      <div class="ai-v21-checks"><label><input type="checkbox" data-ai-v22-model-override/>允许该档案覆盖模型</label><label><input type="checkbox" data-ai-v22-prompt-override/>允许该档案附加提示词</label></div>
      <div class="ai-v22-defaults"><label><span>Worker 默认档案</span><select data-ai-v22-default></select></label><label class="ai-v22-switch"><input type="checkbox" data-ai-v22-profile-override/><span>允许网页 / 项目切换 Provider Profile</span></label></div>
      <div class="ai-v21-actions"><button type="button" class="primary" data-ai-v22-save>保存档案</button><button type="button" data-ai-v22-import-live>同步 Worker 公开档案</button></div>
      <div class="ai-v21-config"><header><span>多 Provider Worker 配置</span><button type="button" data-ai-v22-copy>复制清单</button></header><pre data-ai-v22-config></pre></div>
      <p class="ai-v21-note" data-ai-v22-status>AI_PROFILES_JSON 不包含密钥。每个档案通过 keyBinding 指向一个 Worker Secret。</p>`;
    const panels=providerSection.querySelectorAll('.ai-v21-panel');
    const second=panels[1];
    if(second) providerSection.insertBefore(panel,second); else providerSection.appendChild(panel);
  }

  const q=selector=>providerSection.querySelector(selector);
  let selectedId='';
  let liveProfiles=[];
  let liveDefault='';

  function normalizedProfile(raw){
    const id=slug(raw.id);
    const mode=raw.mode==='chat-completions'?'chat-completions':'responses';
    const path=clean(raw.path)||(mode==='chat-completions'?'/chat/completions':'/responses');
    return {
      id,name:clean(raw.name)||id,provider:clean(raw.provider)||clean(raw.name)||id,baseUrl:clean(raw.baseUrl).replace(/\/+$/,''),mode,path:path.startsWith('/')?path:`/${path}`,
      model:clean(raw.model)||'gpt-5-mini',keyBinding:clean(raw.keyBinding)||secretFor(id),authHeader:clean(raw.authHeader)||'Authorization',authPrefix:String(raw.authPrefix??'Bearer '),
      allowedModels:clean(raw.allowedModels),allowModelOverride:raw.allowModelOverride!==false,allowPromptOverride:raw.allowPromptOverride!==false,
      defaultPrompt:String(raw.defaultPrompt||'').trim().slice(0,6000),inputUsdPer1M:clean(raw.inputUsdPer1M),outputUsdPer1M:clean(raw.outputUsdPer1M)
    };
  }
  function currentForm(){
    return normalizedProfile({
      id:q('[data-ai-v22-id]').value,name:q('[data-ai-v22-name]').value,provider:q('[data-ai-v22-provider]').value,baseUrl:q('[data-ai-v22-base]').value,
      mode:q('[data-ai-v22-mode]').value,path:q('[data-ai-v22-path]').value,model:q('[data-ai-v22-model]').value,keyBinding:q('[data-ai-v22-secret]').value,
      authHeader:q('[data-ai-v22-auth-header]').value,authPrefix:q('[data-ai-v22-auth-prefix]').value,allowedModels:q('[data-ai-v22-models]').value,
      allowModelOverride:q('[data-ai-v22-model-override]').checked,allowPromptOverride:q('[data-ai-v22-prompt-override]').checked,defaultPrompt:q('[data-ai-v22-prompt]').value,
      inputUsdPer1M:q('[data-ai-v22-input-price]').value,outputUsdPer1M:q('[data-ai-v22-output-price]').value
    });
  }
  function fillForm(profile){
    const p=normalizedProfile(profile||{});selectedId=p.id;
    q('[data-ai-v22-id]').value=p.id;q('[data-ai-v22-name]').value=p.name;q('[data-ai-v22-provider]').value=p.provider;q('[data-ai-v22-base]').value=p.baseUrl;
    q('[data-ai-v22-mode]').value=p.mode;q('[data-ai-v22-path]').value=p.path;q('[data-ai-v22-model]').value=p.model;q('[data-ai-v22-secret]').value=p.keyBinding;
    q('[data-ai-v22-auth-header]').value=p.authHeader;q('[data-ai-v22-auth-prefix]').value=p.authPrefix;q('[data-ai-v22-models]').value=p.allowedModels;
    q('[data-ai-v22-model-override]').checked=p.allowModelOverride;q('[data-ai-v22-prompt-override]').checked=p.allowPromptOverride;q('[data-ai-v22-prompt]').value=p.defaultPrompt;
    q('[data-ai-v22-input-price]').value=p.inputUsdPer1M;q('[data-ai-v22-output-price]').value=p.outputUsdPer1M;
  }
  function configObject(profile){
    const p=normalizedProfile(profile);
    const result={id:p.id,name:p.name,provider:p.provider,baseUrl:p.baseUrl,mode:p.mode,path:p.path,model:p.model,keyBinding:p.keyBinding,authHeader:p.authHeader,authPrefix:p.authPrefix,
      allowedModels:p.allowedModels.split(',').map(clean).filter(Boolean),allowModelOverride:p.allowModelOverride,allowPromptOverride:p.allowPromptOverride,defaultPrompt:p.defaultPrompt};
    if(p.inputUsdPer1M!=='')result.inputUsdPer1M=Number(p.inputUsdPer1M);
    if(p.outputUsdPer1M!=='')result.outputUsdPer1M=Number(p.outputUsdPer1M);
    return result;
  }
  function configText(){
    const d=data();
    const profiles=d.profiles.map(configObject);
    const secrets=[...new Set(profiles.map(p=>p.keyBinding).filter(Boolean))];
    return [
      '# Provider Profiles：公开配置，不包含 API Key',
      `AI_DEFAULT_PROFILE=${d.defaultId||profiles[0]?.id||''}`,
      `AI_ALLOW_PROFILE_OVERRIDE=${d.allowProfileOverride}`,
      `AI_PROFILES_JSON=${JSON.stringify(profiles)}`,
      '',
      '# 每个档案的 API Key 单独写入 Worker Secret',
      ...secrets.map(name=>`npx wrangler secret put ${name}`),
      '',
      '# 然后部署',
      'npm run deploy'
    ].join('\n');
  }
  function optionSets(){
    const d=data();
    const list=q('[data-ai-v22-profile-list]');
    list.innerHTML=d.profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.id)} · ${esc(p.id)}</option>`).join('');
    const def=q('[data-ai-v22-default]');def.innerHTML=d.profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.id)} · ${esc(p.id)}</option>`).join('');
    def.value=d.defaultId||d.profiles[0]?.id||'';q('[data-ai-v22-profile-override]').checked=d.allowProfileOverride!==false;
    const runtimeSelect=q('[data-ai-v22-runtime-profile]');
    if(runtimeSelect){
      const active=runtime().requestProfile||'';
      const merged=new Map();liveProfiles.forEach(p=>merged.set(p.id,{...p,live:true}));d.profiles.forEach(p=>{if(!merged.has(p.id))merged.set(p.id,{...p,live:false})});
      runtimeSelect.innerHTML='<option value="">继承 Worker 默认档案</option>'+[...merged.values()].map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.provider||p.id)} · ${esc(p.id)}${p.live?'':' · 草稿'}</option>`).join('');
      runtimeSelect.value=active;
      if(active&&!merged.has(active)){const opt=document.createElement('option');opt.value=active;opt.textContent=`${active} · 当前绑定`;runtimeSelect.appendChild(opt);runtimeSelect.value=active}
    }
    q('[data-ai-v22-config]').textContent=configText();
  }
  function render(){
    const d=data();if(!d.profiles.length){d.profiles=[normalizedProfile({id:'primary',name:'Primary AI',provider:'OpenAI',baseUrl:'https://api.openai.com/v1'})];d.defaultId='primary';saveData(d)}
    optionSets();const target=d.profiles.find(p=>p.id===selectedId)||d.profiles[0];fillForm(target);q('[data-ai-v22-profile-list]').value=target.id;
  }
  function saveProfile(){
    const d=data();const next=currentForm();
    if(!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(next.id)){q('[data-ai-v22-status]').textContent='Profile ID 只能使用字母、数字、点、下划线和短横线。';return}
    if(!next.baseUrl){q('[data-ai-v22-status]').textContent='请填写 Base URL。';return}
    const clash=d.profiles.find(p=>p.id===next.id&&p.id!==selectedId);if(clash){q('[data-ai-v22-status]').textContent=`Profile ID ${next.id} 已存在。`;return}
    const index=d.profiles.findIndex(p=>p.id===selectedId);if(index>=0)d.profiles[index]=next;else d.profiles.push(next);
    if(d.defaultId===selectedId||!d.defaultId)d.defaultId=next.id;
    selectedId=next.id;saveData(d);render();q('[data-ai-v22-status]').textContent=`✓ 已保存 ${next.name}；复制下方清单部署到 Worker 后即可使用。`;
  }
  async function refreshLive(){
    const base=workerBase();if(!base){q('[data-ai-v22-live]').textContent='未配置 Worker';return}
    try{
      const response=await fetch(`${base}/api/status`,{headers:{Accept:'application/json'}});const status=await response.json().catch(()=>({}));if(!response.ok)throw new Error(status.error||`HTTP ${response.status}`);
      liveProfiles=Array.isArray(status.ai_profiles?.profiles)?status.ai_profiles.profiles:[];liveDefault=status.ai_profiles?.default_profile||'';
      const node=q('[data-ai-v22-live]');node.textContent=status.ai_profiles?.enabled?`${liveProfiles.length} 个已部署档案 · 默认 ${liveDefault}`:'Worker 仍使用单 Provider';node.className=`ai-v21-live ${status.ai_profiles?.enabled?'ok':'warn'}`;
      q('[data-ai-v22-runtime-note]').textContent=status.ai_profiles?.enabled?`Worker 已部署 ${liveProfiles.length} 个档案；默认 ${liveDefault}。`:'当前 Worker 尚未启用 AI_PROFILES_JSON，运行时会继续走单 Provider 配置。';optionSets();
      return status;
    }catch(error){q('[data-ai-v22-live]').textContent='Worker 检测失败';q('[data-ai-v22-status]').textContent=`Worker 状态读取失败：${error.message}`}
  }
  function importLive(){
    if(!liveProfiles.length){q('[data-ai-v22-status]').textContent='当前 Worker 没有公开 Provider Profiles 可同步。';return}
    const d=data();const map=new Map(d.profiles.map(p=>[p.id,p]));
    liveProfiles.forEach(p=>map.set(p.id,normalizedProfile({...map.get(p.id),id:p.id,name:p.name||p.provider||p.id,provider:p.provider,baseUrl:p.base_url,mode:p.protocol,path:p.api_path,model:p.model,keyBinding:p.key_binding,authHeader:p.auth_header,allowedModels:(p.allowed_models||[]).join(','),allowModelOverride:p.model_override_allowed,allowPromptOverride:p.prompt_override_allowed})));
    d.profiles=[...map.values()];if(liveDefault)d.defaultId=liveDefault;saveData(d);render();q('[data-ai-v22-status]').textContent=`✓ 已同步 ${liveProfiles.length} 个 Worker 公开档案；Secret 和默认提示词正文不会从服务器返回。`;
  }

  providerSection.addEventListener('click',event=>{
    if(event.target.closest('[data-ai-v22-save]'))saveProfile();
    if(event.target.closest('[data-ai-v22-new]')){const d=data();let i=d.profiles.length+1,id=`profile-${i}`;while(d.profiles.some(p=>p.id===id)){i+=1;id=`profile-${i}`}selectedId=id;fillForm({id,name:`Provider ${i}`,provider:'OpenAI-compatible',baseUrl:'https://api.example.com/v1',mode:'chat-completions',path:'/chat/completions',model:'model-name',keyBinding:secretFor(id),allowModelOverride:true,allowPromptOverride:true});q('[data-ai-v22-status]').textContent='填写后点击“保存档案”。'}
    if(event.target.closest('[data-ai-v22-duplicate]')){const source=currentForm();let id=`${source.id}-copy`,i=2;const d=data();while(d.profiles.some(p=>p.id===id)){id=`${source.id}-copy-${i++}`}selectedId=id;fillForm({...source,id,name:`${source.name} Copy`,keyBinding:secretFor(id)});q('[data-ai-v22-status]').textContent='已复制为新草稿，保存后生效。'}
    if(event.target.closest('[data-ai-v22-delete]')){const d=data();if(d.profiles.length<=1){q('[data-ai-v22-status]').textContent='至少保留一个 Provider Profile。';return}d.profiles=d.profiles.filter(p=>p.id!==selectedId);if(d.defaultId===selectedId)d.defaultId=d.profiles[0].id;selectedId=d.profiles[0].id;saveData(d);render();q('[data-ai-v22-status]').textContent='已删除本地档案草稿。'}
    if(event.target.closest('[data-ai-v22-import-live]'))importLive();
    if(event.target.closest('[data-ai-v22-copy]')){const text=configText();navigator.clipboard?.writeText(text).then(()=>{q('[data-ai-v22-status]').textContent='✓ 已复制 Provider Profiles 配置清单。'}).catch(()=>{q('[data-ai-v22-status]').textContent='复制失败，请直接选中配置文本复制。'})}
    if(event.target.closest('[data-ai-v21-save-runtime]')){const select=q('[data-ai-v22-runtime-profile]');if(select)saveRuntime({requestProfile:select.value});}
  });
  providerSection.addEventListener('change',event=>{
    if(event.target.matches('[data-ai-v22-profile-list]')){selectedId=event.target.value;const p=data().profiles.find(item=>item.id===selectedId);if(p)fillForm(p)}
    if(event.target.matches('[data-ai-v22-default]')){const d=data();d.defaultId=event.target.value;saveData(d);optionSets()}
    if(event.target.matches('[data-ai-v22-profile-override]')){const d=data();d.allowProfileOverride=event.target.checked;saveData(d);optionSets()}
    if(event.target.matches('[data-ai-v22-mode]')){const path=q('[data-ai-v22-path]');if(!clean(path.value)||['/responses','/chat/completions'].includes(clean(path.value)))path.value=event.target.value==='chat-completions'?'/chat/completions':'/responses'}
    if(event.target.matches('[data-ai-v22-runtime-profile]'))saveRuntime({requestProfile:event.target.value});
  });
  document.addEventListener('click',event=>{if(event.target.closest('#settingsBtn,[data-open-settings]'))setTimeout(()=>{render();refreshLive()},80)});
  window.addEventListener('research-ai-settings-changed',()=>optionSets());
  window.addEventListener('research-provider-profiles-changed',()=>optionSets());
  migrate();render();[120,600].forEach(delay=>setTimeout(refreshLive,delay));
  window.ResearchProviderProfiles={list:()=>data().profiles.map(p=>({...p})),settings:()=>({...data()}),live:()=>liveProfiles.map(p=>({...p})),refresh:refreshLive};
})();
