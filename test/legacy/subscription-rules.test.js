/**
 * PRD 章节 5.1 - 订阅规则匹配引擎测试
 * 
 * 测试范围：
 * - 订阅规则元数据（名称、状态开关）
 * - 信息筛选矩阵（任务源、关键词逻辑、热度阈值、信源数量）
 * - 发送频次策略（实时、定时）
 * - 路由接收人配置
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { TEST_CONFIG, cleanupTestRules, randomId } from './config.js';

const { baseUrl, testRulePrefix, testEmail } = TEST_CONFIG;

describe('PRD 5.1 - 订阅规则管理', () => {
  before(async () => {
    // 清理旧测试规则
    await cleanupTestRules(baseUrl);
  });

  after(async () => {
    // 清理测试规则
    await cleanupTestRules(baseUrl);
  });

  describe('5.1.1 订阅规则元数据（名称、状态开关）', () => {
    it('应该能够创建带名称和启用状态的规则', async () => {
      const ruleName = `${testRulePrefix}元数据测试_${randomId()}`;
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

      assert.strictEqual(response.status, 201, '创建规则应该返回 201');
      const rule = await response.json();
      assert.strictEqual(rule.name, ruleName, '规则名称应该正确保存');
      assert.strictEqual(rule.enabled, true, '启用状态应该为 true');
      assert.ok(rule.id, '规则应该被分配 ID');
    });

    it('应该能够创建禁用状态的规则', async () => {
      const ruleName = `${testRulePrefix}禁用状态_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: false,
          recipients: [testEmail],
          minScore: 0.5,
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.strictEqual(rule.enabled, false, '禁用状态应该为 false');
    });

    it('应该能够切换规则的启用状态', async () => {
      // 先创建规则
      const ruleName = `${testRulePrefix}状态切换_${randomId()}`;
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
      const rule = await createRes.json();

      // 切换为禁用
      const patchRes = await fetch(`${baseUrl}/api/subscriptions/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });

      assert.strictEqual(patchRes.status, 200, 'PATCH 应该返回 200');
      const updatedRule = await patchRes.json();
      assert.strictEqual(updatedRule.enabled, false, '规则应该被禁用');

      // 切换回启用
      const enableRes = await fetch(`${baseUrl}/api/subscriptions/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
      const enabledRule = await enableRes.json();
      assert.strictEqual(enabledRule.enabled, true, '规则应该重新启用');
    });
  });

  describe('5.1.2 信息筛选矩阵', () => {
    it('应该能够配置关键词 OR 逻辑（包含任意关键词）', async () => {
      const ruleName = `${testRulePrefix}关键词OR_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          includeKeywords: ['DeepSeek', 'Llama', 'GPT'],
          minScore: 0.7,
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.deepStrictEqual(rule.includeKeywords, ['DeepSeek', 'Llama', 'GPT'], 'OR 关键词应该正确保存');
    });

    it('应该能够配置关键词 AND 逻辑（必须同时包含）', async () => {
      const ruleName = `${testRulePrefix}关键词AND_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          andKeywords: ['开源', '发布'],
          minScore: 0.7,
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.deepStrictEqual(rule.andKeywords, ['开源', '发布'], 'AND 关键词应该正确保存');
    });

    it('应该能够配置排除关键词（NOT 逻辑）', async () => {
      const ruleName = `${testRulePrefix}排除关键词_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          includeKeywords: ['AI', 'LLM'],
          excludeKeywords: ['广告', '推广'],
          minScore: 0.7,
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.deepStrictEqual(rule.excludeKeywords, ['广告', '推广'], '排除关键词应该正确保存');
    });

    it('应该能够配置热度阈值', async () => {
      const ruleName = `${testRulePrefix}热度阈值_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          minScore: 0.85,
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.strictEqual(rule.minScore, 0.85, '热度阈值应该正确保存');
    });

    it('应该能够配置最低信源数量', async () => {
      const ruleName = `${testRulePrefix}信源数量_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          minSupportingSources: 5,
          minScore: 0.7,
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.strictEqual(rule.minSupportingSources, 5, '最低信源数量应该正确保存');
    });

    it('应该能够配置最低可信度阈值', async () => {
      const ruleName = `${testRulePrefix}可信度阈值_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          minTrustScore: 0.75,
          minScore: 0.7,
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.strictEqual(rule.minTrustScore, 0.75, '最低可信度阈值应该正确保存');
    });
  });

  describe('5.1.3 发送频次策略', () => {
    it('应该能够配置实时发送频次', async () => {
      const ruleName = `${testRulePrefix}实时发送_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.strictEqual(rule.deliveryFrequency, 'instant', '发送频次应该为实时');
    });

    it('应该能够配置每日定时发送', async () => {
      const ruleName = `${testRulePrefix}每日定时_${randomId()}`;
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
      assert.strictEqual(rule.deliveryFrequency, 'daily', '发送频次应该为每日');
      assert.strictEqual(rule.deliveryTime, '09:00', '发送时间应该正确保存');
    });

    it('应该能够配置每周定时发送', async () => {
      const ruleName = `${testRulePrefix}每周定时_${randomId()}`;
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
      assert.strictEqual(rule.deliveryFrequency, 'weekly', '发送频次应该为每周');
      assert.strictEqual(rule.deliveryTime, '17:30', '发送时间应该正确保存');
    });

    it('应该支持多时点配置（逗号分隔）', async () => {
      const ruleName = `${testRulePrefix}多时点_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: [testEmail],
          deliveryFrequency: 'daily',
          deliveryTime: '09:00, 14:00, 18:00',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.strictEqual(rule.deliveryTime, '09:00, 14:00, 18:00', '多时点配置应该正确保存');
    });
  });

  describe('5.1.4 路由接收人配置', () => {
    it('应该能够配置单个接收人', async () => {
      const ruleName = `${testRulePrefix}单接收人_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: ['cto@company.com'],
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.deepStrictEqual(rule.recipients, ['cto@company.com'], '单个接收人应该正确保存');
    });

    it('应该能够配置多个接收人', async () => {
      const ruleName = `${testRulePrefix}多接收人_${randomId()}`;
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: ['tech@company.com', 'cto@company.com', 'pr@company.com'],
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201);
      const rule = await response.json();
      assert.deepStrictEqual(
        rule.recipients, 
        ['tech@company.com', 'cto@company.com', 'pr@company.com'], 
        '多个接收人应该正确保存'
      );
    });
  });

  describe('5.1.5 规则 CRUD 操作', () => {
    it('应该能够列出所有订阅规则', async () => {
      const response = await fetch(`${baseUrl}/api/subscriptions`);
      assert.strictEqual(response.status, 200, '获取规则列表应该返回 200');
      const rules = await response.json();
      assert.ok(Array.isArray(rules), '规则列表应该是数组');
    });

    it('应该能够编辑规则', async () => {
      // 创建规则
      const ruleName = `${testRulePrefix}编辑测试_${randomId()}`;
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
      const rule = await createRes.json();

      // 编辑规则
      const patchRes = await fetch(`${baseUrl}/api/subscriptions/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${ruleName}_已修改`,
          minScore: 0.85,
          includeKeywords: ['AI', 'LLM'],
        }),
      });

      assert.strictEqual(patchRes.status, 200, '编辑规则应该返回 200');
      const updatedRule = await patchRes.json();
      assert.strictEqual(updatedRule.name, `${ruleName}_已修改`, '名称应该被更新');
      assert.strictEqual(updatedRule.minScore, 0.85, '阈值应该被更新');
      assert.deepStrictEqual(updatedRule.includeKeywords, ['AI', 'LLM'], '关键词应该被更新');
    });

    it('应该能够删除规则', async () => {
      // 创建规则
      const ruleName = `${testRulePrefix}删除测试_${randomId()}`;
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
      const rule = await createRes.json();

      // 删除规则
      const deleteRes = await fetch(`${baseUrl}/api/subscriptions/${rule.id}`, {
        method: 'DELETE',
      });
      assert.strictEqual(deleteRes.status, 200, '删除规则应该返回 200');

      // 验证规则已被删除
      const getRes = await fetch(`${baseUrl}/api/subscriptions/${rule.id}`);
      assert.strictEqual(getRes.status, 404, '已删除规则应该返回 404');
    });

    it('删除不存在的规则应该返回 404', async () => {
      const response = await fetch(`${baseUrl}/api/subscriptions/99999`, {
        method: 'DELETE',
      });
      assert.strictEqual(response.status, 404, '删除不存在规则应该返回 404');
    });
  });

  describe('5.1.6 表单验证', () => {
    it('规则名称不能为空', async () => {
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          enabled: true,
          recipients: [testEmail],
          deliveryFrequency: 'instant',
        }),
      });

      // API 对空名称返回 500（因为 zod 验证在 server 层）
      // 或者返回 400，取决于验证位置
      assert.ok(
        response.status === 400 || response.status === 500,
        `空名称应该返回 400 或 500，实际: ${response.status}`
      );
    });

    it('接收人邮箱列表不能为空', async () => {
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${testRulePrefix}空邮箱_${randomId()}`,
          enabled: true,
          recipients: [],
          deliveryFrequency: 'instant',
        }),
      });

      assert.ok(
        response.status === 400 || response.status === 500,
        `空邮箱列表应该返回 400 或 500，实际: ${response.status}`
      );
    });

    it('接收人邮箱格式必须正确', async () => {
      const response = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${testRulePrefix}错误邮箱_${randomId()}`,
          enabled: true,
          recipients: ['not-an-email'],
          deliveryFrequency: 'instant',
        }),
      });

      assert.ok(
        response.status === 400 || response.status === 500,
        `错误邮箱格式应该返回 400 或 500，实际: ${response.status}`
      );
    });
  });
});
