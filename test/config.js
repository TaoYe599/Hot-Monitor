/**
 * 测试配置文件
 * 用于 Hot-Monitor PRD 功能测试
 */

export const TEST_CONFIG = {
  // 服务器地址，默认本地开发服务器
  baseUrl: process.env.TEST_BASE_URL || 'http://127.0.0.1:8787',
  
  // API 超时时间（毫秒）
  timeout: 10000,
  
  // 测试用的邮箱地址
  testEmail: process.env.TEST_EMAIL || 'test@example.com',
  
  // 测试规则名称前缀
  testRulePrefix: 'TEST_RULE_',
};

// 辅助函数：等待指定时间
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 辅助函数：创建随机测试数据
export function randomId() {
  return Math.random().toString(36).substring(2, 10);
}

// 辅助函数：清理测试创建的规则
export async function cleanupTestRules(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/subscriptions`);
    if (response.ok) {
      const rules = await response.json();
      for (const rule of rules) {
        if (rule.name.startsWith(TEST_CONFIG.testRulePrefix)) {
          await fetch(`${baseUrl}/api/subscriptions/${rule.id}`, { 
            method: 'DELETE' 
          });
        }
      }
    }
  } catch (e) {
    // 忽略清理错误
  }
}
