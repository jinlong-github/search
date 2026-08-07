# Research Search

一个部署在 GitHub Pages 上的个人科研 / 技术情报搜索站，统一查看：

- **论文**：OpenAlex 实时搜索
- **专利**：可选 PatentsView 实时搜索；未配置时保留 Google Patents / Espacenet 深搜入口
- **官网 / Web**：Cloudflare Worker + Brave Search；官方域名自动标记并支持“仅官网”过滤
- **技术博客 / 文章**：Hacker News Algolia 实时发现
- **技术情报概览**：对论文、专利、官网与技术文章做跨来源信号聚合

## 在线使用

https://jinlong-github.github.io/search/

## 当前能力

- 论文 / 专利 / 博客 / 官网-Web 四路统一结果页
- 论文引用数、作者、年份、开放获取状态
- PatentsView 专利卡片：专利号、申请人/受让人、授权日期、摘要、参考文献数
- Google Patents / Espacenet / USPTO 深度跳转
- 官网 / Web 独立标签页，支持官网优先标记与“仅官网”模式
- 未配置 Worker 时自动降级为 Brave Search / Google 官网搜索入口
- 跨来源技术情报概览：高频主题、主要论文来源、主要专利申请人、最新信号日期
- 相关度 / 影响力 / 最新排序
- 起始年份筛选、开放获取筛选
- 收藏、搜索历史、JSON 导出
- 响应式布局 + PWA
- GitHub Actions 自动部署 Pages

## 官网 / Web 搜索（Cloudflare Worker）

仓库内已包含 `worker/`，后端使用 Cloudflare Workers。Web 搜索通过 Brave Search API 调用，API Key 仅保存在 Worker Secret 中，不进入 GitHub Pages 前端。

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put BRAVE_SEARCH_API_KEY
npm run deploy
```

部署后，把 `https://...workers.dev` 地址填入网页右上角 **设置 → Cloudflare Worker 地址**，点击 **测试连接**。

如果还拥有 PatentsView Key，也可以执行：

```bash
npx wrangler secret put PATENTSVIEW_API_KEY
```

之后专利查询会优先通过 Worker 代理，浏览器端 Key 仅作为兼容回退。

## 专利实时搜索

PatentsView PatentSearch API 目前要求请求头：

`X-Api-Key: YOUR_KEY`

在网页右上角 **设置** 中填入 Key 即可启用实时专利聚合。

Key 的处理方式：

- 默认只写入当前浏览器 `sessionStorage`
- 勾选“记住在这台设备上”时写入当前浏览器 `localStorage`
- Key 不会提交到 GitHub 仓库
- 可随时在设置中清除

如果没有 PatentsView Key，网站仍然可用，并提供 Google Patents 与 Espacenet 的同查询入口。

> 注意：PatentsView 官方当前可能暂停新 API Key 发放；已有 Key 的用户可继续配置。若浏览器或服务端的 CORS / API 策略变化导致直连失败，页面会保留专业专利库入口。后续版本可将专利调用迁移到 Cloudflare Worker 等服务端代理。

## 数据源

- [OpenAlex](https://openalex.org/) — 学术论文与引用元数据
- [PatentsView PatentSearch](https://search.patentsview.org/) — 美国专利结构化数据
- [Brave Search API](https://brave.com/search/api/) — 官网与全网搜索
- [Hacker News Algolia](https://hn.algolia.com/api) — 技术文章发现
- [Google Patents](https://patents.google.com/) — 全球专利深搜
- [Espacenet](https://worldwide.espacenet.com/) — EPO 专利检索
- [USPTO Patent Public Search](https://ppubs.uspto.gov/pubwebapp/) — 美国专利官方检索

## 架构边界

GitHub Pages 是静态托管，不能安全保存共享的服务端 Secret，也不能运行 FastAPI / OpenSearch。

当前架构已经加入 Cloudflare Worker serverless backend；OpenAlex / HN 仍可由浏览器直连，Brave Search 与可选 PatentsView Key 放在 Worker Secret 中。下一阶段可以继续用于：

1. 查询扩展与中英文跨语言检索
2. 语义 rerank
3. AI Overview（带来源引用）
4. 论文 → 专利 → 官网 → 技术博客的跨来源关联
5. 专利族、CPC/IPC、法律状态等更完整的专利情报

## 本地预览

```bash
python -m http.server 8000 -d site
```

然后打开 `http://localhost:8000`。

## License

MIT
