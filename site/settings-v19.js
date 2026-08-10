(() => {
  const dialog=document.querySelector('#settingsDialog');
  if (!dialog) return;
  const configList=dialog.querySelector('.settings-config-list');
  if (configList && !configList.querySelector('[data-v19-pricing]')) {
    const block=document.createElement('div');
    block.dataset.v19Pricing='';
    block.innerHTML='<span>可选 · 输入成本估算</span><code>OPENAI_INPUT_USD_PER_1M</code><small>填写当前模型每百万输入 Token 的美元单价；不配置则控制中心只统计 Token，不估算费用。</small>';
    configList.appendChild(block);
    const output=document.createElement('div');
    output.dataset.v19Pricing='';
    output.innerHTML='<span>可选 · 输出成本估算</span><code>OPENAI_OUTPUT_USD_PER_1M</code><small>填写当前模型每百万输出 Token 的美元单价。价格变化时只改 Worker 环境变量，不需要改前端代码。</small>';
    configList.appendChild(output);
  }
  const security=dialog.querySelector('[data-settings-section="security"]');
  if (security && !security.querySelector('.settings-v19-cost-note')) {
    const note=document.createElement('div');
    note.className='settings-info-card settings-v19-cost-note';
    note.innerHTML='<strong>为什么价格不写死在网页里？</strong><p>模型价格会变化，而且不同模型、缓存与服务层的计价可能不同。系统只读取你在 Worker 中明确配置的估算单价，避免把旧价格当成事实。</p>';
    security.querySelector('.settings-security-note')?.before(note);
  }
  const footer=dialog.querySelector('.settings-center-footer');
  if (footer && !footer.querySelector('[data-open-control-center]')) {
    const button=document.createElement('button');
    button.type='button';
    button.className='ghost-btn';
    button.dataset.openControlCenter='';
    button.textContent='打开系统控制中心';
    footer.insertBefore(button,footer.firstChild);
    button.addEventListener('click',()=>{
      dialog.close();
      setTimeout(()=>document.querySelector('#controlCenterBtn')?.click(),20);
    });
  }
})();
