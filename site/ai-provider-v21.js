(() => {
  const dialog = document.querySelector('#settingsDialog');
  if (!dialog) return;

  const AI_KEY = 'research-search:ai-settings-v1';
  const WORKER_KEY = 'research-search:worker-url';
  const DRAFT_KEY = 'research-search:ai-provider-draft-v21';
  const DEFAULT_DRAFT = {
    provider:'OpenAI', baseUrl:'https://api.openai.com/v1', mode:'responses', path:'/responses',
    model:'gpt-5-mini', authHeader:'Authorization', authPrefix:'Bearer ', allowedModels:'',
    allowModelOverride:true, allowPromptOverride:true, defaultPrompt:''
  };
  const DEFAULT_RUNTIME = {
    enabled:false, style:'standard', batchSize:10, onlyWithSource:true,
    requestModel:'', customPrompt:'', projectModel:'', projectPrompt:''
  };

  const clean = value => String(value ?? '').trim();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const load = (key, fallback) => {
    try { return {...fallback, ...(JSON.parse(localStorage.getItem(key) || '{}') || {})}; }
    catch { return {...fallback}; }
  };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const runtime = () => load(AI_KEY, DEFAULT_RUNTIME);
  const draft = () => load(DRAFT_KEY, DEFAULT_DRAFT);
  const workerBase = () => clean(localStorage.getItem(WORKER_KEY) || '').replace(/\/+$/, '');

  const nav = dialog.querySelector('.settings-center-nav');
  const body = dialog.querySelector('.settings-center-body');
  const aiSection = dialog.querySelector('[data-settings-section="ai"]');
  const serviceSection = dialog.querySelector('[data-settings-section="service"]');
  if (!nav || !body || !aiSection) return;

  let navButton = nav.querySelector('[data-settings-jump="provider"]');
  if (!navButton) {
    navButton = document.createElement('button');
    navButton.type = 'button';
    navButton.dataset.settingsJump = 'provider';
    navButton.innerHTML = '<b>接</b><span>AI 接口</span>';
    const serviceButton = nav.querySelector('[data-settings-jump="service"]');
    if (serviceButton) nav.insertBefore(navButton, serviceButton);
    else nav.appendChild(navButton);
  }

  let section = body.querySelector('[data-settings-section="provider"]');
  if (!section) {
    section = document.createElement('section');
    section.className = 'settings-v18-section';
    section.dataset.settingsSection = 'provider';
    section.innerHTML = `
      <div class="settings-section-head">
        <div><span>AI 接口</span><h3>自定义 URL、协议、模型与提示词</h3></div>
        <i class="settings-status-pill" data-ai-v21-pill>等待检测</i>
      </div>
      <div class="settings-info-card important">
        <strong>连接参数分两层</strong>
        <p>模型名称和提示词可以在网页运行时覆盖；AI Base URL、API 路径、鉴权方式和 API Key 属于 Worker 服务端连接参数。API Key 只保存为 Worker Secret，网页不保存 Key。</p>
      </div>

      <div class="ai-v21-panel">
        <div class="ai-v21-panel-head">
          <div><span>运行时覆盖</span><h4>模型名称与全局提示词</h4><p>保存后下一次 AI 摘要请求生效。Worker 可以通过开关或模型白名单拒绝覆盖。</p></div>
          <i class="ai-v21-live" data-ai-v21-runtime>等待 Worker</i>
        </div>
        <div class="ai-v21-grid">
          <label class="ai-v21-field"><span>模型名称</span><input data-ai-v21-model type="text" autocomplete="off" placeholder="例如 gpt-5-mini / qwen3 / deepseek-chat"/><small>留空时使用 Worker 的 AI_MODEL。</small></label>
          <label class="ai-v21-field"><span>当前项目覆盖</span><input data-ai-v21-project readonly placeholder="没有项目级覆盖"/><small>项目工作区可单独设置模型和提示词，优先级高于全局配置。</small></label>
          <label class="ai-v21-field wide"><span>全局附加提示词</span><textarea data-ai-v21-prompt placeholder="例如：优先说明输入、输出、约束条件和失败边界；信息不足时明确写未说明。"></textarea><small>这是附加要求。系统固定的证据边界和 JSON 输出约束始终保留。</small></label>
        </div>
        <div class="ai-v21-actions"><button type="button" class="primary" data-ai-v21-save-runtime>保存运行时配置</button><button type="button" data-ai-v21-test>发送一次真实测试</button></div>
        <div class="ai-v21-status-grid" data-ai-v21-live-grid></div>
        <p class="ai-v21-note" data-ai-v21-test-status>测试会调用当前 Worker 的 /api/ai/summaries，可能产生少量 Token 消耗。</p>
      </div>

      <div class="ai-v21-panel">
        <div class="ai-v21-panel-head">
          <div><span>Worker 上游</span><h4>AI 服务连接草稿</h4><p>在这里整理准备部署到 Worker 的参数并生成配置清单。保存草稿不会自动修改 Cloudflare。</p></div>
          <i class="ai-v21-live" data-ai-v21-deploy-state>本机草稿</i>
        </div>
        <div class="ai-v21-grid three">
          <label class="ai-v21-field"><span>提供方名称</span><input data-ai-v21-provider placeholder="OpenAI / 自定义名称"/></label>
          <label class="ai-v21-field"><span>API 协议</span><select data-ai-v21-mode><option value="responses">Responses API</option><option value="chat-completions">Chat Completions</option></select></label>
          <label class="ai-v21-field"><span>默认模型</span><input data-ai-v21-default-model placeholder="gpt-5-mini"/></label>
          <label class="ai-v21-field wide"><span>AI Base URL</span><input data-ai-v21-base type="url" autocomplete="off" placeholder="https://api.openai.com/v1"/><small>只填写基础地址；不要把密钥放在 URL 参数中。</small></label>
          <label class="ai-v21-field"><span>API 路径</span><input data-ai-v21-path placeholder="/responses"/></label>
          <label class="ai-v21-field"><span>鉴权 Header</span><input data-ai-v21-auth-header placeholder="Authorization"/></label>
          <label class="ai-v21-field"><span>鉴权前缀</span><input data-ai-v21-auth-prefix placeholder="Bearer "/><small>如果服务使用 x-api-key，一般将前缀留空。</small></label>
          <label class="ai-v21-field wide"><span>允许网页覆盖的模型白名单</span><input data-ai-v21-allowed-models placeholder="model-a,model-b,model-c"/><small>生产环境建议填写；留空表示开启覆盖后不限制模型名称。</small></label>
          <label class="ai-v21-field wide"><span>Worker 默认附加提示词</span><textarea data-ai-v21-default-prompt placeholder="服务端默认提示词，可留空。"></textarea></label>
        </div>
        <div class="ai-v21-checks"><label><input type="checkbox" data-ai-v21-model-override/>允许网页覆盖模型</label><label><input type="checkbox" data-ai-v21-prompt-override/>允许网页 / 项目覆盖提示词</label></div>
        <div class="ai-v21-secret"><b>钥</b><p><strong>API Key</strong><br/>推荐 Secret 名称：<code>AI_API_KEY</code>；旧的 <code>OPENAI_API_KEY</code> 继续兼容。执行 <code>npx wrangler secret put AI_API_KEY</code> 后在终端中粘贴密钥。</p></div>
        <div class="ai-v21-actions"><button type="button" class="primary" data-ai-v21-save-draft>保存连接草稿</button><button type="button" data-ai-v21-from-live>从当前 Worker 读取公开配置</button></div>
        <div class="ai-v21-config"><header><span>Worker 环境变量与 Secret 配置</span><button type="button" data-ai-v21-copy>复制清单</button></header><pre data-ai-v21-config-preview></pre></div>
        <p class="ai-v21-note">Base URL 和 API 路径只由 Worker 环境变量控制，不允许浏览器在每次请求中任意指定上游地址，避免把 Worker 变成开放代理。</p>
      </div>`;
    if (serviceSection && serviceSection.parentNode === body) body.insertBefore(section, serviceSection);
    else body.appendChild(section);
  }

  const q = selector => section.querySelector(selector);
  const normalizePath = (value, mode) => {
    const text = clean(value) || (mode === 'chat-completions' ? '/chat/completions' : '/responses');
    return text.startsWith('/') ? text : `/${text}`;
  };
  function readDraftUi() {
    const mode = q('[data-ai-v21-mode]').value;
    return {
      provider:clean(q('[data-ai-v21-provider]').value) || 'OpenAI-compatible',
      baseUrl:clean(q('[data-ai-v21-base]').value).replace(/\/+$/, ''),
      mode,
      path:normalizePath(q('[data-ai-v21-path]').value, mode),
      model:clean(q('[data-ai-v21-default-model]').value) || 'gpt-5-mini',
      authHeader:clean(q('[data-ai-v21-auth-header]').value) || 'Authorization',
      authPrefix:q('[data-ai-v21-auth-prefix]').value,
      allowedModels:clean(q('[data-ai-v21-allowed-models]').value),
      allowModelOverride:q('[data-ai-v21-model-override]').checked,
      allowPromptOverride:q('[data-ai-v21-prompt-override]').checked,
      defaultPrompt:q('[data-ai-v21-default-prompt]').value.trim()
    };
  }
  function configText(d) {
    return [
      '# 1) API Key：交互式输入，不写入仓库',
      'cd worker',
      'npx wrangler secret put AI_API_KEY',
      '',
      '# 2) Cloudflare Worker 环境变量',
      `AI_PROVIDER_NAME=${d.provider}`,
      `AI_BASE_URL=${d.baseUrl}`,
      `AI_API_MODE=${d.mode}`,
      `AI_API_PATH=${d.path}`,
      `AI_MODEL=${d.model}`,
      `AI_AUTH_HEADER=${d.authHeader}`,
      `AI_AUTH_PREFIX=${d.authPrefix}`,
      `AI_ALLOW_MODEL_OVERRIDE=${d.allowModelOverride}`,
      `AI_ALLOWED_MODELS=${d.allowedModels}`,
      `AI_ALLOW_PROMPT_OVERRIDE=${d.allowPromptOverride}`,
      `AI_DEFAULT_PROMPT=${d.defaultPrompt.replace(/\n/g, '\\n')}`,
      '',
      '# 3) 部署',
      'npm run deploy'
    ].join('\n');
  }
  function renderDraft() {
    const d = draft();
    q('[data-ai-v21-provider]').value = d.provider;
    q('[data-ai-v21-base]').value = d.baseUrl;
    q('[data-ai-v21-mode]').value = d.mode;
    q('[data-ai-v21-path]').value = d.path;
    q('[data-ai-v21-default-model]').value = d.model;
    q('[data-ai-v21-auth-header]').value = d.authHeader;
    q('[data-ai-v21-auth-prefix]').value = d.authPrefix;
    q('[data-ai-v21-allowed-models]').value = d.allowedModels;
    q('[data-ai-v21-model-override]').checked = Boolean(d.allowModelOverride);
    q('[data-ai-v21-prompt-override]').checked = d.allowPromptOverride !== false;
    q('[data-ai-v21-default-prompt]').value = d.defaultPrompt || '';
    q('[data-ai-v21-config-preview]').textContent = configText(d);
  }
  function renderRuntime() {
    const a = runtime();
    q('[data-ai-v21-model]').value = a.requestModel || '';
    q('[data-ai-v21-prompt]').value = a.customPrompt || '';
    q('[data-ai-v21-project]').value = a.projectModel || a.projectPrompt ? `${a.projectModel || '默认模型'}${a.projectPrompt ? ' · 已配置项目提示词' : ''}` : '';
  }
  function saveRuntime() {
    const a = runtime();
    save(AI_KEY, {...a, requestModel:clean(q('[data-ai-v21-model]').value), customPrompt:q('[data-ai-v21-prompt]').value.trim()});
    window.dispatchEvent(new CustomEvent('research-ai-settings-changed'));
    q('[data-ai-v21-test-status]').textContent = '✓ 已保存；下一次 AI 请求生效。';
  }
  async function fetchStatus() {
    const base = workerBase();
    if (!base) throw new Error('请先配置 Worker 基础地址');
    const response = await fetch(`${base}/api/status`, {headers:{Accept:'application/json'}});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }
  function renderLive(data) {
    const ai = data?.ai || {};
    const ready = Boolean(data?.providers?.ai || data?.providers?.openai);
    const pill = q('[data-ai-v21-pill]');
    pill.textContent = ready ? 'AI 已连接' : 'AI 未配置';
    pill.className = `settings-status-pill ${ready ? 'ok' : 'warn'}`;
    const live = q('[data-ai-v21-runtime]');
    live.textContent = ready ? `${ai.provider || 'AI'} · ${ai.model || '模型未知'}` : 'Worker 未就绪';
    live.className = `ai-v21-live ${ready ? 'ok' : 'warn'}`;
    const rows = [
      ['提供方', ai.provider || '—'], ['协议', ai.protocol || '—'], ['Base URL', ai.base_url || '—'], ['API 路径', ai.api_path || '—'],
      ['服务端模型', ai.model || '—'], ['API Key', ai.key_configured ? '已配置（服务端）' : '未配置'], ['模型覆盖', ai.model_override_allowed ? '允许' : '禁止'], ['提示词覆盖', ai.prompt_override_allowed ? '允许' : '禁止']
    ];
    q('[data-ai-v21-live-grid]').innerHTML = rows.map(([name,value]) => `<article><span>${esc(name)}</span><strong>${esc(value)}</strong></article>`).join('');
    return data;
  }
  async function refreshLive() {
    try { return renderLive(await fetchStatus()); }
    catch (error) {
      const pill = q('[data-ai-v21-pill]');
      pill.textContent = '连接失败'; pill.className = 'settings-status-pill fail';
      const live = q('[data-ai-v21-runtime]'); live.textContent = error.message; live.className = 'ai-v21-live warn';
      throw error;
    }
  }
  function importLive(data) {
    const ai = data?.ai || {};
    if (!ai.base_url) return;
    const next = {
      ...draft(), provider:ai.provider || 'AI', baseUrl:ai.base_url, mode:ai.protocol || 'responses', path:ai.api_path || '/responses',
      model:ai.model || '', authHeader:ai.auth_header || 'Authorization', allowedModels:(ai.allowed_models || []).join(','),
      allowModelOverride:Boolean(ai.model_override_allowed), allowPromptOverride:ai.prompt_override_allowed !== false
    };
    save(DRAFT_KEY, next); renderDraft();
  }
  async function testAi() {
    saveRuntime();
    const base = workerBase();
    if (!base) { q('[data-ai-v21-test-status]').textContent = '测试失败：请先配置 Worker。'; return; }
    q('[data-ai-v21-test-status]').textContent = '正在发送真实 AI 测试…';
    const a = runtime();
    try {
      const response = await fetch(`${base}/api/ai/summaries`, {
        method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({style:'brief', model:a.projectModel || a.requestModel || '', prompt:[a.customPrompt,a.projectPrompt].filter(Boolean).join('\n\n'), items:[{key:'test:v21',type:'paper',title:'Research OS configurable AI provider test',source:'local test',year:2026,text:'This is a connectivity test. Do not infer any scientific result.'}]})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      q('[data-ai-v21-test-status]').textContent = `✓ 测试成功 · ${data.provider || 'AI'} · ${data.model || '模型未知'} · ${Number(data.usage?.total_tokens || 0)} Token`;
      await refreshLive();
    } catch (error) { q('[data-ai-v21-test-status]').textContent = `测试失败：${error.message}`; }
  }

  navButton.addEventListener('click', () => {
    dialog.querySelectorAll('[data-settings-jump]').forEach(node => node.classList.toggle('active', node === navButton));
    section.scrollIntoView({behavior:'smooth',block:'start'});
  });
  q('[data-ai-v21-save-runtime]').addEventListener('click', saveRuntime);
  q('[data-ai-v21-test]').addEventListener('click', testAi);
  q('[data-ai-v21-save-draft]').addEventListener('click', () => {
    const d = readDraftUi(); save(DRAFT_KEY, d); q('[data-ai-v21-config-preview]').textContent = configText(d); q('[data-ai-v21-deploy-state]').textContent = '草稿已保存';
  });
  q('[data-ai-v21-from-live]').addEventListener('click', async () => {
    try { importLive(await refreshLive()); q('[data-ai-v21-deploy-state]').textContent = '已读取 Worker'; }
    catch (error) { q('[data-ai-v21-deploy-state]').textContent = `读取失败：${error.message}`; }
  });
  q('[data-ai-v21-copy]').addEventListener('click', async event => {
    try { await navigator.clipboard.writeText(q('[data-ai-v21-config-preview]').textContent); event.currentTarget.textContent = '已复制'; setTimeout(() => event.currentTarget.textContent = '复制清单', 1200); } catch {}
  });
  q('[data-ai-v21-mode]').addEventListener('change', () => {
    const field = q('[data-ai-v21-path]');
    if (!field.value || ['/responses','/chat/completions'].includes(field.value)) field.value = q('[data-ai-v21-mode]').value === 'chat-completions' ? '/chat/completions' : '/responses';
  });
  section.addEventListener('input', () => { q('[data-ai-v21-config-preview]').textContent = configText(readDraftUi()); });
  section.addEventListener('change', () => { q('[data-ai-v21-config-preview]').textContent = configText(readDraftUi()); });
  document.addEventListener('click', event => {
    if (event.target.closest('#settingsBtn,[data-open-settings]')) setTimeout(() => { renderRuntime(); renderDraft(); refreshLive().catch(() => {}); }, 50);
  });
  window.addEventListener('research-project-changed', renderRuntime);
  window.addEventListener('research-project-updated', renderRuntime);

  const oldInfo = aiSection.querySelector('.settings-info-card.important p');
  if (oldInfo) oldInfo.textContent = '网页只调用你自己的 Worker；API Key 由 Worker Secret 保存。上游可使用 OpenAI 或兼容 Responses / Chat Completions 的 AI 服务。';
  const oldProvider = aiSection.querySelector('.settings-endpoint-card div:first-child strong');
  if (oldProvider) oldProvider.textContent = '可配置 AI 服务 · Worker 代理';

  renderRuntime(); renderDraft();
  if (workerBase()) refreshLive().catch(() => {});
})();
