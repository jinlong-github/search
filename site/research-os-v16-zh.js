(() => {
  const exact = new Map([
    ['INTELLIGENCE OPERATING SYSTEM','科研情报操作系统'],
    ['SESSION','研究会话'],['READY','就绪'],['LIVE SOURCES','实时来源'],
    ['LOCAL HEURISTICS · SOURCE-FIRST','本地启发式 · 来源优先'],
    ['RESEARCH MAP','研究地图'],['TIMELINE','时间演进'],['ENTITY INTELLIGENCE','实体情报'],['EVIDENCE BOARD','证据板'],['TECHNOLOGY PATH','技术脉络'],
    ['AUTHORS','作者'],['VENUES & DOMAINS','来源与域名'],['ORGANIZATIONS / ASSIGNEES','机构 / 专利申请人'],
    ['FIRST SIGNAL','最早信号'],['PEAK DENSITY','密度峰值'],['LATEST SIGNAL','最新信号'],
    ['LEAD · 高信号','核心 · 高信号'],['EXPLORE · 扩展','探索 · 扩展'],
    ['01 / QUERY','01 / 检索问题'],['02 / RESEARCH','02 / 学术研究'],['03 / IP','03 / 知识产权'],['04 / ENGINEERING','04 / 工程落地'],
    ['Query','检索问题'],['Research','研究成果'],['IP','知识产权'],['Engineering','工程落地'],
    ['session','研究会话'],['DATA SOURCE','数据源'],['Prior Art','现有技术'],['先验 / Prior Art','现有技术'],
    ['Web / 官网','网页 / 官网'],['Web','网页'],['layers','层级'],['GitHub','GitHub']
  ]);
  const iconMap = new Map([
    ['SRCH','搜'],['MAP','图'],['TIME','时'],['ENT','实'],['EVD','证'],['PATH','脉'],
    ['S','搜'],['M','图'],['T','时'],['E','实'],['V','证'],['P','脉'],['EX','导']
  ]);
  const textRules = [
    [/^(\d+) records$/,'$1 条结果'],[/^(\d+) sources$/,'$1 个来源'],[/^(\d+) evidence$/,'$1 条证据'],
    [/^(\d+) records · (\d+) evidence$/,'$1 条结果 · $2 条证据'],
    [/^(\d+) clusters$/,'$1 个主题簇'],[/^(\d+) types$/,'$1 类来源'],
    [/^(\d+) record$/,'$1 条记录'],[/^(\d+) source types$/,'$1 类来源'],
    [/^query\s+(\d+)\s+·\s+signal\s+(\d+)$/i,'相关度 $1 · 信号 $2'],
    [/^signal\s+(\d+)$/i,'信号 $1']
  ];
  let queued = false;

  function translateText(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    if (exact.has(raw)) return exact.get(raw);
    for (const [pattern,replacement] of textRules) {
      if (pattern.test(raw)) return raw.replace(pattern,replacement);
    }
    return null;
  }

  function replacePhrases(text) {
    let next = String(text || '');
    const replacements = [
      ['Query → Research → IP → Engineering','检索问题 → 学术研究 → 知识产权 → 工程落地'],
      ['Web 工程信号','网页工程信号'],['Web / 官网','网页 / 官网'],[' / Web ',' / 网页 '],
      ['Prior Art','现有技术'],['Worker / PatentsView','后端代理 / PatentsView']
    ];
    replacements.forEach(([from,to]) => { next = next.split(from).join(to); });
    return next;
  }

  function localize() {
    const brand = document.querySelector('.brand-copy strong');
    if (brand && brand.textContent.trim() !== '科研情报系统') brand.textContent = '科研情报系统';
    const brandSmall = document.querySelector('.brand-copy small');
    if (brandSmall && brandSmall.textContent.trim() !== '科研情报操作系统') brandSmall.textContent = '科研情报操作系统';
    const railBrand = document.querySelector('.research-os-rail-brand span');
    if (railBrand && railBrand.textContent.trim() !== '研') railBrand.textContent = '研';

    document.querySelectorAll('.research-os-nav .os-icon,.research-command-item .icon').forEach(node => {
      const next = iconMap.get(node.textContent.trim());
      if (next && node.textContent !== next) node.textContent = next;
    });
    document.querySelectorAll('.research-os-nav .os-label').forEach(node => {
      const text = node.textContent.replace(/\s*·\s*Alt\+\d+\s*$/,'').trim();
      if (text && node.textContent !== text) node.textContent = text;
    });

    document.querySelectorAll([
      '.research-os-stage-kicker','.research-os-metric span','.research-os-statusbar span','.research-os-statusbar strong',
      '.research-os-session-chip','.research-timeline-notes small','.research-entity-panel-head h3','.research-entity-row p',
      '.research-path-node h3','.research-path-node-head small','.research-path-item span','.research-path-item small',
      '.research-map-cluster-label b','.research-map-cluster-label span','.research-map-cluster-list span','.os-source-key span',
      '.dialog-kicker','.research-command-item small'
    ].join(',')).forEach(node => {
      const translated = translateText(node.textContent);
      const next = translated || replacePhrases(node.textContent);
      if (next && next !== node.textContent) node.textContent = next;
    });

    document.querySelectorAll('.research-os-stage-head > div > p:not(.research-os-stage-kicker),.research-os-integrity,.research-path-gap').forEach(node => {
      const next = replacePhrases(node.textContent);
      if (next !== node.textContent) node.textContent = next;
    });

    document.querySelectorAll('.research-os-stage-metrics .research-os-metric span').forEach(node => {
      const map = {records:'条结果',clusters:'个主题簇',types:'类来源',layers:'层级',first:'起始',latest:'最新',peak:'峰值',saved:'已保存',lanes:'研判分类',papers:'论文',patents:'专利',engineering:'工程信号'};
      const key = node.textContent.trim();
      if (map[key]) node.textContent = map[key];
    });

    document.querySelectorAll('.research-timeline-notes strong,.research-map-cluster-label span,.research-path-item strong').forEach(node => {
      let next = node.textContent;
      next = next.replace(/(\d+) records/g,'$1 条结果').replace(/(\d+) source types/g,'$1 类来源');
      if (next !== node.textContent) node.textContent = next;
    });

    /* 对纯 UI 叶节点做安全的精确词典翻译，不碰论文标题、作者名或来源名。 */
    document.querySelectorAll('body *').forEach(node => {
      if (node.childElementCount) return;
      const translated = translateText(node.textContent);
      if (translated && translated !== node.textContent) node.textContent = translated;
    });

    document.querySelectorAll('[data-os-status-query]').forEach(node => {
      if (node.textContent.trim() === 'READY') node.textContent = '就绪';
    });

    const title = document.querySelector('title');
    if (title && title.textContent !== '科研情报系统 · 技术研究工作台') title.textContent = '科研情报系统 · 技术研究工作台';
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; localize(); });
  }

  localize();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  [100,300,800,1800,4200,8000].forEach(delay => setTimeout(localize,delay));
})();
