(()=>{
  'use strict';

  const root=document.documentElement;
  const body=document.body;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer=window.matchMedia('(pointer: fine)').matches;

  let targetX=window.innerWidth*0.5;
  let targetY=window.innerHeight*0.3;
  let currentX=targetX;
  let currentY=targetY;
  let pointerVisible=false;

  const setPointerVars=(x,y)=>{
    root.style.setProperty('--mx',`${x}px`);
    root.style.setProperty('--my',`${y}px`);
    root.style.setProperty('--mouse-x',(x/Math.max(window.innerWidth,1)).toFixed(4));
    root.style.setProperty('--mouse-y',(y/Math.max(window.innerHeight,1)).toFixed(4));
  };
  setPointerVars(currentX,currentY);

  let cursor=null;
  if(finePointer&&!reduceMotion){
    cursor=document.createElement('div');
    cursor.className='sci-fi-cursor';
    cursor.setAttribute('aria-hidden','true');
    body.appendChild(cursor);
  }

  const interactiveSelector='a,button,input,select,textarea,[role="button"],.result-card,.overview-card,.search-box';
  const tiltSelector='.search-box,.result-card,.overview-card,[class*="project-"][class*="card"],[class*="ai-"][class*="card"]';

  const updateTilt=(target,event)=>{
    if(reduceMotion||!finePointer||!target)return;
    const rect=target.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const px=Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width));
    const py=Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height));
    const strength=target.classList.contains('search-box')?1.35:2.25;
    target.style.setProperty('--local-x',`${(px*100).toFixed(1)}%`);
    target.style.setProperty('--local-y',`${(py*100).toFixed(1)}%`);
    target.style.setProperty('--tilt-x',`${((0.5-py)*strength).toFixed(2)}deg`);
    target.style.setProperty('--tilt-y',`${((px-0.5)*strength).toFixed(2)}deg`);
  };

  const resetTilt=(target)=>{
    if(!target)return;
    target.style.setProperty('--tilt-x','0deg');
    target.style.setProperty('--tilt-y','0deg');
    target.style.setProperty('--local-x','50%');
    target.style.setProperty('--local-y','50%');
  };

  window.addEventListener('pointermove',event=>{
    targetX=event.clientX;
    targetY=event.clientY;
    pointerVisible=true;
    if(cursor){
      root.style.setProperty('--cursor-x',`${event.clientX}px`);
      root.style.setProperty('--cursor-y',`${event.clientY}px`);
      cursor.style.opacity='1';
    }
    body.classList.toggle('is-interactive',Boolean(event.target.closest(interactiveSelector)));
    updateTilt(event.target.closest(tiltSelector),event);
  },{passive:true});

  window.addEventListener('pointerout',event=>{
    const from=event.target.closest?.(tiltSelector);
    const to=event.relatedTarget?.closest?.(tiltSelector);
    if(from&&from!==to)resetTilt(from);
  },{passive:true});

  document.addEventListener('mouseleave',()=>{
    pointerVisible=false;
    body.classList.remove('is-interactive');
    if(cursor)cursor.style.opacity='0';
  });
  document.addEventListener('mouseenter',()=>{pointerVisible=true;});

  if(!reduceMotion){
    const smoothPointer=()=>{
      currentX+=(targetX-currentX)*0.085;
      currentY+=(targetY-currentY)*0.085;
      setPointerVars(currentX,currentY);
      requestAnimationFrame(smoothPointer);
    };
    requestAnimationFrame(smoothPointer);
  }

  if(reduceMotion)return;

  const canvas=document.createElement('canvas');
  canvas.id='sciFiField';
  canvas.setAttribute('aria-hidden','true');
  body.prepend(canvas);
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return;

  let width=0;
  let height=0;
  let dpr=1;
  let particles=[];
  let raf=0;
  let last=performance.now();

  const particleCount=()=>{
    const area=window.innerWidth*window.innerHeight;
    return Math.max(34,Math.min(78,Math.round(area/22000)));
  };

  const makeParticle=()=>({
    x:Math.random()*width,
    y:Math.random()*height,
    vx:(Math.random()-.5)*0.13,
    vy:(Math.random()-.5)*0.13,
    r:.65+Math.random()*1.15,
    phase:Math.random()*Math.PI*2
  });

  const resize=()=>{
    width=window.innerWidth;
    height=window.innerHeight;
    dpr=Math.min(window.devicePixelRatio||1,1.6);
    canvas.width=Math.max(1,Math.floor(width*dpr));
    canvas.height=Math.max(1,Math.floor(height*dpr));
    canvas.style.width=`${width}px`;
    canvas.style.height=`${height}px`;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const desired=particleCount();
    if(!particles.length){
      particles=Array.from({length:desired},makeParticle);
    }else if(particles.length<desired){
      particles.push(...Array.from({length:desired-particles.length},makeParticle));
    }else if(particles.length>desired){
      particles.length=desired;
    }
  };

  const draw=(now)=>{
    const dt=Math.min(32,now-last);
    last=now;
    ctx.clearRect(0,0,width,height);

    for(let i=0;i<particles.length;i++){
      const p=particles[i];
      p.phase+=dt*0.00045;

      if(pointerVisible&&finePointer){
        const dx=p.x-currentX;
        const dy=p.y-currentY;
        const dist2=dx*dx+dy*dy;
        if(dist2<36000&&dist2>36){
          const dist=Math.sqrt(dist2);
          const force=(1-dist/190)*0.0045;
          p.vx+=(dx/dist)*force*dt;
          p.vy+=(dy/dist)*force*dt;
        }
      }

      p.vx*=0.992;
      p.vy*=0.992;
      p.vx+=Math.sin(p.phase)*0.00055*dt;
      p.vy+=Math.cos(p.phase*.83)*0.00045*dt;
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;

      if(p.x<-20)p.x=width+20;
      if(p.x>width+20)p.x=-20;
      if(p.y<-20)p.y=height+20;
      if(p.y>height+20)p.y=-20;
    }

    for(let i=0;i<particles.length;i++){
      const a=particles[i];
      for(let j=i+1;j<particles.length;j++){
        const b=particles[j];
        const dx=a.x-b.x;
        const dy=a.y-b.y;
        const d2=dx*dx+dy*dy;
        if(d2<15500){
          const alpha=(1-d2/15500)*0.12;
          ctx.beginPath();
          ctx.moveTo(a.x,a.y);
          ctx.lineTo(b.x,b.y);
          ctx.strokeStyle=`rgba(82,225,244,${alpha.toFixed(3)})`;
          ctx.lineWidth=.55;
          ctx.stroke();
        }
      }

      if(pointerVisible&&finePointer){
        const dx=a.x-currentX;
        const dy=a.y-currentY;
        const d2=dx*dx+dy*dy;
        if(d2<26000){
          const alpha=(1-d2/26000)*0.19;
          ctx.beginPath();
          ctx.moveTo(a.x,a.y);
          ctx.lineTo(currentX,currentY);
          ctx.strokeStyle=`rgba(110,255,199,${alpha.toFixed(3)})`;
          ctx.lineWidth=.65;
          ctx.stroke();
        }
      }
    }

    for(const p of particles){
      const pulse=.64+Math.sin(p.phase*2)*.22;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(116,238,255,${Math.max(.12,pulse*.42).toFixed(3)})`;
      ctx.fill();
    }

    raf=requestAnimationFrame(draw);
  };

  const onVisibility=()=>{
    if(document.hidden){
      cancelAnimationFrame(raf);
      raf=0;
    }else if(!raf){
      last=performance.now();
      raf=requestAnimationFrame(draw);
    }
  };

  let resizeTimer=0;
  window.addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(resize,120);
  },{passive:true});
  document.addEventListener('visibilitychange',onVisibility);

  resize();
  raf=requestAnimationFrame(draw);
})();
