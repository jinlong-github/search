(()=>{
  'use strict';

  if(document.documentElement.dataset.ultimateV26==='1')return;
  document.documentElement.dataset.ultimateV26='1';

  const root=document.documentElement;
  const body=document.body;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer=window.matchMedia('(pointer: fine)').matches;

  body.classList.add('ultimate-v26');

  const el=(tag,className,text)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  };

  const scrollProgress=el('div','v26-scroll-progress');
  scrollProgress.setAttribute('aria-hidden','true');
  body.appendChild(scrollProgress);

  const lens=el('div','v26-gravity-lens');
  lens.setAttribute('aria-hidden','true');
  body.prepend(lens);

  const topbar=document.querySelector('.topbar');
  const topActions=document.querySelector('.top-actions');
  if(topbar&&topActions&&!topbar.querySelector('.v26-top-status')){
    const status=el('div','v26-top-status');
    status.setAttribute('aria-hidden','true');
    const statusItems=[['CORE','ONLINE'],['VECTOR','READY'],['SYNTH','READY']];
    statusItems.forEach(([name,value])=>{
      const item=el('span');
      item.append(el('i'),document.createTextNode(`${name} ${value}`));
      status.appendChild(item);
    });
    topbar.insertBefore(status,topActions);
  }

  const hero=document.querySelector('.hero');
  let heroConsole=null;
  if(hero&&!hero.querySelector('.v26-hero-grid')){
    const grid=el('div','v26-hero-grid');
    const main=el('div','v26-hero-main');
    const existing=[...hero.children];
    existing.forEach(node=>main.appendChild(node));

    const title=main.querySelector('h1');
    if(title){
      const kicker=el('p','v26-kicker','RESEARCH INTELLIGENCE / COMMAND NODE 01');
      main.insertBefore(kicker,title);
    }

    heroConsole=el('aside','v26-hero-console');
    heroConsole.setAttribute('aria-label','研究系统状态');

    const consoleHead=el('div','v26-console-head');
    consoleHead.append(el('strong','', 'SYSTEM CORE / RESEARCH ENGINE'));
    consoleHead.append(el('span','', 'SYNCHRONIZED'));

    const core=el('div','v26-core');
    const orb=el('div','v26-core-orb');
    const coreLabel=el('span','v26-core-label','MULTI-SOURCE KNOWLEDGE FIELD');
    core.append(orb,coreLabel);

    const metricGrid=el('div','v26-metric-grid');
    const metrics=[
      ['DATA LAYERS','PAPER · PATENT · WEB'],
      ['RESEARCH MODE','EVIDENCE + SYNTHESIS'],
      ['INTERFACE','SPATIAL / LIVE']
    ];
    metrics.forEach(([label,value])=>{
      const metric=el('div','v26-metric');
      metric.append(el('small','',label),el('strong','',value));
      metricGrid.appendChild(metric);
    });

    const wave=el('div','v26-wave');
    wave.setAttribute('aria-hidden','true');

    heroConsole.append(consoleHead,core,metricGrid,wave);
    grid.append(main,heroConsole);
    hero.appendChild(grid);
  }else if(hero){
    heroConsole=hero.querySelector('.v26-hero-console');
  }

  const workspace=document.getElementById('searchWorkspace');
  const tabs=workspace?.querySelector('.tabs');
  const contentGrid=workspace?.querySelector('.content-grid');
  const queryInput=document.getElementById('queryInput');
  const statusLine=document.getElementById('statusLine');

  let sessionQuery=null;
  let sessionStatus=null;
  if(workspace&&tabs&&!workspace.querySelector('.v26-workspace-strip')){
    const strip=el('div','v26-workspace-strip');
    const session=el('div','v26-session-copy');
    session.append(document.createTextNode('ACTIVE SESSION'));
    sessionQuery=el('strong','',queryInput?.value||'等待研究任务');
    session.appendChild(sessionQuery);

    const nodes=el('div','v26-session-nodes');
    ['DISCOVERY','EVIDENCE','SYNTHESIS'].forEach(text=>{
      const item=el('span');
      item.append(el('i'),document.createTextNode(text));
      nodes.appendChild(item);
    });
    strip.append(session,nodes);
    tabs.insertAdjacentElement('afterend',strip);
  }else{
    sessionQuery=workspace?.querySelector('.v26-session-copy strong')||null;
  }

  let rail=null;
  const countMap={
    papers:document.getElementById('paperCount'),
    patents:document.getElementById('patentCount'),
    blogs:document.getElementById('blogCount'),
    web:document.getElementById('webCount')
  };
  const railStats={};

  if(contentGrid&&!contentGrid.querySelector('.v26-intel-rail')){
    rail=el('aside','v26-intel-rail');
    rail.setAttribute('aria-label','实时情报侧栏');

    const taskPanel=el('section','v26-rail-panel');
    taskPanel.append(el('p','v26-rail-kicker','ACTIVE RESEARCH VECTOR'));
    taskPanel.append(el('h3','v26-rail-title','当前研究任务'));
    const query=el('div','v26-rail-query',queryInput?.value||'等待输入研究问题…');
    query.dataset.v26Query='1';
    taskPanel.appendChild(query);

    const sourcePanel=el('section','v26-rail-panel');
    sourcePanel.append(el('p','v26-rail-kicker','SOURCE TELEMETRY'));
    const sourceGrid=el('div','v26-source-grid');
    const sourceDefs=[['papers','论文'],['patents','专利'],['blogs','技术文章'],['web','网页']];
    sourceDefs.forEach(([key,label])=>{
      const stat=el('div','v26-source-stat');
      stat.append(el('small','',label));
      const strong=el('strong','', '0');
      railStats[key]=strong;
      stat.appendChild(strong);
      sourceGrid.appendChild(stat);
    });
    sourcePanel.appendChild(sourceGrid);

    const pipelinePanel=el('section','v26-rail-panel');
    pipelinePanel.append(el('p','v26-rail-kicker','INTELLIGENCE PIPELINE'));
    const pipeline=el('div','v26-pipeline');
    const rows=[
      ['检索与聚合','READY'],
      ['证据结构化','READY'],
      ['AI 综合研判','READY'],
      ['研究会话','LIVE']
    ];
    rows.forEach(([label,state])=>{
      const row=el('div','v26-pipeline-row');
      row.append(el('i'),el('span','',label),el('b','',state));
      pipeline.appendChild(row);
    });
    pipelinePanel.appendChild(pipeline);

    const signalPanel=el('section','v26-rail-panel');
    signalPanel.append(el('p','v26-rail-kicker','SIGNAL DENSITY'));
    const bars=el('div','v26-signal-bars');
    const heights=[28,45,34,72,51,84,43,66,92,58,76,39,61,88,48,70,55,81,44,68,37,74,52,86];
    heights.forEach((height,index)=>{
      const bar=el('span');
      bar.style.setProperty('--h',`${height}%`);
      bar.style.setProperty('--d',`${(index%7)*-.19}s`);
      bars.appendChild(bar);
    });
    signalPanel.append(bars,el('div','v26-rail-foot','LIVE VISUAL TELEMETRY / DECORATIVE SIGNAL FIELD'));

    const statusPanel=el('section','v26-rail-panel');
    statusPanel.append(el('p','v26-rail-kicker','STREAM STATUS'));
    sessionStatus=el('div','v26-rail-query',statusLine?.textContent||'准备搜索');
    sessionStatus.dataset.v26Status='1';
    statusPanel.appendChild(sessionStatus);

    rail.append(taskPanel,sourcePanel,pipelinePanel,signalPanel,statusPanel);
    contentGrid.appendChild(rail);
  }else{
    rail=contentGrid?.querySelector('.v26-intel-rail')||null;
    sessionStatus=rail?.querySelector('[data-v26-status]')||null;
    rail?.querySelectorAll('.v26-source-stat').forEach((node,index)=>{
      const key=['papers','patents','blogs','web'][index];
      railStats[key]=node.querySelector('strong');
    });
  }

  const normalizeCount=(node)=>{
    if(!node)return '0';
    const raw=(node.textContent||'').trim();
    const match=raw.match(/\d+/);
    return match?match[0]:'0';
  };

  const updateTelemetry=()=>{
    Object.entries(countMap).forEach(([key,node])=>{
      if(railStats[key])railStats[key].textContent=normalizeCount(node);
    });
    const query=(queryInput?.value||'').trim();
    if(sessionQuery)sessionQuery.textContent=query||'等待研究任务';
    const railQuery=rail?.querySelector('[data-v26-query]');
    if(railQuery)railQuery.textContent=query||'等待输入研究问题…';
    if(sessionStatus&&statusLine)sessionStatus.textContent=statusLine.textContent||'准备搜索';
  };

  const updateWorkspaceState=()=>{
    const hasResults=Boolean(workspace&&!workspace.classList.contains('hidden'));
    body.classList.toggle('v26-has-results',hasResults);
    updateTelemetry();
  };

  queryInput?.addEventListener('input',updateTelemetry,{passive:true});

  if(workspace){
    const workspaceObserver=new MutationObserver(updateWorkspaceState);
    workspaceObserver.observe(workspace,{attributes:true,attributeFilter:['class']});
  }

  const telemetryObserver=new MutationObserver(updateTelemetry);
  Object.values(countMap).forEach(node=>{
    if(node)telemetryObserver.observe(node,{childList:true,characterData:true,subtree:true});
  });
  if(statusLine)telemetryObserver.observe(statusLine,{childList:true,characterData:true,subtree:true});

  const revealObserver=!reduceMotion&&'IntersectionObserver' in window
    ?new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('v26-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },{rootMargin:'80px 0px -20px',threshold:.05})
    :null;

  const prepareCards=(container=document)=>{
    container.querySelectorAll?.('.result-card,.overview-card').forEach(card=>{
      if(card.dataset.v26Prepared==='1')return;
      card.dataset.v26Prepared='1';
      card.classList.add('v26-reveal');
      if(revealObserver)revealObserver.observe(card);
      else card.classList.add('v26-visible');
    });
  };

  const results=document.getElementById('results');
  const overviewBox=document.getElementById('overviewBox');
  prepareCards(document);

  if(results){
    const resultsObserver=new MutationObserver(mutations=>{
      mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>{
        if(node.nodeType===1)prepareCards(node.matches?.('.result-card,.overview-card')?node.parentElement:node);
      }));
      updateTelemetry();
    });
    resultsObserver.observe(results,{childList:true,subtree:true});
  }

  if(overviewBox){
    const overviewObserver=new MutationObserver(()=>prepareCards(document));
    overviewObserver.observe(overviewBox,{attributes:true,childList:true,subtree:true});
  }

  let pointerX=window.innerWidth*.5;
  let pointerY=window.innerHeight*.35;
  let smoothX=pointerX;
  let smoothY=pointerY;

  const updateScroll=()=>{
    const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
    const progress=Math.max(0,Math.min(1,window.scrollY/max));
    root.style.setProperty('--v26-scroll',progress.toFixed(4));
  };

  window.addEventListener('scroll',updateScroll,{passive:true});
  updateScroll();

  if(finePointer&&!reduceMotion){
    window.addEventListener('pointermove',event=>{
      pointerX=event.clientX;
      pointerY=event.clientY;
      body.classList.toggle('v26-interactive',Boolean(event.target.closest('a,button,input,select,.result-card,.overview-card,.v26-hero-console')));
    },{passive:true});

    document.addEventListener('mouseleave',()=>body.classList.remove('v26-interactive'));

    const animatePointer=()=>{
      smoothX+=(pointerX-smoothX)*.075;
      smoothY+=(pointerY-smoothY)*.075;
      root.style.setProperty('--v26-px',`${smoothX}px`);
      root.style.setProperty('--v26-py',`${smoothY}px`);
      requestAnimationFrame(animatePointer);
    };
    requestAnimationFrame(animatePointer);
  }

  updateWorkspaceState();
})();
