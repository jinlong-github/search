# AI Provider Profiles

Research OS 推荐使用 **Provider Profiles** 管理 AI。一个 Worker 可以连接多套上游，研究项目只绑定 Profile ID、模型覆盖和提示词覆盖。

```text
浏览器 / 项目
    ↓ profile ID
Cloudflare Worker
    ↓ 服务端选择 URL / 协议 / Secret
AI Provider
```

真实 API Key 不进入浏览器，也不写进 `AI_PROFILES_JSON`。

## 1. 配置 Profiles

Cloudflare Worker 普通环境变量：

```text
AI_DEFAULT_PROFILE=openai
AI_ALLOW_PROFILE_OVERRIDE=true
AI_PROFILES_JSON=[{"id":"openai","name":"OpenAI Research","provider":"OpenAI","baseUrl":"https://api.openai.com/v1","mode":"responses","path":"/responses","model":"gpt-5-mini","keyBinding":"AI_KEY_OPENAI","authHeader":"Authorization","authPrefix":"Bearer ","allowedModels":["gpt-5-mini"],"allowModelOverride":true,"allowPromptOverride":true}]
```

常用字段：

- `id`：稳定 Profile ID，项目只保存这个值。
- `baseUrl`：AI 基础地址。
- `mode`：`responses` 或 `chat-completions`。
- `path`：例如 `/responses`、`/chat/completions`。
- `model`：默认模型名称。
- `keyBinding`：对应的 Worker Secret 变量名。
- `authHeader` / `authPrefix`：鉴权请求头。
- `allowedModels`：允许网页 / 项目覆盖的模型白名单。
- `defaultPrompt`：该档案的服务端默认附加提示词。

## 2. 配置 Secrets

Profile JSON 只写变量名。真实密钥通过 Wrangler Secret 保存：

```bash
cd worker
npx wrangler secret put AI_KEY_OPENAI
npm run deploy
```

多档案时，每个 Key 单独保存：

```bash
npx wrangler secret put AI_KEY_OPENAI
npx wrangler secret put AI_KEY_PRIVATE
npm run deploy
```

## 3. OpenAI-compatible 示例

```json
{
  "id": "private",
  "name": "Private Research Model",
  "provider": "Private AI",
  "baseUrl": "https://ai.example.com/v1",
  "mode": "chat-completions",
  "path": "/chat/completions",
  "model": "research-model",
  "keyBinding": "AI_KEY_PRIVATE",
  "authHeader": "x-api-key",
  "authPrefix": "",
  "allowedModels": ["research-model"],
  "allowModelOverride": true,
  "allowPromptOverride": true
}
```

## 4. 网站配置流程

打开 **配置 → AI 接口**：

1. 选择 Provider 模板并套用到草稿。
2. 修改 Profile ID、URL、模型和 Secret 绑定名。
3. 保存档案并复制 Worker 配置。
4. 部署 Worker。
5. 点击 **刷新 Worker 状态**，比较“本地草稿 vs Worker 已部署”。
6. 点击 **测试当前 Profile**，验证 URL、鉴权、模型和协议整条链路。

真实测试会产生少量 Token 消耗。

## 5. 模型与提示词优先级

```text
项目 Profile > 全局 Profile > Worker 默认 Profile
项目模型 > 全局模型 > Profile 默认模型
Profile 默认提示词 + 全局提示词 + 项目提示词
```

系统固定的科研证据规则始终保留，自定义提示词不能取消“不得编造实验数字、引用关系、专利关系或因果关系”等约束。

## 6. Profile 切换安全

允许网页 / 项目切换：

```text
AI_ALLOW_PROFILE_OVERRIDE=true
```

设置为 `false` 时，Worker 始终使用 `AI_DEFAULT_PROFILE`。

每个 Profile 仍可单独限制模型和提示词覆盖：

```json
{
  "allowedModels": ["model-a", "model-b"],
  "allowModelOverride": true,
  "allowPromptOverride": true
}
```

浏览器不能临时指定任意 Base URL，因此 Worker 不会成为开放代理。

## 7. 旧单 Provider 配置

没有 `AI_PROFILES_JSON` 时，旧配置继续兼容：

```text
AI_API_KEY / OPENAI_API_KEY
AI_BASE_URL / OPENAI_BASE_URL
AI_MODEL / OPENAI_MODEL
AI_API_MODE
AI_API_PATH
AI_DEFAULT_PROMPT
```

新部署建议直接使用 Provider Profiles。
