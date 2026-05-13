/**
 * 验证热点卡片增强功能 (简化版)
 */

import { chromium, type Browser } from "playwright";

const BASE_URL = "http://localhost:5255";
const results: Array<{ name: string; passed: boolean; message: string }> = [];

function pass(name: string, message: string) {
  results.push({ name, passed: true, message });
  console.log(`  [PASS] ${name}: ${message}`);
}

function fail(name: string, message: string) {
  results.push({ name, passed: false, message });
  console.log(`  [FAIL] ${name}: ${message}`);
}

async function runTests() {
  let browser: Browser | null = null;

  try {
    console.log("\n🚀 启动浏览器...\n");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    console.log(`🌐 导航到 ${BASE_URL}/hotspots ...`);
    await page.goto(`${BASE_URL}/hotspots`, { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForTimeout(1500);

    // 检查"热点发现"标题
    {
      const panelTitle = await page.locator("h2").filter({ hasText: "热点发现" }).count();
      panelTitle > 0 ? pass("热点发现面板", "找到面板标题") : fail("热点发现面板", "未找到");
    }

    // 检查全选复选框
    {
      const checkboxes = await page.locator('input[type="checkbox"]').count();
      checkboxes > 0 ? pass("批量选择复选框", `找到 ${checkboxes} 个复选框`) : fail("批量选择复选框", "未找到");
    }

    // 检查展开/折叠按钮
    {
      const expandBtn = await page.locator("button").filter({ hasText: /全部展开|全部折叠/ }).count();
      expandBtn > 0 ? pass("展开/折叠按钮", `找到 ${expandBtn} 个`) : fail("展开/折叠按钮", "未找到");
    }

    // 检查来源类型标签
    {
      const sourceLabels = await page.locator('[class*="ember"]').count();
      sourceLabels > 0 ? pass("来源类型标签", `找到 ${sourceLabels} 个`) : fail("来源类型标签", "未找到");
    }

    // 检查热点评分
    {
      const scoreText = await page.locator("text=热点").count();
      scoreText > 0 ? pass("热点评分", "找到评分显示") : fail("热点评分", "未找到");
    }

    // 检查时间颜色编码
    {
      const coloredTime = await page.locator('[class*="text-red"], [class*="text-orange"], [class*="text-yellow"]').count();
      coloredTime > 0 ? pass("时间颜色编码", `找到 ${coloredTime} 个彩色时间`) : fail("时间颜色编码", "未找到");
    }

    // 检查 AI 聚类理由
    {
      const reasonBtn = await page.locator("text=AI 聚类理由").count();
      reasonBtn > 0 ? pass("AI 聚类理由", `找到 ${reasonBtn} 个`) : fail("AI 聚类理由", "未找到");
    }

    // 检查来源链接展开
    {
      const sourcesBtn = await page.locator("button").filter({ hasText: /来源链接/ }).count();
      sourcesBtn > 0 ? pass("来源链接展开", `找到 ${sourcesBtn} 个`) : fail("来源链接展开", "未找到");
    }

    // 检查多维度评分
    {
      const newScore = await page.locator("text=/新 /").count();
      const multiScore = await page.locator("text=/多 /").count();
      const hotScore = await page.locator("text=/热 /").count();
      if (newScore > 0 && multiScore > 0 && hotScore > 0) {
        pass("多维度评分", "新鲜度、多样性、互动度都存在");
      } else {
        fail("多维度评分", `新:${newScore} 多:${multiScore} 热:${hotScore}`);
      }
    }

    // 测试展开理由功能
    {
      const reasonBtns = await page.locator("text=AI 聚类理由").all();
      if (reasonBtns.length > 0) {
        await reasonBtns[0].click();
        await page.waitForTimeout(300);
        const expanded = await page.locator('[class*="bg-[rgba"]').count();
        expanded > 0 ? pass("理由展开功能", "点击后显示理由内容") : fail("理由展开功能", "未显示内容");
      } else {
        fail("理由展开功能", "没有理由按钮可点击");
      }
    }

    // 测试全部展开按钮
    {
      const expandAllBtn = await page.locator("button").filter({ hasText: "全部展开" }).first();
      if (await expandAllBtn.count() > 0) {
        await expandAllBtn.click();
        await page.waitForTimeout(300);
        const collapsedBtn = await page.locator("button").filter({ hasText: "全部折叠" }).count();
        collapsedBtn > 0 ? pass("全部展开按钮", "点击后变为折叠状态") : fail("全部展开按钮", "状态未改变");
      } else {
        fail("全部展开按钮", "未找到");
      }
    }

    // 检查分页
    {
      const pagination = await page.locator("text=/页/").count();
      pagination > 0 ? pass("分页组件", "找到分页") : fail("分页组件", "未找到");
    }

    // 检查控制台错误
    {
      const critical = consoleErrors.filter((e) => !e.includes("Warning") && !e.includes("DevTools"));
      critical.length === 0 ? pass("无控制台错误", "没有关键错误") : fail("无控制台错误", `有 ${critical.length} 个错误`);
    }

    await context.close();
  } catch (error) {
    console.error("\n❌ 测试失败:", error);
    fail("测试执行", String(error));
  } finally {
    if (browser) await browser.close();
  }

  // 汇总
  console.log("\n" + "=".repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`📊 结果: 通过 ${passed} / ${results.length}, 失败 ${failed}`);
  if (failed > 0) {
    console.log("\n失败项:");
    results.filter((r) => !r.passed).forEach((r) => console.log(`  - ${r.name}: ${r.message}`));
  }
  console.log("=".repeat(60) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
