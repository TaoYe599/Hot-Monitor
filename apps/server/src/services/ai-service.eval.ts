/**
 * AI 相关性审核评估框架
 *
 * 用于评估 AI 判断的准确度、召回率和 F1 分数
 */

import type { MatchType } from "@hot-monitor/shared";

// ============================================================
// 类型定义
// ============================================================

export interface TestCase {
  id: string;
  query: string;
  title: string;
  content: string;
  /** 预期相关性判断 */
  expectedRelevance: boolean;
  /** 预期匹配类型（仅当 expectedRelevance=true 时有效） */
  expectedMatchType?: MatchType;
  /** 预期真实性判断（仅当 expectedRelevance=true 时有效） */
  expectedAuthenticity?: boolean;
  /** 用例描述 */
  description: string;
}

export interface CaseResult {
  case: TestCase;
  /** 预测的相关性 */
  predictedRelevance: boolean;
  /** 预测的匹配类型 */
  predictedMatchType?: MatchType;
  /** 预测的真实性 */
  predictedAuthenticity?: boolean;
  /** 相关性是否正确 */
  relevanceCorrect: boolean;
  /** 匹配类型是否正确 */
  matchTypeCorrect: boolean;
  /** 真实性是否正确 */
  authenticityCorrect: boolean;
  /** 整体是否正确 */
  overallCorrect: boolean;
  /** 错误原因 */
  errorReason?: string;
}

export interface EvaluationResult {
  totalCases: number;
  /** 相关性统计 */
  relevance: {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
    precision: number;
    recall: number;
    f1: number;
    accuracy: number;
  };
  /** 匹配类型统计（仅针对预期相关的内容） */
  matchType: {
    correct: number;
    total: number;
    accuracy: number;
  };
  /** 真实性统计（仅针对预期相关的内容） */
  authenticity: {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
    precision: number;
    recall: number;
    f1: number;
    accuracy: number;
  };
  caseResults: CaseResult[];
  timestamp: string;
}

// ============================================================
// 评估函数
// ============================================================

export interface AIRecommendation {
  isRelated: boolean;
  matchType?: MatchType;
  isAuthentic?: boolean;
}

/**
 * 评估单个测试用例
 */
export function evaluateCase(
  testCase: TestCase,
  recommendation: AIRecommendation,
): CaseResult {
  const relevanceCorrect = testCase.expectedRelevance === recommendation.isRelated;
  const matchTypeCorrect = !testCase.expectedRelevance ||
    !recommendation.isRelated ||
    testCase.expectedMatchType === recommendation.matchType;
  const authenticityCorrect = !testCase.expectedRelevance ||
    !recommendation.isRelated ||
    testCase.expectedAuthenticity === recommendation.isAuthentic;

  const overallCorrect = relevanceCorrect && matchTypeCorrect && authenticityCorrect;

  let errorReason: string | undefined;
  if (!overallCorrect) {
    const errors: string[] = [];
    if (!relevanceCorrect) {
      errors.push(
        `相关性: 预期=${testCase.expectedRelevance}, 预测=${recommendation.isRelated}`,
      );
    }
    if (!matchTypeCorrect && testCase.expectedRelevance && recommendation.isRelated) {
      errors.push(
        `匹配类型: 预期=${testCase.expectedMatchType}, 预测=${recommendation.matchType}`,
      );
    }
    if (!authenticityCorrect && testCase.expectedRelevance && recommendation.isRelated) {
      errors.push(
        `真实性: 预期=${testCase.expectedAuthenticity}, 预测=${recommendation.isAuthentic}`,
      );
    }
    errorReason = errors.join("; ");
  }

  return {
    case: testCase,
    predictedRelevance: recommendation.isRelated,
    predictedMatchType: recommendation.matchType,
    predictedAuthenticity: recommendation.isAuthentic,
    relevanceCorrect,
    matchTypeCorrect,
    authenticityCorrect,
    overallCorrect,
    errorReason,
  };
}

/**
 * 计算 TP/FP/TN/FN
 */
function calculateConfusionMatrix(
  caseResults: CaseResult[],
  isPositive: (c: CaseResult) => boolean,
  expectedPositive: (c: TestCase) => boolean,
): { tp: number; fp: number; tn: number; fn: number } {
  let tp = 0, fp = 0, tn = 0, fn = 0;

  for (const result of caseResults) {
    const predicted = isPositive(result);
    const expected = expectedPositive(result.case);

    if (predicted && expected) tp++;
    else if (predicted && !expected) fp++;
    else if (!predicted && expected) fn++;
    else tn++;
  }

  return { tp, fp, tn, fn };
}

/**
 * 计算精确率、召回率、F1
 */
function calculateMetrics(tp: number, fp: number, tn: number, fn: number): EvaluationResult["relevance"] {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const accuracy = tp + tn + fp + fn > 0 ? (tp + tn) / (tp + tn + fp + fn) : 0;

  return {
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    f1: Number(f1.toFixed(3)),
    accuracy: Number(accuracy.toFixed(3)),
  };
}

/**
 * 评估所有测试用例
 */
export function evaluateAll(
  caseResults: CaseResult[],
): EvaluationResult {
  // 相关性统计
  const relevanceMatrix = calculateConfusionMatrix(
    caseResults,
    (r) => r.predictedRelevance,
    (c) => c.expectedRelevance,
  );
  const relevanceMetrics = calculateMetrics(
    relevanceMatrix.tp,
    relevanceMatrix.fp,
    relevanceMatrix.tn,
    relevanceMatrix.fn,
  );

  // 匹配类型统计（仅针对预期相关的内容）
  const matchTypeResults = caseResults.filter((r) => r.case.expectedRelevance);
  const matchTypeCorrect = matchTypeResults.filter((r) => r.matchTypeCorrect).length;

  // 真实性统计（仅针对预期相关的内容）
  const authenticityResults = caseResults.filter((r) => r.case.expectedRelevance);
  const authenticityMatrix = calculateConfusionMatrix(
    authenticityResults,
    (r) => r.predictedAuthenticity ?? false,
    (c) => c.expectedAuthenticity ?? true,
  );
  const authenticityMetrics = calculateMetrics(
    authenticityMatrix.tp,
    authenticityMatrix.fp,
    authenticityMatrix.tn,
    authenticityMatrix.fn,
  );

  return {
    totalCases: caseResults.length,
    relevance: {
      ...relevanceMatrix,
      ...relevanceMetrics,
    },
    matchType: {
      correct: matchTypeCorrect,
      total: matchTypeResults.length,
      accuracy: matchTypeResults.length > 0
        ? Number((matchTypeCorrect / matchTypeResults.length).toFixed(3))
        : 0,
    },
    authenticity: {
      ...authenticityMatrix,
      ...authenticityMetrics,
    },
    caseResults,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// 报告输出
// ============================================================

/**
 * 格式化评估报告
 */
export function formatEvaluationReport(result: EvaluationResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("╔═══════════════════════════════════════════════════════════════╗");
  lines.push("║           AI 相关性审核评估报告                              ║");
  lines.push("╚═══════════════════════════════════════════════════════════════╝");
  lines.push("");
  lines.push(`测试时间: ${result.timestamp}`);
  lines.push(`总用例数: ${result.totalCases}`);
  lines.push("");
  lines.push("┌─────────────────────────────────────────────────────────────┐");
  lines.push("│  相关性判断指标                                            │");
  lines.push("├─────────────────────────────────────────────────────────────┤");
  lines.push(`│  精确率 (Precision):  ${(result.relevance.precision * 100).toFixed(1).padStart(6)}%`);
  lines.push(`│  召回率 (Recall):      ${(result.relevance.recall * 100).toFixed(1).padStart(6)}%`);
  lines.push(`│  F1 分数:             ${(result.relevance.f1 * 100).toFixed(1).padStart(6)}%`);
  lines.push(`│  准确率 (Accuracy):    ${(result.relevance.accuracy * 100).toFixed(1).padStart(6)}%`);
  lines.push("├─────────────────────────────────────────────────────────────┤");
  lines.push(`│  TP: ${result.relevance.truePositives.toString().padStart(3)}  FP: ${result.relevance.falsePositives.toString().padStart(3)}  TN: ${result.relevance.trueNegatives.toString().padStart(3)}  FN: ${result.relevance.falseNegatives.toString().padStart(3)}`);
  lines.push("└─────────────────────────────────────────────────────────────┘");
  lines.push("");

  if (result.matchType.total > 0) {
    lines.push("┌─────────────────────────────────────────────────────────────┐");
    lines.push("│  匹配类型判断指标                                          │");
    lines.push("├─────────────────────────────────────────────────────────────┤");
    lines.push(`│  准确率 (Accuracy):    ${(result.matchType.accuracy * 100).toFixed(1).padStart(6)}%`);
    lines.push(`│  正确数/总数:         ${result.matchType.correct.toString().padStart(3)}/${result.matchType.total.toString().padStart(3)}`);
    lines.push("└─────────────────────────────────────────────────────────────┘");
    lines.push("");
  }

  const authenticityResults = result.caseResults.filter((r) => r.case.expectedRelevance);
  if (authenticityResults.length > 0) {
    lines.push("┌─────────────────────────────────────────────────────────────┐");
    lines.push("│  真实性判断指标                                            │");
    lines.push("├─────────────────────────────────────────────────────────────┤");
    lines.push(`│  精确率 (Precision):  ${(result.authenticity.precision * 100).toFixed(1).padStart(6)}%`);
    lines.push(`│  召回率 (Recall):      ${(result.authenticity.recall * 100).toFixed(1).padStart(6)}%`);
    lines.push(`│  F1 分数:             ${(result.authenticity.f1 * 100).toFixed(1).padStart(6)}%`);
    lines.push(`│  准确率 (Accuracy):    ${(result.authenticity.accuracy * 100).toFixed(1).padStart(6)}%`);
    lines.push("├─────────────────────────────────────────────────────────────┤");
    lines.push(`│  TP: ${result.authenticity.truePositives.toString().padStart(3)}  FP: ${result.authenticity.falsePositives.toString().padStart(3)}  TN: ${result.authenticity.trueNegatives.toString().padStart(3)}  FN: ${result.authenticity.falseNegatives.toString().padStart(3)}`);
    lines.push("└─────────────────────────────────────────────────────────────┘");
    lines.push("");
  }

  const failedCases = result.caseResults.filter((r) => !r.overallCorrect);
  if (failedCases.length > 0) {
    lines.push("┌─────────────────────────────────────────────────────────────┐");
    lines.push("│  失败用例详情                                              │");
    lines.push("├─────────────────────────────────────────────────────────────┤");
    for (const fc of failedCases) {
      lines.push(`│  [${fc.case.id}] ${fc.case.description.slice(0, 40).padEnd(40)}│`);
      lines.push(`│    错误: ${fc.errorReason?.slice(0, 48).padEnd(48)}│`);
    }
    lines.push("└─────────────────────────────────────────────────────────────┘");
    lines.push("");
  }

  const correctCount = result.caseResults.filter((r) => r.overallCorrect).length;
  lines.push(`总体正确率: ${(correctCount / result.totalCases * 100).toFixed(1)}% (${correctCount}/${result.totalCases})`);
  lines.push("");

  return lines.join("\n");
}

/**
 * 打印评估报告到控制台
 */
export function printEvaluationReport(result: EvaluationResult): void {
  console.info(formatEvaluationReport(result));
}
