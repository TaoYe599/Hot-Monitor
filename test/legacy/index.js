/**
 * Hot-Monitor PRD 功能测试套件
 * 
 * 运行方式：
 *   node --test test/*.test.js
 *   或者
 *   pnpm test
 * 
 * 前置条件：
 *   1. 后端服务器必须运行在 http://127.0.0.1:8787
 *   2. 或设置环境变量 TEST_BASE_URL 指定服务器地址
 *   3. 测试会创建和删除以 "TEST_RULE_" 开头的规则
 */

import { describe } from 'node:test';

// 导入所有测试文件
import './subscription-rules.test.js';
import './cooldown-evolution.test.js';
import './silent-period.test.js';
import './email-templates.test.js';
import './health-dashboard.test.js';

console.log('===========================================');
console.log('Hot-Monitor PRD 功能测试套件');
console.log('===========================================');
console.log('');
console.log('测试范围覆盖：');
console.log('  ✓ PRD 5.1 - 订阅规则管理');
console.log('  ✓ PRD 6.1 - 防轰炸冷却与演进判定');
console.log('  ✓ PRD 6.2 - 数据静默归档与唤醒释放');
console.log('  ✓ PRD 7   - 拟物化邮件模板');
console.log('  ✓ PRD 8.2 - 闭环式智能负反馈机制');
console.log('  ✓ PRD 8.3 - 订阅健康看板与送达监控');
console.log('  ✓ PRD 9.2 - 零警报安全信降级');
console.log('');
console.log('===========================================');
