const { chromium } = require('playwright-core');
const fs = require('fs');

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:8000/').replace(/\/?$/, '/');
const url = query => `${BASE_URL}${query.startsWith('?') ? query : `?${query}`}`;

(async () => {
  const executablePath = ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
  assert(executablePath, 'Chrome not found');
  const browser = await chromium.launch({headless:true, executablePath, args:['--no-sandbox']});
  const context = await browser.newContext({acceptDownloads:true, viewport:{width:1440,height:1000}});
  const page = await context.newPage();
  const errors = [];
  const legacyStyleWarnings = [];
  page.on('pageerror', error => errors.push(`pageerror:${error}`));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/favicon|ERR_NAME_NOT_RESOLVED/i.test(text)) return;
    if (/frame-ancestors.*ignored when delivered via a <meta>/i.test(text)) return;
    if (/Applying inline style violates.*Content Security Policy/i.test(text)) { legacyStyleWarnings.push(text); return; }
    errors.push(`console:${text}`);
  });

  const status = {
    service_version:'research-os-v24-test',
    version:'research-os-v24-test',
    providers:{ai:true,openai:false,brave:true,patentsview:true},
    ai:{provider:'MockAI',model:'mock-model',key_configured:true,base_url:'https://mock.example/v1',api_path:'/responses',protocol:'responses',model_override_allowed:true,prompt_override_allowed:true,pricing:{configured:false}},
    ai_profiles:{enabled:true,default_profile:'alpha',profile_override_allowed:true,profiles:[{id:'alpha',name:'Alpha',provider:'MockAI',model:'mock-model',key_configured:true,base_url:'https://mock.example/v1',api_path:'/responses',protocol:'responses',model_override_allowed:true,prompt_override_allowed:true}]}
  };
  const fulfillJson = (route, body, statusCode=200) => route.fulfill({status:statusCode, contentType:'application/json', body:JSON.stringify(body)});
  await page.route('https://mock-v25.workers.dev/api/status', route => fulfillJson(route,status));
  await page.route('https://mock-v25.workers.dev/api/web**', route => fulfillJson(route,{results:[{title:'Official engineering page',url:'https://example.com/official',description:'Engineering source',domain:'example.com',official:true}],total:1}));
  await page.route('https://mock-v25.workers.dev/api/patents**', route => fulfillJson(route,{patents:[{patent_id:'1234567',patent_title:'Engineering reconstruction patent',patent_date:'2024-01-01',patent_year:2024,patent_abstract:'Patent abstract',patent_num_total_documents_cited:2,assignees:[{assignee_organization:'Example Corp'}]}],total_hits:1}));
  await page.route('https://mock-v25.workers.dev/api/ai/summaries', route => fulfillJson(route,{provider:'MockAI',model:'mock-model',usage:{total_tokens:10},summaries:[{key:'test:v21',summary:'测试摘要'}]}));
  await page.route('https://mock-v25.workers.dev/api/ai/research', route => fulfillJson(route,{profile:'alpha',provider:'MockAI',model:'mock-model',latency_ms:12,result:{headline:'证据审查完成',summary:'基于项目证据完成审查。',signals:[{label:'缺口',text:'需要更多工程证据',evidence_keys:[]}],queries:['next query'],tasks:['补充工程验证'],claim_reviews:[]}}));
  await page.route('https://api.crossref.org/**', route => fulfillJson(route,{message:{items:[
    {DOI:'10.1/test-a',title:['Engineering drawing reconstruction'],author:[{given:'A',family:'B'}],published:{'date-parts':[[2025,1,1]]},URL:'https://doi.org/10.1/test-a',type:'journal-article','is-referenced-by-count':3,score:20},
    {DOI:'10.1/test-b',title:['CAD reconstruction from technical drawings'],author:[{given:'C',family:'D'}],published:{'date-parts':[[2023,1,1]]},URL:'https://doi.org/10.1/test-b',type:'journal-article','is-referenced-by-count':8,score:18},
    {DOI:'10.1/test-c',title:['Geometric reasoning for engineering drawings'],author:[{given:'E',family:'F'}],published:{'date-parts':[[2021,1,1]]},URL:'https://doi.org/10.1/test-c',type:'journal-article','is-referenced-by-count':2,score:16}
  ],'total-results':3}}));
  await page.route('https://hn.algolia.com/**', route => fulfillJson(route,{hits:[{objectID:'1',title:'Engineering reconstruction notes',url:'https://example.com/a',author:'x',created_at:'2022-01-01T00:00:00Z',points:5,num_comments:1}],nbHits:1}));

  // Settings / environment configuration: every tab must be visible and actionable.
  await page.goto(url('?audit=settings'));
  await page.click('#settingsBtn');
  assert(await page.locator('#settingsDialog').evaluate(dialog => dialog.open), 'settings dialog did not open');
  for (const name of ['ai','provider','service','sources','security']) {
    const nav = page.locator(`[data-settings-jump="${name}"]`);
    assert(await nav.count() === 1, `missing settings nav ${name}`);
    await nav.click();
    assert(await nav.evaluate(node => node.classList.contains('active')), `settings nav did not activate: ${name}`);
    assert(await page.locator(`[data-settings-section="${name}"]`).isVisible(), `settings section not visible: ${name}`);
  }

  await page.click('[data-settings-jump="service"]');
  await page.locator('#workerEndpoint').fill('https://mock-v25.workers.dev');
  await page.click('#testWorker');
  await sleep(500);
  assert(/Worker 可用/.test(await page.locator('#workerStatus').innerText()), `Worker test gave no usable result: ${await page.locator('#workerStatus').innerText()}`);
  const envStatus = await page.locator('[data-v25-env-status-text]').innerText();
  assert(/Worker 已连接/.test(envStatus) && /MockAI/.test(envStatus) && /mock-model/.test(envStatus), `environment status incomplete: ${envStatus}`);
  await page.screenshot({path:'/tmp/v25-settings-service.png',fullPage:true});

  await page.click('[data-settings-jump="provider"]');
  const runtimeProfile = page.locator('[data-ai-v22-runtime-profile]');
  await runtimeProfile.selectOption('alpha');
  await page.locator('[data-ai-v21-model]').fill('model-keep');
  await page.locator('[data-ai-v21-prompt]').fill('prompt-keep');
  await page.click('[data-ai-v21-save-runtime]');
  await page.click('[data-ai-v21-test]');
  await sleep(350);
  assert(/测试成功/.test(await page.locator('[data-ai-v21-test-status]').innerText()), 'AI test action had no success state');

  // Provider profile local editor CRUD must have visible effects.
  const profileCountBefore = await page.locator('[data-ai-v22-profile-list] option').count();
  await page.click('[data-ai-v22-new]');
  await page.locator('[data-ai-v22-id]').fill('audit-profile');
  await page.locator('[data-ai-v22-name]').fill('Audit Profile');
  await page.locator('[data-ai-v22-base]').fill('https://audit.example/v1');
  await page.click('[data-ai-v22-save]');
  assert(/已保存/.test(await page.locator('[data-ai-v22-status]').innerText()), 'provider profile save had no visible success state');
  assert(await page.locator('[data-ai-v22-profile-list] option').count() === profileCountBefore + 1, 'provider profile was not added');
  await page.click('[data-ai-v22-duplicate]');
  await page.click('[data-ai-v22-save]');
  assert(await page.locator('[data-ai-v22-profile-list] option').count() === profileCountBefore + 2, 'provider duplicate had no effect');
  await page.click('[data-ai-v22-delete]');
  assert(await page.locator('[data-ai-v22-profile-list] option').count() === profileCountBefore + 1, 'provider delete had no effect');
  await page.screenshot({path:'/tmp/v25-settings-provider.png',fullPage:true});

  await page.click('#saveSettings');
  await sleep(250);
  const aiSettings = await page.evaluate(() => JSON.parse(localStorage.getItem('research-search:ai-settings-v1') || '{}'));
  assert(aiSettings.requestModel === 'model-keep', `requestModel lost after Save All: ${JSON.stringify(aiSettings)}`);
  assert(aiSettings.customPrompt === 'prompt-keep', `customPrompt lost after Save All: ${JSON.stringify(aiSettings)}`);
  assert(aiSettings.requestProfile === 'alpha', `requestProfile lost after Save All: ${JSON.stringify(aiSettings)}`);
  assert(await page.evaluate(() => localStorage.getItem('research-search:worker-url')) === 'https://mock-v25.workers.dev', 'Worker URL not persisted');

  await page.reload();
  await page.click('#settingsBtn');
  await page.click('[data-settings-jump="service"]');
  assert(await page.locator('#workerEndpoint').inputValue() === 'https://mock-v25.workers.dev', 'Worker URL not restored after reload');
  await page.click('[data-settings-jump="provider"]');
  assert(await page.locator('[data-ai-v21-model]').inputValue() === 'model-keep', 'runtime model not restored after reload');
  assert(await page.locator('[data-ai-v22-runtime-profile]').inputValue() === 'alpha', 'runtime profile not restored after reload');
  await page.click('#closeSettings');

  // Main search, source tabs and every Research OS view.
  await page.fill('#queryInput','engineering drawing');
  await page.click('.search-btn');
  await sleep(900);
  assert(await page.locator('.ux-result').count() >= 3, 'search produced too few result cards');
  for (const tab of ['papers','patents','blogs','web','all']) {
    const button = page.locator(`.tab[data-tab="${tab}"]`);
    await button.click();
    await sleep(110);
    assert(await button.evaluate(node => node.classList.contains('active')), `result tab failed: ${tab}`);
  }

  const openView = async view => {
    const button = page.locator(`#researchOsRail [data-os-view="${view}"]`);
    assert(await button.count() === 1, `missing Research OS view: ${view}`);
    await button.click();
    await sleep(180);
    assert(await button.evaluate(node => node.classList.contains('active')), `Research OS view did not activate: ${view}`);
    assert(await page.evaluate(expected => document.body.dataset.researchOsView === expected, view), `body view state mismatch: ${view}`);
  };
  await openView('map');
  const mapPositions = await page.locator('.research-map-node').evaluateAll(nodes => nodes.map(node => `${getComputedStyle(node).left}/${getComputedStyle(node).top}`));
  assert(mapPositions.length >= 3 && new Set(mapPositions).size >= 2 && mapPositions.every(pos => !/^auto\//.test(pos)), `map CSSOM hydration failed: ${mapPositions.join(', ')}`);
  await openView('timeline');
  const timelineHeights = await page.locator('.research-year-bar').evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).height)||0));
  assert(timelineHeights.length >= 3 && Math.max(...timelineHeights) > 10, `timeline bars have no visual height: ${timelineHeights.join(', ')}`);
  await openView('entities');
  assert(await page.locator('.research-entity-row:visible').count() >= 1, 'entity intelligence has no visible rows');
  await openView('evidence');
  assert(await page.locator('.research-evidence-board, .research-os-empty').count() >= 1, 'evidence view did not render');
  await openView('path');
  assert(await page.locator('.research-path-node').count() >= 4, 'technology path did not render all stages');
  await openView('search');

  // Detail pane, history, control center, export.
  const preview = page.locator('.research-preview-btn').first();
  if (await preview.count()) {
    await preview.click();
    await sleep(150);
    assert(await page.locator('.research-detail-pane.open').count() === 1, 'detail pane did not open');
    await page.keyboard.press('Escape');
  }
  await page.click('#historyBtn');
  assert(await page.locator('#historyDialog').evaluate(dialog => dialog.open), 'history dialog did not open');
  await page.click('#closeHistory');
  await page.click('#controlCenterBtn');
  assert(await page.locator('#controlCenterDialog').evaluate(dialog => dialog.open), 'control center did not open');
  await page.click('[data-control-refresh]');
  await sleep(500);
  assert(await page.locator('#controlCenterDialog').getAttribute('data-ai-ready') === '1', 'control center did not recognize providers.ai / AI profile readiness');
  const aiServiceCard = page.locator('[data-control-overview] article').filter({hasText:'AI 服务'});
  assert(/已就绪/.test(await aiServiceCard.innerText()) && /MockAI/.test(await aiServiceCard.innerText()), `control center AI status inconsistent: ${await aiServiceCard.innerText()}`);
  await page.click('[data-control-close]');
  assert(await page.locator('#exportBtn').isVisible(), 'desktop export control is hidden');
  const downloadPromise = page.waitForEvent('download');
  await page.click('#exportBtn');
  const download = await downloadPromise;
  assert(/research-search-/.test(download.suggestedFilename()), 'export did not produce expected download');

  // Project workspace and all four Copilot actions.
  await page.goto(url('?project=new&audit=project'));
  await page.evaluate(() => localStorage.setItem('research-search:worker-url','https://mock-v25.workers.dev'));
  await page.reload();
  await sleep(1000);
  assert(await page.locator('#projectWorkspaceDialog').evaluate(dialog => dialog.open), 'project workspace did not open');
  assert(await page.locator('[data-project-copilot-v24]').count() === 1, 'Research Copilot panel missing');
  for (const action of ['evidence','counter','queries','claims']) {
    await page.click(`[data-v24-action="${action}"]`);
    await sleep(300);
    const output = await page.locator('[data-v24-output]').innerText();
    assert(/证据审查完成/.test(output), `Copilot action produced no result: ${action}: ${output}`);
  }
  await page.screenshot({path:'/tmp/v25-project.png',fullPage:true});

  // Mobile settings: especially service/environment tab must remain reachable.
  const mobile = await browser.newContext({viewport:{width:430,height:900}});
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(url('?mobile=1'));
  await sleep(700);
  await mobilePage.click('#settingsBtn');
  await mobilePage.click('[data-settings-jump="service"]');
  assert(await mobilePage.locator('#workerEndpoint').isVisible(), 'mobile Worker environment field is not visible');
  const box = await mobilePage.locator('#settingsDialog').boundingBox();
  assert(box && box.width <= 430, `settings dialog overflows mobile viewport: ${box?.width}`);
  await mobilePage.screenshot({path:'/tmp/v25-mobile-settings.png',fullPage:true});

  assert(errors.length === 0, `browser errors: ${errors.join(' | ')}`);
  console.log(`LEGACY_CSP_STYLE_WARNINGS=${legacyStyleWarnings.length}`);
  console.log('FULL_INTERACTION_AUDIT_OK');
  await browser.close();
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
