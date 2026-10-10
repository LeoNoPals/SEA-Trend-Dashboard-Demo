import type { YearMonth } from './sheet';
import type { Phase } from './theme';

/** 自然月列头（Jan.~Dec. 循环日历） */
export const MONTH_LABELS = [
  'Jan.',
  'Feb.',
  'Mar.',
  'Apr.',
  'May',
  'Jun.',
  'Jul.',
  'Aug.',
  'Sep.',
  'Oct.',
  'Nov.',
  'Dec.',
] as const;

export const MONTH_LABELS_CN = MONTH_LABELS;

export const MONTH_COUNT = 12;

/** 爆发期阈值 */
export const BURST_THRESHOLD = 120;
/** 常规水位 */
export const BASELINE = 100;

/**
 * 趋势品判定（页面所有「趋势品」口径的唯一入口）。
 *
 * 口径本身没有变，仍是「当月 TGI > 120（需求强度，取所选国家自己的 TGI）
 * 且当月日均 GMV 达到体量门槛（取 SEA 六国总和口径）」两条同时成立；
 * 变的只是**算在哪一层**：判定所需的 GMV 与门槛常量一律留在构建期
 * （`src/data/datasetBuild.ts` 的 `isTrendProductRaw`，只有 `scripts/build-history.mjs` 会 import），
 * 前端产物里只剩逐月的布尔结果 `trend[]`，因此 bundle 里既没有金额也没有门槛数字。
 *
 * ⚠️ 组件继续调用这个函数而不是直接读 `item.trend[m]`，是为了让「趋势品」的语义
 * 仍然只有一个出口：将来口径要变，改构建期实现 + 这里一处即可。
 */
export function isTrendProduct(
  item: { trend: boolean[] },
  monthIndex: number,
): boolean {
  return item.trend[monthIndex] === true;
}

export type CategoryTrend = {
  key: string;
  l1: string;
  l2: string;
  l3: string;
  leaf: string;
  /** 索引 0..11 = 1月..12月 */
  tgi: number[];
  phases: Phase[];
  /**
   * 规模指数（逐月，索引同上）：对该类目当月日均 GMV 取 log10 后，
   * 在**本市场全部类目 × 全部月份**范围内做 min-max 归一化得到的 0~1 无量纲值。
   * 归一化用的 min / max **不进产物**，因此无法从它反推任何金额。
   *
   * 用途只有两处，都只需要「相对大小」：
   * ① 热力图「Daily GMV 倒序」的排序键（与 GMV 单调同序，排序结果不变）；
   * ② 气泡图的气泡半径（半径本来就是先对 log10(GMV) 做一次 min-max 归一化再开方，
   *    而 min-max 归一化对单调仿射变换不变，所以半径与改造前逐个像素一致）。
   */
  scale: number[];
  /**
   * 价位段序号（逐月，索引同上）：AOV 落在 `PRICE_BANDS` 的第几档，-1 = 未知。
   * 构建期由 `priceBandIndex(aov)` 算好，前端只知道「落在 $5~10 这一档」，拿不到具体客单价。
   */
  band: number[];
  /** 逐月趋势品判定结果（构建期算好，见 isTrendProduct） */
  trend: boolean[];
  /**
   * 体量门槛（不选月份时的长尾剪枝）：窗口内**任一月**达到体量门槛即为 true。
   * 与 trend[] 同源、同样在构建期算好，前端不知道门槛值是多少。
   */
  volumeOk: boolean;
};

/**
 * 分国参考线专用的「宽松口径」类目序列：保留窗口内**任一有值月份**的 TGI，
 * 缺失月份为 null，不做「任一月缺即整条剔除」的清洗。
 *
 * 仅供 TGI 走势浮层里的 6 条分国参考线消费（「有几个月画几个月」）；
 * 绝不参与热力图、阶段判定、备货/爆发/清仓、峰值等核心口径——
 * 那些一律继续使用 `categories`（12 月齐全才算），避免小市场稀疏数据污染核心分析。
 */
export type PartialCategoryTrend = {
  key: string;
  /** 索引 0..11 = 1月..12月，缺失月为 null */
  tgi: (number | null)[];
  /** 窗口内有 TGI 值的月份数（0 = 该国完全没有此三级类目数据） */
  monthsWithData: number;
};

export type TrendDataset = {
  /** 真实分析窗口（按时间顺序的 12 个月） */
  window: YearMonth[];
  /** 自然月索引 → 窗口内对应的年月 */
  monthOfIndex: (YearMonth | null)[];
  categories: CategoryTrend[];
  /**
   * 全量类目的宽松序列（含被 categories 清洗剔除的稀疏类目），key → 逐月 TGI（可含 null）。
   * 只给浮层分国参考线用，不影响任何核心口径。
   */
  partials: Map<string, PartialCategoryTrend>;
  /** 参与统计的类目数 */
  totalCategories: number;
  /** 因缺值被剔除的类目数 */
  droppedCategories: number;
};

/**
 * 阶段判定（12 个月首尾闭环回绕）。
 * - TGI > 120 → 爆发期
 * - 爆发期起始月的 T-2 ~ T-1 → 备货期（跨年回推）
 * - 爆发期结束后第一个 TGI < 100 的月份 → 清仓期（沿循环日历向后找，最多绕一圈）
 * - 优先级：爆发期 > 备货期 > 清仓期，每月只保留一个标签
 * - 多段爆发期分别判定，合并后再按优先级去重
 */
export function computePhases(tgi: number[]): Phase[] {
  const n = MONTH_COUNT;
  const phases: Phase[] = new Array(n).fill('normal');
  const isBurst = tgi.map(v => Number.isFinite(v) && v > BURST_THRESHOLD);

  if (isBurst.every(v => v)) {
    return new Array(n).fill('burst');
  }
  if (isBurst.every(v => !v)) {
    return phases;
  }

  const runs: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < n; i += 1) {
    if (isBurst[i] && !isBurst[(i - 1 + n) % n]) {
      let length = 0;
      while (length < n && isBurst[(i + length) % n]) {
        length += 1;
      }
      runs.push({ start: i, end: (i + length - 1) % n });
    }
  }

  // ① 清仓期（优先级最低，先写）：爆发期结束后第一个 TGI<100 的月份
  for (const run of runs) {
    for (let k = 1; k <= n; k += 1) {
      const index = (run.end + k) % n;
      if (Number.isFinite(tgi[index]) && tgi[index] < BASELINE) {
        phases[index] = 'clear';
        break;
      }
    }
  }

  // ② 备货期覆盖清仓期
  for (const run of runs) {
    for (const back of [1, 2]) {
      phases[(run.start - back + n) % n] = 'stock';
    }
  }

  // ③ 爆发期优先级最高，最后覆盖
  for (let i = 0; i < n; i += 1) {
    if (isBurst[i]) {
      phases[i] = 'burst';
    }
  }

  return phases;
}

/** 某个阶段命中的自然月索引（按 1~12 月顺序） */
export function phaseMonthIndexes(phases: Phase[], phase: Phase): number[] {
  const list: number[] = [];
  phases.forEach((item, index) => {
    if (item === phase) {
      list.push(index);
    }
  });
  return list;
}

/**
 * 把逐月阶段合并成条带：只合并 1~12 月内连续的同阶段月份，
 * 跨年回绕（如 12 月与 1 月）自然拆成两段分别绘制。
 */
export function phaseSegments(
  phases: Phase[],
): Array<{ phase: Phase; start: number; end: number }> {
  const segments: Array<{ phase: Phase; start: number; end: number }> = [];
  phases.forEach((phase, index) => {
    if (phase === 'normal') {
      return;
    }
    const last = segments[segments.length - 1];
    if (last && last.phase === phase && last.end === index - 1) {
      last.end = index;
      return;
    }
    segments.push({ phase, start: index, end: index });
  });
  return segments;
}

/**
 * 类目主键：`(CBEC L3, 三级类目名)`。
 * 节日标签表（Category_Festival_Tag）的 `(cbec_l3, third_category_name)` 与它一一对应，
 * 跨数据层关联一律复用这个函数，禁止另造 key 规则。
 */
export function categoryKey(l3: string, leaf: string): string {
  return `${l3}\u0001${leaf}`;
}

/** 上一个自然月（跨年回绕取 12 月） */
export function prevMonthIndex(index: number): number {
  return (index - 1 + MONTH_COUNT) % MONTH_COUNT;
}

/** 环比：相对上一个自然月的 TGI 变化（百分比） */
export function tgiMoM(tgi: number[], index: number): number {
  const prev = tgi[prevMonthIndex(index)];
  if (!Number.isFinite(prev) || prev === 0) {
    return 0;
  }
  return ((tgi[index] - prev) / prev) * 100;
}

/** 价格区间（固定 10 档，顺序不变） */
export const PRICE_BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: '$0~2', min: 0, max: 2 },
  { label: '$2~5', min: 2, max: 5 },
  { label: '$5~10', min: 5, max: 10 },
  { label: '$10~20', min: 10, max: 20 },
  { label: '$20~30', min: 20, max: 30 },
  { label: '$30~50', min: 30, max: 50 },
  { label: '$50~75', min: 50, max: 75 },
  { label: '$75~100', min: 75, max: 100 },
  { label: '$100~200', min: 100, max: 200 },
  { label: '$>200', min: 200, max: Number.POSITIVE_INFINITY },
];
