(()=>{
  'use strict';

  if(document.documentElement.dataset.simpleSettingsV29==='1')return;
  document.documentElement.dataset.simpleSettingsV29='1';

  const body=document.body;
  const settingsButton=document.getElementById('settingsBtn');
  if(settingsButton)settingsButton.textContent='AI 配置';

  const hideLegacyEntryPoints=()=>{
    document.querySelectorAll('[data-open-settings]').forEach(node=>{
      node.hidden=true;
      node.setAttribute('aria-hidden','true');
    });
  };

  const mount=()=>{
    const dialog=document.querySelector('#settingsDialog.settings-center');
    const aiSection=dialog?.querySelector('[data-settings-section="ai"]');
    if(!dialog||!aiSection||aiSection.dataset.simpleAiV28!=='1')return false;
    if(dialog.querySelector('.simple-settings-v29-shell'))return true;

    body.classList.add('simple-settings-v29');

    const shell=document.createElement('div');
    shell.className='simple-settings-v29-shell';
    shell.innerHTML=`
      <div class="simple-settings-v29-header">
        <div>
          <span>AI / CONFIG</span>
          <h2>AI 配置</h2>
          <p>只需要 URL、API、Name。其余参数由系统自动处理。</p>
        </div>
        <button class="simple-settings-v29-close" type="button" aria-label="关闭">×</button>
      </div>
      <div class="simple-settings-v29-content"></div>`;

    shell.querySelector('.simple-settings-v29-content').appendChild(aiSection);
    dialog.appendChild(shell);

    const note=aiSection.querySelector('.simple-ai-v28-note');
    if(note)note.innerHTML='<strong>只保留三个配置。</strong> URL 填 OpenAI-compatible 地址，API 填密钥，Name 填模型名称。密钥只保存在当前浏览器。';

    shell.querySelector('.simple-settings-v29-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('cancel',()=>dialog.close());

    hideLegacyEntryPoints();
    return true;
  };

  let attempts=0;
  const ensure=()=>{
    if(mount())return;
    if(attempts++<100)setTimeout(ensure,80);
  };

  if(document.readyState==='complete')ensure();
  else window.addEventListener('load',ensure,{once:true});

  const observer=new MutationObserver(()=>{
    hideLegacyEntryPoints();
    if(!document.querySelector('.simple-settings-v29-shell'))ensure();
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();
