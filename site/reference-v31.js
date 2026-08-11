(()=>{
  'use strict';
  if(document.documentElement.dataset.referenceV31==='1')return;
  document.documentElement.dataset.referenceV31='1';

  const onReady=callback=>{
    if(document.readyState==='complete'||document.readyState==='interactive')callback();
    else document.addEventListener('DOMContentLoaded',callback,{once:true});
  };

  onReady(()=>{
    const body=document.body;
    const topbar=document.querySelector('.topbar');
    const shell=document.querySelector('.shell');
    const footer=document.querySelector('footer');
    const hero=document.querySelector('.hero');
    const searchForm=document.querySelector('#searchForm');
    const workspace=document.querySelector('#searchWorkspace');
    const contentGrid=workspace?.querySelector('.content-grid');
    const filters=workspace?.querySelector('.filters');
    const resultsPane=workspace?.querySelector('.results-pane');
    const topActions=topbar?.querySelector('.top-actions');
    if(!body||!topbar||!shell||!hero||!searchForm||!workspace||!contentGrid||!resultsPane)return;

    body.classList.add('reference-v31');

    const originalBrand=topbar.querySelector('.brand');
    originalBrand?.classList.add('v31-original-brand');
    const density=document.querySelector('#densityToggle');
    if(density)density.hidden=true;
    const settings=document.querySelector('#settingsBtn');
    if(settings)settings.textContent='AI 配置';

    const title=hero.querySelector('h1');
    const subtitle=hero.querySelector('.subtitle');
    if(title)title.textContent='探索研究';
    if(subtitle)subtitle.textContent='在一个工作区里检索论文、专利、技术文章与网页，并继续进入地图、时间演进和证据分析。';

    const app=document.createElement('div');
    app.className='v31-app';
    const sidebar=document.createElement('aside');
    sidebar.className='v31-sidebar';
    sidebar.innerHTML=`
      <div class="v31-brand">
        <div class="v31-brand-mark">R</div>
        <div><strong>RESEARCH OS</strong><span>Academic Intelligence</span></div>
      </div>
      <div class="v31-nav-label">WORKSPACE</div>
      <nav class="v31-nav" aria-label="研究视图">
        <button class="active" type="button" data-v31-view="search"><span>⌕</span><b>探索</b></button>
        <button type="button" data-v31-view="map"><span>◇</span><b>研究地图</b></button>
        <button type="button" data-v31-view="timeline"><span>≋</span><b>时间演进</b></button>
        <button type="button" data-v31-view="entities"><span>◎</span><b>实体情报</b></button>
        <button type="button" data-v31-view="evidence"><span>▣</span><b>证据板</b></button>
        <button type="button" data-v31-view="path"><span>↗</span><b>技术脉络</b></button>
      </nav>
      <div class="v31-sidebar-spacer"></div>
      <nav class="v31-nav v31-nav-secondary" aria-label="辅助操作">
        <button type="button" data-v31-action="history"><span>◴</span><b>历史</b></button>
        <button type="button" data-v31-action="settings"><span>⚙</span><b>AI 配置</b></button>
        <button type="button" data-v31-action="export"><span>⇩</span><b>导出</b></button>
      </nav>`;

    const main=document.createElement('main');
    main.className='v31-main';
    const insights=document.createElement('aside');
    insights.className='v31-insights';
    insights.setAttribute('aria-label','研究信号');
    insights.innerHTML=`
      <section class="v31-insight-head">
        <span>RESEARCH SIGNAL</span>
        <h2>研究信号</h2>
        <p data-v31-query>等待检索</p>
      </section>
      <section class="v31-radar-card">
        <div class="v31-radar-wrap">
          <svg viewBox="0 0 240 240" role="img" aria-label="真实来源数量雷达图">
            <circle cx="120" cy="120" r="96"></circle>
            <circle cx="120" cy="120" r="68"></circle>
            <circle cx="120" cy="120" r="40"></circle>
            <line x1="120" y1="20" x2="120" y2="220"></line>
            <line x1="20" y1="120" x2="220" y2="120"></line>
            <polygon class="v31-radar-area" points="120,120 120,120 120,120 120,120"></polygon>
            <circle class="v31-radar-dot" data-axis="0" cx="120" cy="120" r="4"></circle>
            <circle class="v31-radar-dot" data-axis="1" cx="120" cy="120" r="4"></circle>
            <circle class="v31-radar-dot" data-axis="2" cx="120" cy="120" r="4"></circle>
            <circle class="v31-radar-dot" data-axis="3" cx="120" cy="120" r="4"></circle>
            <text x="120" y="12" text-anchor="middle">论文</text>
            <text x="232" y="124" text-anchor="end">专利</text>
            <text x="120" y="237" text-anchor="middle">文章</text>
            <text x="8" y="124">网页</text>
          </svg>
        </div>
        <p class="v31-radar-note">按各来源真实匹配数量进行对数归一化，仅表示本轮结果覆盖，不代表质量评分。</p>
      </section>
      <section class="v31-source-card">
        <div class="v31-source-head"><strong>来源覆盖</strong><span data-v31-total>0</span></div>
        <div class="v31-source-list">
          <div data-source="papers"><span><i></i>论文</span><b>0</b><em><u></u></em></div>
          <div data-source="patents"><span><i></i>专利</span><b>0</b><em><u></u></em></div>
          <div data-source="blogs"><span><i></i>技术文章</span><b>0</b><em><u></u></em></div>
          <div data-source="web"><span><i></i>网页</span><b>0</b><em><u></u></em></div>
        </div>
      </section>
      <section class="v31-context-card">
        <span>当前状态</span>
        <strong data-v31-status>准备搜索</strong>
      </section>`;

    const searchSlot=document.createElement('div');
    searchSlot.className='v31-search-slot';
    topbar.insertBefore(searchSlot,topActions||null);
    searchSlot.appendChild(searchForm);

    body.insertBefore(app,body.firstChild);
    app.append(sidebar,main,insights);
    main.append(topbar,shell);
    if(footer)main.appendChild(footer);

    if(filters&&resultsPane){
      const filterToolbar=document.createElement('div');
      filterToolbar.className='v31-filter-toolbar';
      filters.parentElement?.insertBefore(filterToolbar,filters);
      filterToolbar.appendChild(filters);
    }

    const clickLegacyView=view=>{
      const candidates=[...document.querySelectorAll('[data-os-view]')].filter(node=>node.dataset.osView===view&&!node.closest('.v31-sidebar'));
      const target=candidates.find(node=>node.closest('#researchOsRail,#researchOsViewbar'))||candidates[0];
      if(target){target.click();return true}
      return false;
    };

    sidebar.addEventListener('click',event=>{
      const viewButton=event.target.closest('[data-v31-view]');
      if(viewButton){
        const view=viewButton.dataset.v31View;
        if(!clickLegacyView(view))setTimeout(()=>clickLegacyView(view),180);
        sidebar.querySelectorAll('[data-v31-view]').forEach(button=>button.classList.toggle('active',button===viewButton));
        return;
      }
      const action=event.target.closest('[data-v31-action]')?.dataset.v31Action;
      if(action==='history')document.querySelector('#historyBtn')?.click();
      if(action==='settings')document.querySelector('#settingsBtn')?.click();
      if(action==='export')document.querySelector('#exportBtn')?.click();
    });

    const syncActiveView=()=>{
      const view=body.dataset.researchOsView||'search';
      sidebar.querySelectorAll('[data-v31-view]').forEach(button=>button.classList.toggle('active',button.dataset.v31View===view));
    };
    new MutationObserver(syncActiveView).observe(body,{attributes:true,attributeFilter:['data-research-os-view']});

    const parseCount=node=>{
      const text=(node?.textContent||'').replace(/[^\d]/g,'');
      return text?Number(text):0;
    };
    const countNodes={
      papers:document.querySelector('#paperCount'),
      patents:document.querySelector('#patentCount'),
      blogs:document.querySelector('#blogCount'),
      web:document.querySelector('#webCount')
    };
    const queryInput=document.querySelector('#queryInput');
    const statusLine=document.querySelector('#statusLine');

    const radarPoints=values=>{
      const logs=values.map(value=>value>0?Math.log10(value+1):0);
      const max=Math.max(1,...logs);
      const radii=logs.map(value=>value?28+(value/max)*68:12);
      const center=120;
      const points=[
        [center,center-radii[0]],
        [center+radii[1],center],
        [center,center+radii[2]],
        [center-radii[3],center]
      ];
      return points;
    };

    const updateInsights=()=>{
      const keys=['papers','patents','blogs','web'];
      const values=keys.map(key=>parseCount(countNodes[key]));
      const total=values.reduce((sum,value)=>sum+value,0);
      const points=radarPoints(values);
      const polygon=insights.querySelector('.v31-radar-area');
      if(polygon)polygon.setAttribute('points',points.map(point=>point.join(',')).join(' '));
      insights.querySelectorAll('.v31-radar-dot').forEach((dot,index)=>{
        dot.setAttribute('cx',String(points[index][0]));
        dot.setAttribute('cy',String(points[index][1]));
      });
      const max=Math.max(1,...values);
      keys.forEach((key,index)=>{
        const row=insights.querySelector(`[data-source="${key}"]`);
        row?.querySelector('b')?.replaceChildren(document.createTextNode(values[index].toLocaleString('zh-CN')));
        const bar=row?.querySelector('u');
        if(bar)bar.style.width=`${Math.max(values[index]?8:0,Math.round(values[index]/max*100))}%`;
      });
      const totalNode=insights.querySelector('[data-v31-total]');
      if(totalNode)totalNode.textContent=total?total.toLocaleString('zh-CN'):'0';
      const query=String(queryInput?.value||'').trim();
      const queryNode=insights.querySelector('[data-v31-query]');
      if(queryNode)queryNode.textContent=query||'等待检索';
      const statusNode=insights.querySelector('[data-v31-status]');
      if(statusNode)statusNode.textContent=statusLine?.textContent||'准备搜索';
      body.classList.toggle('v31-has-results',!workspace.classList.contains('hidden'));
    };

    const observer=new MutationObserver(updateInsights);
    Object.values(countNodes).forEach(node=>node&&observer.observe(node,{childList:true,subtree:true,characterData:true}));
    if(statusLine)observer.observe(statusLine,{childList:true,subtree:true,characterData:true});
    observer.observe(workspace,{attributes:true,attributeFilter:['class']});
    queryInput?.addEventListener('input',updateInsights,{passive:true});

    document.querySelectorAll('#researchOsRail,#researchOsStatusbar').forEach(node=>node.setAttribute('aria-hidden','true'));
    syncActiveView();
    updateInsights();
  });
})();