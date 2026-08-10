(() => {
  const PROJECTS_KEY = 'research-search:projects-v19';
  const ACTIVE_KEY = 'research-search:active-project-v19';
  const AI_KEY = 'research-search:ai-settings-v1';
  const EVIDENCE_META_KEY = 'research-os:evidence-meta';
  const SAVED_KEY = 'research-search:saved';
  const VERSION = 20;
  const PHASES = ['探索','验证','收敛','归档'];
  const CLAIM_STATES = {open:'待验证',support:'已有支持',counter:'存在反证'};
  const PRESETS = {
    explore:{label:'技术探索',style:'standard',batchSize:16,onlyWithSource:false},
    review:{label:'系统综述',style:'detailed',batchSize:16,onlyWithSource:true},
    engineering:{label:'工程落地',style:'detailed',batchSize:10,onlyWithSource:true},
    patent:{label:'专利侦察',style:'brief',batchSize:10,onlyWithSource:true}
  };
  const clean = value => String(value ?? '').replace(/\s+/g,' ').trim();
  const esc = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const load = (key,fallback) => { try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; } catch { return fallback; } };
  const save = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); } catch {} };
  const now = () => new Date().toISOString();
  const id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const fmtDate = value => value ? new Date(value).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}) : '—';
  const stateSafe = () => { try { return state; } catch { return null; } };
  const itemType = item => item?.type || (String(item?.key || '').startsWith('paper:') ? 'paper' : String(item?.key || '').startsWith('patent:') ? 'patent' : String(item?.key || '').startsWith('blog:') ? 'blog' : 'web');
  const typeLabel = type => ({paper:'论文',patent:'专利',blog:'技术文章',official:'官网',web:'网页'})[type] || '资料';
  const laneLabel = lane => ({inbox:'待研判',support:'支持',counter:'反证',method:'方法',prior:'先验 / Prior Art'})[lane] || '待研判';

  function normalizeProject(project={}) {
    return {
      ...project,
      id:clean(project.id) || id('project'),
      name:clean(project.name) || '未命名研究项目',
      strategy:PRESETS[project.strategy] ? project.strategy : 'explore',
      aiEnabled:Boolean(project.aiEnabled),
      status:PHASES.includes(project.status) ? project.status : '探索',
      question:clean(project.question || ''),
      description:String(project.description || '').trim(),
      queries:Array.isArray(project.queries) ? project.queries.slice(0,80) : [],
      evidence:Array.isArray(project.evidence) ? project.evidence.slice(0,240) : [],
      library:Array.isArray(project.library) ? project.library.slice(0,300) : [],
      claims:Array.isArray(project.claims) ? project.claims.slice(0,120) : [],
      tasks:Array.isArray(project.tasks) ? project.tasks.slice(0,120) : [],
      activity:Array.isArray(project.activity) ? project.activity.slice(0,160) : [],
      createdAt:project.createdAt || now(),
      updatedAt:project.updatedAt || project.createdAt || now(),
      schemaVersion:VERSION
    };
  }
  function projects() {
    const list = load(PROJECTS_KEY,[]);
    return (Array.isArray(list) ? list : []).map(normalizeProject);
  }
  function persistProjects(list) { save(PROJECTS_KEY,list.map(normalizeProject)); }
  function activeId() { return localStorage.getItem(ACTIVE_KEY) || ''; }
  function activeProject() { return projects().find(project => project.id === activeId()) || null; }
  function setActive(projectId) {
    if (projectId) localStorage.setItem(ACTIVE_KEY,projectId); else localStorage.removeItem(ACTIVE_KEY);
    window.dispatchEvent(new CustomEvent('research-project-changed',{detail:{projectId}}));
  }
  function updateProject(projectId,mutator,{activity}={}) {
    const list = projects();
    const index = list.findIndex(project => project.id === projectId);
    if (index < 0) return null;
    const draft = normalizeProject(structuredClone ? structuredClone(list[index]) : JSON.parse(JSON.stringify(list[index])));
    mutator(draft);
    draft.updatedAt = now();
    if (activity) draft.activity = [{id:id('activity'),text:activity,at:now()},...(draft.activity||[])].slice(0,160);
    list[index] = normalizeProject(draft);
    persistProjects(list);
    window.dispatchEvent(new CustomEvent('research-project-updated',{detail:{projectId}}));
    return list[index];
  }
  function currentSnapshot(item) {
    if (!item) return null;
    return {
      key:clean(item.key),type:itemType(item),title:clean(item.title || item.display_name || '未命名资料'),
      url:item.url || item.doi || '',year:item.year || item.publication_year || null,
      source:clean(item.venue || item.domain || item.source || item.assignees?.[0] || ''),
      summary:clean(item.summaryZh || item.abstract || item.description || item.snippet || '').slice(0,500),
      capturedAt:now()
    };
  }
  function findItem(key) {
    const current = stateSafe();
    if (!current) return load(SAVED_KEY,{})?.[key] || null;
    return [current.papers||[],current.patents||[],current.blogs||[],current.web||[]].flat().find(item => item?.key === key) || current.saved?.[key] || load(SAVED_KEY,{})?.[key] || null;
  }
  function resultCounts() {
    const current = stateSafe();
    return {
      paper:(current?.papers||[]).length,patent:(current?.patents||[]).length,
      blog:(current?.blogs||[]).length,web:(current?.web||[]).length
    };
  }
  function addQueryToActive(query) {
    const project = activeProject();
    query = clean(query);
    if (!project || !query) return;
    const counts = resultCounts();
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    updateProject(project.id,draft => {
      const latest = draft.queries?.[0];
      if (latest && latest.q.toLowerCase() === query.toLowerCase() && Date.now()-new Date(latest.at).getTime() < 45000) {
        latest.at = now(); latest.counts = counts; latest.total = total;
      } else {
        draft.queries = [{id:id('query'),q:query,at:now(),counts,total},...(draft.queries||[]).filter(item=>clean(item.q).toLowerCase()!==query.toLowerCase())].slice(0,80);
      }
      if (!draft.question) draft.question = query;
    },{activity:`检索“${query}” · ${total} 条结果`});
  }
  function syncLibrary(key,forceAdd=false) {
    const project = activeProject();
    if (!project || !key) return;
    const saved = stateSafe()?.saved || load(SAVED_KEY,{});
    const shouldKeep = forceAdd || Boolean(saved?.[key]);
    const item = findItem(key);
    updateProject(project.id,draft => {
      draft.library = (draft.library||[]).filter(entry => entry.key !== key);
      if (shouldKeep && item) draft.library.unshift(currentSnapshot(item));
    },{activity:shouldKeep && item ? `加入项目资料库：${clean(item.title).slice(0,54)}` : `从项目资料库移出一条资料`});
  }
  function syncEvidence(key,{remove=false}={}) {
    const project = activeProject();
    if (!project || !key) return;
    const item = findItem(key);
    const meta = load(EVIDENCE_META_KEY,{})?.[key] || {};
    updateProject(project.id,draft => {
      draft.evidence = (draft.evidence||[]).filter(entry => entry.key !== key);
      if (!remove && item) draft.evidence.unshift({...currentSnapshot(item),lane:meta.lane || 'inbox',addedAt:meta.addedAt || now(),updatedAt:now()});
    },{activity:remove ? '从项目证据集中移出一条资料' : item ? `加入项目证据：${clean(item.title).slice(0,52)}` : '更新项目证据'});
  }
  function syncEvidenceLane(key,lane) {
    const project = activeProject();
    if (!project || !key) return;
    updateProject(project.id,draft => {
      const entry = (draft.evidence||[]).find(item => item.key === key);
      if (entry) { entry.lane = lane; entry.updatedAt = now(); }
    },{activity:`证据分类调整为“${laneLabel(lane)}”`});
  }

  let list = projects();
  if (JSON.stringify(load(PROJECTS_KEY,[])) !== JSON.stringify(list)) persistProjects(list);

  const button = document.createElement('button');
  button.id = 'projectWorkspaceBtn';
  button.className = 'ghost-btn project-v20-entry';
  button.type = 'button';
  button.textContent = '项目';
  const control = document.querySelector('#controlCenterBtn');
  (control || document.querySelector('#settingsBtn'))?.before(button);

  const dialog = document.createElement('dialog');
  dialog.id = 'projectWorkspaceDialog';
  dialog.className = 'project-v20-dialog';
  dialog.innerHTML = `
    <div class="project-v20-shell">
      <aside class="project-v20-sidebar">
        <div class="project-v20-brand"><span>项目工作区</span><strong>Research Project</strong></div>
        <button type="button" class="project-v20-new" data-project-new>＋ 新建研究项目</button>
        <div class="project-v20-list" data-project-list></div>
        <div class="project-v20-sidefoot"><span>项目数据保存在当前浏览器</span><button type="button" data-project-close>返回科研系统</button></div>
      </aside>
      <main class="project-v20-main">
        <header class="project-v20-topbar">
          <div data-project-breadcrumb><span>研究项目</span><strong>未选择项目</strong></div>
          <div><button type="button" data-project-open-search>进入检索</button><button type="button" data-project-control>控制台</button><button type="button" data-project-close aria-label="关闭">×</button></div>
        </header>
        <div class="project-v20-canvas" data-project-canvas></div>
      </main>
    </div>`;
  document.body.appendChild(dialog);

  const q = selector => dialog.querySelector(selector);
  function kpis(project) {
    const supported = (project.claims||[]).filter(item=>item.state==='support').length;
    const open = (project.claims||[]).filter(item=>item.state==='open').length;
    const done = (project.tasks||[]).filter(item=>item.done).length;
    return {queries:project.queries.length,library:project.library.length,evidence:project.evidence.length,claims:project.claims.length,supported,open,tasks:project.tasks.length,done};
  }
  function queryTypeSummary(entry) {
    const counts = entry.counts || {};
    const parts = [];
    if (counts.paper) parts.push(`论文 ${counts.paper}`);
    if (counts.patent) parts.push(`专利 ${counts.patent}`);
    if (counts.blog) parts.push(`文章 ${counts.blog}`);
    if (counts.web) parts.push(`网页 ${counts.web}`);
    return parts.join(' · ') || `${entry.total || 0} 条结果`;
  }
  function renderProjectList() {
    const all = projects().sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
    const active = activeId();
    q('[data-project-list]').innerHTML = all.length ? all.map(project => `
      <button type="button" class="project-v20-listitem ${project.id===active?'active':''}" data-project-select="${esc(project.id)}">
        <span>${esc(project.status)}</span><strong>${esc(project.name)}</strong><small>${project.queries.length} 次检索 · ${project.evidence.length} 条证据</small>
      </button>`).join('') : `<div class="project-v20-empty-side"><strong>还没有项目</strong><p>新建一个项目，把检索、证据和判断留在同一个上下文里。</p></div>`;
  }
  function evidencePreview(project) {
    const lanes = ['inbox','support','counter','method','prior'];
    const grouped = Object.fromEntries(lanes.map(lane=>[lane,(project.evidence||[]).filter(item=>(item.lane||'inbox')===lane)]));
    return `<div class="project-v20-evidence-summary">${lanes.map(lane=>`<article><span>${esc(laneLabel(lane))}</span><strong>${grouped[lane].length}</strong></article>`).join('')}</div>
      <div class="project-v20-records">${project.evidence.length ? project.evidence.slice(0,5).map(item=>`<button type="button" data-project-record="${esc(item.key)}"><span>${esc(typeLabel(item.type))} · ${esc(item.year || item.source || '')}</span><strong>${esc(item.title)}</strong></button>`).join('') : '<p class="project-v20-empty-inline">还没有项目证据。检索结果中点击“证据”即可自动归入当前项目。</p>'}</div>`;
  }
  function claimsHtml(project) {
    return project.claims.length ? project.claims.slice(0,8).map(claim=>`<article class="project-v20-claim ${esc(claim.state||'open')}"><div><span>${esc(CLAIM_STATES[claim.state]||'待验证')}</span><time>${esc(fmtDate(claim.updatedAt||claim.createdAt))}</time></div><p>${esc(claim.text)}</p><div class="project-v20-claim-actions"><button type="button" data-claim-state="${esc(claim.id)}:open">待验证</button><button type="button" data-claim-state="${esc(claim.id)}:support">已有支持</button><button type="button" data-claim-state="${esc(claim.id)}:counter">存在反证</button><button type="button" data-claim-delete="${esc(claim.id)}">删除</button></div></article>`).join('') : '<p class="project-v20-empty-inline">还没有阶段结论。这里适合记录“当前认为是什么”，而不是让系统替你下结论。</p>';
  }
  function tasksHtml(project) {
    return project.tasks.length ? project.tasks.slice(0,10).map(task=>`<label class="project-v20-task ${task.done?'done':''}"><input type="checkbox" data-task-toggle="${esc(task.id)}" ${task.done?'checked':''}/><span><strong>${esc(task.text)}</strong><small>${esc(task.done?'已完成':`创建于 ${fmtDate(task.createdAt)}`)}</small></span><button type="button" data-task-delete="${esc(task.id)}" aria-label="删除任务">×</button></label>`).join('') : '<p class="project-v20-empty-inline">没有下一步任务。把要补的论文、专利、实验或验证动作写在这里。</p>';
  }
  function renderProject(project) {
    const stats = kpis(project);
    q('[data-project-breadcrumb]').innerHTML = `<span>研究项目 · ${esc(PRESETS[project.strategy]?.label || '技术探索')}</span><strong>${esc(project.name)}</strong>`;
    q('[data-project-canvas]').innerHTML = `
      <section class="project-v20-hero">
        <div class="project-v20-hero-copy">
          <div class="project-v20-phase"><span>当前阶段</span><select data-project-status>${PHASES.map(phase=>`<option ${phase===project.status?'selected':''}>${phase}</option>`).join('')}</select></div>
          <input class="project-v20-name" data-project-name value="${esc(project.name)}" aria-label="项目名称" />
          <textarea class="project-v20-question" data-project-question rows="2" placeholder="这个项目真正要回答的研究问题是什么？">${esc(project.question)}</textarea>
          <textarea class="project-v20-desc" data-project-description rows="2" placeholder="补充研究边界、约束、应用场景或不希望混入的方向…">${esc(project.description)}</textarea>
        </div>
        <div class="project-v20-hero-actions"><button type="button" data-project-save-definition>保存研究定义</button><button type="button" data-project-run-question>检索研究问题</button></div>
      </section>
      <section class="project-v20-kpis">
        <article><span>检索轨迹</span><strong>${stats.queries}</strong><small>项目内保留最近 80 次</small></article>
        <article><span>项目资料库</span><strong>${stats.library}</strong><small>当前项目收藏快照</small></article>
        <article><span>证据集合</span><strong>${stats.evidence}</strong><small>支持 / 反证 / 方法 / 先验</small></article>
        <article><span>阶段结论</span><strong>${stats.claims}</strong><small>支持 ${stats.supported} · 待验证 ${stats.open}</small></article>
        <article><span>下一步任务</span><strong>${stats.done}/${stats.tasks}</strong><small>只统计你手动勾选的任务</small></article>
      </section>
      <div class="project-v20-grid project-v20-grid-top">
        <section class="project-v20-panel project-v20-query-panel"><header><div><span>检索轨迹</span><h3>这个项目查过什么</h3></div><button type="button" data-project-open-search>新检索</button></header>
          <div class="project-v20-query-list">${project.queries.length ? project.queries.slice(0,10).map(entry=>`<button type="button" data-project-query="${esc(entry.q)}"><span>${esc(fmtDate(entry.at))}</span><strong>${esc(entry.q)}</strong><small>${esc(queryTypeSummary(entry))}</small></button>`).join('') : '<p class="project-v20-empty-inline">还没有项目检索。输入研究问题后执行第一次搜索。</p>'}</div>
        </section>
        <section class="project-v20-panel"><header><div><span>证据工作区</span><h3>当前材料如何支持判断</h3></div><button type="button" data-project-evidence-view>打开证据板</button></header>${evidencePreview(project)}</section>
      </div>
      <div class="project-v20-grid">
        <section class="project-v20-panel"><header><div><span>阶段结论</span><h3>把判断写成可被推翻的句子</h3></div></header><div class="project-v20-compose"><textarea data-claim-input rows="2" placeholder="例如：现有方法主要依赖规则驱动的几何约束，端到端方法仍缺少工程容差证据。"></textarea><button type="button" data-claim-add>添加待验证结论</button></div><div class="project-v20-claims">${claimsHtml(project)}</div></section>
        <section class="project-v20-panel"><header><div><span>下一步路线</span><h3>还要补什么证据或动作</h3></div></header><div class="project-v20-compose compact"><input data-task-input type="text" placeholder="例如：补查 2024–2026 年工程图重建专利"/><button type="button" data-task-add>添加任务</button></div><div class="project-v20-tasks">${tasksHtml(project)}</div></section>
      </div>
      <div class="project-v20-grid project-v20-grid-bottom">
        <section class="project-v20-panel"><header><div><span>项目资料库</span><h3>收藏到这个项目的资料</h3></div><button type="button" data-project-saved-view>查看全部收藏</button></header><div class="project-v20-library">${project.library.length ? project.library.slice(0,8).map(item=>`<button type="button" data-project-record="${esc(item.key)}"><span>${esc(typeLabel(item.type))} · ${esc(item.year || item.source || '')}</span><strong>${esc(item.title)}</strong></button>`).join('') : '<p class="project-v20-empty-inline">项目资料库为空。在结果中点击收藏或证据即可加入。</p>'}</div></section>
        <section class="project-v20-panel"><header><div><span>最近活动</span><h3>项目发生了什么变化</h3></div></header><div class="project-v20-activity">${project.activity.length ? project.activity.slice(0,12).map(item=>`<div><time>${esc(fmtDate(item.at))}</time><p>${esc(item.text)}</p></div>`).join('') : '<p class="project-v20-empty-inline">还没有活动记录。</p>'}</div></section>
      </div>`;
  }
  function renderEmpty() {
    q('[data-project-breadcrumb]').innerHTML = '<span>研究项目</span><strong>项目启动台</strong>';
    q('[data-project-canvas]').innerHTML = `<section class="project-v20-launch"><span>PROJECT WORKSPACE</span><h2>把一个技术问题变成持续研究项目</h2><p>项目会保留自己的研究问题、检索轨迹、资料库、证据分类、阶段结论和下一步任务。所有内容先只存于当前浏览器。</p><button type="button" data-project-new>创建第一个研究项目</button></section>`;
  }
  function render() {
    renderProjectList();
    const project = activeProject();
    if (project) renderProject(project); else renderEmpty();
  }
  function createProject() {
    const current = stateSafe();
    const query = clean(current?.query || document.querySelector('#queryInput')?.value || '');
    const project = normalizeProject({
      id:id('project'),name:query ? query.slice(0,52) : '新的研究项目',question:query,
      strategy:'explore',aiEnabled:false,status:'探索',createdAt:now(),updatedAt:now(),
      activity:[{id:id('activity'),text:'创建研究项目',at:now()}]
    });
    const next=[project,...projects()];
    persistProjects(next); setActive(project.id); applyProjectAi(project); render();
  }
  function applyProjectAi(project) {
    if (!project) return;
    const preset=PRESETS[project.strategy]||PRESETS.explore;
    save(AI_KEY,{...load(AI_KEY,{}),enabled:Boolean(project.aiEnabled),style:preset.style,batchSize:preset.batchSize,onlyWithSource:preset.onlyWithSource});
    window.dispatchEvent(new CustomEvent('research-ai-settings-changed'));
  }
  function selectProject(projectId) { setActive(projectId); const project=activeProject(); applyProjectAi(project); render(); }
  function openWorkspace() {
    render();
    if (!dialog.open) dialog.showModal();
    const url=new URL(location.href); url.searchParams.set('project','1'); history.replaceState(null,'',url);
  }
  function closeWorkspace() {
    if (dialog.open) dialog.close();
    const url=new URL(location.href); url.searchParams.delete('project'); history.replaceState(null,'',url);
  }
  function openSearch(query='') {
    closeWorkspace();
    if (query) {
      const input=document.querySelector('#queryInput'); if (input) input.value=query;
      if (typeof performSearch==='function') performSearch(query);
    } else {
      document.querySelector('#queryInput')?.focus();
    }
  }
  function openRecord(key) {
    closeWorkspace();
    const current=stateSafe();
    if (current?.saved?.[key]) {
      current.activeTab='saved';
      try { render(); } catch {}
    }
    setTimeout(()=>{
      const card=[...document.querySelectorAll('.ux-result[data-key]')].find(node=>node.dataset.key===key);
      card?.scrollIntoView({block:'center'});
      card?.querySelector('.research-preview-btn')?.click();
    },120);
  }

  button.addEventListener('click',openWorkspace);
  dialog.addEventListener('click',event=>{
    const newBtn=event.target.closest('[data-project-new]'); if (newBtn) { createProject(); return; }
    const closeBtn=event.target.closest('[data-project-close]'); if (closeBtn) { closeWorkspace(); return; }
    const select=event.target.closest('[data-project-select]'); if (select) { selectProject(select.dataset.projectSelect); return; }
    if (event.target.closest('[data-project-control]')) { closeWorkspace(); document.querySelector('#controlCenterBtn')?.click(); return; }
    const project=activeProject();
    if (!project) return;
    if (event.target.closest('[data-project-open-search]')) { openSearch(); return; }
    if (event.target.closest('[data-project-save-definition]')) {
      updateProject(project.id,draft=>{
        draft.name=clean(q('[data-project-name]')?.value).slice(0,100)||draft.name;
        draft.question=clean(q('[data-project-question]')?.value).slice(0,1000);
        draft.description=String(q('[data-project-description]')?.value||'').trim().slice(0,3000);
        draft.status=q('[data-project-status]')?.value||draft.status;
      },{activity:'更新研究定义'}); render(); return;
    }
    if (event.target.closest('[data-project-run-question]')) { const question=clean(q('[data-project-question]')?.value||project.question); if (question) openSearch(question); return; }
    const queryBtn=event.target.closest('[data-project-query]'); if (queryBtn) { openSearch(queryBtn.dataset.projectQuery); return; }
    if (event.target.closest('[data-project-evidence-view]')) { closeWorkspace(); const target=document.querySelector('[data-os-view="evidence"]'); target?.click(); return; }
    if (event.target.closest('[data-project-saved-view]')) { closeWorkspace(); document.querySelector('.tab[data-tab="saved"]')?.click(); return; }
    const record=event.target.closest('[data-project-record]'); if (record) { openRecord(record.dataset.projectRecord); return; }
    if (event.target.closest('[data-claim-add]')) {
      const text=clean(q('[data-claim-input]')?.value).slice(0,1600); if (!text) return;
      updateProject(project.id,draft=>{ draft.claims=[{id:id('claim'),text,state:'open',createdAt:now(),updatedAt:now()},...(draft.claims||[])]; },{activity:'新增一条待验证结论'}); render(); return;
    }
    const claimState=event.target.closest('[data-claim-state]'); if (claimState) {
      const [claimId,stateName]=claimState.dataset.claimState.split(':');
      updateProject(project.id,draft=>{ const claim=draft.claims.find(item=>item.id===claimId); if (claim) { claim.state=stateName; claim.updatedAt=now(); } },{activity:`更新阶段结论状态：${CLAIM_STATES[stateName]||stateName}`}); render(); return;
    }
    const claimDelete=event.target.closest('[data-claim-delete]'); if (claimDelete) { updateProject(project.id,draft=>{ draft.claims=draft.claims.filter(item=>item.id!==claimDelete.dataset.claimDelete); },{activity:'删除一条阶段结论'}); render(); return; }
    if (event.target.closest('[data-task-add]')) {
      const text=clean(q('[data-task-input]')?.value).slice(0,500); if (!text) return;
      updateProject(project.id,draft=>{ draft.tasks=[{id:id('task'),text,done:false,createdAt:now(),updatedAt:now()},...(draft.tasks||[])]; },{activity:'新增下一步任务'}); render(); return;
    }
    const taskDelete=event.target.closest('[data-task-delete]'); if (taskDelete) { updateProject(project.id,draft=>{ draft.tasks=draft.tasks.filter(item=>item.id!==taskDelete.dataset.taskDelete); },{activity:'删除一项任务'}); render(); return; }
  });
  dialog.addEventListener('change',event=>{
    const project=activeProject(); if (!project) return;
    const task=event.target.closest('[data-task-toggle]');
    if (task) { updateProject(project.id,draft=>{ const row=draft.tasks.find(item=>item.id===task.dataset.taskToggle); if (row) { row.done=task.checked; row.updatedAt=now(); } },{activity:task.checked?'完成一项研究任务':'重新打开一项研究任务'}); render(); }
  });

  const results=document.querySelector('#results');
  results?.addEventListener('click',event=>{
    const evidence=event.target.closest('[data-os-evidence]');
    const saved=event.target.closest('[data-save]');
    if (evidence) setTimeout(()=>syncEvidence(evidence.dataset.osEvidence),20);
    if (saved) setTimeout(()=>syncLibrary(saved.dataset.save),20);
  });
  document.addEventListener('click',event=>{
    const remove=event.target.closest('[data-os-evidence-remove]');
    if (remove) setTimeout(()=>syncEvidence(remove.dataset.osEvidenceRemove,{remove:true}),20);
  });
  document.addEventListener('change',event=>{
    const lane=event.target.closest('[data-os-evidence-lane]');
    if (lane) setTimeout(()=>syncEvidenceLane(lane.dataset.osEvidenceLane,lane.value),20);
  });

  try {
    if (typeof performSearch==='function') {
      const previous=performSearch;
      const wrapped=async function projectAwareSearch(...args) {
        const result=await previous(...args);
        const query=clean(args[0] || stateSafe()?.query);
        if (query) addQueryToActive(query);
        return result;
      };
      wrapped.__researchOsWrapped=true;
      wrapped.__projectV20Wrapped=true;
      performSearch=wrapped;
    }
  } catch {}

  window.ResearchProjects = {projects,activeProject,updateProject,open:openWorkspace,create:createProject,syncEvidence,syncLibrary};
  window.addEventListener('research-project-updated',()=>{ if (dialog.open) render(); });
  window.addEventListener('research-project-changed',()=>{ if (dialog.open) render(); });

  const params=new URLSearchParams(location.search);
  if (params.get('project')==='1') setTimeout(openWorkspace,80);
  else if (!params.get('q') && !params.get('view') && !params.get('control') && !params.get('settings') && activeProject()) setTimeout(openWorkspace,260);
})();