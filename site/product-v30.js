(()=>{
  'use strict';
  if(document.documentElement.dataset.productV30==='1')return;
  document.documentElement.dataset.productV30='1';

  const root=document.documentElement;
  const body=document.body;
  body.classList.add('product-v30');

  // Remove fabricated visual telemetry if an older cached script happened to run first.
  [
    '.v26-top-status','.v26-hero-console','.v26-workspace-strip','.v26-intel-rail',
    '.v26-gravity-lens','.v26-scroll-progress','.sci-fi-cursor','#sciFiField'
  ].forEach(selector=>document.querySelectorAll(selector).forEach(node=>node.remove()));

  const brandSub=document.querySelector('.brand-copy small');
  if(brandSub)brandSub.textContent='Technical Research';

  const workspace=document.getElementById('searchWorkspace');
  const syncWorkspace=()=>body.classList.toggle('product-v30-has-results',Boolean(workspace&&!workspace.classList.contains('hidden')));
  if(workspace){
    new MutationObserver(syncWorkspace).observe(workspace,{attributes:true,attributeFilter:['class']});
    syncWorkspace();
  }

  // A very low-amplitude pointer light: spatial feedback, not decoration.
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer=window.matchMedia('(pointer: fine)').matches;
  if(finePointer&&!reduceMotion){
    let targetX=innerWidth*.5,targetY=innerHeight*.28,x=targetX,y=targetY,raf=0;
    const render=()=>{
      x+=(targetX-x)*.08;
      y+=(targetY-y)*.08;
      root.style.setProperty('--p30-px',`${x}px`);
      root.style.setProperty('--p30-py',`${y}px`);
      if(Math.abs(targetX-x)>.2||Math.abs(targetY-y)>.2)raf=requestAnimationFrame(render);else raf=0;
    };
    addEventListener('pointermove',event=>{
      targetX=event.clientX;targetY=event.clientY;
      if(!raf)raf=requestAnimationFrame(render);
    },{passive:true});
  }
})();
