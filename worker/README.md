# Research Search Worker

Cloudflare Worker backend for Research Search.

## What it provides

- `GET /api/status` — backend/provider health
- `GET /api/web?q=...&official=0|1&count=20` — Brave Search web results with official-domain tagging
- `GET /api/patents?q=...&fromYear=2024&sort=relevance` — optional PatentsView proxy

## Deploy

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put BRAVE_SEARCH_API_KEY
# Optional
npx wrangler secret put PATENTSVIEW_API_KEY
npm run deploy
```

Copy the resulting `https://...workers.dev` URL into the website's **设置 → Cloudflare Worker 地址** and click **测试连接**.

Do not commit `.dev.vars` or `.env` files containing real keys.
