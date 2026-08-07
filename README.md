# Research Search

一个可直接部署到 GitHub Pages 的个人科研/技术情报搜索入口，面向：

- 论文：OpenAlex 实时检索
- 技术博客/文章：Hacker News Algolia 实时检索
- 专利：Google Patents / Espacenet 检索入口（GitHub Pages 无服务端，后续可接专利 API 代理）

## 在线使用

项目内置 GitHub Pages Actions 工作流。首次部署后，在仓库 **Settings → Pages** 可看到站点地址，通常为：

`https://jinlong-github.github.io/search/`

## 功能

- 统一搜索界面
- 论文 / 专利 / 博客分类
- 论文引用数、作者、年份、开放获取状态
- 技术文章来源与发布时间
- 专利搜索直达 Google Patents / Espacenet
- 收藏与搜索历史（仅保存在当前浏览器 localStorage）
- JSON 导出
- 响应式布局，可作为 PWA 添加到桌面/手机主屏幕
- 无需本地运行、无需服务器

## 数据源

- [OpenAlex](https://openalex.org/)：论文及学术元数据
- [Hacker News Algolia Search](https://hn.algolia.com/api)：技术文章发现
- [Google Patents](https://patents.google.com/)：专利检索跳转
- [Espacenet](https://worldwide.espacenet.com/)：专利检索跳转

## GitHub Pages 的边界

GitHub Pages 只能托管静态网页，不能安全保存第三方 API Secret，也不能运行 Python/FastAPI/OpenSearch。因此当前版本优先采用可在浏览器直接调用的公开 API；需要鉴权的专利全文 API、AI reranker、语义向量检索等应通过独立后端/Cloudflare Worker 扩展。

## 本地预览

直接打开 `site/index.html` 即可；部分浏览器会限制 `file://` 下的 Service Worker，但搜索功能不受影响。也可以运行任意静态服务器：

```bash
python -m http.server 8000 -d site
```

然后访问 `http://localhost:8000`。

## License

MIT
