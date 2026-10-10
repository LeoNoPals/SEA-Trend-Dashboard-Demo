import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  type CategoryFilter,
  CategoryFilterBar,
  filterCategories,
} from '@/components/HeatmapModule';
import { CloseIconButton, EmptyBlock, SectionCard } from '@/components/common';
import {
  type CategoryCnMap,
  EMPTY_CATEGORY_CN,
  categoryCnName,
} from '@/data/categoryCn';
import {
  type CategoryTrend,
  PRICE_BANDS,
  isTrendProduct,
} from '@/data/dataset';
import { niceTicks } from '@/data/format';
import { getChartTokens, getColors } from '@/data/theme';
import { useThemeMode } from '@/hooks/useTheme';
import { useModalDialog } from '@/hooks/useModalDialog';
import { DEMO_NOTICE } from '@/data/demo/history';

/**
 * 图表区的**最小**高度。真实高度由卡片撑开：本模块与左侧「TOP趋势品热度排名」
 * 同处一个 grid 行且必须等高，所以图表区写成 flex-1 + 这个下限 ——
 * 10 个价格档因此能在整张卡片的高度里铺开，不再挤在卡片上半部分、下面留一片空白。
 */
const CHART_MIN_HEIGHT = 400;
/** tooltip 最多列出的 CBEC L1 条数，超出合并成「其他」 */
const TIP_MAX_ROWS = 8;
/** 堆叠柱两端的圆角半径：与左侧 TOP 排名的横柱同一档（6px） */
const BAR_RADIUS = 6;
/**
 * 单条堆叠柱的**固定粗细**，与左侧「TOP趋势品热度排名」的横柱实测一致（15px）。
 *
 * 为什么写死而不是交给 recharts 自动分配：本图是 6 个 `stackId` 相同的 Bar，
 * recharts 给堆叠系列自动算出来的柱宽只有 8px 上下（比左边细一半），
 * 两块图并排时一眼就能看出粗细不一样；`barSize` 是唯一能精确对齐的入口。
 * 卡片被拉高时多出来的高度全部变成档与档之间的留白（更疏朗），柱子不跟着变胖。
 */
const BAR_SIZE = 15;

/** 某价格档内单个 CBEC L1 的数量 */
type Segment = { name: string; count: number; color: string };

type Row = {
  band: string;
  total: number;
  /**
   * 落入该价格档的**最细三级类目（leaf）明细**。
   * 柱子的计数口径本来就是 leaf 粒度（`categories` 按 `l3\u0001leaf` 去重），
   * 这里把原始行一并留下来，点柱体时弹层逐行列出（不展示具体 AOV 数值）。
   */
  items: CategoryTrend[];
  /** 该档内各 L1 数量（按数量降序），tooltip 直接用 */
  detail: Segment[];
  /** 本档内第一个 / 最后一个非零堆叠段的序号（-1 = 该档为空），圆角只画在这两端 */
  firstIndex: number;
  lastIndex: number;
  /** 堆叠段的取数键：`s{序号}` 对应 series[序号] 那个 L1 */
  [key: `s${number}`]: number | string | Segment[] | CategoryTrend[];
};

/**
 * 堆叠柱的圆角：只把**整条柱子的两端**画成圆角，段与段之间仍然是直角相接。
 *
 * recharts 的 `Bar radius` 是按「每个矩形」生效的，直接给堆叠段加圆角会让
 * 每一小段都变成独立胶囊，中间出现锯齿状缺口。所以这里换成自定义 shape：
 * 每段自己判断是不是本行的第一段 / 最后一段，只在对应侧收圆角；
 * 半径还要被段宽夹住（`Math.min`），否则最窄的那一两个类目会被圆角吃成一个点。
 */
function StackedBarShape(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  seriesIndex?: number;
  payload?: Row;
}) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    fill,
    seriesIndex,
    payload,
  } = props;
  if (!(width > 0) || !(height > 0) || !payload || seriesIndex === undefined) {
    return null;
  }
  const cap = Math.min(BAR_RADIUS, width / 2, height / 2);
  const left = payload.firstIndex === seriesIndex ? cap : 0;
  const right = payload.lastIndex === seriesIndex ? cap : 0;
  const path = [
    `M${x + left},${y}`,
    `H${x + width - right}`,
    right ? `A${right},${right} 0 0 1 ${x + width},${y + right}` : '',
    `V${y + height - right}`,
    right ? `A${right},${right} 0 0 1 ${x + width - right},${y + height}` : '',
    `H${x + left}`,
    left ? `A${left},${left} 0 0 1 ${x},${y + height - left}` : '',
    `V${y + left}`,
    left ? `A${left},${left} 0 0 1 ${x + left},${y}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <path
      d={path}
      fill={fill}
      /* 整根柱子（每一段）都可点：鼠标给出 pointer 手型，提示这里能下钻看明细 */
      style={{ cursor: 'pointer' }}
    />
  );
}

/** 鼠标悬停某个价格档：列出该档各 CBEC L1 的数量与占比明细 */
function BandTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Row }>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row || row.total === 0) {
    return null;
  }
  const shown = row.detail.slice(0, TIP_MAX_ROWS);
  const restCount = row.detail
    .slice(TIP_MAX_ROWS)
    .reduce((sum, item) => sum + item.count, 0);
  const pct = (count: number) => ((count / row.total) * 100).toFixed(1);
  return (
    <div className="rounded-md border border-line-5 bg-tooltip px-3 py-2 text-[11.5px] text-fg-2 shadow-card">
      <p className="mb-1 font-semibold text-fg">
        {row.band} · Trending categories: {row.total}
      </p>
      {shown.map(item => (
        <p key={item.name} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="max-w-[168px] truncate">{item.name}</span>
          <span className="tabular-nums text-fg-4">
            {item.count} categories · {pct(item.count)}%
          </span>
        </p>
      ))}
      {restCount > 0 ? (
        <p className="flex items-center gap-1.5 text-fg-4">
          <span className="h-2 w-2 shrink-0 rounded-full bg-fill-5" />
          Other {row.detail.length - TIP_MAX_ROWS} L1 groups
          <span className="tabular-nums">
            {restCount} categories · {pct(restCount)}%
          </span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * 价格档明细浮层：点柱体后列出该价位段里**全部最细三级类目（leaf）**。
 *
 * 三条刻意的口径：
 * ① **只表示「落在该价位段」，不给任何具体 AOV 数值**——价格本身是敏感口径，
 *   业务要的是「这个价位都有哪些品类可做」，不是某个品类的客单价；
 * ② 每个 leaf 都给**中文名 + 英文名同字号并列**（Category_CN 查不到时只显示英文，
 *   不留占位），中文名按 leaf 精确命中、歧义英文名自动不收录；
 * ③ 按 CBEC L1 分组（顺序沿用柱体堆叠顺序），组内按英文名字母序——
 *   一屏最多近百条，分组 + 内部滚动比平铺长列表更好定位。
 */
function BandDetailOverlay({
  row,
  monthLabel,
  categoryCn,
  l1Colors,
  onClose,
}: {
  row: Row;
  monthLabel: string;
  categoryCn: CategoryCnMap;
  l1Colors: Record<string, string>;
  onClose: () => void;
}) {
  const dialogRef = useModalDialog(true);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** 按 L1 分组：组顺序沿用 row.detail（即柱体里各段的数量降序） */
  const groups = useMemo(() => {
    const byL1 = new Map<string, CategoryTrend[]>();
    for (const item of row.items) {
      const name = item.l1 || 'Uncategorized';
      const list = byL1.get(name);
      if (list) {
        list.push(item);
      } else {
        byL1.set(name, [item]);
      }
    }
    return row.detail
      .map(segment => ({
        name: segment.name,
        color: segment.color,
        items: byL1.get(segment.name) ?? [],
      }))
      .filter(group => group.items.length > 0);
  }, [row]);

  return createPortal(
    // biome-ignore lint/a11y/useSemanticElements: 与 TGI 走势浮层同一套 portal + 显隐模型
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${row.band} price band category details`}
      data-band-detail="true"
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
    >
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-scrim"
      />
      <div className="relative z-10 flex max-h-[86vh] w-full max-w-[720px] min-w-0 flex-col overflow-hidden rounded-xl border border-line-4 bg-card shadow-card">
        <div className="flex items-start justify-between gap-3 border-b border-line-3 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[clamp(15px,1.3vw,19px)] font-semibold leading-tight text-fg">
              {row.band}
              <span className="ml-2 text-fg-2">{row.total} categories</span>
            </h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-fg-5">
              {monthLabel} trending examples (TGI&gt;120) · Fictional price band assignments
            </p>
            <p lang="zh-CN" className="demo-inline-notice mt-2">{DEMO_NOTICE}</p>
          </div>
          <CloseIconButton onClick={onClose} ariaLabel="Close price band details" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {groups.map(group => (
            <section key={group.name} className="py-2">
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: l1Colors[group.name] ?? group.color,
                  }}
                />
                <span className="text-[12.5px] font-semibold text-fg-1">
                  {group.name}
                </span>
                <span className="text-[11px] tabular-nums text-fg-5">
                  {group.items.length}
                </span>
              </div>
              <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {group.items.map(item => {
                  const cn = categoryCnName(categoryCn, item.l1, item.leaf);
                  return (
                    <li
                      key={item.key}
                      className="flex min-w-0 flex-col border-b border-line-3 py-1.5"
                    >
                      {/* 中英文名同字号并列；查不到中文时只显示英文 */}
                      <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[12.5px] leading-snug text-fg-1">
                        <span className="font-medium">{cn || item.leaf}</span>
                        {cn ? (
                          <span className="text-fg-4">{item.leaf}</span>
                        ) : null}
                      </p>
                      <p className="truncate text-[10.5px] text-fg-5">
                        {[item.l2, item.l3].filter(Boolean).join(' / ')}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PriceBandModuleImpl({
  categories,
  l1Colors,
  monthIndex,
  monthLabel,
  filter,
  onFilterChange,
  extra,
  sourceIds,
  fallback,
  categoryCn = EMPTY_CATEGORY_CN,
}: {
  categories: CategoryTrend[];
  /** CBEC L1 → 颜色（由 page 统一算一次，与气泡图、TOP 排名共用同一份映射） */
  l1Colors: Record<string, string>;
  monthIndex: number;
  monthLabel: string;
  filter: CategoryFilter;
  onFilterChange: (next: CategoryFilter) => void;
  extra?: React.ReactNode;
  sourceIds: string;
  fallback?: React.ReactNode;
  /** 三级类目英→中翻译（Category_CN sheet），弹层明细每个 leaf 都要给中文名 */
  categoryCn?: CategoryCnMap;
}) {
  const mode = useThemeMode();
  const colors = getColors(mode);
  const chart = getChartTokens(mode);
  /** 当前打开下钻明细的价格档；null = 浮层关闭 */
  const [openBand, setOpenBand] = useState<string | null>(null);
  const closeBand = useCallback(() => setOpenBand(null), []);
  /**
   * 每个价格档按「档内各 CBEC L1 的趋势品数量」拆成堆叠段：
   * 段长比例 = 该 L1 在这一档的占比，因此不做任何筛选也能看出各类目落在哪些价位段。
   */
  const { rows, series, total } = useMemo(() => {
    const scoped = filterCategories(categories, filter).filter(item =>
      isTrendProduct(item, monthIndex),
    );
    /**
     * 计数与下钻明细都按**最细三级类目 leaf**粒度：
     * 入参 `categories` 已按 `l3\u0001leaf` 唯一去重（同名 L3 下的不同 leaf 算不同类目），
     * 这里逐行落档，一个 leaf 恰好计 1 次，明细列表里也恰好出现 1 次。
     */
    /** 价格档 → L1 → 数量 */
    const grid = PRICE_BANDS.map(() => new Map<string, number>());
    /** 价格档 → 落入该档的 leaf 明细（点击该行时弹层逐行展示） */
    const bandItems = PRICE_BANDS.map(() => [] as CategoryTrend[]);
    const overall = new Map<string, number>();
    for (const item of scoped) {
      // 价位段序号由构建期用 AOV 算好（`band[月]`，-1 = 未知）：
      // 前端只知道「落在 $5~10 这一档」，拿不到具体客单价金额。
      const index = item.band[monthIndex];
      if (index < 0) {
        continue;
      }
      const name = item.l1 || 'Uncategorized';
      grid[index].set(name, (grid[index].get(name) ?? 0) + 1);
      bandItems[index].push(item);
      overall.set(name, (overall.get(name) ?? 0) + 1);
    }
    /** 堆叠顺序：全局数量多的 L1 排在左侧，10 个档的段顺序一致，便于横向对比 */
    const seriesList = [...overall.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'))
      .map(([name, count]) => ({
        name,
        count,
        color: l1Colors[name] ?? colors.primary,
      }));

    const list = PRICE_BANDS.map((band, index) => {
      const counts = grid[index];
      const row: Row = {
        band: band.label,
        total: [...counts.values()].reduce((sum, value) => sum + value, 0),
        items: bandItems[index].sort(
          (a, b) =>
            (a.l1 || '').localeCompare(b.l1 || '', 'en') ||
            a.leaf.localeCompare(b.leaf, 'en'),
        ),
        firstIndex: -1,
        lastIndex: -1,
        detail: [...counts.entries()]
          .map(([name, count]) => ({
            name,
            count,
            color: l1Colors[name] ?? colors.primary,
          }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      };
      let firstIndex = -1;
      let lastIndex = -1;
      seriesList.forEach((item, seriesIndex) => {
        const value = counts.get(item.name) ?? 0;
        row[`s${seriesIndex}`] = value;
        if (value > 0) {
          if (firstIndex < 0) {
            firstIndex = seriesIndex;
          }
          lastIndex = seriesIndex;
        }
      });
      row.firstIndex = firstIndex;
      row.lastIndex = lastIndex;
      return row;
    });

    return { rows: list, series: seriesList, total: scoped.length };
  }, [categories, filter, monthIndex, l1Colors]);

  const peak = useMemo(
    () =>
      rows.reduce(
        (best, row) => (row.total > best.total ? row : best),
        rows[0],
      ),
    [rows],
  );

  const xMax = useMemo(() => {
    const max = Math.max(1, ...rows.map(row => row.total));
    const step = max > 200 ? 50 : max > 80 ? 20 : max > 20 ? 10 : 5;
    return Math.ceil((max * 1.06) / step) * step;
  }, [rows]);

  const title =
    total > 0
      ? `${monthLabel} ${total} trending categories · ${peak.band} is the largest price band (${peak.total})`
      : 'Category price band distribution';

  /** 当前打开明细的那一根柱子（筛选 / 换月后若该档已不存在，自动收起） */
  const openRow = openBand
    ? (rows.find(row => row.band === openBand && row.total > 0) ?? null)
    : null;

  /**
   * 按档位名打开明细：整行（含左侧价格标签、柱子右侧空白）都是点击热区，
   * 不需要精准点到色段上。空档（total=0）不响应。
   */
  const openBandByLabel = useCallback(
    (band?: string | null) => {
      if (!band) return;
      const target = rows.find(row => row.band === band && row.total > 0);
      if (target) {
        setOpenBand(target.band);
      }
    },
    [rows],
  );

  return (
    <>
      <SectionCard
        tag="Trend Price Distribution"
        title={title}
        sourceIds={sourceIds}
        extra={extra}
        toolbar={
          <div className="flex min-w-0 flex-col gap-2">
            <CategoryFilterBar
              categories={categories}
              value={filter}
              onChange={onFilterChange}
            />
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-fg-4">
              <span className="shrink-0 text-fg-5">CBEC L1</span>
              {series.map(item => (
                <span
                  key={item.name}
                  data-l1={item.name}
                  title={`${item.name}（${item.count} trending categories)`}
                  className="inline-flex min-w-0 shrink-0 items-center gap-1.5"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.name}</span>
                </span>
              ))}
            </div>
          </div>
        }
      >
        {fallback ??
          (total === 0 ? (
            <EmptyBlock
              label="No trending categories match these filters"
              height={CHART_MIN_HEIGHT}
            />
          ) : (
            /*
            图表区 flex-1 + 最小高度：卡片被同排的 TOP 排名拉高时，10 个价格档
            跟着在整张卡片里铺开（档距变大、柱子之间更疏朗），两块的占幅因此一样大。
          */
            <div
              className="min-h-0 min-w-0 flex-1"
              style={{ minHeight: CHART_MIN_HEIGHT }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rows}
                  layout="vertical"
                  margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
                  barCategoryGap="38%"
                  /*
                  整行下钻：点击绘图区任意位置（含柱子右侧空白）都按当前
                  hover 到的档位打开明细，recharts 的 activeLabel 就是 band。
                */
                  style={{ cursor: 'pointer' }}
                  onClick={(state: { activeLabel?: string | number }) => {
                    const label = state?.activeLabel;
                    openBandByLabel(
                      typeof label === 'number' ? String(label) : label,
                    );
                  }}
                >
                  <CartesianGrid
                    stroke={colors.grid}
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    domain={[0, xMax]}
                    ticks={niceTicks(0, xMax, 5)}
                    allowDecimals={false}
                    tick={{ fill: colors.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: colors.grid }}
                  />
                  <YAxis
                    type="category"
                    dataKey="band"
                    width={74}
                    interval={0}
                    /* 价格档标签本身也是热区：点标签 = 点这一行 */
                    tick={(props: {
                      x?: number;
                      y?: number;
                      payload?: { value?: string };
                    }) => (
                      <text
                        x={props.x}
                        y={props.y}
                        dy={4}
                        textAnchor="end"
                        fill={colors.axis}
                        fontSize={11}
                        style={{ cursor: 'pointer' }}
                        onClick={() => openBandByLabel(props.payload?.value)}
                      >
                        {props.payload?.value}
                      </text>
                    )}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<BandTooltip />}
                    cursor={{ fill: chart.cursorFill }}
                  />
                  {/*
                  堆叠段一律**纯品牌原色填充、零描边**（stroke 完全不设，
                  strokeWidth=0）：所有色段的渲染几何尺寸因此完全一致，
                  不会出现「带描边的段看起来更粗、强调色段显得更细」的问题。
                  白底上浅色区段对比度较低是既定设计取舍，不做补偿。
                */}
                  {series.map((item, index) => (
                    <Bar
                      key={item.name}
                      dataKey={`s${index}`}
                      name={item.name}
                      stackId="band"
                      fill={item.color}
                      strokeWidth={0}
                      barSize={BAR_SIZE}
                      /* 点任意一段都下钻该档明细：recharts 回传的 payload.payload 即 Row */
                      onClick={(data: { payload?: unknown }) => {
                        const row = data?.payload as Row | undefined;
                        if (row && row.total > 0) {
                          setOpenBand(row.band);
                        }
                      }}
                      /* 圆角只收在整条柱的两端，见 StackedBarShape 的说明 */
                      shape={<StackedBarShape seriesIndex={index} />}
                      isAnimationActive={false}
                    >
                      {/* 合计数量标在整条堆叠柱右侧，只在最后一段上挂一次 */}
                      {index === series.length - 1 ? (
                        <LabelList
                          dataKey="total"
                          position="right"
                          fill={colors.muted}
                          fontSize={10.5}
                        />
                      ) : null}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
      </SectionCard>
      {openRow ? (
        <BandDetailOverlay
          row={openRow}
          monthLabel={monthLabel}
          categoryCn={categoryCn}
          l1Colors={l1Colors}
          onClose={closeBand}
        />
      ) : null}
    </>
  );
}

export const PriceBandModule = memo(PriceBandModuleImpl);
