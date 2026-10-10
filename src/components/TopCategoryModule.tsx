import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
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
  isTrendProduct,
} from '@/data/dataset';
import { formatTgi, niceTicks, truncate } from '@/data/format';
import { getChartTokens, getColors } from '@/data/theme';
import { useThemeMode } from '@/hooks/useTheme';

/**
 * 滚动视口的**最小**高度（不是内容高度）。真实视口高度由卡片撑开：
 * 本模块与右侧「趋势品价格区间分布」同处一个 grid 行、必须等高，
 * 图表区因此写成 flex-1 + 这个下限，谁高谁把对方拉平，两块的占幅就一样大。
 */
const CHART_MIN_HEIGHT = 360;
/** 圆角半径：横向柱四角统一圆角，不用直角矩形 */
const BAR_RADIUS: [number, number, number, number] = [6, 6, 6, 6];
/** 单条横柱的占位高度：视口一次约露出 13 条 */
const BAR_ROW_HEIGHT = 27;
/** 图表内边距与纵轴宽度：固定横轴条要按同一组值对齐，必须共用常量 */
const CHART_MARGIN = { top: 4, right: 46, bottom: 4, left: 4 };
const Y_AXIS_WIDTH = 150;

type Row = {
  /** 类目稳定键：柱子被点击时靠它回查 CategoryTrend 原始行（与气泡图同一套做法） */
  key: string;
  name: string;
  full: string;
  /** 三级类目中文名（翻译表里查不到时为空串，tooltip 就只显示英文） */
  cn: string;
  /** 一级行业 CBEC L1，决定柱体颜色（与气泡图同一份映射） */
  l1: string;
  color: string;
  rank: number;
  tgi: number;
};

/**
 * 把「可见区间的最大 TGI」归到整齐的档位上。
 * 滚动时横轴要跟着可见类目变化，但如果逐像素跟随最大值，
 * 轴上限会一帧一个数、柱体和刻度都在抖；量化成 20/50/100 的档位后
 * 横轴只在换挡时动一次，配合下面的平滑插值就不会有抖动感。
 */
function axisMaxFor(values: number[]): number {
  const max = Math.max(BURST_THRESHOLD, ...values);
  const step = max > 400 ? 100 : max > 150 ? 50 : 20;
  return Math.ceil((max * 1.04) / step) * step;
}

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Row }>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) {
    return null;
  }
  return (
    <div className="rounded-md border border-line-5 bg-tooltip px-3 py-2 text-[11.5px] text-fg-2 shadow-card">
      <p className="mb-1 max-w-[240px] font-semibold text-fg">{row.full}</p>
      {row.cn ? <p className="mb-1 max-w-[240px] text-fg-4">{row.cn}</p> : null}
      <p className="mb-1 inline-flex items-center gap-1.5 text-fg-4">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: row.color }}
        />
        {row.l1 || 'Uncategorized'}
      </p>
      <p className="mb-0.5 text-fg-4">Monthly TGI rank #{row.rank}</p>
      <p>TGI {formatTgi(row.tgi)}</p>
    </div>
  );
}

function TopCategoryModuleImpl({
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
  /** CBEC L1 → 颜色（由 page 统一算一次，与气泡图、价格分布共用同一份映射） */
  l1Colors: Record<string, string>;
  /** 三级类目英文名 → 中文名（仅 hover 提示用，读不到时为空映射） */
  categoryCn?: CategoryCnMap;
  monthIndex: number;
  monthLabel: string;
  /**
   * 点击柱子时唤起该三级类目的 TGI 走势浮层（与热力图「查看TGI走势」、气泡图同一个入口、
   * 同一个浮层实例）。不传则柱子不可点，光标也不变。
   */
  onOpenTrend?: (category: CategoryTrend) => void;
  extra?: React.ReactNode;
  sourceIds: string;
  fallback?: React.ReactNode;
}) {
  const mode = useThemeMode();
  const colors = getColors(mode);
  const chart = getChartTokens(mode);
  /** 图例筛选：空数组 = 不筛选（全选），避免用户把自己点成空图 */
  const [picked, setPicked] = useState<string[]>([]);

  /**
   * 候选池 = 当月所有趋势品按 CBEC L1 汇总（截断到 Top N 之前）。
   * 图例基于这个池子而非榜内出现的 L1，否则筛到只剩一个 L1 后图例会塌缩。
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

  const rows = useMemo<Row[]>(() => {
    const top = categories
      .filter(
        item => activeL1.length === 0 || activeL1.includes(item.l1 || 'Uncategorized'),
      )
      .filter(item => isTrendProduct(item, monthIndex))
      .sort((a, b) => b.tgi[monthIndex] - a.tgi[monthIndex]);
    /*
      刻意**不截断**：榜单要能滑到当月全部趋势品（TGI>120）的最后一名。
      早期写死过 Top 40，底表刷新后趋势品变多就会看不全（第 41 名之后凭空消失），
      而"看不全"这件事在页面上完全没有提示，比多渲染几十根柱子危险得多。
      条数是当月爆发期类目数（量级几十~几百），全部渲染在滚动容器内即可。
    */
    return top.map((item, index) => ({
      key: item.key,
      name: truncate(item.leaf, 20),
      full: `${item.l3} / ${item.leaf}`,
      cn: categoryCnName(categoryCn, item.l1, item.leaf),
      l1: item.l1 || 'Uncategorized',
      color: l1Colors[item.l1] ?? colors.primary,
      rank: index + 1,
      tgi: Number(item.tgi[monthIndex].toFixed(1)),
    }));
  }, [categories, monthIndex, activeL1, l1Colors, categoryCn]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  /**
   * 滚动视口的实测高度。视口高度不再是常量（卡片被同排的价格区间模块拉高时它跟着长），
   * 而内层图表高度要用「视口高度」兜底（类目少于一屏时不能留白），所以必须实测。
   */
  const [viewHeight, setViewHeight] = useState(CHART_MIN_HEIGHT);
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(entries => {
      const next = Math.round(entries[0].contentRect.height);
      setViewHeight(prev => (Math.abs(prev - next) < 1 ? prev : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /** 内层高度：条数 × 单条高度；条数少于一屏时仍撑满视口，不留白 */
  const innerHeight = Math.max(viewHeight, rows.length * BAR_ROW_HEIGHT);

  /** 可见区间算出的横轴上限（已量化到档位） */
  const [targetMax, setTargetMax] = useState(BURST_THRESHOLD);
  /** 真正下发给 XAxis 的上限：向 targetMax 平滑靠近，换挡时柱体是「长/缩」而不是瞬移 */
  const [xMax, setXMax] = useState(BURST_THRESHOLD);
  const xMaxRef = useRef(BURST_THRESHOLD);
  /**
   * 滚动条占掉的宽度：图表画在滚动容器**内**（宽度已被滚动条挤窄），
   * 固定横轴条画在容器**外**，不补这段差值刻度就会整体右偏一个滚动条的量。
   */
  const [gutter, setGutter] = useState(0);

  /**
   * 按滚动位置算出「视口内可见的那批类目」，用它们的最大 TGI 定横轴上限。
   * 刻意不把 scrollTop 放进 state：滚动一帧一个 setState 会让整榜柱子反复重绘，
   * 这里只在量化后的档位真的变了才触发 render。
   */
  const measure = useCallback(() => {
    const node = scrollerRef.current;
    if (!node || rows.length === 0) {
      return;
    }
    const rowHeight = node.scrollHeight / rows.length;
    const first = Math.max(0, Math.floor(node.scrollTop / rowHeight));
    const last = Math.min(
      rows.length - 1,
      Math.ceil((node.scrollTop + node.clientHeight) / rowHeight) - 1,
    );
    const visible = rows.slice(first, last + 1).map(row => row.tgi);
    const next = axisMaxFor(visible);
    setTargetMax(prev => (prev === next ? prev : next));
    const bar = node.offsetWidth - node.clientWidth;
    setGutter(prev => (prev === bar ? prev : bar));
  }, [rows]);

  /** 换月 / 换筛选后榜单整体变了：回到榜首并重算横轴 */
  useEffect(() => {
    const node = scrollerRef.current;
    if (node) {
      node.scrollTop = 0;
    }
    measure();
  }, [measure]);

  /** 视口被同排卡片拉高 / 压低后，可见区间跟着变，横轴上限要重算 */
  useEffect(() => {
    measure();
  }, [measure, viewHeight]);

  /** 横轴上限的缓动：每帧向目标靠 24%，约 200ms 收敛，避免换挡时的跳变 */
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const diff = targetMax - xMaxRef.current;
      if (Math.abs(diff) < 0.5) {
        xMaxRef.current = targetMax;
        setXMax(targetMax);
        return;
      }
      xMaxRef.current += diff * 0.24;
      setXMax(xMaxRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetMax]);

  /**
   * 刻度值取自目标上限（缓动过程中标签数字不会乱跳），
   * 只把还没进入当前 domain 的刻度暂时过滤掉，保证刻度位置永远与网格线一致。
   */
  const ticks = useMemo(
    () => niceTicks(0, targetMax, 5).filter(value => value <= xMax + 0.5),
    [targetMax, xMax],
  );

  const title =
    rows.length > 0
      ? `${monthLabel} · ${rows.length} trending categories by TGI · Leader: ${rows[0].full.split(' / ')[1]}，TGI ${formatTgi(rows[0].tgi)}`
      : 'No trending categories match these filters';

  /**
   * **整行热区**：按行序号打开该类目的 TGI 走势浮层。
   *
   * 用户反馈「必须精准点到那根柱子上太别扭，在这一行范围内点哪儿都该生效」，
   * 所以热区从「柱体本身」扩到了整行：左侧类目名标签、柱子、柱子右侧的空白、
   * 柱端的 TGI 数值标签四处都调这个函数（与模块六价格区间的整行下钻同一套做法）。
   *
   * 为什么按 `index` 而不是按类目名（recharts 的 `activeLabel`）定位：
   * 纵轴标签是 `truncate(leaf, 20)` 截断后的短名，不同 L3 下的同名 leaf 会撞车，
   * 按名字回查会打开错误的类目；行序号是唯一无歧义的键。
   */
  const openRowAt = useCallback(
    (index?: number) => {
      if (!onOpenTrend || index === undefined || index < 0) {
        return;
      }
      const target = rows[index];
      if (!target) {
        return;
      }
      const row = categories.find(item => item.key === target.key);
      if (row) {
        onOpenTrend(row);
      }
    },
    [onOpenTrend, rows, categories],
  );

  /**
   * 绘图区**之外**那两条竖带的兜底热区：左边的类目名列（宽 Y_AXIS_WIDTH）与右边
   * 放 TGI 数值标签的留白（宽 CHART_MARGIN.right）。
   *
   * recharts 的 `getMouseInfo()` 只在绘图区内返回坐标，所以这两带上的点击拿不到
   * `activeTooltipIndex`；这里按「点击点落在第几个类目带」自己换算行序号 ——
   * 纵轴是等分的 category 轴，行带高 = 绘图高 / 条数，直接整除即可。
   * 绘图区内的点击一律交给 `<BarChart onClick>`（recharts 自己的命中判定更准），
   * 这里立刻返回，避免同一次点击被两套算法解释成两个不同的行。
   */
  const handleGutterClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onOpenTrend || rows.length === 0) {
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const plotLeft = Y_AXIS_WIDTH + CHART_MARGIN.left;
      const plotRight = rect.width - CHART_MARGIN.right;
      if (x >= plotLeft && x <= plotRight) {
        return;
      }
      const plotHeight = rect.height - CHART_MARGIN.top - CHART_MARGIN.bottom;
      if (plotHeight <= 0) {
        return;
      }
      const ratio = (event.clientY - rect.top - CHART_MARGIN.top) / plotHeight;
      const index = Math.floor(ratio * rows.length);
      openRowAt(Math.min(Math.max(index, 0), rows.length - 1));
    },
    [onOpenTrend, rows, openRowAt],
  );

  return (
    <SectionCard
      tag="Top Trending Categories"
      title={title}
      sourceIds={sourceIds}
      extra={extra}
      toolbar={
        <L1Legend
          items={pool}
          active={activeL1}
          onToggle={toggleL1}
          onReset={() => setPicked([])}
        />
      }
    >
      {fallback ??
        (rows.length === 0 ? (
          <EmptyBlock label="No categories match these filters" height={CHART_MIN_HEIGHT} />
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            {/*
              纵向滚动区：占位层 flex-1（高度由卡片给，最少 CHART_MIN_HEIGHT），
              真正的滚动容器用 absolute inset-0 铺满它。

              为什么必须 absolute：滚动内容有几百条（236 个趋势品 ≈ 6400px），
              如果滚动容器还留在文档流里，`flex-1` 只是「至少分到这么高」，
              内容照样会把卡片撑到 6000+ px —— 上线前实测就是这样，整张卡变成一条长面条。
              绝对定位把内容从流里摘出去，容器高度只由外层给定，才真正形成滚动视口。

              内层图表高度 = 条数 × 单条高度，所以柱体粗细与行距不随条数变化；
              纵轴类目名跟着内容一起滚，横轴被摘到下方固定住（见后面的横轴条）。
            */}
            <div
              className="relative min-h-0 min-w-0 flex-1"
              style={{ minHeight: CHART_MIN_HEIGHT }}
            >
              <div
                ref={scrollerRef}
                onScroll={measure}
                className="absolute inset-0 min-w-0 overscroll-contain overflow-y-auto"
              >
                {/*
                  这层 div 只负责「绘图区之外」的兜底热区（左侧类目名列 + 右侧数值留白），
                  让用户在整行范围内点哪儿都能开走势浮层。
                  键盘可达性不靠它：每一行的类目名标签本身是 role=button + tabIndex=0 的
                  可聚焦元素，Enter / 空格即可打开（见下面 YAxis 的自定义 tick）。
                */}
                <div
                  onClick={handleGutterClick}
                  className={onOpenTrend ? 'cursor-pointer' : undefined}
                >
                  <ResponsiveContainer width="100%" height={innerHeight}>
                    <BarChart
                      data={rows}
                      layout="vertical"
                      margin={CHART_MARGIN}
                      barCategoryGap="22%"
                      /*
                      整行可点：绘图区内任意位置（柱体、柱子右侧空白、行间距）
                      都按 recharts 回传的 activeTooltipIndex 打开该行类目的走势浮层。
                      纵轴类目名与柱端数值标签在绘图区之外，各自单独挂了点击事件（见下）。
                    */
                      style={onOpenTrend ? { cursor: 'pointer' } : undefined}
                      onClick={(state: { activeTooltipIndex?: number }) =>
                        openRowAt(state?.activeTooltipIndex)
                      }
                    >
                      <CartesianGrid
                        stroke={colors.grid}
                        strokeDasharray="3 3"
                        horizontal={false}
                      />
                      {/*
                    XAxis 设 hide：只借它提供刻度与比例尺（网格线、柱长都按它算），
                    轴本身不占高度、也不会跟着列表滚走。
                    allowDataOverflow 必须为 true，否则 recharts 会把 domain 反过来
                    撑到「装下全部数据」，可见区间的动态横轴就失效了；
                    超出当前 domain 的柱子由 recharts 自动裁剪在绘图区内。
                  */}
                      <XAxis
                        type="number"
                        hide
                        domain={[0, xMax]}
                        ticks={ticks}
                        allowDataOverflow
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={Y_AXIS_WIDTH}
                        interval={0}
                        /*
                        类目名标签也是热区（它在绘图区左侧、recharts 的鼠标事件覆盖不到），
                        同时它是这一行**唯一可聚焦**的元素：给 role/tabIndex/aria-label +
                        Enter / 空格键处理，键盘用户可以在滚动列表里逐行 Tab 过去开走势浮层。
                      */
                        tick={(props: {
                          x?: number;
                          y?: number;
                          index?: number;
                          payload?: { value?: string };
                        }) => {
                          const row =
                            props.index === undefined
                              ? undefined
                              : rows[props.index];
                          return (
                            <text
                              x={props.x}
                              y={props.y}
                              dy={4}
                              textAnchor="end"
                              fill={colors.axis}
                              fontSize={10.5}
                              role={onOpenTrend ? 'button' : undefined}
                              tabIndex={onOpenTrend ? 0 : undefined}
                              aria-label={
                                onOpenTrend && row
                                  ? `View ${row.full} TGI trend`
                                  : undefined
                              }
                              style={
                                onOpenTrend ? { cursor: 'pointer' } : undefined
                              }
                              onClick={event => {
                                /* 阻止冒泡到外层兜底热区，避免同一次点击被算两遍 */
                                event.stopPropagation();
                                openRowAt(props.index);
                              }}
                              onKeyDown={event => {
                                if (
                                  event.key === 'Enter' ||
                                  event.key === ' '
                                ) {
                                  event.preventDefault();
                                  openRowAt(props.index);
                                }
                              }}
                            >
                              {props.payload?.value}
                            </text>
                          );
                        }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ReferenceLine
                        x={BURST_THRESHOLD}
                        stroke={colors.primary}
                        strokeDasharray="4 3"
                      />
                      <ReferenceLine
                        x={BASELINE}
                        stroke={colors.base}
                        strokeDasharray="2 4"
                      />
                      <Tooltip
                        content={<BarTooltip />}
                        cursor={{ fill: chart.cursorFill }}
                      />
                      <Bar
                        dataKey="tgi"
                        radius={BAR_RADIUS}
                        isAnimationActive={false}
                        /* 可点开走势时给 pointer 光标（与气泡图一致），否则柱子看不出可点 */
                        cursor={onOpenTrend ? 'pointer' : undefined}
                        /*
                          柱体本身**不再单独挂 onClick**：整行热区已经由外层
                          `<BarChart onClick>` 统一接管（柱子也在绘图区内），
                          两处都挂会让同一次点击触发两遍同样的打开动作。
                        */
                      >
                        {/*
                      柱体一律**纯品牌原色填充、零描边**（不设 stroke，strokeWidth=0），
                      所有横条的渲染几何尺寸完全一致，不存在某几支因描边显得更粗。
                      白底上粉彩对比度低是既定设计取舍，不做补偿。
                    */}
                        {rows.map(row => (
                          <Cell
                            key={row.key}
                            data-l1={row.l1}
                            fill={row.color}
                            strokeWidth={0}
                            style={
                              onOpenTrend ? { cursor: 'pointer' } : undefined
                            }
                          />
                        ))}
                        <LabelList
                          dataKey="tgi"
                          position="right"
                          fill={colors.muted}
                          fontSize={10.5}
                          formatter={(value: number) => formatTgi(value)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/*
              固定横轴条：刻度不能跟着类目一起滚走，所以从图表里摘出来用 DOM 画。
              左右内边距 = 纵轴宽度 + 图表左右边距（与图内共用同一组常量），
              刻度按 tick / xMax 的百分比落位，因此和图内网格线严格重合。
            */}
            <div
              className="relative select-none"
              style={{
                paddingLeft: Y_AXIS_WIDTH + CHART_MARGIN.left,
                paddingRight: CHART_MARGIN.right + gutter,
              }}
            >
              <div
                className="relative h-4 border-t"
                style={{ borderColor: colors.grid }}
              >
                {ticks.map(tick => (
                  <span
                    key={tick}
                    className="absolute top-[2px] -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums"
                    style={{
                      left: `${(tick / xMax) * 100}%`,
                      color: colors.axis,
                    }}
                  >
                    {formatTgi(tick)}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-1 text-[10.5px] text-fg-5">
              Scroll to explore ranks 1–{rows.length}{' '}
              (all trending categories this month). The axis scales to the visible rows.
            </p>
          </div>
        ))}
    </SectionCard>
  );
}

export const TopCategoryModule = memo(TopCategoryModuleImpl);
