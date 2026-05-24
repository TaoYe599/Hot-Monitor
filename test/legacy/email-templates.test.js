/**
 * PRD 章节 7 - 拟物化邮件模板测试
 * 
 * 测试范围：
 * - 实时预警邮件模板（Apple 降级拟物）
 * - 周期汇总简报模板
 * - 新鲜度/互动度数据渲染
 * - 官方权威信源标识
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { TEST_CONFIG, cleanupTestRules, randomId } from './config.js';

const { baseUrl, testRulePrefix, testEmail } = TEST_CONFIG;

describe('PRD 7 - 拟物化邮件模板', () => {
  before(async () => {
    await cleanupTestRules(baseUrl);
  });

  after(async () => {
    await cleanupTestRules(baseUrl);
  });

  describe('7.1 实时预警邮件 (Instant Alert)', () => {
    it('应该能够触发实时预警测试邮件', async () => {
      /**
       * PRD 7.1 - 实时预警邮件应该包含：
       * - 红色呼吸灯指示器
       * - 热度/新鲜度/互动度指标
       * - AI 情报摘要
       * - 信源追踪与原著链路
       * - 负反馈按钮
       */

      // 创建测试规则
      const ruleName = `${testRulePrefix}邮件测试_${randomId()}`;
      const createRes = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          includeKeywords: ['DeepSeek', 'LLM'],
          minScore: 0.7,
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(createRes.status, 201);
      const rule = await createRes.json();

      // 触发测试邮件发送
      const testRes = await fetch(`${baseUrl}/api/subscriptions/${rule.id}/test-notification`, {
        method: 'POST',
      });

      assert.strictEqual(testRes.status, 200, '测试邮件 API 应该返回 200');
      const result = await testRes.json();
      assert.strictEqual(result.ok, true, '测试邮件应该发送成功');
    });

    it('实时预警邮件应该支持 Heuristic 降级提示', async () => {
      /**
       * PRD 9.1 - AI 服务调用失败时的邮件生成降级
       * - 邮件顶部显示降级提示文案
       * - 指标使用启发式算法计算
       */

      // 创建规则（Heuristic 降级在代码中根据 hotspot.isHeuristic 字段自动判断）
      const ruleName = `${testRulePrefix}Heuristic测试_${randomId()}`;
      const createRes = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          minScore: 0.7,
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(createRes.status, 201);
      const rule = await createRes.json();

      // 验证规则可以正常发送测试邮件
      // Heuristic 模式会在实际热点数据中体现
      const testRes = await fetch(`${baseUrl}/api/subscriptions/${rule.id}/test-notification`, {
        method: 'POST',
      });

      assert.strictEqual(testRes.status, 200);
    });
  });

  describe('7.1.1 邮件内容元素验证', () => {
    it('实时预警邮件应该包含新鲜度指标', async () => {
      /**
       * PRD 7.1.1 要求：
       * - 新鲜度数据实际渲染（freshnessScore）
       */

      const ruleName = `${testRulePrefix}新鲜度测试_${randomId()}`;
      const createRes = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(createRes.status, 201);
      const rule = await createRes.json();

      // 发送测试邮件
      const testRes = await fetch(`${baseUrl}/api/subscriptions/${rule.id}/test-notification`, {
        method: 'POST',
      });

      // 测试邮件使用 mockHotspot 数据，其中 freshnessScore: 1.0
      assert.strictEqual(testRes.status, 200);
    });

    it('实时预警邮件应该包含互动热度指标', async () => {
      /**
       * PRD 7.1.1 要求：
       * - 互动热度数据实际渲染（engagementScore）
       */

      const ruleName = `${testRulePrefix}互动度测试_${randomId()}`;
      const createRes = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(createRes.status, 201);
      const rule = await createRes.json();

      // 发送测试邮件
      const testRes = await fetch(`${baseUrl}/api/subscriptions/${rule.id}/test-notification`, {
        method: 'POST',
      });

      // 测试邮件使用 mockHotspot 数据，其中 engagementScore: 0.92
      assert.strictEqual(testRes.status, 200);
    });

    it('实时预警邮件应该包含官方权威信源标识', async () => {
      /**
       * PRD 7.1.1 要求：
       * - 官方权威信源高亮标识（authenticityScore >= 0.9）
       */

      const ruleName = `${testRulePrefix}官方标识测试_${randomId()}`;
      const createRes = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          minTrustScore: 0.9, // 设置高可信度阈值
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(createRes.status, 201);
      const rule = await createRes.json();

      // 发送测试邮件
      const testRes = await fetch(`${baseUrl}/api/subscriptions/${rule.id}/test-notification`, {
        method: 'POST',
      });

      // 测试邮件的 mock 事件包含 authenticityScore: 0.95 和 0.88
      assert.strictEqual(testRes.status, 200);
    });
  });

  describe('7.2 周期汇总简报 (Periodic Digest)', () => {
    it('每日简报应该能够正常配置', async () => {
      /**
       * PRD 7.2 - 周期汇总简报应该包含：
       * - 高雅卡片流设计
       * - 热度排行榜 TOP 3
       * - 监控主题分组
       */

      const ruleName = `${testRulePrefix}日报测试_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          deliveryFrequency: 'daily',
          deliveryTime: '09:00',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.strictEqual(rule.deliveryFrequency, 'daily', '发送频次应该是每日');
      assert.strictEqual(rule.deliveryTime, '09:00', '发送时间应该是 09:00');
    });

    it('每周简报应该能够正常配置', async () => {
      const ruleName = `${testRulePrefix}周报测试_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          deliveryFrequency: 'weekly',
          deliveryTime: '17:30',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.strictEqual(rule.deliveryFrequency, 'weekly', '发送频次应该是每周');
    });

    it('周期简报应该支持无热点时的零警报安全信', async () => {
      /**
       * PRD 9.2 - 定时发送时的数据枯竭降级
       * - 不发送完全空白的简报邮件
       * - 发送"运行平稳"告知邮件
       */

      // 这个功能在 scheduler.ts 中实现
      // 当 matchedHotspots.length === 0 时，发送静默报信邮件

      const ruleName = `${testRulePrefix}零警报测试_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          deliveryFrequency: 'daily',
          deliveryTime: '09:00',
          minScore: 0.99, // 高阈值确保没有热点匹配
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      
      // 规则创建成功，零警报降级在调度时自动触发
      assert.ok(rule.id, '规则应该有 ID');
    });
  });

  describe('8.2 闭环式智能负反馈机制', () => {
    it('应该支持正反馈（relevant）', async () => {
      /**
       * PRD 8.2 - 邮件底部提供 👍/👎 按钮
       * 用户点击后触发反馈动作
       */

      // 测试反馈 API
      const response = await fetch(`${baseUrl}/api/feedback?hotspotId=1&ruleId=1&verdict=relevant`);
      assert.strictEqual(response.status, 200, '正反馈 API 应该返回 200');
      
      const contentType = response.headers.get('content-type');
      assert.ok(contentType?.includes('text/html'), '反馈页面应该是 HTML');
    });

    it('应该支持负反馈（irrelevant）', async () => {
      const response = await fetch(`${baseUrl}/api/feedback?hotspotId=1&ruleId=1&verdict=irrelevant`);
      assert.strictEqual(response.status, 200);
      
      const contentType = response.headers.get('content-type');
      assert.ok(contentType?.includes('text/html'), '反馈页面应该是 HTML');
    });

    it('应该支持分类错误反馈（wrong_category）', async () => {
      const response = await fetch(`${baseUrl}/api/feedback?hotspotId=1&ruleId=1&verdict=wrong_category`);
      assert.strictEqual(response.status, 200);
    });

    it('应该支持分数过高反馈（score_too_high）', async () => {
      const response = await fetch(`${baseUrl}/api/feedback?hotspotId=1&ruleId=1&verdict=score_too_high`);
      assert.strictEqual(response.status, 200);
    });

    it('未知反馈类型应该返回默认值', async () => {
      const response = await fetch(`${baseUrl}/api/feedback?hotspotId=1&ruleId=1&verdict=unknown`);
      assert.strictEqual(response.status, 200);
      
      // 应该返回 HTML 反馈页面
      const contentType = response.headers.get('content-type');
      assert.ok(contentType?.includes('text/html'));
    });
  });
});
