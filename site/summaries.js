(() => {
  const TOPIC_RULES = [
    [/large language model|\bllm(s)?\b/i,'大语言模型'],
    [/vision language model|vision-language|\bvlm\b/i,'视觉语言模型'],
    [/multimodal/i,'多模态'],
    [/machine learning/i,'机器学习'],
    [/deep learning/i,'深度学习'],
    [/neural network/i,'神经网络'],
    [/transformer/i,'Transformer'],
    [/computer vision/i,'计算机视觉'],
    [/3d reconstruction|three-dimensional reconstruction/i,'三维重建'],
    [/engineering drawing|technical drawing/i,'工程图'],
    [/computer[- ]aided design|\bcad\b/i,'CAD'],
    [/boundary representation|\bb-?rep\b/i,'B-Rep'],
    [/point cloud/i,'点云'],
    [/parametric/i,'参数化建模'],
    [/geometric constraint|geometry constraint/i,'几何约束'],
    [/tolerance|tolerancing|\bpmi\b/i,'公差与 PMI'],
    [/generative ai|generative model/i,'生成式 AI'],
    [/diffusion model/i,'扩散模型'],
    [/reinforcement learning/i,'强化学习'],
    [/robot|robotics/i,'机器人'],
    [/autonomous/i,'自主系统'],
    [/digital twin/i,'数字孪生'],
    [/manufactur|machining|cnc/i,'制造与加工'],
    [/simulation|finite element|\bfea\b/i,'仿真分析'],
    [/knowledge graph/i,'知识图谱'],
    [/retrieval[- ]augmented|\brag\b/i,'RAG'],
    [/agentic|ai agent|agents\b/i,'AI 智能体'],
    [/semantic search|vector search/i,'语义检索'],
    [/patent/i,'专利技术'],
    [/benchmark/i,'基准评测']
  ];

  function cleanText(value='') {
    return String(value)
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function short(value='', max=72) {
    const text = cleanText(value);
    return text.length > max ? `${text.slice(0, max).trim()}…` : text;
  }

  function sourceText(item) {
    return cleanText(item.abstract || item.description || item.snippet || '');
  }

  function hasChinese(value='') { return /[\u3400-\u9fff]/.test(String(value)); }

  function conciseChinese(value='', max=160) {
    const text = cleanText(value);
    if (!text) return '';
    const parts = text.split(/(?<=[。！？!?])\s*/).filter(Boolean);
    const picked = (parts.slice(0, 2).join('') || text).trim();
    return short(picked, max);
  }

  function detectedTopics(item) {
    const text = `${item.title || ''} ${sourceText(item)} ${state.query || ''}`;
    const topics = [];
    for (const [rule, label] of TOPIC_RULES) {
      if (rule.test(text) && !topics.includes(label)) topics.push(label);
      if (topics.length >= 4) break;
    }
    return topics;
  }

  function researchSignals(text='') {
    const signals = [];
    if (/\b(propose[sd]?|present[sd]?|introduce[sd]?|develop[sd]?|design(ed)?)\b/i.test(text)) signals.push('提出或设计了相关方法/系统');
    if (/\b(framework|architecture|pipeline)\b/i.test(text)) signals.push('包含框架或流程设计');
    if (/\b(experiment|evaluation|evaluate[sd]?|benchmark|results? show|demonstrate[sd]?)\b/i.test(text)) signals.push('给出了实验、评估或基准结果');
    if (/\b(dataset|data set|corpus)\b/i.test(text)) signals.push('涉及数据集或语料');
    return signals.slice(0, 2);
  }

  function topicPhrase(item) {
    const topics = detectedTopics(item);
    return topics.length ? topics.join('、') : '该技术主题';
  }

  function fallbackSummary(item) {
    const original = sourceText(item);
    if (hasChinese(original)) return conciseChinese(original);

    const title = short(item.title || '该结果', 70);
    const topics = topicPhrase(item);
    const signals = researchSignals(original);

    if (item.type === 'paper') {
      const details = signals.length ? `从原始摘要可判断其${signals.join('，并')}` : '当前索引信息主要用于快速判断研究方向，具体方法与实验结论需结合原文';
      const cited = Number(item.citations || 0) > 0 ? `；索引显示约 ${fmtNumber(item.citations)} 次引用` : '';
      return `该论文聚焦${topics}，围绕“${title}”展开。${details}${cited}。`;
    }

    if (item.type === 'patent') {
      const owner = short(item.assignees?.[0] || '', 34);
      const form = /\bmethod\b/i.test(original) ? '方法' : /\bsystem\b/i.test(original) ? '系统' : /\bdevice|apparatus\b/i.test(original) ? '装置' : '技术方案';
      return `该专利涉及${topics}，围绕“${title}”描述相关${form}。${owner ? `主要申请/受让方为 ${owner}；` : ''}建议进一步核对权利要求、同族专利和法律状态以判断保护范围。`;
    }

    if (item.type === 'blog') {
      const domain = short(item.domain || domainOf(item.url), 36);
      const heat = Number(item.points || 0) > 0 ? `，在 Hacker News 获得约 ${fmtNumber(item.points)} points` : '';
      return `这篇技术文章关注${topics}，主题为“${title}”。${domain ? `来源于 ${domain}` : '可作为工程实践补充'}${heat}，适合快速了解产品进展、实现思路或社区讨论焦点。`;
    }

    if (item.type === 'web') {
      const domain = short(item.domain || domainOf(item.url), 36);
      const signal = signals.length ? `页面片段显示其${signals.join('，并')}。` : '';
      const official = item.official ? '该结果来自官网，可优先作为一手资料核对。' : '建议结合原网页核对信息来源和发布时间。';
      return `该网页来自 ${domain || '相关站点'}，内容与${topics}相关，主题为“${title}”。${signal}${official}`;
    }

    return `该结果主要涉及${topics}，主题为“${title}”。建议打开原始来源查看完整上下文。`;
  }

  function currentItems() {
    const map = new Map();
    const groups = [state.papers || [], state.patents || [], state.blogs || [], state.web || []];
    for (const group of groups) {
      for (const item of group) if (item?.key) map.set(item.key, item);
    }
    return [...map.values()];
  }

  function itemByKey() {
    const map = new Map(currentItems().map(item => [item.key, item]));
    for (const [key, item] of Object.entries(state.saved || {})) if (!map.has(key)) map.set(key, item);
    return map;
  }

  function prepareSummaries(items) {
    for (const item of items) {
      if (item.summaryZh && item.summarySource === 'ai') continue;
      item.summaryZh = fallbackSummary(item);
      item.summarySource = hasChinese(sourceText(item)) ? 'source' : 'local';
    }
  }

  function renderSummaryBlocks() {
    const items = itemByKey();
    $$('.ux-result[data-key]').forEach(card => {
      const item = items.get(card.dataset.key || '');
      if (!item) return;
      if (!item.summaryZh) {
        item.summaryZh = fallbackSummary(item);
        item.summarySource = hasChinese(sourceText(item)) ? 'source' : 'local';
      }

      const body = card.querySelector('.ux-result-body');
      if (!body) return;
      let block = card.querySelector('.ux-zh-summary');
      if (!block) {
        block = document.createElement('div');
        block.className = 'ux-zh-summary';
        const original = body.querySelector('.ux-description');
        const footer = body.querySelector('.ux-footer');
        body.insertBefore(block, original || footer || null);
      }

      const mode = item.summarySource === 'ai' ? 'AI 生成' : item.summarySource === 'source' ? '原文提炼' : '自动概述';
      block.innerHTML = `<div class="ux-zh-summary-head"><span>中文摘要</span><small>${esc(mode)}</small></div><p>${esc(item.summaryZh)}</p>`;

      const originalLabel = body.querySelector('.ux-description-label');
      if (originalLabel) originalLabel.textContent = item.type === 'web' || item.type === 'blog' ? '来源片段' : '原始摘要';
      if (item.type === 'paper') {
        const index = body.querySelector('.ux-index-source strong');
        if (index) index.textContent = item.indexSource || 'Crossref';
      }
    });
  }

  const previousRender = render;
  render = function renderWithChineseSummaries() {
    previousRender();
    prepareSummaries(currentItems());
    renderSummaryBlocks();
  };

  const previousPerformSearch = performSearch;
  performSearch = async function performSearchWithChineseSummaries(rawQuery) {
    await previousPerformSearch(rawQuery);
    prepareSummaries(currentItems());
    renderSummaryBlocks();
  };

  if (state.activeTab === 'saved') setTimeout(() => render(), 0);
})();
