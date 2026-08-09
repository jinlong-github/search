(() => {
  const stage = document.querySelector('#researchOsStage');
  const results = document.querySelector('#results');
  if (!stage || !results) return;

  const clean = value => String(value || '').replace(/\s+/g,' ').trim();
  const clamp = (value,min=0,max=100) => Math.max(min,Math.min(max,value));
  const hash = value => {
    let h = 2166136261;
    for (const char of String(value || '')) { h ^= char.charCodeAt(0); h = Math.imul(h,16777619); }
    return h >>> 0;
  };
  let timer = 0;
  let patching = false;

  function cardSignal(key) {
    const card = [...results.querySelectorAll('.ux-result[data-key]')].find(node => node.dataset.key === key);
    if (!card) return 0;
    const signal = Number(card.dataset.researchSignal || 0) || 0;
    const metrics = [...card.querySelectorAll('.ux-metrics span')].map(node => clean(node.textContent));
    const citations = Number((metrics.find(value => /^引用\s/.test(value)) || '').replace(/[^\d]/g,'')) || 0;
    return signal + Math.min(18,Math.log10(citations + 1) * 5);
  }

  function focusKeys(keys,label) {
    document.querySelector('[data-os-view="search"]')?.click();
    const wanted = new Set(keys);
    const cards = [...results.querySelectorAll('.ux-result[data-key]')];
    cards.forEach(card => {
      card.classList.toggle('os-focus-hit',wanted.has(card.dataset.key));
      card.classList.toggle('os-focus-dim',!wanted.has(card.dataset.key));
    });
    cards.find(card => wanted.has(card.dataset.key))?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    let banner = document.querySelector('#researchOsFocusBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'researchOsFocusBanner';
      banner.className = 'research-os-focus-banner';
      results.insertAdjacentElement('beforebegin',banner);
    }
    banner.textContent = `${label} · ${wanted.size} 条`;
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = '清除聚焦';
    clear.addEventListener('click',() => {
      cards.forEach(card => card.classList.remove('os-focus-hit','os-focus-dim'));
      banner.remove();
    },{once:true});
    banner.appendChild(clear);
  }

  function setNodePosition(node,cx,cy,index) {
    const key = node.dataset.osKey || `${index}`;
    const seed = hash(`${key}:fallback`);
    const angle = ((seed % 360) / 180) * Math.PI;
    const ring = 10 + ((seed >>> 8) % 15) + Math.min(8,index * .7);
    const x = clamp(cx + Math.cos(angle) * ring,7,93);
    const y = clamp(cy + Math.sin(angle) * ring * .65,9,91);
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    return {x,y};
  }

  function labelNode(text,count,x,y) {
    const label = document.createElement('div');
    label.className = 'research-map-cluster-label research-map-fallback-label';
    label.style.left = `${x}%`;
    label.style.top = `${y}%`;
    label.innerHTML = `<b>${text}</b><span>${count} records</span>`;
    return label;
  }

  function patchDegenerateMap() {
    if (patching || document.body.dataset.researchOsView !== 'map') return;
    const canvas = stage.querySelector('.research-map-canvas');
    if (!canvas) return;
    const nodes = [...canvas.querySelectorAll('.research-map-node[data-os-key]')];
    const labels = [...canvas.querySelectorAll('.research-map-cluster-label')];
    if (nodes.length < 8 || labels.length >= 2 || canvas.dataset.mapFallback === 'signal-layer') return;

    patching = true;
    try {
      const ranked = nodes.map(node => ({node,key:node.dataset.osKey,score:cardSignal(node.dataset.osKey)}))
        .sort((a,b) => b.score-a.score || a.key.localeCompare(b.key));
      const split = Math.max(3,Math.min(ranked.length-3,Math.ceil(ranked.length * .45)));
      const lead = ranked.slice(0,split);
      const explore = ranked.slice(split);
      if (!lead.length || !explore.length) return;

      labels.forEach(label => label.remove());
      canvas.appendChild(labelNode('LEAD · 高信号',lead.length,30,34));
      canvas.appendChild(labelNode('EXPLORE · 扩展',explore.length,70,62));

      const svg = canvas.querySelector('.research-map-svg');
      if (svg) svg.replaceChildren();
      const drawGroup = (group,cx,cy) => group.forEach((entry,index) => {
        const {x,y} = setNodePosition(entry.node,cx,cy,index);
        if (!svg) return;
        const line = document.createElementNS('http://www.w3.org/2000/svg','line');
        line.setAttribute('x1',String(cx));
        line.setAttribute('y1',String(cy));
        line.setAttribute('x2',String(x));
        line.setAttribute('y2',String(y));
        if (index > Math.ceil(group.length / 2)) line.setAttribute('class','cross');
        svg.appendChild(line);
      });
      drawGroup(lead,30,34);
      drawGroup(explore,70,62);

      const clusterList = stage.querySelector('.research-map-cluster-list');
      if (clusterList) {
        clusterList.replaceChildren();
        [
          ['LEAD · 高信号',lead],
          ['EXPLORE · 扩展',explore]
        ].forEach(([label,group]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.innerHTML = `<i></i><span>${label}</span><small>${group.length}</small>`;
          button.addEventListener('click',() => focusKeys(group.map(entry => entry.key),label));
          clusterList.appendChild(button);
        });
      }

      const metrics = [...stage.querySelectorAll('.research-os-metric')];
      if (metrics[1]) {
        const value = metrics[1].querySelector('b');
        const label = metrics[1].querySelector('span');
        if (value) value.textContent = '2';
        if (label) label.textContent = 'layers';
      }
      const integrity = stage.querySelector('.research-os-integrity');
      if (integrity && !integrity.textContent.includes('Lead / Explore')) {
        integrity.textContent += ' 当前主题词区分度不足，因此该会话自动退化为 Lead / Explore 检索信号分层；该分层仍不代表真实语义聚类。';
      }
      const description = stage.querySelector('.research-os-stage-head > div > p:not(.research-os-stage-kicker)');
      if (description && !description.textContent.includes('信号分层')) {
        description.textContent += ' · 主题区分不足，已切换检索信号分层';
      }
      canvas.dataset.mapFallback = 'signal-layer';
    } finally {
      patching = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(patchDegenerateMap,40);
  }

  new MutationObserver(schedule).observe(stage,{childList:true,subtree:true});
  [0,120,360,900,1800,3600,7200].forEach(delay => setTimeout(schedule,delay));
})();
