const { chromium } = require('playwright-core');
const fs = require('fs');

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:8000/').replace(/\/?$/, '/');

(async () => {
  const executablePath = ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
  assert(executablePath, 'Chrome not found');
  const browser = await chromium.launch({headless:true, executablePath, args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1200,height:900}});

  const baseStatus = {
    service_version:'research-os-v22',
    version:'research-os-v22',
    providers:{ai:true,openai:false,brave:true,patentsview:true},
    ai:{provider:'MockAI',model:'mock-model',key_configured:true},
    ai_profiles:{enabled:true,default_profile:'alpha',profiles:[{id:'alpha',name:'Alpha',provider:'MockAI',model:'mock-model',key_configured:true}]}
  };
  let currentStatus = baseStatus;
  await page.route('https://mock-v25.workers.dev/api/status', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(currentStatus)}));

  await page.goto(`${BASE_URL}?audit=capability`);
  await page.click('#settingsBtn');
  await page.click('[data-settings-jump="service"]');
  await page.locator('#workerEndpoint').fill('https://mock-v25.workers.dev');

  // A healthy older Worker must not masquerade as a Copilot-ready backend.
  await page.click('#testWorker');
  await sleep(550);
  let statusText = page.locator('[data-v25-env-status-text]');
  assert(await statusText.getAttribute('data-copilot-ready') === '0', 'legacy Worker incorrectly marked Copilot ready');
  assert(/Worker 已连接/.test(await statusText.innerText()), 'legacy Worker should still be recognized as connected');
  assert(/Copilot 后端版本未确认/.test(await statusText.innerText()), `legacy capability warning missing: ${await statusText.innerText()}`);

  // A v24-capable Worker must explicitly advertise the research endpoint.
  currentStatus = {
    ...baseStatus,
    service_version:'research-os-v24',
    version:'research-os-v24',
    capabilities:{provider_profiles:true,research_copilot:true,research_actions:['evidence','counter','queries','claims']}
  };
  await page.click('#testWorker');
  await sleep(550);
  statusText = page.locator('[data-v25-env-status-text]');
  assert(await statusText.getAttribute('data-copilot-ready') === '1', 'v24 Worker capability was not recognized');
  assert(/Copilot 已就绪/.test(await statusText.innerText()), `Copilot ready state missing: ${await statusText.innerText()}`);
  assert(/MockAI/.test(await statusText.innerText()) && /mock-model/.test(await statusText.innerText()), 'provider/model missing from environment status');

  console.log('ENVIRONMENT_CAPABILITY_AUDIT_OK');
  await browser.close();
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
