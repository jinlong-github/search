# Research OS Worker

Cloudflare Worker 后端。GitHub Pages 只连接这个 Worker；共享密钥留在服务端。

## 接口

- `GET /api/status` — 数据源与 AI Provider 状态
- `GET /api/web` — Brave Search
- `GET /api/patents` — PatentsView 代理
- `POST /api/ai/summaries` — AI 中文摘要

## 部署

```bash
cd worker
npm install
npx wrangler login

npx wrangler secret put BRAVE_SEARCH_API_KEY
# 可选
npx wrangler secret put PATENTSVIEW_API_KEY

npm run deploy
```

然后在网站 **配置 → 服务地址** 中填写 Worker 基础地址，例如：

```text
https://research-search-api.example.workers.dev
```

不要填写 `/api/status` 等具体路径。

## AI：推荐使用 Provider Profiles

一个 Worker 可以连接多套 AI 服务。每套档案独立定义 URL、协议、模型、鉴权方式和 Secret 绑定名；网页和研究项目只传 Profile ID。

完整配置见：

**`AI_PROVIDER_CONFIG.md`**

最小概念：

```text
AI_DEFAULT_PROFILE=openai
AI_ALLOW_PROFILE_OVERRIDE=true
AI_PROFILES_JSON=[...不含真实 Key 的公开配置...]
```

每套密钥单独保存：

```bash
npx wrangler secret put AI_KEY_OPENAI
npx wrangler secret put AI_KEY_PRIVATE
npm run deploy
```

如果没有配置 `AI_PROFILES_JSON`，旧的单 Provider `AI_* / OPENAI_*` 环境变量仍兼容。

## CORS

正式部署建议只允许自己的站点：

```text
ALLOWED_ORIGINS=https://jinlong-github.github.io,http://localhost:8000
```

使用自定义域名时替换成对应 Origin。

## 状态与诊断

部署后先检查：

```text
GET /api/status
```

网站 **配置 → AI 接口** 还提供：

- Provider 模板
- 本地草稿 vs Worker 已部署差异
- 当前 Profile 一键真实测试

真实测试会产生少量 Token 消耗。

## 安全原则

- 不提交 `.dev.vars`、`.env` 或真实 API Key。
- Profile JSON 只保存 Secret 的变量名，不保存 Secret 值。
- 浏览器不能把任意 Base URL 临时传给 Worker，避免把 Worker 变成开放代理。
- `ALLOWED_ORIGINS` 只允许正式站点和必要的本地开发地址。
- Token / 成本统计是诊断信息，不替代服务商账单。
