# Research Search Worker

Cloudflare Worker backend for Research Search / 科研情报系统。

## 提供的接口

- `GET /api/status` — Worker 与 Brave / PatentsView / OpenAI 配置状态，以及 AI 模型和成本估算配置状态
- `GET /api/web?q=...&official=0|1&count=20` — Brave Search 网页与官网结果
- `GET /api/patents?q=...&fromYear=2024&sort=relevance` — PatentsView 专利代理
- `POST /api/ai/summaries` — 服务端调用 OpenAI，为搜索结果批量生成中文技术摘要

`POST /api/ai/summaries` 只从 Worker Secret 读取 `OPENAI_API_KEY`，不会把 OpenAI API Key 下发给 GitHub Pages 前端。接口会安全返回本次 AI 调用的 Token usage；浏览器控制中心只在当前设备本地累计这些统计。

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

### 可选：AI 成本估算

控制中心可以累计当前浏览器实际收到的 AI Token 用量。若还希望显示美元成本估算，在 Worker 普通环境变量中配置：

```text
OPENAI_INPUT_USD_PER_1M=<当前模型每百万输入 Token 的美元单价>
OPENAI_OUTPUT_USD_PER_1M=<当前模型每百万输出 Token 的美元单价>
```

这两个值不是 Secret，但不要把某个时点的模型价格硬编码进前端。模型或价格变化时，只修改 Worker 环境变量即可。未配置时，系统仍会统计输入、输出和总 Token，只把费用显示为“未配置估算”。

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

## v19 系统控制中心

网站顶部 **控制台** 会显示：

- Worker 当前状态和健康检查延迟
- Crossref / HN Algolia / Worker Web / 专利 / AI 的最近请求延迟、P95 和成功率
- 本设备累计 AI 请求数、输入 / 输出 / 总 Token 和可选成本估算
- AI 摘要缓存条数、缓存命中率和本地存储占用
- 当前搜索结果的“可用性诊断”（来源覆盖、原始片段覆盖、中文摘要覆盖、重复率、年份覆盖）
- 本地研究项目与 AI 策略预设

这些统计默认保存在当前浏览器的 `localStorage`，不是服务器级监控，也不会把完整搜索内容上传到额外的遥测服务。

## 安全原则

- 不要把真实 `.dev.vars`、`.env` 或 API Key 提交到 GitHub。
- OpenAI API Key 应只放在 Worker Secret / 服务端环境变量中，不要写入浏览器 JavaScript 或 localStorage。
- `ALLOWED_ORIGINS` 应只包含你的正式站点和必要的本地开发地址。
- AI 摘要请求使用 OpenAI Responses API，并设置 `store: false`；网页仍保留本地启发式摘要作为失败回退。
- 控制中心的成本只是按你配置的 Token 单价进行估算，不替代 OpenAI 账户侧的实际账单。
