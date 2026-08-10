# Research Search Worker

Cloudflare Worker backend for Research Search / 科研情报系统。

## 提供的接口

- `GET /api/status` — Worker 与 Brave / PatentsView / OpenAI 配置状态
- `GET /api/web?q=...&official=0|1&count=20` — Brave Search 网页与官网结果
- `GET /api/patents?q=...&fromYear=2024&sort=relevance` — PatentsView 专利代理
- `POST /api/ai/summaries` — 服务端调用 OpenAI，为搜索结果批量生成中文技术摘要

`POST /api/ai/summaries` 只从 Worker Secret 读取 `OPENAI_API_KEY`，不会把 OpenAI API Key 下发给 GitHub Pages 前端。

## 推荐配置

```bash
cd worker
npm install
npx wrangler login

# Web 搜索
npx wrangler secret put BRAVE_SEARCH_API_KEY

# AI 中文摘要
npx wrangler secret put OPENAI_API_KEY

# 可选：专利
npx wrangler secret put PATENTSVIEW_API_KEY

npm run deploy
```

在 Cloudflare Worker 的普通环境变量中建议设置：

```text
OPENAI_MODEL=gpt-5-mini
ALLOWED_ORIGINS=https://jinlong-github.github.io,http://localhost:8000
```

如果你使用自定义域名，把 `ALLOWED_ORIGINS` 换成你的正式网站 Origin，例如：

```text
ALLOWED_ORIGINS=https://research.example.com,http://localhost:8000
```

## 网站端填写什么地址

Worker 部署后会得到类似：

```text
https://research-search-api.<account>.workers.dev
```

在网站 **配置 → 服务地址 → Cloudflare Worker 基础地址** 中只填写基础地址，不要填写 `/api/status` 或 `/api/web`。

网站会自动使用：

```text
https://...workers.dev/api/status
https://...workers.dev/api/web
https://...workers.dev/api/patents
https://...workers.dev/api/ai/summaries
```

然后点击 **测试后端连接**，确认 Web / 专利 / AI 的配置状态。

## 安全原则

- 不要把真实 `.dev.vars`、`.env` 或 API Key 提交到 GitHub。
- OpenAI API Key 应只放在 Worker Secret / 服务端环境变量中，不要写入浏览器 JavaScript 或 localStorage。
- `ALLOWED_ORIGINS` 应只包含你的正式站点和必要的本地开发地址。
- AI 摘要请求使用 OpenAI Responses API，并设置 `store: false`；网页仍保留本地启发式摘要作为失败回退。
