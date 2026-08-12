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
    const quickQueries=hero?.querySelector('.quick-queries');
    const workspace=document.querySelector('#searchWorkspace');
    const contentGrid=workspace?.querySelector('.content-grid');
    const filters=workspace?.querySelector('.filters');
    const resultsPane=workspace?.querySelector('.results-pane');
    const results=document.querySelector('#results');
    const topActions=topbar?.querySelector('.top-actions');
    if(!body||!topbar||!shell||!hero||!searchForm||!workspace||!contentGrid||!resultsPane)return;

    body.classList.add('reference-v31','clarity-v32','controls-v33');

    const originalBrand=topbar.querySelector('.brand');
    originalBrand?.classList.add('v31-original-brand');
    const density=document.querySelector('#densityToggle');
    if(density)density.hidden=true;
    const settings=document.querySelector('#settingsBtn');
    if(settings)settings.textContent='AI 配置';
    const searchButton=searchForm.querySelector('.search-btn');
    if(searchButton)searchButton.textContent='搜索';

    const title=hero.querySelector('h1');
    const subtitle=hero.querySelector('.subtitle');
    if(title)title.textContent='研究搜索';
    if(subtitle)subtitle.textContent='先找到可信资料，再进入关系、时间、实体与证据分析。';

    const app=document.createElement('div');
    app.className='v31-app';

    const sidebar=document.createElement('aside');
    sidebar.className='v31-sidebar';
    sidebar.innerHTML=`
      <div class="v31-brand">
        <div class="v31-brand-mark">R</div>
        <div><strong>RESEARCH OS</strong><span>科研情报工作台</span></div>
      </div>
      <div class="v31-nav-label">主要功能</div>
      <nav class="v31-nav v32-primary-nav" aria-label="主要功能">
        <button class="active" type="button" data-v31-view="search"><b>搜索</b></button>
        <button type="button" data-v32-analysis-root><b>分析工具</b></button>
      </nav>
      <nav class="v32-analysis-nav" aria-label="分析工具">
        <button type="button" data-v31-view="map">关系地图</button>
        <button type="button" data-v31-view="timeline">时间趋势</button>
        <button type="button" data-v31-view="entities">关键实体</button>
        <button type="button" data-v31-view="evidence">证据</button>
        <button type="button" data-v31-view="path">技术路径</button>
      </nav>
      <div class="v31-sidebar-spacer"></div>
      <nav class="v31-nav v31-nav-secondary" aria-label="辅助操作">
        <button type="button" data-v31-action="history"><b>搜索历史</b></button>
        <button type="button" data-v31-action="settings"><b>AI 配置</b></button>
        <button type="button" data-v31-action="export"><b>导出结果</b></button>
      </nav>`;

    const main=document.createElement('main');
    main.className='v31-main';

    const searchSlot=document.createElement('div');
    searchSlot.className='v31-search-slot';
    topbar.insertBefore(searchSlot,topActions||null);

    body.insertBefore(app,body.firstChild);
    app.append(sidebar,main);
    main.append(topbar,shell);
    if(footer)main.appendChild(footer);

    if(filters&&resultsPane){
      const filterToolbar=document.createElement('div');
      filterToolbar.className='v31-filter-toolbar';
      filters.parentElement?.insertBefore(filterToolbar,filters);
      filterToolbar.appendChild(filters);
    }

    const clickLegacyView=view=>{
      const candidates=[...document.querySelectorAll('[data-os-view]')]
        .filter(node=>node.dataset.osView===view&&!node.closest('.v31-sidebar'));
      const target=candidates.find(node=>node.closest('#researchOsRail,#researchOsViewbar'))||candidates[0];
      if(target){target.click();return true;}
      return false;
    };

    const activateView=view=>{
      if(!clickLegacyView(view))setTimeout(()=>clickLegacyView(view),180);
    };

    sidebar.addEventListener('click',event=>{
      const analysisRoot=event.target.closest('[data-v32-analysis-root]');
      if(analysisRoot){
        sidebar.classList.add('v32-analysis-open');
        activateView('map');
        return;
      }

      const viewButton=event.target.closest('[data-v31-view]');
      if(viewButton){
        const view=viewButton.dataset.v31View;
        activateView(view);
        if(view==='search')sidebar.classList.remove('v32-analysis-open');
        else sidebar.classList.add('v32-analysis-open');
        return;
      }

      const action=event.target.closest('[data-v31-action]')?.dataset.v31Action;
      if(action==='history')document.querySelector('#historyBtn')?.click();
      if(action==='settings')document.querySelector('#settingsBtn')?.click();
      if(action==='export')document.querySelector('#exportBtn')?.click();
    });

    const currentView=()=>body.dataset.researchOsView||'search';
    const hasResults=()=>!workspace.classList.contains('hidden');

    const syncSearchPlacement=()=>{
      const homeMode=currentView()==='search'&&!hasResults();
      body.classList.toggle('v32-home-mode',homeMode);
      if(homeMode){
        if(searchForm.parentElement!==hero)hero.insertBefore(searchForm,quickQueries||null);
      }else if(searchForm.parentElement!==searchSlot){
        searchSlot.appendChild(searchForm);
      }
    };

    const syncActiveView=()=>{
      const view=currentView();
      const inAnalysis=view!=='search';
      sidebar.classList.toggle('v32-analysis-open',inAnalysis);
      sidebar.querySelectorAll('[data-v31-view]').forEach(button=>{
        button.classList.toggle('active',button.dataset.v31View===view);
      });
      sidebar.querySelector('[data-v32-analysis-root]')?.classList.toggle('active',inAnalysis);
      syncSearchPlacement();
    };
    new MutationObserver(syncActiveView).observe(body,{attributes:true,attributeFilter:['data-research-os-view']});

    const syncResultsState=()=>{
      body.classList.toggle('v31-has-results',hasResults());
      syncSearchPlacement();
    };
    new MutationObserver(syncResultsState).observe(workspace,{attributes:true,attributeFilter:['class']});

    let normalizeQueued=false;
    let normalizing=false;
    const normalizeResultActions=()=>{
      normalizeQueued=false;
      if(normalizing||!results)return;
      normalizing=true;
      try{
        results.querySelectorAll('.ux-result').forEach(card=>{
          const save=card.querySelector('.ux-save');
          if(save){
            const saved=save.classList.contains('saved');
            save.textContent=saved?'已收藏':'收藏';
            save.setAttribute('aria-label',saved?'取消收藏':'收藏');
          }

          const actions=card.querySelector('.ux-actions');
          if(!actions)return;

          let main=actions.querySelector('.ux-open');
          if(main){
            main.textContent='打开来源 ↗';
            if(main.parentElement!==actions)actions.prepend(main);
          }

          let project=actions.querySelector('.project-v20-add');
          let details=actions.querySelector(':scope > .v33-more-actions');
          if(project&&project.parentElement!==actions){
            if(details)actions.insertBefore(project,details);
            else actions.appendChild(project);
          }

          const extras=[...actions.children].filter(node=>node!==main&&node!==project&&node!==details);
          if(extras.length){
            if(!details){
              details=document.createElement('details');
              details.className='v33-more-actions';
              const summary=document.createElement('summary');
              summary.textContent='更多';
              const menu=document.createElement('div');
              menu.className='v33-more-actions-menu';
              details.append(summary,menu);
              actions.appendChild(details);
            }
            const menu=details.querySelector('.v33-more-actions-menu');
            extras.forEach(node=>menu?.appendChild(node));
          }

          project=actions.querySelector('.project-v20-add');
          if(project&&project.parentElement!==actions){
            if(details)actions.insertBefore(project,details);
            else actions.appendChild(project);
          }

          if(details&&!details.querySelector('.v33-more-actions-menu')?.children.length)details.remove();
        });
      }finally{
        normalizing=false;
      }
    };
    const queueNormalize=()=>{
      if(normalizeQueued)return;
      normalizeQueued=true;
      requestAnimationFrame(normalizeResultActions);
    };
    if(results){
      new MutationObserver(queueNormalize).observe(results,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
      results.addEventListener('click',()=>setTimeout(queueNormalize,0),true);
      [0,100,350,900,1800].forEach(delay=>setTimeout(queueNormalize,delay));
    }

    const removeSettingsDecoration=()=>{
      document.querySelectorAll('.simple-settings-v29-header span').forEach(node=>node.remove());
    };
    new MutationObserver(removeSettingsDecoration).observe(body,{childList:true,subtree:true});
    removeSettingsDecoration();

    document.querySelectorAll('#researchOsRail,#researchOsStatusbar').forEach(node=>node.setAttribute('aria-hidden','true'));
    syncActiveView();
    syncResultsState();
    queueNormalize();
  });
})();