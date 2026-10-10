import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Customized,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CountryFlag } from '@/components/CountryFlag';
import { Chip, CloseIconButton } from '@/components/common';
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
  MONTH_LABELS_CN,
  phaseMonthIndexes,
  phaseSegments,
} from '@/data/dataset';
import { formatTgi } from '@/data/format';
import {
  COUNTRY_CODES,
  COUNTRY_NAMES,
  type CountryCode,
  MARKET_CODES,
  type MarketCode,
} from '@/data/market';
import {
  PHASE_RULE,
  type Phase,
  getChartTokens,
  getColors,
  getPhaseMeta,
  getSeriesColors,
} from '@/data/theme';
import type { MarketAvailability, TrendState } from '@/hooks/useDashboardData';
import { useThemeMode } from '@/hooks/useTheme';
import { useModalDialog } from '@/hooks/useModalDialog';
import { DEMO_NOTICE } from '@/data/demo/history';

/** 条带内标注：像素宽度不足时降级为单字，再窄就不标 */
const BAND_FULL_LABEL_PX = 46;
const BAND_SHORT_LABEL_PX = 18;
/** 容器窄于该宽度时 X 轴只显示月份数字，避免 12 个标签互相压字 */
const COMPACT_WIDTH = 560;

const CHART_MARGIN = { top: 18, right: 30, bottom: 12, left: 4 };
const Y_AXIS_WIDTH = 46;

/**
 * 分国参考线的**最小连续月数**：只绘制长度 ≥ 该值的连续月份区间，
 * 不足的碎片段整段不画、按"数据缺失"处理。
 *
 * 为什么取 3：
 * - 1 个月：单点连不成线，本身就没有"走势"可言；
 * - 2 个月：只能画出一条直线段，斜率完全由两个孤立月份决定，在 12 个月的
 *   坐标系里就是一小截陡峭短线，既读不出趋势又容易被误当成异常波动
 *   （用户截图里被吐槽的正是 Sep→Oct 这种 2 个月的段）；
 * - 3 个月：至少有两段斜率、能看出"上行/下行/转折"，是"走势"成立的最小长度。
 * 这个阈值**只决定画不画**，不改任何数据口径：热力图 / 阶段判定 / 峰值仍用
 * `categories` 的"12 月齐全"严口径，这里过滤的只是浮层里的分国参考线。
 */
const MIN_RUN_MONTHS = 3;

/** 分国线的线宽：单层纯品牌原色，深浅两套主题同一个值 */
const LINE_WIDTH = 1.8;

/**
 * 曲线「从左到右延伸」的入场动画时长（毫秒）。
 * 只在**打开浮层 / 切换类目**这两种「加载」时机播放一次；
 * 播完立刻把 isAnimationActive 关掉，之后点图例增删曲线都不再重播
 * （用户明确要求：筛选选中时不呈现动画）。
 */
const DRAW_DURATION = 900;

/**
 * 把长度不足 `minRun` 的连续有值片段整段置为 null（= 数据缺失，不绘制）。
 * 入参是 12 个自然月的序列，缺失月已经是 null。
 */
function maskShortRuns(
  values: Array<number | null>,
  minRun: number,
): Array<number | null> {
  const out = [...values];
  let start = 0;
  while (start < out.length) {
    if (out[start] === null) {
      start += 1;
      continue;
    }
    let end = start;
    while (end < out.length && out[end] !== null) {
      end += 1;
    }
    if (end - start < minRun) {
      for (let i = start; i < end; i += 1) {
        out[i] = null;
      }
    }
    start = end;
  }
  return out;
}

type Row = Record<string, number | string | null>;

function TrendTooltip({
  active,
  payload,
  label,
  phases,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    value?: number;
    color?: string;
  }>;
  label?: string | number;
  phases?: Phase[];
}) {
  const mode = useThemeMode();
  if (!active || !payload?.length) {
    return null;
  }
  const index = typeof label === 'number' ? label : Number(label);
  const phase = phases?.[index];
  const meta = phase ? getPhaseMeta(mode)[phase] : null;
  // 分国线在缺失月份为 null，过滤掉这些点，避免 tooltip 里列出「—」的假条目。
  const items = payload.filter(
    item => typeof item.value === 'number' && Number.isFinite(item.value),
  );
  if (!items.length) {
    return null;
  }
  return (
    <div className="rounded-md border border-line-5 bg-tooltip px-3 py-2 text-[11.5px] text-fg-2 shadow-card">
      <p className="mb-1 flex items-center gap-2 font-semibold text-fg">
        {MONTH_LABELS[index] ?? label}
        {meta && phase !== 'normal' ? (
          <span
            className="rounded px-1.5 py-px text-[10.5px] font-medium"
            style={{ backgroundColor: meta.band, color: meta.text }}
          >
            {meta.label}
          </span>
        ) : null}
      </p>
      {items.map(item => (
        <p
          key={String(item.dataKey)}
          className="flex items-center justify-between gap-3"
        >
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-1.5 w-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            {String(item.dataKey)}
          </span>
          <span className="tabular-nums">{formatTgi(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** 阶段摘要卡：月份列表从数据现算 */
function PhaseSummaryCard({
  phase,
  months,
}: {
  phase: Phase;
  months: number[];
}) {
  const meta = getPhaseMeta(useThemeMode())[phase];
  return (
    <div
      className="min-w-0 flex-1 basis-[128px] rounded-lg border px-2.5 py-2"
      style={{
        borderColor: `${meta.text}55`,
        backgroundColor: meta.band,
      }}
      title={PHASE_RULE[phase]}
    >
      <p className="text-[11px]" style={{ color: meta.text }}>
        {meta.label}
      </p>
      <p className="mt-0.5 text-[12.5px] font-semibold leading-snug text-fg">
        {months.length > 0
          ? months.map(index => MONTH_LABELS_CN[index]).join('、')
          : '—'}
      </p>
    </div>
  );
}

/** 估算文字像素宽度：中日韩字符按全宽算，用于给标注垫一层底色 */
function textWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) {
    width += /[\u3000-\u9fff\uff00-\uffef]/.test(char)
      ? fontSize
      : fontSize * 0.58;
  }
  return width;
}

/** 标注统一垫一层与卡片同色的底，避免曲线穿过文字影响阅读 */
function PlateText({
  x,
  y,
  text,
  color,
  anchor,
  fontSize = 10,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  anchor: 'start' | 'middle' | 'end';
  fontSize?: number;
}) {
  /* 垫底色必须与卡片底同色：深色底是 #0D0D0D、浅色底是白色，浅底再实一点才压得住曲线 */
  const chart = getChartTokens(useThemeMode());
  const w = textWidth(text, fontSize) + 6;
  const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return (
    <g>
      <rect
        x={left}
        y={y - fontSize}
        width={w}
        height={fontSize + 5}
        rx={2}
        fill={chart.plate}
        fillOpacity={chart.plateOpacity}
      />
      <text
        x={anchor === 'end' ? x - 3 : anchor === 'middle' ? x : x + 3}
        y={y}
        textAnchor={anchor}
        fill={color}
        fontSize={fontSize}
      >
        {text}
      </text>
    </g>
  );
}

type AxisEntry = { scale?: (value: number) => number };

/**
 * 标注层：阶段名与两条参考线的标注必须画在曲线之上，否则曲线会从文字中间穿过。
 * recharts 按 children 顺序绘制，所以这一层放在所有 Line 之后，用轴 scale 自己定位。
 */
function AnnotationLayer(props: {
  segments: Array<{ phase: Phase; start: number; end: number }>;
  perMonthPx: number;
  xAxisMap?: Record<string, AxisEntry>;
  yAxisMap?: Record<string, AxisEntry>;
  offset?: { top?: number; left?: number; width?: number; height?: number };
}) {
  const mode = useThemeMode();
  const colors = getColors(mode);
  const chart = getChartTokens(mode);
  const phaseMeta = getPhaseMeta(mode);
  const { segments, perMonthPx, xAxisMap, yAxisMap, offset } = props;
  const xScale = xAxisMap ? Object.values(xAxisMap)[0]?.scale : undefined;
  const yScale = yAxisMap ? Object.values(yAxisMap)[0]?.scale : undefined;
  if (!xScale || !yScale) {
    return null;
  }
  const top = offset?.top ?? 0;
  const right = (offset?.left ?? 0) + (offset?.width ?? 0) - 2;

  return (
    <g>
      {segments.map(segment => {
        const meta = phaseMeta[segment.phase];
        const span = segment.end - segment.start + 1;
        const widthPx = perMonthPx * span;
        const text =
          widthPx >= BAND_FULL_LABEL_PX
            ? meta.label
            : widthPx >= BAND_SHORT_LABEL_PX
              ? meta.short
              : '';
        if (!text) {
          return null;
        }
        const x1 = xScale(segment.start - 0.5);
        const x2 = xScale(segment.end + 0.5);
        return (
          <PlateText
            key={`${segment.phase}-${segment.start}`}
            x={(x1 + x2) / 2}
            y={top + 12}
            text={text}
            color={meta.text}
            anchor="middle"
            fontSize={10.5}
          />
        );
      })}
      <PlateText
        x={right}
        y={yScale(BURST_THRESHOLD) - 5}
        text={`Peak threshold (${BURST_THRESHOLD})`}
        color={chart.burstLabel}
        anchor="end"
      />
      <PlateText
        x={right}
        y={yScale(BASELINE) + 13}
        text={`Baseline (${BASELINE})`}
        color={colors.muted}
        anchor="end"
      />
    </g>
  );
}

export function TrendOverlay({
  open,
  category,
  categoryCn = EMPTY_CATEGORY_CN,
  focusCategory,
  country,
  marketTrends,
  availability,
  onClose,
}: {
  open: boolean;
  /** TTL 曲线与标题口径：始终为 SEA 六国总和 */
  category: CategoryTrend | null;
  /** 三级类目英文名 → 中文名，用于标题里的中文对照（查不到就只显示英文） */
  categoryCn?: CategoryCnMap;
  /**
   * 阶段口径：全局选中国家的同类目序列（选 SEA 时即 SEA 自身）。
   * 各国的备货 / 爆发 / 清仓期时间并不一致，背景条带、阶段摘要卡与运营建议
   * 一律以当前所选国家为准，其余国家的曲线只作横向参考。
   */
  focusCategory: CategoryTrend | null;
  country: CountryCode;
  marketTrends: Record<MarketCode, TrendState>;
  availability: MarketAvailability;
  onClose: () => void;
}) {
  const mode = useThemeMode();
  const colors = getColors(mode);
  const chart = getChartTokens(mode);
  const phaseMeta = getPhaseMeta(mode);
  const series = getSeriesColors(mode);
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const dialogRef = useModalDialog(open && category !== null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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

  const availableMarkets = useMemo(
    () =>
      MARKET_CODES.filter(market => {
        const state = marketTrends[market];
        return availability[market] && state.dataset !== null;
      }),
    [availability, marketTrends],
  );

  /**
   * 分国参考线「最终绘制序列」（本轮改动的核心）。
   *
   * 背景：分国底表（尤其 SG/新加坡）是小市场，很多三级类目在窗口内只有零星几个月有 GMV，
   * 上游 `buildTrendDataset` 的核心口径 `categories` 会把「任一月缺」的类目整条剔除，
   * 于是这些国家在浮层里大面积缺线。经离线核对确认这是**底表本身稀疏**（行就不存在），
   * 不是读取/解析漏读。因此对**分国参考线**取宽松口径 `dataset.partials`（保留有值月份）。
   *
   * 上一轮"有几个月画几个月"会产出难看的碎片：只跨 1~2 个月的孤立陡峭短线段、
   * 以及孤立单月的小圆点。本轮改为：
   *   **只画长度 ≥ MIN_RUN_MONTHS(3) 个自然月的连续区间，不足的片段整段按数据缺失处理**
   *   （孤立单月的小圆点也一并去掉）。
   * 于是这里先把 partials 序列跑一遍 `maskShortRuns`，后续的画线、缺失国家清单、
   * 说明文案统统以这份"已过滤序列"为唯一事实来源，展示与说明不会打架。
   *
   * SEA(TTL) 主线、热力图、阶段判定、峰值等核心口径不受影响——它们继续用 `categories`。
   */
  const drawnByMarket = useMemo(() => {
    const map = new Map<MarketCode, Array<number | null>>();
    if (!category) {
      return map;
    }
    for (const market of availableMarkets) {
      const partial = marketTrends[market].dataset?.partials.get(category.key);
      const raw = MONTH_LABELS.map((_, index) => {
        const value = partial?.tgi[index];
        return value !== null && value !== undefined
          ? Number(value.toFixed(1))
          : null;
      });
      map.set(market, maskShortRuns(raw, MIN_RUN_MONTHS));
    }
    return map;
  }, [category, availableMarkets, marketTrends]);

  /** 每个国家过滤后实际会画出的月份数（0 = 一段都画不出） */
  const drawnCountByMarket = useMemo(() => {
    const map = {} as Record<string, number>;
    for (const [market, values] of drawnByMarket) {
      map[market] = values.filter(value => value !== null).length;
    }
    return map;
  }, [drawnByMarket]);

  /**
   * 「数据缺失 / 未绘制」的国家：过滤后一个月都画不出来
   * （压根没有该类目、或只有 1~2 个月的碎片段被整段丢弃）。
   * 表现沿用既有的 `hiddenMarkets` 那套：图例 chip 置灰 + 标注 + 计入浮层底部清单。
   */
  const hiddenMarkets = useMemo(() => {
    if (!category) {
      return [] as MarketCode[];
    }
    return availableMarkets.filter(
      market => (drawnCountByMarket[market] ?? 0) === 0,
    );
  }, [category, availableMarkets, drawnCountByMarket]);

  const hiddenSet = useMemo(
    () => new Set<string>(hiddenMarkets),
    [hiddenMarkets],
  );

  /**
   * 曲线可见性：SEA 代表 TTL 总和线，其余为分国线，支持多选。
   * 打开浮层 / 切换全局国家时重置为「TTL + 所有已接入分国」，先看全，再自行收敛。
   */
  const [visible, setVisible] = useState<Set<CountryCode>>(new Set(['SEA']));
  useEffect(() => {
    if (!open) {
      return;
    }
    setVisible(new Set<CountryCode>(['SEA', ...availableMarkets]));
  }, [open, country, availableMarkets]);

  /**
   * 入场动画开关：浮层打开、或在浮层里换了另一个三级类目时，
   * 让所有曲线重新「从左到右延伸」画一遍；DRAW_DURATION 之后关掉，
   * 于是后续点图例增删曲线（筛选）只是直接出现 / 消失，不再有动画。
   */
  const [drawing, setDrawing] = useState(false);
  useEffect(() => {
    if (!open || !category) {
      setDrawing(false);
      return;
    }
    setDrawing(true);
    const timer = window.setTimeout(
      () => setDrawing(false),
      DRAW_DURATION + 80,
    );
    return () => window.clearTimeout(timer);
  }, [open, category]);

  const toggleSeries = (code: CountryCode) => {
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        /** 至少留一条线，全关掉图就空了 */
        const drawable = [...next].filter(item => item === 'SEA' || !hiddenSet.has(item));
        if (drawable.length === 1) {
          return prev;
        }
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  /** 实际参与绘制的分国线：可见、且过滤后至少还剩一段连续 ≥3 个月的区间 */
  const shownMarkets = useMemo(
    () =>
      availableMarkets.filter(
        market => visible.has(market) && !hiddenSet.has(market),
      ),
    [availableMarkets, visible, hiddenSet],
  );

  const rows = useMemo<Row[]>(() => {
    if (!category) {
      return [];
    }
    return MONTH_LABELS.map((_, index) => {
      const row: Row = {
        mi: index,
        TTL: Number(category.tgi[index].toFixed(1)),
      };
      for (const market of availableMarkets) {
        // 分国线取「已按最小连续月数过滤」的序列：被丢弃的碎片段与缺失月一样是 null，
        // 配合 connectNulls=false，短段既不连线也不描点，视觉上就是「这几个月没有数据」。
        row[market] = drawnByMarket.get(market)?.[index] ?? null;
      }
      return row;
    });
  }, [category, availableMarkets, drawnByMarket]);

  /**
   * 有数据但月份不全（过滤后 1~11 个月会被画出）的分国：用于浮层内的实事求是说明。
   * 注意统计的是**过滤后**的月份数，所以文案与图上真正画出来的东西一致。
   */
  const partialMarkets = useMemo(() => {
    if (!category) {
      return [] as MarketCode[];
    }
    return shownMarkets.filter(market => {
      const count = drawnCountByMarket[market] ?? 0;
      return count > 0 && count < MONTH_LABELS.length;
    });
  }, [category, shownMarkets, drawnCountByMarket]);

  /** 阶段与峰值一律看当前所选国家；该国数据未接入时回落 SEA */
  const focus = focusCategory ?? category;

  const peak = useMemo(() => {
    if (!focus) {
      return null;
    }
    let best = 0;
    focus.tgi.forEach((value, index) => {
      if (value > focus.tgi[best]) {
        best = index;
      }
    });
    return { index: best, value: focus.tgi[best] };
  }, [focus]);

  /** 三级类目中文译名（翻译表里查不到时为空串，标题就只显示英文名） */
  const leafCn = category
    ? categoryCnName(categoryCn, category.l1, category.leaf)
    : '';

  const phases = focus?.phases ?? [];
  const segments = useMemo(() => phaseSegments(phases), [phases]);
  const burstMonths = useMemo(
    () => phaseMonthIndexes(phases, 'burst'),
    [phases],
  );
  const stockMonths = useMemo(
    () => phaseMonthIndexes(phases, 'stock'),
    [phases],
  );
  const clearMonths = useMemo(
    () => phaseMonthIndexes(phases, 'clear'),
    [phases],
  );

  /** 绘图区可用宽度 → 单月像素宽，决定条带标注用全称、单字还是不标 */
  const perMonthPx = useMemo(() => {
    const plot =
      boxWidth - CHART_MARGIN.left - CHART_MARGIN.right - Y_AXIS_WIDTH;
    return plot > 0 ? plot / 12 : 0;
  }, [boxWidth]);
  const compact = boxWidth > 0 && boxWidth < COMPACT_WIDTH;

  /** 末端标记点：只在 TTL 最后一个自然月渲染实心点，其余点不画 */
  const lastIndex = rows.length - 1;
  const renderTtlDot = (dotProps: {
    cx?: number;
    cy?: number;
    index?: number;
  }) => {
    const { cx, cy, index } = dotProps;
    if (cx == null || cy == null || index !== lastIndex) {
      return <g key={`ttl-dot-${index}`} />;
    }
    return (
      <g key={`ttl-dot-${index}`}>
        <circle
          cx={cx}
          cy={cy}
          r={3.4}
          fill={series.TTL}
          stroke={chart.plate}
          strokeWidth={1.2}
        />
      </g>
    );
  };

  if (!open || !category) {
    return null;
  }

  const pendingMarkets = MARKET_CODES.filter(
    market => !availableMarkets.includes(market),
  );
  const monthText = (list: number[]) =>
    list.map(index => MONTH_LABELS_CN[index]).join('、');

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="TGI Trend" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/*
        视口级纯色遮罩：只覆盖一屏，成本恒定，不随一级页面复杂度增长。
        刻意不用 backdrop-filter —— 一级页面内容很长（日历 + 热力图 + 三张图表），
        每帧都会触发背景快照重取 + 模糊，外接显示器 / 高 DPR 下就是肉眼可见的卡顿。
      */}
      <button
        type="button"
        aria-label="Close overlay"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-scrim"
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-[980px] min-w-0 flex-col overflow-y-auto rounded-xl border border-line-4 bg-card p-4 shadow-card sm:p-6">
        <p lang="zh-CN" className="demo-inline-notice mb-3">{DEMO_NOTICE}</p>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-[11px] text-fg-5">
              {category.l1} / {category.l2} / {category.l3}
            </p>
            <h3 className="mt-1 text-[clamp(15px,1.3vw,20px)] font-semibold leading-tight text-fg">
              {category.leaf}
              {leafCn ? (
                /* 中文译名与英文名**同字号同字重**（不套字号类，直接继承 h3）：
                   商家日常沟通用中文，英文名只是底表口径，两者是并列关系，
                   把中文压成小字会让人以为它是注释。颜色退一档以区分主次。 */
                <span className="ml-2 text-fg-2">{leafCn}</span>
              ) : null}
              {peak ? (
                <span className="ml-2 text-[clamp(11px,0.85vw,13px)] font-medium text-accent-text">
                  {MONTH_LABELS[peak.index]} · Annual peak TGI{' '}
                  {formatTgi(peak.value)}
                </span>
              ) : null}
            </h3>
            <p className="mt-1 text-[11.5px] text-fg-4">
              12-month TGI trend · TTL represents the combined SEA view · Phases follow{' '}
              <span className="font-medium text-fg-2">
                {COUNTRY_NAMES[country]}
              </span>{' '}
              ; other market series are for comparison.
            </p>
          </div>
          <CloseIconButton onClick={onClose} ariaLabel="Close TGI trend" />
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap gap-2">
          <PhaseSummaryCard phase="stock" months={stockMonths} />
          <PhaseSummaryCard phase="burst" months={burstMonths} />
          <PhaseSummaryCard phase="clear" months={clearMonths} />
          <div className="min-w-0 flex-1 basis-[128px] rounded-lg border border-line-4 bg-fill-1 px-2.5 py-2">
            <p className="text-[11px] text-fg-4">Peak TGI</p>
            <p className="mt-0.5 text-[12.5px] font-semibold leading-snug text-fg tabular-nums">
              {peak ? formatTgi(peak.value) : '—'}
              {peak ? (
                <span className="ml-1 text-[11px] font-normal text-fg-4">
                  （{MONTH_LABELS_CN[peak.index]}）
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div
          ref={setBoxEl}
          className="relative mt-3 min-w-0"
          data-demo-chart="trend"
        >
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={rows} margin={CHART_MARGIN}>
              <CartesianGrid
                stroke={colors.grid}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                type="number"
                dataKey="mi"
                domain={[-0.5, 11.5]}
                ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
                interval={0}
                allowDecimals={false}
                tickFormatter={(value: number) =>
                  compact ? String(value + 1) : MONTH_LABELS[value]
                }
                tick={{ fill: colors.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: colors.grid }}
              />
              <YAxis
                domain={[0, 'auto']}
                tick={{ fill: colors.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={Y_AXIS_WIDTH}
                label={{
                  value: 'TGI',
                  angle: -90,
                  position: 'insideLeft',
                  fill: colors.axis,
                  fontSize: 11,
                }}
              />
              {segments.map(segment => {
                const meta = phaseMeta[segment.phase];
                return (
                  <ReferenceArea
                    key={`${segment.phase}-${segment.start}`}
                    x1={segment.start - 0.5}
                    x2={segment.end + 0.5}
                    fill={meta.band}
                    fillOpacity={1}
                    stroke={meta.text}
                    strokeOpacity={0.25}
                    ifOverflow="hidden"
                  />
                );
              })}
              <ReferenceLine
                y={BURST_THRESHOLD}
                stroke={colors.primary}
                strokeDasharray="5 3"
              />
              <ReferenceLine
                y={BASELINE}
                stroke={colors.base}
                strokeDasharray="3 4"
              />
              <Tooltip
                content={<TrendTooltip phases={phases} />}
                cursor={{
                  stroke: colors.primary,
                  strokeWidth: 1,
                  strokeDasharray: '4 3',
                }}
              />
              {/*
                分国曲线（每个国家一个固定色，见 SERIES_COLORS，纯色不用渐变）：
                - 数据已按「最小连续 3 个月」过滤，碎片段与缺失月一律是 null；
                  connectNulls=false 让缺口断开，于是图上只剩「≥3 个月的连续区间」，
                  既没有孤立陡峭短线段、也不再描孤立单月的点（dot=false）。
                - 每条线都是**单层纯品牌原色**、统一线宽，不垫任何外描边：浅色下
                  粉彩线在白底对比度低（1.2~2.0:1）是既定设计取舍，不做补偿。
              */}
              {shownMarkets.map(market => (
                <Line
                  key={market}
                  type="monotone"
                  dataKey={market}
                  stroke={series[market]}
                  strokeWidth={LINE_WIDTH}
                  strokeLinecap="round"
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 3.5, stroke: 'none' }}
                  isAnimationActive={drawing}
                  animationBegin={0}
                  animationDuration={DRAW_DURATION}
                  animationEasing="ease-out"
                />
              ))}
              {/* TTL 主线：TikTok White 纯色、稍粗，末端一个实心点标出最新月 */}
              {visible.has('SEA') ? (
                <Line
                  type="monotone"
                  dataKey="TTL"
                  stroke={series.TTL}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  dot={renderTtlDot}
                  activeDot={{ r: 4, fill: series.TTL, stroke: 'none' }}
                  isAnimationActive={drawing}
                  animationBegin={0}
                  animationDuration={DRAW_DURATION}
                  animationEasing="ease-out"
                />
              ) : null}
              <Customized
                component={(chartProps: Record<string, unknown>) => (
                  <AnnotationLayer
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
                    segments={segments}
                    perMonthPx={perMonthPx}
                  />
                )}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/*
          曲线筛选 = 图例：chip 上直接带国旗、曲线颜色点与国家码，
          选中即显示对应曲线，避免另做一排图例重复占位。
        */}
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
          <span className="shrink-0 text-[11px] text-fg-5">Series</span>
          {COUNTRY_CODES.map(code => {
            const ready = code === 'SEA' || availableMarkets.includes(code);
            const on = visible.has(code);
            const color = code === 'SEA' ? series.TTL : series[code];
            if (!ready) {
              return (
                <span
                  key={code}
                  title={`${COUNTRY_NAMES[code]}: no market TGI data available`}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-line-3 px-3 py-1 text-[clamp(11px,0.8vw,13px)] font-medium text-fg-6"
                >
                  <CountryFlag code={code} />
                  {code}
                  <span className="text-[10px]">Unavailable</span>
                </span>
              );
            }
            /*
              该国整体有数据，但当前三级类目在窗口内**画不出任何一段**：要么压根没有该 key、
              要么只剩 1~2 个月的碎片段（已按最小连续 3 个月的规则整段丢弃）。既然一条线都
              画不出，选中它没有意义，这里给一个明显区别于正常国家的「静态灰化 chip」：
              空心灰点 + 降透明度 + 「数据缺失」小标注 + hover tooltip「本类目数据缺失，未绘制」，
              且不可点击（span 而非 button）。
            */
            if (hiddenSet.has(code)) {
              return (
                <span
                  key={code}
                  title={`${COUNTRY_NAMES[code]}: no category data to plot`}
                  className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-full border border-line-4 bg-fill-1 px-3 py-1 text-[clamp(11px,0.8vw,13px)] font-medium text-fg-6 opacity-70"
                >
                  <CountryFlag code={code} />
                  <span
                    className="h-1.5 w-3.5 shrink-0 rounded-sm border border-line-5"
                    aria-hidden
                  />
                  {code}
                  <span className="text-[10px]">Missing data</span>
                </span>
              );
            }
            return (
              <Chip
                key={code}
                active={on}
                onClick={() => toggleSeries(code)}
                title={
                  code === 'SEA' ? 'TTL: combined SEA market view' : COUNTRY_NAMES[code]
                }
                icon={<CountryFlag code={code} />}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-3.5 shrink-0 rounded-sm"
                    style={{
                      backgroundColor: color,
                      opacity: on ? 1 : 0.5,
                      /*
                        选中态 chip 的底色是强调色（Blaze 系）：MY 的色点本身就是 Blaze，
                        贴在同色底上会糊成一片，所以选中时统一勾一圈 --accent-fg（白）
                        —— 这条深浅两套主题一致，与白底可见性无关。
                        未选中态是纯原色色块，不加任何描边。
                      */
                      boxShadow: on ? '0 0 0 1px var(--accent-fg)' : undefined,
                    }}
                  />
                  {code === 'SEA' ? 'SEA（TTL）' : code}
                </span>
              </Chip>
            );
          })}
        </div>

        {/*
          实事求是的两类说明（随当前类目动态变化）：
          ① partialMarkets：有数据但月份不全的国家——只画出连续 ≥3 个月的区间，其余按缺失处理；
          ② hiddenMarkets：一段都画不出来的国家（无数据、或只有 1~2 个月的碎片）——不绘制。
          国家用页面既有的国家码显示法；无对应国家时该句不出现。文字走语义变量，深浅两套主题都适配。
        */}
        {partialMarkets.length > 0 ? (
          <p className="mt-2 text-[11px] leading-relaxed text-fg-5">
            Some months are missing. Only runs of at least {MIN_RUN_MONTHS}{' '}
             consecutive months are plotted:
            {partialMarkets.join('、')}
            (only partial monthly data is available for these markets).
          </p>
        ) : null}
        {hiddenMarkets.length > 0 ? (
          <p className="mt-2 text-[11px] leading-relaxed text-fg-5">
            No category series available for:{hiddenMarkets.join('、')}
            (this category has fewer than {MIN_RUN_MONTHS}{' '}
             consecutive months of TGI data).
          </p>
        ) : null}

        <div className="mt-3 rounded-lg border border-line-3 bg-fill-1 px-3 py-2.5 text-[11.5px] leading-relaxed text-fg-3">
          <p className="mb-1 text-fg-4">Illustrative planning tips · Demo only</p>
          <p>
            <span style={{ color: phaseMeta.burst.text }}>Peak</span>
            {burstMonths.length > 0
              ? `（${monthText(burstMonths)}): plan launches and campaigns during the peak window.`
              : ': no month exceeds TGI 120 in this demo window.'}
          </p>
          <p>
            <span style={{ color: phaseMeta.stock.text }}>Stock-up</span>
            {stockMonths.length > 0
              ? `（${monthText(stockMonths)}): prepare stock and production ahead of the peak.`
              : ': no peak phase identified.'}
          </p>
          <p>
            <span style={{ color: phaseMeta.clear.text }}>Clearance</span>
            {clearMonths.length > 0
              ? `（${monthText(clearMonths)}): consider promotions to clear remaining stock.`
              : ': no post-peak month falls below TGI 100.'}
          </p>
          <p className="mt-1.5 text-[11px] text-fg-5">
            {PHASE_RULE.burst}；{PHASE_RULE.stock}；{PHASE_RULE.clear}
            ; priority: Peak &gt; Stock-up &gt; Clearance.
          </p>
        </div>

        {pendingMarkets.length > 0 ? (
          <p className="mt-2 text-[11px] leading-relaxed text-fg-5">
            Market data ({pendingMarkets.join(' / ')}) is unavailable. Only TTL is shown until market data is available.
          </p>
        ) : null}
      </div>
    </div>
  );
}
