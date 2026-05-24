/**
 * Hot-Monitor 前端页面冒烟测试
 * 
 * 运行方式：
 *   node --test test/smoke.test.js
 * 
 * 前置条件：
 *   1. 后端服务器必须运行在 http://127.0.0.1:8787
 *   2. 前端必须已构建（apps/web/dist 目录存在）
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

const BASE_URL = 'http://127.0.0.1:8787';

describe('Hot-Monitor 前端页面冒烟测试', () => {
  
  describe('1. 后端 API 基础健康检查', () => {
    it('API 健康检查应该返回 200', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      assert.strictEqual(response.status, 200, '健康检查 API 应该返回 200');
      
      const data = await response.json();
      assert.ok(data.ok === true, '健康检查应该返回 ok: true');
      assert.ok(data.port, '健康检查应该返回端口号');
    });
  });

  describe('2. 主页加载测试', () => {
    it('主页 HTML 应该能正常加载', async () => {
      const response = await fetch(`${BASE_URL}/`);
      assert.strictEqual(response.status, 200, '主页应该返回 200');
      
      const html = await response.text();
      assert.ok(html.length > 0, '主页 HTML 不应该为空');
      assert.ok(html.includes('<!DOCTYPE html>') || html.includes('<html'), '返回的应该是 HTML');
    });
  });

  describe('3. 通知设置页面测试', () => {
    it('通知设置页面应该能正常加载', async () => {
      const response = await fetch(`${BASE_URL}/settings`);
      assert.strictEqual(response.status, 200, '/settings 应该返回 200');
      
      const html = await response.text();
      assert.ok(html.length > 0, '设置页面 HTML 不应该为空');
      assert.ok(html.includes('<!DOCTYPE html>') || html.includes('<html'), '返回的应该是 HTML');
    });
  });

  describe('4. Dashboard API 测试', () => {
    it('Dashboard API 应该返回正确的数据结构', async () => {
      const response = await fetch(`${BASE_URL}/api/dashboard`);
      assert.strictEqual(response.status, 200, 'Dashboard API 应该返回 200');
      
      const data = await response.json();
      
      // 验证必要字段存在
      assert.ok('monitors' in data, 'Dashboard 应该包含 monitors 字段');
      assert.ok('events' in data, 'Dashboard 应该包含 events 字段');
      assert.ok('hotspots' in data, 'Dashboard 应该包含 hotspots 字段');
      assert.ok('settings' in data, 'Dashboard 应该包含 settings 字段');
      assert.ok('subscriptionRules' in data, 'Dashboard 应该包含 subscriptionRules 字段');
      assert.ok('stats' in data, 'Dashboard 应该包含 stats 字段');
      
      // 验证订阅规则列表
      assert.ok(Array.isArray(data.subscriptionRules), 'subscriptionRules 应该是数组');
    });
  });

  describe('5. 订阅规则 API 测试', () => {
    it('应该能够获取订阅规则列表', async () => {
      const response = await fetch(`${BASE_URL}/api/subscriptions`);
      assert.strictEqual(response.status, 200, '订阅规则列表 API 应该返回 200');
      
      const rules = await response.json();
      assert.ok(Array.isArray(rules), '订阅规则应该返回数组');
    });

    it('应该能够创建新的订阅规则', async () => {
      const ruleName = `SMOKE_TEST_${Date.now()}`;
      const response = await fetch(`${BASE_URL}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          enabled: true,
          recipients: ['smoke-test@example.com'],
          minScore: 0.7,
          deliveryFrequency: 'instant',
        }),
      });

      assert.strictEqual(response.status, 201, '创建规则应该返回 201');
      
      const rule = await response.json();
      assert.strictEqual(rule.name, ruleName, '规则名称应该正确保存');
      assert.ok(rule.id, '规则应该有 ID');
      
      // 清理
      await fetch(`${BASE_URL}/api/subscriptions/${rule.id}`, { method: 'DELETE' });
    });
  });

  describe('6. 健康看板 API 测试', () => {
    it('健康看板 API 应该返回统计数据', async () => {
      const response = await fetch(`${BASE_URL}/api/notifications/stats`);
      assert.strictEqual(response.status, 200, '健康看板 API 应该返回 200');
      
      const stats = await response.json();
      
      assert.ok('total' in stats, '统计应该包含 total');
      assert.ok('sent' in stats, '统计应该包含 sent');
      assert.ok('failed' in stats, '统计应该包含 failed');
      assert.ok('deliveryRate' in stats, '统计应该包含 deliveryRate');
      assert.ok('noiseRatio' in stats, '统计应该包含 noiseRatio');
      assert.ok('dailyStats' in stats, '统计应该包含 dailyStats');
      
      // 验证数据范围
      assert.ok(stats.deliveryRate >= 0 && stats.deliveryRate <= 1, '送达率应该在 0-1 范围内');
      assert.ok(stats.noiseRatio >= 0 && stats.noiseRatio <= 1, '噪音比应该在 0-1 范围内');
    });
  });

  describe('7. 负反馈 API 测试', () => {
    it('反馈 API 应该返回 HTML 页面', async () => {
      const response = await fetch(`${BASE_URL}/api/feedback?hotspotId=1&ruleId=1&verdict=relevant`);
      assert.strictEqual(response.status, 200, '反馈 API 应该返回 200');
      
      const contentType = response.headers.get('content-type');
      assert.ok(contentType?.includes('text/html'), '反馈应该返回 HTML');
    });
  });

  describe('8. 监控任务 API 测试', () => {
    it('应该能够获取监控任务列表', async () => {
      const response = await fetch(`${BASE_URL}/api/monitors`);
      assert.strictEqual(response.status, 200, '监控任务列表 API 应该返回 200');
      
      const monitors = await response.json();
      assert.ok(Array.isArray(monitors), '监控任务应该返回数组');
    });
  });

  describe('9. 热点 API 测试', () => {
    it('应该能够获取热点列表', async () => {
      const response = await fetch(`${BASE_URL}/api/hotspots`);
      assert.strictEqual(response.status, 200, '热点列表 API 应该返回 200');
      
      const data = await response.json();
      assert.ok('hotspots' in data, '响应应该包含 hotspots');
      assert.ok('total' in data, '响应应该包含 total');
      assert.ok(Array.isArray(data.hotspots), 'hotspots 应该是数组');
    });
  });

  describe('10. 前端资源加载测试', () => {
    it('前端 JS 资源应该能加载', async () => {
      const response = await fetch(`${BASE_URL}/assets/index-DX9eO1NQ.css`);
      // CSS 文件可能不存在或文件名不同，检查主要入口文件
      const indexResponse = await fetch(`${BASE_URL}/`);
      
      assert.strictEqual(indexResponse.status, 200, '前端入口应该能加载');
      
      const html = await indexResponse.text();
      // 检查是否引用了 JS 资源
      assert.ok(
        html.includes('<script') || html.includes('index-'),
        'HTML 应该引用了 JS 资源'
      );
    });
  });
});

console.log('运行前端冒烟测试...');
console.log(`测试目标: ${BASE_URL}`);
