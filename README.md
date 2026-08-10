# 科研情报系统 · Research OS

一个面向个人研究与技术情报的网页工作台。搜索只是入口，系统把论文、专利、技术文章和 Web 信号组织进持续的研究项目。

## 在线使用

https://jinlong-github.github.io/search/

## 核心能力

- **统一检索**：Crossref 论文、HN Algolia 技术文章，可选 PatentsView 专利和 Brave Web 搜索。
- **研究视图**：研究地图、时间演进、实体情报、证据板、技术脉络。
- **研究项目**：保存研究问题、检索轨迹、项目资料、证据、阶段结论和下一步任务。
- **AI 摘要**：默认保留本地中文摘要；配置 Worker 后可使用服务端 AI 增强。
- **Provider Profiles**：一个 Worker 可连接多套 AI 服务；项目可绑定不同 Provider、模型和提示词。
- **控制中心**：查看数据源延迟、AI Token、缓存和本机运行诊断。

## 本地预览

```bash
python -m http.server 8000 -d site
```

打开 `http://localhost:8000`。

## 可选 Worker

`worker/` 提供 Cloudflare Worker 后端，用于：

- Brave Search Web / 官网搜索
- PatentsView 专利代理
- AI 中文摘要
- 多 AI Provider Profile 路由

最小部署：

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put BRAVE_SEARCH_API_KEY
npm run deploy
```

部署后，把 `https://...workers.dev` 填入网站 **配置 → 服务地址**。

AI、多 Provider、模型、提示词和 Secret 的配置见：

**`worker/AI_PROVIDER_CONFIG.md`**

Worker 接口与部署说明见：

**`worker/README.md`**

## 安全边界

- GitHub Pages 不保存共享 API Secret。
- AI Key、Brave Key、PatentsView Key 推荐只放 Worker Secret。
- 浏览器只保存 Worker 地址、Provider ID、模型/提示词覆盖和项目数据。
- Provider Profile 的公开 JSON 不包含真实 API Key。
- AI 生成内容不能替代原始论文、专利或网页证据；系统固定保留“不编造关系与数据”的约束。

## 数据源

- Crossref — 论文题录与 DOI
- Hacker News Algolia — 技术文章发现
- PatentsView — 可选美国专利结构化数据
- Brave Search — 可选官网 / Web 搜索
- Google Patents / Espacenet / USPTO — 专业专利深搜入口

## License

MIT
