# AI 提供方自定义配置

Research OS v21 支持 OpenAI Responses API，以及多数提供 OpenAI-compatible `/chat/completions` 或 `/responses` 接口的服务。

## 推荐架构

浏览器只连接你自己的 Worker：

`GitHub Pages -> Cloudflare Worker -> AI 上游服务`

API Key 只保存在 Worker Secret 中。不要把真实 AI Key 写入 GitHub、HTML、JavaScript 或 localStorage。

## 最小配置：OpenAI Responses

```text
AI_API_KEY=<secret>
AI_PROVIDER_NAME=OpenAI
AI_BASE_URL=https://api.openai.com/v1
AI_API_MODE=responses
AI_API_PATH=/responses
AI_MODEL=gpt-5-mini
AI_AUTH_HEADER=Authorization
AI_AUTH_PREFIX=Bearer 
AI_ALLOW_MODEL_OVERRIDE=true
AI_ALLOW_PROMPT_OVERRIDE=true
```

密钥通过交互式 Secret 命令配置：

```bash
cd worker
npx wrangler secret put AI_API_KEY
npm run deploy
```

## OpenAI-compatible Chat Completions

如果你的服务只兼容 `/v1/chat/completions`，使用：

```text
AI_PROVIDER_NAME=My Provider
AI_BASE_URL=https://api.example.com/v1
AI_API_MODE=chat-completions
AI_API_PATH=/chat/completions
AI_MODEL=my-model-name
AI_AUTH_HEADER=Authorization
AI_AUTH_PREFIX=Bearer 
AI_ALLOW_MODEL_OVERRIDE=true
AI_ALLOW_PROMPT_OVERRIDE=true
```

## 非 Bearer 鉴权

如果服务要求 `x-api-key: <key>`：

```text
AI_AUTH_HEADER=x-api-key
AI_AUTH_PREFIX=
```

Secret 仍然使用 `AI_API_KEY` 保存。

## 模型覆盖

默认模型由 `AI_MODEL` 决定。若希望网页或项目工作区临时选择模型：

```text
AI_ALLOW_MODEL_OVERRIDE=true
```

建议同时限制可选模型：

```text
AI_ALLOWED_MODELS=model-a,model-b,model-c
```

网页请求的模型名只有在允许覆盖且满足 allowlist 时才会生效。

## 提示词

提示词分三层：

1. 系统固定科研证据规则：永远保留，防止摘要编造实验数字、关系或结论。
2. Worker 默认附加提示词：`AI_DEFAULT_PROMPT`。
3. 浏览器全局提示词 / 项目提示词：只有 `AI_ALLOW_PROMPT_OVERRIDE=true` 时生效。

项目提示词会覆盖研究场景，例如：

```text
重点说明工程约束、输入输出、适用条件和失败边界。避免市场宣传语气。对原始片段没有提供的信息明确写“未说明”。
```

自定义提示词不能取消系统固定的 JSON 输出格式和证据边界规则。

## 成本估算

如果希望控制中心估算成本，可配置：

```text
AI_INPUT_USD_PER_1M=<当前输入 Token 单价>
AI_OUTPUT_USD_PER_1M=<当前输出 Token 单价>
```

价格不写死在前端，需要你按照当前服务实际价格维护。

## 旧配置兼容

v21 优先使用通用 `AI_*` 变量，但为了避免已有部署突然失效，下列旧名称仍然兼容：

```text
OPENAI_API_KEY              -> AI_API_KEY
OPENAI_BASE_URL             -> AI_BASE_URL
OPENAI_MODEL                -> AI_MODEL
OPENAI_INPUT_USD_PER_1M     -> AI_INPUT_USD_PER_1M
OPENAI_OUTPUT_USD_PER_1M    -> AI_OUTPUT_USD_PER_1M
```

因此你可以逐步迁移，不需要一次性修改现有 Worker。新部署建议统一使用 `AI_*` 命名。

## 状态检查

部署后访问 Worker：

```text
GET /api/status
```

返回的 `ai` 字段会显示：提供方名称、协议、Base URL、API Path、模型、鉴权头名称、模型/提示词覆盖权限和价格配置状态。不会返回 API Key。

摘要接口保持：

```text
POST /api/ai/summaries
```

可选请求字段：

```json
{
  "model": "可选模型覆盖",
  "prompt": "可选附加提示词",
  "style": "standard",
  "items": []
}
```
