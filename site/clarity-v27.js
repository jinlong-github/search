(()=>{
  'use strict';
  if(document.documentElement.dataset.clarityV27==='1')return;
  document.documentElement.dataset.clarityV27='1';

  const body=document.body;
  body.classList.add('clarity-v27');

  const controlButton=document.getElementById('controlCenterBtn');
  if(controlButton){
    controlButton.textContent='系统状态';
    controlButton.setAttribute('aria-label','查看系统状态');
  }

  const dialog=document.getElementById('controlCenterDialog');
  if(dialog){
    const title=dialog.querySelector('.control-v19-head h2');
    const kicker=dialog.querySelector('.control-v19-head p');
    const desc=dialog.querySelector('.control-v19-head>div:first-child span');
    if(title)title.textContent='系统状态';
    if(kicker)kicker.textContent='运行概览';
    if(desc)desc.textContent='默认只看关键状态；模型、Token、数据源延迟和项目策略放在高级诊断里。';

    const actions=dialog.querySelector('.control-v19-head-actions');
    if(actions&&!actions.querySelector('.v27-advanced-btn')){
      const advanced=document.createElement('button');
      advanced.type='button';
      advanced.className='v27-advanced-btn';
      advanced.textContent='高级诊断';
      advanced.setAttribute('aria-expanded','false');
      advanced.addEventListener('click',()=>{
        const show=dialog.classList.toggle('v27-show-advanced');
        advanced.setAttribute('aria-expanded',String(show));
        advanced.textContent=show?'收起高级诊断':'高级诊断';
      });
      const settings=actions.querySelector('[data-control-settings]');
      if(settings)actions.insertBefore(advanced,settings);
      else actions.appendChild(advanced);
    }

    dialog.addEventListener('close',()=>{
      dialog.classList.remove('v27-show-advanced');
      const advanced=dialog.querySelector('.v27-advanced-btn');
      if(advanced){
        advanced.setAttribute('aria-expanded','false');
        advanced.textContent='高级诊断';
      }
    });
  }

  const relabelRail=()=>{
    const rail=document.querySelector('.v26-intel-rail');
    if(!rail)return;
    const panels=rail.querySelectorAll('.v26-rail-panel');
    if(panels[0]){
      const kicker=panels[0].querySelector('.v26-rail-kicker');
      const title=panels[0].querySelector('.v26-rail-title');
      if(kicker)kicker.textContent='当前研究';
      if(title)title.textContent='研究问题';
    }
    if(panels[1]){
      const kicker=panels[1].querySelector('.v26-rail-kicker');
      if(kicker)kicker.textContent='结果概览';
    }
  };

  const strip=document.querySelector('.v26-session-copy');
  if(strip){
    const first=strip.firstChild;
    if(first&&first.nodeType===Node.TEXT_NODE)first.textContent='当前研究 ';
  }

  relabelRail();
  const workspace=document.getElementById('searchWorkspace');
  if(workspace){
    const observer=new MutationObserver(relabelRail);
    observer.observe(workspace,{childList:true,subtree:true});
  }
})();
