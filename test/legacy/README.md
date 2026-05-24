# Hot-Monitor PRD 功能测试套件

本测试套件用于验证 PRD 文档中定义的所有功能点是否已正确实现。

## 测试覆盖范围

| PRD 章节 | 功能点 | 测试文件 |
|----------|--------|----------|
| 5.1 | 订阅规则元数据（名称、状态开关） | `subscription-rules.test.js` |
| 5.1 | 信息筛选矩阵（关键词、热阈值、信源） | `subscription-rules.test.js` |
| 5.1 | 发送频次策略（实时、定时） | `subscription-rules.test.js` |
| 5.1 | 路由接收人配置 | `subscription-rules.test.js` |
| 6.1 | 防轰炸冷却机制（4h） | `cooldown-evolution.test.js` |
| 6.1 | 演进追加质变判定（分数涨 0.15 / 官方背书 0.95） | `cooldown-evolution.test.js` |
| 6.2 | 数据静默归档机制（22:00-08:00） | `silent-period.test.js` |
| 6.2 | 静默期唤醒释放（08:00 合并早报） | `silent-period.test.js` |
| 7.1 | 实时预警邮件模板 | `email-templates.test.js` |
| 7.1 | 新鲜度/互动度/官方标识数据渲染 | `email-templates.test.js` |
| 7.2 | 周期汇总简报模板 | `email-templates.test.js` |
| 8.2 | 多维度负反馈表单 | `email-templates.test.js` |
| 8.3 | 订阅健康看板（送达率、噪音比） | `health-dashboard.test.js` |
| 9.1 | AI 服务降级文案（Heuristic 模式） | `email-templates.test.js` |
| 9.2 | 零警报安全信降级 | `health-dashboard.test.js` |

## 前置条件

1. **后端服务器必须运行**
   ```bash
   cd apps/server
   pnpm dev
   ```

2. **服务器默认地址**: `http://127.0.0.1:8787`
   - 可通过环境变量 `TEST_BASE_URL` 自定义

## 运行测试

### 方式一：使用 pnpm（推荐）

```bash
# 在项目根目录运行
pnpm test
```

### 方式二：直接使用 Node.js

```bash
# 安装依赖
pnpm install

# 运行所有测试
node --test test/*.test.js

# 运行单个测试文件
node --test test/subscription-rules.test.js

# 运行带监视模式的测试
node --test test/*.test.js --watch
```

## 测试结构

```
test/
├── config.js                  # 测试配置文件
├── index.js                  # 测试入口文件
├── package.json              # 测试依赖配置
├── subscription-rules.test.js # PRD 5.1 订阅规则管理
├── cooldown-evolution.test.js # PRD 6.1 冷却与演进
├── silent-period.test.js      # PRD 6.2 静默期机制
├── email-templates.test.js    # PRD 7 邮件模板
└── health-dashboard.test.js   # PRD 8.3 健康看板
```

## 测试配置

在 `config.js` 中可以修改以下配置：

```javascript
export const TEST_CONFIG = {
  baseUrl: 'http://127.0.0.1:8787',  // 服务器地址
  timeout: 10000,                      // API 超时时间（毫秒）
  testEmail: 'test@example.com',      // 测试用邮箱
  testRulePrefix: 'TEST_RULE_',       // 测试规则名称前缀
};
```

## 测试清理

测试会自动清理以 `TEST_RULE_` 前缀开头的规则。
如果测试中断，可以手动清理：

```bash
# 通过 API 删除测试规则
curl -X DELETE http://127.0.0.1:8787/api/subscriptions/{id}
```

## 预期测试结果

所有测试通过后，应该看到类似输出：

```
✓ PRD 5.1 - 订阅规则管理 (18 tests)
✓ PRD 6.1 - 防轰炸冷却与演进判定 (6 tests)
✓ PRD 6.2 - 数据静默归档与唤醒释放 (5 tests)
✓ PRD 7 - 拟物化邮件模板 (11 tests)
✓ PRD 8.3 - 订阅健康看板与送达监控 (10 tests)

Total: 50 tests passed
```

## 注意事项

1. **邮件发送测试**：部分测试会实际发送邮件，需要配置 SMTP
2. **时序依赖**：静默期测试依赖于时间判断，部分为间接验证
3. **数据隔离**：测试使用独立前缀，不会影响生产数据
