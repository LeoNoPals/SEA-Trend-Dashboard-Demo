import { memo, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Customized,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyBlock, L1Legend, SectionCard } from '@/components/common';
import {
  type CategoryCnMap,
  EMPTY_CATEGORY_CN,
  categoryCnName,
} from '@/data/categoryCn';
import {
  BASELINE,
  BURST_THRESHOLD,
  type CategoryTrend,
  MONTH_LABELS,
  isTrendProduct,
  prevMonthIndex,
  tgiMoM,
} from '@/data/dataset';
import {
  formatPct,
  formatTgi,
  niceTicks,
  symlog,
  symlogInverse,
  truncate,
} from '@/data/format';
import { getChartTokens, getColors } from '@/data/theme';
import { useThemeMode } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const LABEL_FONT = 9.5;
/** 容器窄于该宽度时改用序号标注 + 图下对照表，避免文字互相压字 */
const COMPACT_WIDTH = 620;
/** 环比 symlog 的线性段阈值：|环比| ≤ 20% 内保持线性，超出后按对数压缩 */
const LINEAR_PCT = 20;

/**
 * 展示类目数量的可选区间与默认值。
 * 默认 30 而不是原来的 20：20 个气泡看不满一整行的矩阵、象限分布容易失真；
 * 上限卡在 50 是因为再多，常显类目标签就会大面积互相遮挡
 * （BubbleLabels 会自动隐藏放不下的标签，等于白给数据看不到名字）。
 */
const MIN_TOP_N = 10;
const MAX_TOP_N = 50;
const DEFAULT_TOP_N = 30;
/** 拖动粒度：每档 5 个。逐个数字调没人在意（29 和 30 个气泡看不出差别），
 *  5 的档位既够细，又让滑杆只有 9 档、拖起来能稳稳停在整数档上。 */
const TOP_N_STEP = 5;

/** 非法值（空、NaN、越界）一律夹到 10~50 并对齐到 5 的整数档 */
function clampTopN(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TOP_N;
  }
  const snapped = Math.round(value / TOP_N_STEP) * TOP_N_STEP;
  return Math.min(MAX_TOP_N, Math.max(MIN_TOP_N, snapped));
}

/**
 * 气泡数量控件：**一根可拖动的滑杆**（10~50，步长 5），左侧实时显示当前值。
 *
 * 上一版是「数字输入框 + 五个快捷档位按钮」，用户反馈太占地方也不直观：
 * 一排六个控件挤在图例前面，还得先想清楚要几个才去点。滑杆把「多 / 少」变成
 * 一个连续手势，拖到哪停哪、数字跟着变，原来的输入框与档位按钮已整体删除。
 *
 * 仍与 CBEC L1 图例同排、h-8 对齐，小屏由外层横向滑动而不换行。
 */
function TopNPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2">
      <span className="shrink-0 whitespace-nowrap text-[11px] text-fg-5">
        Bubble count
      </span>
      {/* 当前值用 tabular-nums 定宽：从 10 拖到 50 时数字位数变化不会把滑杆推着走 */}
      <span className="w-[22px] shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-fg-1">
        {value}
      </span>
      <input
        type="range"
        className="range-accent w-[132px] shrink-0 sm:w-[160px]"
        min={MIN_TOP_N}
        max={MAX_TOP_N}
        step={TOP_N_STEP}
        value={value}
        aria-label={`Bubble count (${MIN_TOP_N}~${MAX_TOP_N}, step ${TOP_N_STEP})`}
        title={`Adjust bubble count:${MIN_TOP_N}~${MAX_TOP_N}, step ${TOP_N_STEP} items`}
        onChange={event => onChange(clampTopN(Number(event.target.value)))}
      />
      <span className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-fg-5">
        {MIN_TOP_N}~{MAX_TOP_N}
      </span>
    </div>
  );
}

type Point = {
  key: string;
  name: string;
  full: string;
  /** 三级类目中文名（翻译表里查不到时为空串，tooltip 就只显示英文） */
  cn: string;
  /** 一级行业 CBEC L1，决定气泡颜色 */
  l1: string;
  color: string;
  rank: number;
  tgi: number;
  mom: number;
  /** 纵轴实际绘制位置（symlog 变换后） */
  ty: number;
  radius: number;
};

function BubbleTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Point }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) {
    return null;
  }
  return (
    <div className="rounded-md border border-line-5 bg-tooltip px-3 py-2 text-[11.5px] text-fg-2 shadow-card">
      <p className="mb-1 max-w-[240px] font-semibold text-fg">{point.full}</p>
      {point.cn ? (
        <p className="mb-1 max-w-[240px] text-fg-4">{point.cn}</p>
      ) : null}
      <p className="mb-1 inline-flex items-center gap-1.5 text-fg-4">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: point.color }}
        />
        {point.l1 || 'Uncategorized'}
      </p>
      <p>TGI {formatTgi(point.tgi)}</p>
      <p>MoM of TGI {formatPct(point.mom, 1, true)}</p>
      <p className="mt-1 text-[10.5px] text-fg-5">
        Click a bubble to view the 12-month TGI trend
      </p>
    </div>
  );
}

/** 估算标签像素宽度：中日韩字符按全宽算 */
function labelWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += /[\u3000-\u9fff\uff00-\uffef]/.test(char)
      ? LABEL_FONT
      : LABEL_FONT * 0.56;
  }
  return width;
}

type Rect = { x1: number; x2: number; y1: number; y2: number };
type Circle = { cx: number; cy: number; r: number };

function rectHit(a: Rect, b: Rect): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

function rectCircleHit(rect: Rect, circle: Circle): boolean {
  const nx = Math.max(rect.x1, Math.min(circle.cx, rect.x2));
  const ny = Math.max(rect.y1, Math.min(circle.cy, rect.y2));
  return Math.hypot(nx - circle.cx, ny - circle.cy) < circle.r + 1;
}

type AxisEntry = { scale?: (value: number) => number };

/**
 * 常驻类目标签层。recharts 的 LabelList 拿不到全局位置，无法做防重叠，
 * 这里用 Customized 取到坐标轴 scale，自己算像素位置：
 * 每个标签在 8 个方位 × 多圈半径里挑一个既不压别的标签、也不压任何气泡的位置。
 */
function BubbleLabels(props: {
  points?: Point[];
  compact?: boolean;
  /** 标签文字色（由外层按当前主题传入，Recharts 内不能用 CSS 变量） */
  labelColor?: string;
  xAxisMap?: Record<string, AxisEntry>;
  yAxisMap?: Record<string, AxisEntry>;
  offset?: { top?: number; left?: number; width?: number; height?: number };
}) {
  const {
    points = [],
    compact = false,
    labelColor = 'currentColor',
    xAxisMap,
    yAxisMap,
    offset,
  } = props;
  const xScale = xAxisMap ? Object.values(xAxisMap)[0]?.scale : undefined;
  const yScale = yAxisMap ? Object.values(yAxisMap)[0]?.scale : undefined;
  if (!xScale || !yScale || points.length === 0) {
    return null;
  }
  const left = offset?.left ?? 0;
  const top = offset?.top ?? 0;
  const width = offset?.width ?? 0;
  const height = offset?.height ?? 0;

  const nodes = points.map(point => ({
    point,
    px: xScale(point.tgi),
    py: yScale(point.ty),
  }));
  const circles: Circle[] = nodes.map(node => ({
    cx: node.px,
    cy: node.py,
    r: node.point.radius,
  }));

  const placed: Rect[] = [];
  /** 大气泡先放，小气泡再让位 */
  const ordered = [...nodes].sort((a, b) => b.point.radius - a.point.radius);

  const rendered = ordered.map(node => {
    const text = compact ? String(node.point.rank) : node.point.name;
    const w = compact ? labelWidth(text) + 2 : labelWidth(text);
    const h = LABEL_FONT;
    const r = node.point.radius;

    const candidates: Array<{ dx: number; dy: number }> = [];
    for (let ring = 0; ring < 6; ring += 1) {
      const gap = 5 + ring * 10;
      const diag = (r + gap) * 0.72;
      candidates.push(
        { dx: 0, dy: -(r + gap) },
        { dx: 0, dy: r + gap + h * 0.85 },
        { dx: r + gap + w / 2, dy: h * 0.34 },
        { dx: -(r + gap + w / 2), dy: h * 0.34 },
        { dx: diag + w / 2, dy: -diag },
        { dx: -(diag + w / 2), dy: -diag },
        { dx: diag + w / 2, dy: diag + h * 0.6 },
        { dx: -(diag + w / 2), dy: diag + h * 0.6 },
      );
    }

    let best: { cx: number; ly: number; box: Rect } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const cx = Math.min(
        Math.max(node.px + candidate.dx, left + w / 2 + 2),
        left + width - w / 2 - 2,
      );
      const ly = node.py + candidate.dy;
      if (ly - h < top + 1 || ly > top + height - 1) {
        continue;
      }
      const box: Rect = {
        x1: cx - w / 2 - 2,
        x2: cx + w / 2 + 2,
        y1: ly - h,
        y2: ly + 2,
      };
      let score = 0;
      for (const other of placed) {
        if (rectHit(box, other)) {
          score += 120;
        }
      }
      for (const circle of circles) {
        if (rectCircleHit(box, circle)) {
          score += 70;
        }
      }
      score += Math.hypot(cx - node.px, ly - node.py) * 0.35;
      if (score < bestScore) {
        bestScore = score;
        best = { cx, ly, box };
      }
      if (score < 1) {
        break;
      }
    }

    if (!best) {
      return null;
    }
    placed.push(best.box);
    return {
      key: node.point.key,
      text,
      cx: best.cx,
      ly: best.ly,
      clean: bestScore < 70,
    };
  });

  return (
    <g>
      {rendered.map(node =>
        node?.clean ? (
          <text
            key={node.key}
            x={node.cx}
            y={node.ly}
            textAnchor="middle"
            fill={labelColor}
            fontSize={LABEL_FONT}
          >
            {node.text}
          </text>
        ) : null,
      )}
    </g>
  );
}

function BubbleModuleImpl({
  categories,
  l1Colors,
  monthIndex,
  monthLabel,
  categoryCn = EMPTY_CATEGORY_CN,
  onOpenTrend,
  extra,
  sourceIds,
  fallback,
}: {
  categories: CategoryTrend[];
  /** CBEC L1 → 颜色（由 page 统一算一次，三个模块共用同一份映射） */
  l1Colors: Record<string, string>;
  /** 三级类目英文名 → 中文名（仅 hover 提示用，读不到时为空映射） */
  categoryCn?: CategoryCnMap;
  monthIndex: number;
  monthLabel: string;
  /**
   * 点击气泡时唤起该三级类目的 TGI 走势浮层（与热力图「查看TGI」同一个入口）。
   * 气泡点里只带绘图要用的字段，所以这里按 `point.key` 回表拿完整行对象再往上抛，
   * state 仍然由 page.tsx 统一持有 —— 浮层只有一个实例，两个模块共用。
   */
  onOpenTrend?: (category: CategoryTrend) => void;
  extra?: React.ReactNode;
  sourceIds: string;
  fallback?: React.ReactNode;
}) {
  const mode = useThemeMode();
  const colors = getColors(mode);
  const chart = getChartTokens(mode);
  const [hovered, setHovered] = useState<string | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  /** 图例筛选：空数组 = 不筛选（全选），避免用户把自己点成空图 */
  const [picked, setPicked] = useState<string[]>([]);
  /** 展示的类目数量（默认 30，可在 10~50 之间选或输入） */
  const [topN, setTopN] = useState(DEFAULT_TOP_N);

  useEffect(() => {
    if (!boxEl) {
      return;
    }
    setBoxWidth(boxEl.clientWidth);
    const observer = new ResizeObserver(entries => {
      setBoxWidth(entries[0].contentRect.width);
    });
    observer.observe(boxEl);
    return () => observer.disconnect();
  }, [boxEl]);

  const compact = boxWidth > 0 && boxWidth < COMPACT_WIDTH;

  /**
   * 候选池 = 当月所有趋势品（TGI>120 且达到体量门槛，口径见 isTrendProduct），截断到 Top N 之前。
   * 图例必须基于这个池子，而不是榜内出现的 L1——否则筛到只剩一个 L1 后
   * 图例会跟着塌缩成一项，用户再也切不回其它行业。
   */
  const pool = useMemo(() => {
    const counter = new Map<string, number>();
    for (const item of categories) {
      if (!isTrendProduct(item, monthIndex)) {
        continue;
      }
      const name = item.l1 || 'Uncategorized';
      counter.set(name, (counter.get(name) ?? 0) + 1);
    }
    return [...counter.entries()]
      .map(([name, count]) => ({
        name,
        count,
        color: l1Colors[name] ?? colors.primary,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  }, [categories, monthIndex, l1Colors]);

  /** 生效的筛选集合：与候选池求交（换月后失效的选项自动忽略），空 = 全选 */
  const activeL1 = useMemo(() => {
    const names = new Set(pool.map(item => item.name));
    return picked.filter(name => names.has(name));
  }, [picked, pool]);

  const filtered = activeL1.length > 0 && activeL1.length < pool.length;

  const toggleL1 = (name: string) => {
    setPicked(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name],
    );
  };

  /** 当前筛选范围内的趋势品总数（截断到 Top N 之前） */
  const scopeCount = useMemo(
    () =>
      activeL1.length === 0
        ? pool.reduce((sum, item) => sum + item.count, 0)
        : pool
            .filter(item => activeL1.includes(item.name))
            .reduce((sum, item) => sum + item.count, 0),
    [pool, activeL1],
  );

  const points = useMemo<Point[]>(() => {
    const top = [...categories]
      .filter(
        item => activeL1.length === 0 || activeL1.includes(item.l1 || 'Uncategorized'),
      )
      .filter(item => isTrendProduct(item, monthIndex))
      .sort((a, b) => b.tgi[monthIndex] - a.tgi[monthIndex])
      .slice(0, topN);
    /*
      气泡大小 = 体量。取的是构建期算好的**规模指数** `scale`
      （该市场 `log10(日均 GMV)` 在全部类目 × 全部月份上 min-max 归一化到 0~1），
      它是原来 `Math.log10(Math.max(10, gmv))` 的单调仿射变换，而这里又要在
      「当前可见的 Top N」内部再做一次 min-max，仿射变换对 min-max 归一化不变 ——
      所以气泡半径与改造前逐个像素一致（最小 7px、最大 22px），
      但前端拿不到任何金额，也反推不出量级（归一化用的 min/max 只留在构建期）。
    */
    const logs = top.map(item => item.scale[monthIndex]);
    const logMin = Math.min(...logs);
    const logMax = Math.max(...logs);
    return top.map((item, index) => {
      const norm =
        logMax > logMin ? (logs[index] - logMin) / (logMax - logMin) : 0.5;
      const mom = Number(tgiMoM(item.tgi, monthIndex).toFixed(1));
      return {
        key: item.key,
        name: truncate(item.leaf, 18),
        full: `${item.l3} / ${item.leaf}`,
        cn: categoryCnName(categoryCn, item.l1, item.leaf),
        l1: item.l1,
        color: l1Colors[item.l1] ?? colors.primary,
        rank: index + 1,
        tgi: Number(item.tgi[monthIndex].toFixed(1)),
        mom,
        ty: symlog(mom, LINEAR_PCT),
        radius: 7 + 15 * Math.sqrt(norm),
      };
    });
  }, [categories, monthIndex, l1Colors, activeL1, categoryCn, topN]);

  const axes = useMemo(() => {
    if (points.length === 0) {
      return {
        xDomain: [80, 200] as [number, number],
        xTicks: [80, 120, 160, 200],
        yDomain: [-1, 1] as [number, number],
        yTicks: [-1, 0, 1],
      };
    }
    const xs = points.map(point => point.tgi);
    const xMin = Math.min(...xs, BASELINE);
    const xMax = Math.max(...xs, BURST_THRESHOLD);
    const xPad = Math.max(10, (xMax - xMin) * 0.1);
    const xDomain: [number, number] = [
      Math.max(0, Math.floor((xMin - xPad) / 10) * 10),
      Math.ceil((xMax + xPad) / 10) * 10,
    ];

    const ys = points.map(point => point.ty);
    const yMin = Math.min(...ys, 0);
    const yMax = Math.max(...ys, 0);
    const yPad = Math.max(0.25, (yMax - yMin) * 0.12);
    const yDomain: [number, number] = [yMin - yPad, yMax + yPad];
    const anchors = [
      -30000, -10000, -3000, -1000, -300, -100, -30, -10, 0, 10, 30, 100, 300,
      1000, 3000, 10000, 30000,
    ];
    const yTicks = anchors
      .map(value => symlog(value, LINEAR_PCT))
      .filter(value => value >= yDomain[0] && value <= yDomain[1]);
    return {
      xDomain,
      xTicks: niceTicks(xDomain[0], xDomain[1], 6),
      yDomain,
      yTicks,
    };
  }, [points]);

  const rising = points.filter(point => point.mom > 0).length;
  /** 结论句与口径说明都跟着图例筛选走（范围、数量都会变） */
  const scopeText = filtered
    ? `${activeL1.length} L1 groups (${activeL1.slice(0, 3).join('、')}${activeL1.length > 3 ? '…' : ''}）`
    : 'All L1 groups';
  const title =
    points.length > 0
      ? `${monthLabel}${filtered ? ` · ${scopeText}` : ''} TGI Top${points.length}: ${rising} categories growing month over month (vs. ${MONTH_LABELS[prevMonthIndex(monthIndex)]}）`
      : 'Category TGI × monthly growth × scale';

  return (
    <SectionCard
      tag="Trend Opportunity Matrix"
      title={title}
      sourceIds={sourceIds}
      extra={extra}
    >
      {fallback ??
        (points.length === 0 ? (
          <EmptyBlock label="No categories match these filters" height={780} />
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            {/*
              工具栏一排：展示数量控件 + CBEC L1 图例。两者刻意同排，
              小屏由这一排自己横向滑动（overflow-x-auto）而不换行，
              与模块二 / 六 / 七的筛选条规矩一致。
            */}
            <div className="mb-1 flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5">
              <TopNPicker value={topN} onChange={setTopN} />
              <span className="h-4 w-px shrink-0 bg-line-4" />
              <L1Legend
                className="mb-0 min-w-0"
                items={pool}
                active={activeL1}
                onToggle={toggleL1}
                onReset={() => setPicked([])}
              />
            </div>
            <div
              ref={setBoxEl}
              className="relative min-h-[690px] w-full min-w-0 flex-1"
            >
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 18, right: 30, bottom: 26, left: 4 }}
                  >
                    <CartesianGrid
                      stroke={colors.grid}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      type="number"
                      dataKey="tgi"
                      domain={axes.xDomain}
                      ticks={axes.xTicks}
                      allowDataOverflow={false}
                      tick={{ fill: colors.axis, fontSize: 11 }}
                      tickLine={{ stroke: chart.guide }}
                      axisLine={{ stroke: chart.axisLine }}
                      label={{
                        value: 'TGI',
                        position: 'insideBottom',
                        offset: -14,
                        fill: chart.axisLabel,
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="ty"
                      domain={axes.yDomain}
                      ticks={axes.yTicks}
                      tick={{ fill: colors.axis, fontSize: 11 }}
                      tickLine={{ stroke: chart.guide }}
                      axisLine={false}
                      width={64}
                      tickFormatter={(value: number) =>
                        formatPct(
                          Math.round(symlogInverse(value, LINEAR_PCT)),
                          0,
                          true,
                        )
                      }
                    />
                    <ReferenceLine
                      y={0}
                      stroke={colors.accentDeep}
                      strokeDasharray="2 4"
                    />
                    <ReferenceLine
                      x={BASELINE}
                      stroke={colors.accent}
                      strokeOpacity={0.75}
                      strokeDasharray="2 4"
                    />
                    <ReferenceLine
                      x={BURST_THRESHOLD}
                      stroke={colors.primary}
                      strokeDasharray="5 3"
                      label={
                        compact
                          ? undefined
                          : {
                              value: 'Peak threshold TGI=120',
                              position: 'insideTopRight',
                              fill: chart.burstLabel,
                              fontSize: 10.5,
                            }
                      }
                    />
                    <Tooltip
                      content={<BubbleTooltip />}
                      cursor={{ stroke: chart.cursorStroke }}
                    />
                    <Scatter
                      data={points}
                      isAnimationActive={false}
                      onMouseEnter={(next: unknown) => {
                        const point = next as Point | undefined;
                        setHovered(point?.key ?? null);
                      }}
                      onMouseLeave={() => setHovered(null)}
                      onClick={(next: unknown) => {
                        const point = next as Point | undefined;
                        if (!point?.key || !onOpenTrend) {
                          return;
                        }
                        const row = categories.find(
                          item => item.key === point.key,
                        );
                        if (row) {
                          onOpenTrend(row);
                        }
                      }}
                      shape={(props: {
                        cx?: number;
                        cy?: number;
                        payload?: Point;
                      }) => {
                        const { cx = 0, cy = 0, payload } = props;
                        const radius = payload?.radius ?? 8;
                        const isHovered = payload?.key === hovered;
                        const color = payload?.color ?? colors.primary;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            /* 可点开走势时给 pointer 光标 —— 气泡本身没有别的"可点"暗示 */
                            style={
                              onOpenTrend ? { cursor: 'pointer' } : undefined
                            }
                            r={isHovered ? radius * 1.18 : radius}
                            fill={color}
                            fillOpacity={isHovered ? 0.95 : 0.78}
                            stroke={isHovered ? chart.hoverStroke : color}
                            strokeOpacity={isHovered ? 1 : 0.95}
                            strokeWidth={isHovered ? 1.4 : 1}
                          />
                        );
                      }}
                    />
                    <Customized
                      component={(chartProps: Record<string, unknown>) => (
                        <BubbleLabels
                          {...(chartProps as {
                            xAxisMap?: Record<string, AxisEntry>;
                            yAxisMap?: Record<string, AxisEntry>;
                            offset?: {
                              top?: number;
                              left?: number;
                              width?: number;
                              height?: number;
                            };
                          })}
                          points={points}
                          compact={compact}
                          labelColor={colors.muted}
                        />
                      )}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {compact ? (
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px] leading-tight text-fg-4">
                {points.map(point => (
                  <p
                    key={point.key}
                    className="flex min-w-0 items-center gap-1.5"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: point.color }}
                    />
                    <span className="shrink-0 text-fg-5">{point.rank}</span>
                    <span className="truncate" title={point.full}>
                      {point.name}
                    </span>
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ))}
    </SectionCard>
  );
}

/**
 * 用 memo 包裹：气泡图的防重叠标签布局是每次 render 都会跑的重算法，
 * 在浮层开关 / 单元格选中等无关状态变化时不应重跑，props 稳定即跳过。
 */
export const BubbleModule = memo(BubbleModuleImpl);
