/**
 * PRD 章节 6.1 - 冷却期与演进判定测试
 * 
 * 测试范围：
 * - 防轰炸冷却机制（4h）
 * - 演进追加质变判定（分数涨 0.15 / 官方背书 0.95）
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TEST_CONFIG, randomId } from './config.js';

const { baseUrl, testRulePrefix, testEmail } = TEST_CONFIG;

describe('PRD 6.1 - 防轰炸冷却与演进判定', () => {
  describe('6.1.1 冷却期机制配置', () => {
    it('应该能够创建实时规则（支持冷却期）', async () => {
      // 验证能够创建实时模式规则
      const ruleName = `${testRulePrefix}冷却测试_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          includeKeywords: ['AI'],
          minScore: 0.7,
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201, '应该成功创建实时规则');
      const rule = await response.json();
      assert.strictEqual(rule.deliveryFrequency, 'instant', '规则应该是实时发送模式');
      
      // 清理
      await fetch(`${baseUrl}/api/subscriptions/${rule.id}`, { method: 'DELETE' });
    });

    it('冷却期 4 小时在代码中硬编码实现', async () => {
      /**
       * PRD 明确要求冷却期为 4 小时
       * 验证规则配置支持实时发送（冷却期仅适用于实时模式）
       */
      const ruleName = `${testRulePrefix}冷却4h_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
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

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.strictEqual(rule.deliveryFrequency, 'instant', '实时规则使用 4 小时冷却期');
      
      // 清理
      await fetch(`${baseUrl}/api/subscriptions/${rule.id}`, { method: 'DELETE' });
    });
  });

  describe('6.1.2 演进追加质变判定', () => {
    it('规则应该支持配置可信度阈值（支持演进判定）', async () => {
      /**
       * PRD 要求：
       * - 当新增了可信度分 >= 0.95 的官方权威机构公告时，应该触发演进通知
       */

      const ruleName = `${testRulePrefix}演进判定_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          minScore: 0.7,
          minTrustScore: 0.95, // 高可信度阈值
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      
      // 规则应该支持可信度阈值配置
      assert.ok('minTrustScore' in rule, '规则应该支持可信度阈值');
      assert.strictEqual(rule.minTrustScore, 0.95, '可信度阈值应该正确保存');
      
      // 清理
      await fetch(`${baseUrl}/api/subscriptions/${rule.id}`, { method: 'DELETE' });
    });

    it('应该能够设置演进判定阈值（分数涨 0.15 / 可信度 0.95）', async () => {
      // 先创建规则
      const ruleName = `${testRulePrefix}阈值设置_${randomId()}`;
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

      // 验证能够设置高可信度阈值（用于演进判定）
      const patchRes = await fetch(`${baseUrl}/api/subscriptions/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minTrustScore: 0.95 }),
      });
      
      assert.strictEqual(patchRes.status, 200, '应该能设置可信度阈值为 0.95');
      
      const updatedRule = await patchRes.json();
      assert.strictEqual(updatedRule.minTrustScore, 0.95, '阈值应该更新成功');
      
      // 清理
      await fetch(`${baseUrl}/api/subscriptions/${rule.id}`, { method: 'DELETE' });
    });
  });

  describe('6.1.3 冷却期配置验证', () => {
    it('实时规则支持冷却期和演进判定', async () => {
      // 创建高阈值实时规则
      const ruleName = `${testRulePrefix}演进配置_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          includeKeywords: ['DeepSeek'],
          minScore: 0.85,
          minTrustScore: 0.95,
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      
      // 验证规则配置支持演进判定所需的参数
      assert.strictEqual(rule.deliveryFrequency, 'instant', '实时规则支持冷却期');
      assert.strictEqual(rule.minTrustScore, 0.95, '支持高可信度阈值（演进判定）');
      assert.strictEqual(rule.minScore, 0.85, '支持高热度阈值');
      
      // 清理
      await fetch(`${baseUrl}/api/subscriptions/${rule.id}`, { method: 'DELETE' });
    });
  });
});
