(() => {
  const stage = document.querySelector('#researchOsStage');
  if (!stage) return;

  const hydrated = new WeakMap();
  let timer = 0;

  function hydrateNode(node) {
    const cssText = node.getAttribute('style');
    if (!cssText || hydrated.get(node) === cssText) return;
    const declarations = cssText.split(';').map(part => part.trim()).filter(Boolean);
    node.removeAttribute('style');
    declarations.forEach(declaration => {
      const separator = declaration.indexOf(':');
      if (separator < 1) return;
      const property = declaration.slice(0,separator).trim();
      const value = declaration.slice(separator + 1).trim();
      if (!property || !value) return;
      try { node.style.setProperty(property,value); } catch {}
    });
    hydrated.set(node,cssText);
  }

  function hydrate() {
    [...stage.querySelectorAll('[style]')].forEach(hydrateNode);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(hydrate,0);
  }

  new MutationObserver(schedule).observe(stage,{childList:true,subtree:true});
  [0,40,120,320,900,1800,3600,7200].forEach(delay => setTimeout(hydrate,delay));
})();
