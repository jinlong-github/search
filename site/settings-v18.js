(() => {
  const dialog = document.querySelector('#settingsDialog');
  if (!dialog) return;

  const AI_KEY = 'research-search:ai-settings-v1';
  const WORKER_KEY = 'research-search:worker-url';
  const DEFAULT_AI = {enabled:false,style:'standard',batchSize:10,onlyWithSource:true};
  const load = () => {
    try { return {...DEFAULT_AI,...JSON.parse(localStorage.getItem(AI_KEY) || '{}')}; }
    catch { return {...DEFAULT_AI}; }
  };
  const save = value => localStorage.setItem(AI_KEY, JSON.stringify(value));
  const cleanBase = value => String(value || '').trim().replace(/\/+$/,'');
  const siteOrigin = location.origin;
  const siteBase = new URL('./', location.href).href.replace(/\/$/,'');
  let lastStatus = null;

  dialog.classList.add('settings-center');
  dialog.innerHTML = `
    <div class="settings-center-head">
      <div>
        <p class="dialog-kicker">系统配置</p>
        <h2>科研情报系统设置</h2>
        <p>把 AI、后端地址、搜索数据源和部署安全集中配置。敏感密钥只放在服务器端。</p>
      </div>
      <button id="closeSettings" class="icon-btn" type="button" aria-label="关闭设置">×</button>
    </div>
    <div class="settings-center-layout">
      <nav class="settings-center-nav" aria-label="设置分类">
        <button type="button" data-settings-jump="ai" class="active"><b>AI</b><span>AI 能力</span></button>
        <button type="button" data-settings-jump="service"><b>址</b><span>服务地址</span></button>
        <button type="button" data-settings-jump="sources"><b>源</b><span>搜索数据源</span></button>
        <button type="button" data-settings-jump="security"><b>安</b><span>安全与部署</span></button>
      </nav>
      <div class="settings-center-body">
        <section class="settings-v18-section" data-settings-section="ai">
          <div class="settings-section-head"><div><span>AI 能力</span><h3>AI 中文摘要增强</h3></div><i class="settings-status-pill" id="aiProviderPill">等待检测</i></div>
          <div class="settings-info-card important">
            <strong>API Key 不会保存在浏览器</strong>
            <p>网页只调用你自己的 Cloudflare Worker。请把 <code>OPENAI_API_KEY</code> 配置为 Worker Secret；公开 GitHub Pages 中不会出现密钥。</p>
          </div>
          <label class="settings-switch-row"><span><strong>启用 AI 摘要增强</strong><small>搜索完成后批量生成更自然的中文技术摘要；失败时自动保留本地摘要。</small></span><input id="aiEnabled" type="checkbox" /></label>
          <div class="settings-form-grid">
            <label><span>摘要详细度</span><select id="aiSummaryStyle"><option value="brief">精简 · 1 句</option><option value="standard">标准 · 1–2 句</option><option value="detailed">详细 · 2–3 句</option></select><small>越详细，输出越长、成本越高。</small></label>
            <label><span>单批最多处理</span><select id="aiBatchSize"><option value="6">6 条</option><option value="10">10 条</option><option value="16">16 条</option></select><small>建议 10 条；避免一次提交过多低价值结果。</small></label>
          </div>
          <label class="settings-check-row"><input id="aiOnlyWithSource" type="checkbox" /><span><strong>优先处理有原始摘要/片段的结果</strong><small>减少仅根据标题生成摘要时的推测。</small></span></label>
          <div class="settings-endpoint-card">
            <div><span>AI 提供方</span><strong>OpenAI · 服务端代理</strong></div>
            <div><span>当前模型</span><strong id="aiModelDisplay">由 Worker 决定</strong></div>
            <div><span>调用接口</span><code id="aiEndpointPreview">未配置 Worker</code></div>
            <div><span>状态</span><strong id="aiStatus">请先配置 Worker，再测试 AI。</strong></div>
          </div>
          <div class="settings-inline-actions"><button id="testAi" class="secondary-btn fit" type="button">测试 AI 配置</button></div>
        </section>

        <section class="settings-v18-section" data-settings-section="service">
          <div class="settings-section-head"><div><span>服务地址</span><h3>网站与后端代理</h3></div></div>
          <div class="settings-url-overview">
            <article><span>当前网站地址</span><code id="siteUrlPreview"></code><small>这是浏览器访问的 GitHub Pages 地址，也是 Worker CORS 应允许的来源。</small></article>
            <article><span>后端代理地址</span><code id="workerUrlPreview">未配置</code><small>Cloudflare Worker 的基础地址，不要填写具体 /api/... 路径。</small></article>
          </div>
          <label class="settings-field-wide" for="workerEndpoint"><span>Cloudflare Worker 基础地址</span><input id="workerEndpoint" class="settings-input" type="url" autocomplete="off" placeholder="https://research-search-api.xxxxx.workers.dev" /><small>正确示例：https://research-search-api.example.workers.dev</small></label>
          <div class="settings-inline-actions"><button id="testWorker" class="secondary-btn fit" type="button">测试后端连接</button><button id="clearWorker" class="ghost-btn compact" type="button">清除地址</button></div>
          <div id="workerStatus" class="key-status settings-live-status"></div>
          <div class="settings-endpoints">
            <h4>系统会使用这些接口</h4>
            <div><span>健康检查</span><code data-endpoint-path="/api/status">/api/status</code><small>检查 Worker 与各提供方是否已配置。</small></div>
            <div><span>网页搜索</span><code data-endpoint-path="/api/web">/api/web</code><small>通过 Brave Search 获取官网与 Web 结果。</small></div>
            <div><span>专利搜索</span><code data-endpoint-path="/api/patents">/api/patents</code><small>通过 PatentsView 代理专利请求。</small></div>
            <div><span>AI 摘要</span><code data-endpoint-path="/api/ai/summaries">/api/ai/summaries</code><small>服务端调用 OpenAI，前端不接触 API Key。</small></div>
          </div>
        </section>

        <section class="settings-v18-section" data-settings-section="sources">
          <div class="settings-section-head"><div><span>搜索数据源</span><h3>数据源状态与密钥</h3></div></div>
          <div class="provider-matrix">
            <article><b>论文</b><strong>Crossref</strong><span class="ok">浏览器直连</span><p>论文题录、DOI、作者、年份、引用信号。</p></article>
            <article><b>技术文章</b><strong>HN Algolia</strong><span class="ok">浏览器直连</span><p>工程与技术文章发现，不等同于完整博客索引。</p></article>
            <article><b>网页 / 官网</b><strong>Brave Search</strong><span id="braveProviderState">需 Worker</span><p>密钥配置在 Worker Secret：<code>BRAVE_SEARCH_API_KEY</code>。</p></article>
            <article><b>专利</b><strong>PatentsView</strong><span id="patentProviderState">可选</span><p>推荐在 Worker Secret 中配置 <code>PATENTSVIEW_API_KEY</code>。</p></article>
          </div>
          <div class="settings-legacy-key">
            <h4>PatentsView 浏览器直连（兼容模式）</h4>
            <p>只有在没有 Worker 时才建议使用。浏览器保存密钥的安全性低于服务端 Secret。</p>
            <label for="patentApiKey"><span>PatentsView X-Api-Key</span><input id="patentApiKey" class="settings-input" type="password" autocomplete="off" placeholder="可留空；优先配置到 Worker" /></label>
            <label class="settings-check-row compact"><input id="rememberPatentKey" type="checkbox" /><span><strong>记住在当前设备</strong><small>仅保存到浏览器本地存储。</small></span></label>
            <div id="patentKeyStatus" class="key-status"></div>
          </div>
        </section>

        <section class="settings-v18-section" data-settings-section="security">
          <div class="settings-section-head"><div><span>安全与部署</span><h3>Worker 服务器端配置清单</h3></div></div>
          <div class="settings-info-card"><strong>推荐配置方式</strong><p>使用 <code>wrangler secret put</code> 保存密钥；模型名和允许来源可使用普通环境变量。不要把真实密钥提交到 GitHub。</p></div>
          <div class="settings-config-list">
            <div><span>必需 · AI</span><code>OPENAI_API_KEY</code><small>OpenAI API Secret，仅 Worker 可见。</small></div>
            <div><span>推荐 · AI 模型</span><code>OPENAI_MODEL=gpt-5-mini</code><small>适合批量摘要这类明确任务；也可在 Worker 环境中替换。</small></div>
            <div><span>必需 · Web</span><code>BRAVE_SEARCH_API_KEY</code><small>启用站内官网 / Web 聚合。</small></div>
            <div><span>可选 · 专利</span><code>PATENTSVIEW_API_KEY</code><small>启用站内 PatentsView 专利检索。</small></div>
            <div><span>必需 · CORS</span><code id="allowedOriginsPreview"></code><small>只允许你的正式网站和必要的本地开发地址。</small></div>
          </div>
          <div class="settings-command-block"><strong>Cloudflare Worker 配置命令</strong><pre id="workerCommandPreview"></pre><button type="button" data-copy-config="commands">复制命令</button></div>
          <div class="settings-security-note">OpenAI 官方建议不要在浏览器或移动端部署 API Key，应由自己的后端代理请求；本系统按这个边界设计。</div>
        </section>
      </div>
    </div>
    <div class="settings-center-footer">
      <button id="clearPatentKey" class="ghost-btn" type="button">清除兼容密钥</button>
      <span>更改 AI 参数后，下次搜索生效。</span>
      <button id="saveSettings" class="secondary-btn fit" type="button">保存全部设置</button>
    </div>`;

  const $ = selector => dialog.querySelector(selector);
  const aiEnabled = $('#aiEnabled');
  const aiStyle = $('#aiSummaryStyle');
  const aiBatch = $('#aiBatchSize');
  const aiOnlyWithSource = $('#aiOnlyWithSource');
  const workerInput = $('#workerEndpoint');
  const workerStatus = $('#workerStatus');
  const aiStatus = $('#aiStatus');

  function currentWorker() { return cleanBase(workerInput?.value || localStorage.getItem(WORKER_KEY) || ''); }
  function renderAddresses() {
    const base = currentWorker();
    $('#siteUrlPreview').textContent = siteBase;
    $('#workerUrlPreview').textContent = base || '未配置';
    $('#aiEndpointPreview').textContent = base ? `${base}/api/ai/summaries` : '未配置 Worker';
    dialog.querySelectorAll('[data-endpoint-path]').forEach(node => { node.textContent = base ? `${base}${node.dataset.endpointPath}` : node.dataset.endpointPath; });
    $('#allowedOriginsPreview').textContent = `ALLOWED_ORIGINS=${siteOrigin}`;
    $('#workerCommandPreview').textContent = [
      'cd worker',
      'npx wrangler secret put OPENAI_API_KEY',
      'npx wrangler secret put BRAVE_SEARCH_API_KEY',
      'npx wrangler secret put PATENTSVIEW_API_KEY   # 可选',
      `# 在 Cloudflare 环境变量中设置 OPENAI_MODEL=gpt-5-mini`,
      `# 在 Cloudflare 环境变量中设置 ALLOWED_ORIGINS=${siteOrigin}`,
      'npm run deploy'
    ].join('\n');
  }

  function loadUi() {
    const config = load();
    aiEnabled.checked = Boolean(config.enabled);
    aiStyle.value = config.style || 'standard';
    aiBatch.value = String(config.batchSize || 10);
    aiOnlyWithSource.checked = config.onlyWithSource !== false;
    workerInput.value = cleanBase(localStorage.getItem(WORKER_KEY) || '');
    renderAddresses();
  }

  async function checkStatus(showMessage=true) {
    const base = currentWorker();
    renderAddresses();
    if (!base) {
      lastStatus = null;
      $('#aiProviderPill').textContent = '未连接';
      $('#aiProviderPill').className = 'settings-status-pill warn';
      $('#aiModelDisplay').textContent = '由 Worker 决定';
      $('#braveProviderState').textContent = '需 Worker';
      $('#patentProviderState').textContent = '可选';
      if (showMessage) workerStatus.textContent = '请先填写 Cloudflare Worker 基础地址。';
      return null;
    }
    try {
      const res = await fetch(`${base}/api/status`, {headers:{Accept:'application/json'}});
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      lastStatus = data;
      const providers = data.providers || {};
      $('#aiProviderPill').textContent = providers.openai ? 'AI 已就绪' : 'AI 未配置';
      $('#aiProviderPill').className = `settings-status-pill ${providers.openai ? 'ok' : 'warn'}`;
      $('#aiModelDisplay').textContent = data.ai?.model || '由 Worker 决定';
      $('#braveProviderState').textContent = providers.brave ? '已配置' : '未配置';
      $('#braveProviderState').className = providers.brave ? 'ok' : 'warn';
      $('#patentProviderState').textContent = providers.patentsview ? '已配置' : '未配置';
      $('#patentProviderState').className = providers.patentsview ? 'ok' : 'warn';
      if (showMessage) workerStatus.textContent = `✓ Worker 可用 · Web ${providers.brave?'已配置':'未配置'} · 专利 ${providers.patentsview?'已配置':'未配置'} · AI ${providers.openai?'已配置':'未配置'}`;
      aiStatus.textContent = providers.openai ? `AI 服务可用 · 模型 ${data.ai?.model || '由服务器配置'}` : 'Worker 已连接，但未配置 OPENAI_API_KEY。';
      return data;
    } catch (error) {
      lastStatus = null;
      $('#aiProviderPill').textContent = '连接失败';
      $('#aiProviderPill').className = 'settings-status-pill fail';
      if (showMessage) workerStatus.textContent = `连接失败：${error.message}`;
      aiStatus.textContent = '无法检测 AI：请先修复 Worker 地址或部署状态。';
      return null;
    }
  }

  async function testAi() {
    aiStatus.textContent = '正在检测 Worker 与 OpenAI 配置…';
    const data = await checkStatus(false);
    if (!data?.providers?.openai) {
      aiStatus.textContent = data ? '未检测到 OPENAI_API_KEY。请在 Cloudflare Worker Secret 中配置。' : 'Worker 不可用，无法测试 AI。';
      return;
    }
    aiStatus.textContent = `✓ AI 配置正常 · ${data.ai?.model || '服务器模型'}`;
  }

  function persistAi() {
    save({
      enabled:aiEnabled.checked,
      style:aiStyle.value,
      batchSize:Number(aiBatch.value) || 10,
      onlyWithSource:aiOnlyWithSource.checked
    });
    window.dispatchEvent(new CustomEvent('research-ai-settings-changed'));
  }

  dialog.querySelectorAll('[data-settings-jump]').forEach(button => button.addEventListener('click', () => {
    dialog.querySelectorAll('[data-settings-jump]').forEach(node => node.classList.toggle('active', node === button));
    dialog.querySelector(`[data-settings-section="${button.dataset.settingsJump}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  workerInput.addEventListener('input', renderAddresses);
  $('#testAi').addEventListener('click', testAi);
  $('#testWorker').addEventListener('click', () => setTimeout(() => checkStatus(true), 50));
  $('#saveSettings').addEventListener('click', persistAi);
  $('#closeSettings').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-copy-config="commands"]').addEventListener('click', async () => {
    const text = $('#workerCommandPreview').textContent;
    try { await navigator.clipboard.writeText(text); }
    catch {}
    const button = dialog.querySelector('[data-copy-config="commands"]');
    button.textContent = '已复制';
    setTimeout(() => button.textContent = '复制命令', 1200);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('#settingsBtn,[data-open-settings]')) setTimeout(() => { loadUi(); checkStatus(false); }, 0);
  });

  loadUi();
})();