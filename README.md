# Research Search

一个部署在 GitHub Pages 上的个人科研 / 技术情报搜索站，统一查看：

- **论文**：OpenAlex 实时搜索
- **专利**：可选 PatentsView 实时搜索；未配置时保留 Google Patents / Espacenet 深搜入口
- **技术博客 / 文章**：Hacker News Algolia 实时发现
- **技术情报概览**：在浏览器本地对论文、专利、技术文章做跨来源主题与信号聚合

## 在线使用

https://jinlong-github.github.io/search/

## 当前能力

- 论文 / 专利 / 博客统一结果页
- 论文引用数、作者、年份、开放获取状态
- PatentsView 专利卡片：专利号、申请人/受让人、授权日期、摘要、参考文献数
- Google Patents / Espacenet / USPTO 深度跳转
- 跨来源技术情报概览：高频主题、主要论文来源、主要专利申请人、最新信号日期
- 相关度 / 影响力 / 最新排序
- 起始年份筛选、开放获取筛选
- 收藏、搜索历史、JSON 导出
- 响应式布局 + PWA
- GitHub Actions 自动部署 Pages

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
- [Hacker News Algolia](https://hn.algolia.com/api) — 技术文章发现
- [Google Patents](https://patents.google.com/) — 全球专利深搜
- [Espacenet](https://worldwide.espacenet.com/) — EPO 专利检索
- [USPTO Patent Public Search](https://ppubs.uspto.gov/pubwebapp/) — 美国专利官方检索

## 架构边界

GitHub Pages 是静态托管，不能安全保存共享的服务端 Secret，也不能运行 FastAPI / OpenSearch。

当前架构采用“浏览器直接访问公开 API + 用户自己的可选 API Key”。下一阶段建议增加独立 serverless backend（例如 Cloudflare Worker），用于：

1. 统一代理专利 API，避免浏览器 CORS 与密钥暴露问题
2. 查询扩展与跨语言检索
3. 语义 rerank
4. AI Overview（带来源引用）
5. 论文 → 专利 → 技术博客的跨来源关联
6. 专利族、CPC/IPC、法律状态等更完整的专利情报

## 本地预览

```bash
python -m http.server 8000 -d site
```

然后打开 `http://localhost:8000`。

## License

MIT
