# 数据源配置

Hot Monitor 支持多种信息源，用于收集和监控热点事件。以下是当前支持的数据源及其配置说明。

## 数据源列表

| 数据源 | 类型 | 信任评分 | 说明 |
|--------|------|----------|------|
| Twitter/X | 社交媒体 | 0.60-0.95 | Twitter API 搜索，需要配置 API Key |
| DuckDuckGo | 搜索引擎 | 0.55 | 网页搜索结果 |
| Google | 搜索引擎 | 0.82 | Google 新闻搜索 |
| 官方博客 | RSS | 0.88-0.96 | OpenAI、Anthropic、Hugging Face 等官方博客 |
| GitHub | RSS | 0.82-0.92 | 热门 AI 项目的 Release Feed |
| Hacker News | API | 0.88 | Algolia Search API，支持 48 小时内内容 |
| 微博 | API | 0.75 | 微博移动端搜索 |
| 知乎 | API | 0.80 | 知乎搜索结果 |
| 百度 | 网页抓取 | 0.60 | 百度搜索结果 |
| Reddit | 社交媒体 | 0.70-0.85 | Reddit 热帖和搜索 |
| 魔搭 | RSS | 0.85 | ModelScope 博客 |

## 配置说明

### 环境变量

```bash
# Twitter API (twitterapi.io)
TWITTERAPI_IO_KEY=your_api_key_here
```

### 前端配置

在创建监控任务时，可以在"数据源"配置区域勾选需要启用的信息源。

所有数据源默认**全部启用**。

## 数据源过滤规则

每个数据源都有内置的质量过滤规则，确保只收集高质量内容：

### Twitter/X

| 过滤条件 | 值 |
|----------|-----|
| 最小点赞数 | ≥ 50 |
| 最小转发数 | ≥ 20 |
| 最小浏览量 | ≥ 2000 |
| 最小粉丝数 | ≥ 2000 |

**信任评分加成：**
- 蓝V认证用户 +0.20
- 粉丝 ≥ 1,000 +0.05
- 粉丝 ≥ 10,000 +0.05
- 最高信任分 0.95

### DuckDuckGo 搜索

| 过滤条件 | 值 |
|----------|-----|
| 每变体最多结果 | 4 条 |
| 变体查询数量 | 最多 3 个 |

### Google 新闻

| 过滤条件 | 值 |
|----------|-----|
| 每变体最多结果 | 5 条 |
| 变体查询数量 | 最多 3 个 |

### Hacker News

| 过滤条件 | 值 |
|----------|-----|
| 时间范围 | 最近 48 小时 |
| 每查询最多结果 | 10 条 |
| 变体查询数量 | 最多 3 个 |

### 官方博客 RSS

| 过滤条件 | 值 |
|----------|-----|
| 每个 Feed 最多条目 | 50 条 |

### GitHub Releases

| 过滤条件 | 值 |
|----------|-----|
| 每个仓库最多条目 | 10 条 |
| 并发请求数 | 8 |

### 知乎

| 过滤条件 | 值 |
|----------|-----|
| 每查询结果数 | 20 条 |
| 最小赞数 | ≥ 5 |
| 最小评论数 | ≥ 2 |

### 微博

| 过滤条件 | 值 |
|----------|-----|
| 每查询结果数 | 20 条 |
| 最小转发数 | ≥ 2 |
| 最小评论数 | ≥ 2 |
| 最小点赞数 | ≥ 5 |

### Reddit 热帖

| 过滤条件 | 值 |
|----------|-----|
| 每个子版块最多帖子 | 25 条 |
| 子版块 | r/MachineLearning, r/LocalLLaMA, r/technology, r/programming |
| 最小分数 | ≥ 3 |
| 最小评论数 | ≥ 2 |

**信任评分加成：**
- 分数 ≥ 100 +0.15 (信任分 0.85)
- 分数 ≥ 50 +0.08 (信任分 0.78)
- 其他 0.70

### Reddit 搜索

| 过滤条件 | 值 |
|----------|-----|
| 时间范围 | 最近一周 |
| 每查询最多帖子 | 20 条 |
| 变体查询数量 | 最多 2 个 |
| 最小分数 | ≥ 2 |
| 最小评论数 | ≥ 1 |

## GitHub RSS 源列表

以下项目通过 GitHub Release Atom Feed 进行监控：

### OpenAI & Anthropic
- `openai/openai-python`
- `openai/openai-node`
- `anthropics/anthropic-sdk-typescript`

### Hugging Face
- `huggingface/transformers`
- `huggingface/peft`
- `huggingface/accelerate`
- `huggingface/datasets`
- `huggingface/tokenizers`

### Meta Llama
- `meta-llama/llama`
- `meta-llama/llama-recipes`

### Mistral AI
- `mistralai/mistralai-python`
- `mistralai/cookbook`

### 国产大模型
- `THUDM/ChatGLM3`
- `THUDM/ChatGLM`
- `deepseek-ai/DeepSeek-V2`
- `deepseek-ai/deepseek-mcp`
- `QwenLM/Qwen`
- `QwenLM/qwen-turbo`

### Stability AI
- `Stability-AI/stability-sdk`

### LangChain & Agents
- `langchain-ai/langchain`
- `langchain-ai/langgraph`
- `microsoft/autogen`

### Google
- `google/generative-ai-python`
- `google/gemma-pytorch`
- `google/maxtext`

### Microsoft
- `microsoft/TypeChat`
- `microsoft/onnxruntime`
- `microsoft/guidance`

### Embeddings & Vector
- `embeddings-benchmark/mteb`
- `chromadb/chroma`

### Open Source Models
- `ollama/ollama`
- `lmstudio-ai/lmstudio`

### AI Infrastructure
- `vllm-project/vllm`
- `predibase/lorax`

### Multimodal
- `llava-onevision/lmms`
- `IDEA-Research/GroundingDINO`

## 官方博客 RSS 源

- OpenAI Blog (`openai.com/news/rss.xml`)
- Anthropic News (`anthropic.com/news/rss.xml`)
- Hugging Face Blog (`huggingface.co/blog/feed.xml`)
- Google DeepMind Blog (`deepmind.google/blog/rss.xml`)

## 信任评分说明

信任评分用于衡量信息来源的可信度：

- **0.90+**: 官方权威来源（OpenAI、Anthropic 官方博客）
- **0.80-0.89**: 高质量技术社区（Hacker News、GitHub 官方项目）
- **0.70-0.79**: 中等可信来源（微博、知乎、魔搭、Reddit 高分帖子）
- **0.60-0.69**: 普通来源（搜索引擎、百度）

## 添加新数据源

如需添加新的数据源，需要修改以下文件：

1. `packages/shared/src/index.ts`
   - 在 `SourceKind` 类型中添加新的数据源类型
   - 在 `MonitorSourceConfig` 接口中添加新的布尔字段
   - 更新 `DEFAULT_SOURCE_CONFIG` 默认配置

2. `apps/server/src/services/sources.ts`
   - 添加数据源收集函数（如 `collectXXX`）
   - 在 `SourceService.collect()` 方法中调用新函数
   - 在 `scoreDomainTrust()` 中添加域名信任评分
   - 添加适当的过滤规则

3. `apps/web/src/app.tsx`
   - 在监控表单中添加新的复选框

## 热点评分说明

热点综合分数由 AI 模型根据以下指标计算：

### 评分公式

```
综合分数 = (信任分 × 0.4) + (互动分 × 0.3) + (新鲜分 × 0.3)
```

### 分数构成

| 指标 | 权重 | 说明 |
|------|------|------|
| 信任分 (trustScore) | 40% | 来源可信度，0.55-0.96 |
| 互动分 (engagementScore) | 30% | 社交媒体互动程度，0.0-1.0 |
| 新鲜分 (freshnessScore) | 30% | 内容时效性，0.0-1.0 |

### 新鲜分计算

```
freshnessScore = max(0, 1 - (age_in_hours / max_age))
```

- 内容发布后 1 小时内：freshnessScore ≈ 1.0
- 内容超过 48 小时：freshnessScore ≈ 0（接近归零）

### 通知阈值

- **shouldNotify = true**：仅当综合分数 ≥ 0.7
- **shouldNotify = false**：分数 < 0.7

### 热点聚类

AI 模型会将相似内容聚合为一个热点，每个热点包含：

- **label**: 热点中文标题（简短，不带编号）
- **summary**: 热点中文描述（180 字以内）
- **score**: 综合热度评分（0.0-1.0）
- **diversityScore**: 内容多样性评分
- **shouldNotify**: 是否触发通知
- **supportingUrls**: 热点包含的原始链接列表
