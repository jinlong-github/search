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

    body.classList.add('reference-v31','clarity-v32');

    const originalBrand=topbar.querySelector('.brand');
    originalBrand?.classList.add('v31-original-brand');
    const density=document.querySelector('#densityToggle');
    if(density)density.hidden=true;
    const settings=document.querySelector('#settingsBtn');
    if(settings)settings.textContent='AI 配置';

    const title=hero.querySelector('h1');
    const subtitle=hero.querySelector('.subtitle');
    if(title)title.textContent='研究搜索';
    if(subtitle)subtitle.textContent='先找到可信资料，再进入地图、时间、实体与证据分析。';

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
        <button class="active" type="button" data-v31-view="search"><span>⌕</span><b>检索</b></button>
        <button type="button" data-v32-analysis-root><span>◫</span><b>研究分析</b><i>›</i></button>
      </nav>
      <nav class="v32-analysis-nav" aria-label="研究分析视图">
        <button type="button" data-v31-view="map">研究地图</button>
        <button type="button" data-v31-view="timeline">时间演进</button>
        <button type="button" data-v31-view="entities">实体情报</button>
        <button type="button" data-v31-view="evidence">证据板</button>
        <button type="button" data-v31-view="path">技术脉络</button>
      </nav>
      <div class="v31-sidebar-spacer"></div>
      <nav class="v31-nav v31-nav-secondary" aria-label="辅助操作">
        <button type="button" data-v31-action="history"><span>◴</span><b>历史</b></button>
        <button type="button" data-v31-action="settings"><span>⚙</span><b>AI 配置</b></button>
        <button type="button" data-v31-action="export"><span>⇩</span><b>导出</b></button>
      </nav>`;

    const main=document.createElement('main');
    main.className='v31-main';

    const searchSlot=document.createElement('div');
    searchSlot.className='v31-search-slot';
    topbar.insertBefore(searchSlot,topActions||null);
    searchSlot.appendChild(searchForm);

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

    const syncActiveView=()=>{
      const view=body.dataset.researchOsView||'search';
      const inAnalysis=view!=='search';
      sidebar.classList.toggle('v32-analysis-open',inAnalysis);
      sidebar.querySelectorAll('[data-v31-view]').forEach(button=>{
        button.classList.toggle('active',button.dataset.v31View===view);
      });
      sidebar.querySelector('[data-v32-analysis-root]')?.classList.toggle('active',inAnalysis);
    };
    new MutationObserver(syncActiveView).observe(body,{attributes:true,attributeFilter:['data-research-os-view']});

    const syncResultsState=()=>{
      body.classList.toggle('v31-has-results',!workspace.classList.contains('hidden'));
    };
    new MutationObserver(syncResultsState).observe(workspace,{attributes:true,attributeFilter:['class']});

    document.querySelectorAll('#researchOsRail,#researchOsStatusbar').forEach(node=>node.setAttribute('aria-hidden','true'));
    syncActiveView();
    syncResultsState();
  });
})();