# AI 提供方自定义配置

Research OS v22 支持 OpenAI Responses API，以及多数提供 OpenAI-compatible `/chat/completions` 或 `/responses` 接口的服务；同时支持在一个 Worker 中配置多套 Provider Profiles，让不同项目绑定不同 AI 上游、模型和提示词策略。

## 推荐架构

浏览器只连接你自己的 Worker：

`GitHub Pages -> Cloudflare Worker -> AI Provider Profile -> AI 上游服务`

API Key 只保存在 Worker Secret 中。不要把真实 AI Key 写入 GitHub、HTML、JavaScript、`AI_PROFILES_JSON` 或 localStorage。

## v22：多 Provider Profiles

Provider Profile 是一套服务端 AI 连接档案。浏览器和项目只发送稳定的 `profile` ID，例如 `openai`、`qwen`、`private-cad`；真正的 Base URL、协议、默认模型、鉴权方式和 Secret 映射都留在 Worker。

示例：

```text
AI_DEFAULT_PROFILE=openai
AI_ALLOW_PROFILE_OVERRIDE=true
AI_PROFILES_JSON=[{"id":"openai","name":"OpenAI","provider":"OpenAI","baseUrl":"https://api.openai.com/v1","mode":"responses","path":"/responses","model":"gpt-5-mini","keyBinding":"AI_KEY_OPENAI","authHeader":"Authorization","authPrefix":"Bearer ","allowedModels":["gpt-5-mini"],"allowModelOverride":true,"allowPromptOverride":true,"defaultPrompt":""},{"id":"private-cad","name":"Private CAD","provider":"Internal","baseUrl":"https://ai.example.com/v1","mode":"chat-completions","path":"/chat/completions","model":"cad-research-model","keyBinding":"AI_KEY_PRIVATE_CAD","authHeader":"x-api-key","authPrefix":"","allowedModels":["cad-research-model"],"allowModelOverride":true,"allowPromptOverride":true,"defaultPrompt":"优先分析 CAD、B-Rep、几何约束和工程可实现性。"}]
```

每个档案的 Key 使用独立 Worker Secret：

```bash
cd worker
npx wrangler secret put AI_KEY_OPENAI
npx wrangler secret put AI_KEY_PRIVATE_CAD
npm run deploy
```

`AI_PROFILES_JSON` 中的 `keyBinding` 只是 Secret 变量名，不是密钥本身。

### Profile 字段

常用字段：

```text
id                   稳定档案 ID，项目和网页通过它绑定 Provider
name                 UI 显示名称
provider             Provider 名称
baseUrl              上游 Base URL
mode                 responses | chat-completions
path                 /responses | /chat/completions 或自定义路径
model                默认模型
keyBinding           Worker Secret 绑定名，例如 AI_KEY_OPENAI
authHeader           Authorization / x-api-key 等
authPrefix           Bearer  或空字符串
allowedModels        可覆盖模型白名单
allowModelOverride   是否允许请求覆盖模型
allowPromptOverride  是否允许浏览器/项目追加提示词
defaultPrompt        该档案的服务端默认提示词
inputUsdPer1M        可选：输入 Token 单价
outputUsdPer1M       可选：输出 Token 单价
```

### 默认档案与项目切换

```text
AI_DEFAULT_PROFILE=openai
AI_ALLOW_PROFILE_OVERRIDE=true
```

当 `AI_ALLOW_PROFILE_OVERRIDE=false` 时，即使网页或项目绑定了另一个 Profile，Worker 也会拒绝切换。

项目可以保存：

```text
aiProfile=private-cad
aiModel=cad-research-model
aiPrompt=重点提取二维工程图到参数化 B-Rep 的几何与拓扑恢复约束。
```

实际优先级为：

```text
Worker 默认 Profile
→ 全局运行时 Profile
→ 项目 Profile

Profile 默认模型
→ 全局模型覆盖
→ 项目模型覆盖

系统固定证据规则
→ Profile 默认提示词
→ 全局提示词
→ 项目提示词
```

## v21：单 Provider 配置仍然兼容

如果没有配置 `AI_PROFILES_JSON`，Worker 会继续使用原来的单 Provider 模式。

### 最小配置：OpenAI Responses

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

单 Provider 模式的 Secret 仍然使用 `AI_API_KEY`；Profiles 模式则使用对应的 `keyBinding`。

## 模型覆盖

单 Provider 模式默认模型由 `AI_MODEL` 决定。若希望网页或项目工作区临时选择模型：

```text
AI_ALLOW_MODEL_OVERRIDE=true
```

建议同时限制可选模型：

```text
AI_ALLOWED_MODELS=model-a,model-b,model-c
```

Profiles 模式中的模型覆盖权限和白名单由每个 Profile 自己的 `allowModelOverride` / `allowedModels` 决定。

## 提示词

提示词保留强制科研证据边界：

1. 系统固定科研证据规则：永远保留，防止摘要编造实验数字、关系或结论。
2. Profile / Worker 默认附加提示词。
3. 浏览器全局提示词。
4. 项目提示词。

项目提示词示例：

```text
重点说明工程约束、输入输出、适用条件和失败边界。避免市场宣传语气。对原始片段没有提供的信息明确写“未说明”。
```

自定义提示词不能取消系统固定的 JSON 输出格式和证据边界规则。

## 成本估算

单 Provider 模式：

```text
AI_INPUT_USD_PER_1M=<当前输入 Token 单价>
AI_OUTPUT_USD_PER_1M=<当前输出 Token 单价>
```

Profiles 模式建议在各 Profile 内配置：

```json
{"inputUsdPer1M":0.0,"outputUsdPer1M":0.0}
```

价格不写死在前端，需要你按照当前服务实际价格维护。

## 旧配置兼容

v22 继续兼容以下旧名称：

```text
OPENAI_API_KEY              -> AI_API_KEY
OPENAI_BASE_URL             -> AI_BASE_URL
OPENAI_MODEL                -> AI_MODEL
OPENAI_INPUT_USD_PER_1M     -> AI_INPUT_USD_PER_1M
OPENAI_OUTPUT_USD_PER_1M    -> AI_OUTPUT_USD_PER_1M
```

因此你可以逐步从单 Provider 迁移到 Profiles，不需要一次性修改现有 Worker。

## 状态检查

部署后访问 Worker：

```text
GET /api/status
```

v22 会增加：

```text
ai_profiles.enabled
ai_profiles.default_profile
ai_profiles.profile_override_allowed
ai_profiles.profiles[]
```

每个公开 Profile 会显示 Provider、协议、Base URL、API Path、模型、Secret 绑定名、是否已配置 Key、模型/提示词覆盖权限与价格配置状态；不会返回 API Key 或默认提示词正文。

摘要接口保持：

```text
POST /api/ai/summaries
```

可选请求字段：

```json
{
  "profile": "private-cad",
  "model": "可选模型覆盖",
  "prompt": "可选附加提示词",
  "style": "standard",
  "items": []
}
```
