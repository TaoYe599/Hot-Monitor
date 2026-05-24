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

热点数据在经过采集、去重归一化后，系统将通过大语言模型（如 DeepSeek-v4-flash 等配置模型）利用 JSON Schema 进行结构化判定与聚类，最终输出多维度的热点评分（均规范为 0.0 - 1.0 之间的百分比）。

### 1. 综合热度评分 (score)

表示该热点簇（Hotspot Cluster）的综合推荐指数。系统具备**AI 结构化判定**和**Heuristic 启发式降级**两套打分机制。

#### AI 聚类打分机制（正常流程）
AI 整理并聚类候选热点时，严格执行以下加权打分公式：
```
综合分数 = (信任分 × 0.4) + (互动分 × 0.3) + (新鲜分 × 0.3)
```

#### Heuristic 启发式聚类降级（AI 调用失败退化流程）
若 OpenRouter AI 服务因网络或限流调用失败，系统会退化为如下启发式打分：
```
综合分数 = (最高信任分 × 0.45) + (最高互动分 × 0.25) + (最新新鲜分 × 0.3)
```
*注：综合热度在 0.8 以上被定义为高热点，大多数普通聚类内容的分值会收敛在 0.5 - 0.7 之间。*

---

### 2. 多维度核心评分构成

前端面板（新、热）分别对应以下两个多维度核心指标：

#### ⏰ 新鲜度分 (freshnessScore)
衡量该热点聚合信号中最晚/最新的内容发布时间。

*   **AI 聚类判定分段标准**：
    *   **3 小时以内**：`1.0` (100%)
    *   **24 小时以内**：`0.64` (64%)
    *   **72 小时以内**：`0.48` (48%)
    *   **超过 72 小时**：`0.24` (24%)
*   **Heuristic 降级计算标准**：
    使用如下公式平滑衰减：
    ```
    freshnessScore = max(0, 1 - (age_in_hours / max_age))
    ```
    *通常 `max_age` 设定为 48 小时。超过 48 小时的内容新鲜度将归零。*

#### 🔥 互动度分 (engagementScore)
衡量该热点在各大平台上的传播与讨论热烈程度。热点簇的互动度分值继承自该热点簇中关联事件中最强/互动数据最高的那条事件。

对于不同的数据源平台，系统在后台采集并写入单条 `engagementScore` 时，有以下精确的统计折算规则（最大截断为 1.0）：

| 平台数据源 | 互动度 (engagementScore) 折算公式 |
| :--- | :--- |
| **Twitter/X** | 依据点赞量（Likes）、转推量（Retweets）、浏览量（Views）及评论量进行系统综合加权估算。 |
| **Hacker News** | $\min\left(1.0, (\text{Points} \times 0.001) + (\text{Comments} \times 0.002)\right)$ |
| **知乎** | $\min\left(1.0, (\text{赞同数} \times 0.001) + (\text{评论数} \times 0.002)\right)$ |
| **Reddit** | $\min\left(1.0, (\text{Score} \times 0.0008) + (\text{Comments} \times 0.002)\right)$ |
| **百度 / RSS 官方博客** | 缺乏原生社交互动数据，赋予基础分值（默认为 **0.35** 或 **0.40**）。 |

---

### 3. 通知阈值

*   **shouldNotify = true**：仅当 `score >= 0.7` 且来源可信度高（如 `trustScore >= 0.55`）时，AI 会将此热点判定为应通知状态，系统会通过 Web Push、Webhook、SMTP 邮件等渠道发出提醒。
*   **shouldNotify = false**：候选热点，静默保存在控制台，不触发通知。
*   在 `topic`（主题热点）监控模式下，只要 `score >= 0.3` 就会被聚合为候选热点保留在“热点发现”面板中，供进一步确认。

---

### 4. 热点数据结构 (HotspotCluster)

经过聚类和打分后，落库并传输给前端展示的 `HotspotCluster` 包含以下指标字段：

- **label**: 热点中文标题（由 AI 提炼，简短精炼，不带编号或前缀）
- **summary**: 热点中文描述及情报摘要（180 字以内）
- **score**: 综合热度评分（0.0 - 1.0，前端渲染为“热点 xx%”）
- **freshnessScore**: 内容新鲜度（0.0 - 1.0，前端渲染为“新 xx%”）
- **engagementScore**: 互动热度（0.0 - 1.0，前端渲染为“热 xx%”）
- **shouldNotify**: 是否触发系统级别通知
- **supportingUrls**: 热点所包含的关联原始链接列表（前端据此渲染“来源链路”）
- **createdAt**: 系统的扫描与热点发现时间
- **latestPublishedAt**: 关联事件的最新发布时间
