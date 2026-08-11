(()=>{
  'use strict';
  const start=()=>{
    const body=document.body;
    if(!body)return;

    const topActions=document.querySelector('.top-actions');
    const desktop=window.matchMedia('(min-width: 821px)');
    const syncTopActions=()=>{
      if(!topActions)return;
      if(desktop.matches)topActions.style.setProperty('display','none','important');
      else topActions.style.removeProperty('display');
    };
    syncTopActions();
    if(desktop.addEventListener)desktop.addEventListener('change',syncTopActions);
    else desktop.addListener?.(syncTopActions);

    const dialog=document.querySelector('#settingsDialog');
    let fitQueued=false;
    const fitDialog=()=>{
      fitQueued=false;
      if(!dialog)return;
      const compact='min(480px, calc(100vh - 32px))';
      dialog.style.setProperty('height',compact,'important');
      dialog.style.setProperty('block-size',compact,'important');
      dialog.style.setProperty('min-height','0','important');
      dialog.style.setProperty('min-block-size','0','important');
      dialog.style.setProperty('max-height',compact,'important');
      dialog.style.setProperty('max-block-size',compact,'important');
      dialog.style.setProperty('grid-template-rows','none','important');
      const shell=dialog.querySelector('.simple-settings-v29-shell');
      if(shell){
        shell.style.setProperty('height','100%','important');
        shell.style.setProperty('block-size','100%','important');
        shell.style.setProperty('min-height','0','important');
        shell.style.setProperty('min-block-size','0','important');
        shell.style.setProperty('max-height','100%','important');
        shell.style.setProperty('max-block-size','100%','important');
      }
      const content=dialog.querySelector('.simple-settings-v29-content');
      if(content){
        content.style.setProperty('flex','0 1 auto','important');
        content.style.setProperty('height','auto','important');
        content.style.setProperty('min-height','0','important');
        content.style.setProperty('overflow','auto','important');
      }
    };
    const queueFit=()=>{
      if(fitQueued)return;
      fitQueued=true;
      requestAnimationFrame(()=>requestAnimationFrame(fitDialog));
    };

    if(dialog){
      queueFit();
      new MutationObserver(queueFit).observe(dialog,{attributes:true,childList:true,subtree:true,attributeFilter:['open','class']});
      new MutationObserver(()=>{
        if(dialog.querySelector('.simple-settings-v29-shell'))queueFit();
      }).observe(body,{childList:true,subtree:true});
      document.addEventListener('click',event=>{
        if(event.target.closest('#settingsBtn,[data-v31-action="settings"],[data-open-settings]')){
          [0,80,180,360].forEach(delay=>setTimeout(queueFit,delay));
        }
      },true);
      [0,100,250,600].forEach(delay=>setTimeout(queueFit,delay));
    }
  };

  if(document.readyState==='complete')start();
  else window.addEventListener('load',start,{once:true});
})();
