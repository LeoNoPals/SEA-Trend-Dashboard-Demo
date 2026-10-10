import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import {
  EmptyBlock,
  Pager,
  ResetButton,
  SectionCard,
  SegmentedToggle,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type CategoryCnMap,
  EMPTY_CATEGORY_CN,
  categoryCnName,
} from '@/data/categoryCn';
import {
  type CategoryTrend,
  MONTH_LABELS,
  type TrendDataset,
  isTrendProduct,
} from '@/data/dataset';
import { type FestivalTag, tagsForCategory } from '@/data/festivalTag';
import { formatTgi } from '@/data/format';
import type { CountryCode } from '@/data/market';
import {
  PHASE_RULE,
  type Phase,
  festivalTagStyle,
  getPhaseMeta,
  heatCellStyle,
  phaseColor,
} from '@/data/theme';
import { useThemeMode } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const ALL = '__all__';
/** 数据行统一行高：所有单元格内容一律单行截断，行高与内容多少无关 */
const ROW_HEIGHT = 'h-10';

export type CategoryFilter = { l1: string; l2: string; l3: string };

/**
 * 「查看各国 TGI 走势」的走势图图标（替代原来的「操作」列文字与长按钮）：
 * 一条坐标轴 + 一段折线，线性图标，随字色走（currentColor），深浅主题通吃。
 */
function TrendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {/* 左侧纵轴 + 底部横轴 */}
      <path d="M2.4 2.2v11.4h11.2" />
      {/* 轴内折线：下探后拉升，再回落一小段 */}
      <path d="M4.8 10.4l2.3-2.6 2 1.9 2.9-3.6" />
    </svg>
  );
}

export const EMPTY_FILTER: CategoryFilter = { l1: ALL, l2: ALL, l3: ALL };
export const FILTER_ALL = ALL;

/**
 * 趋势品仪表盘的两种排列方式（本轮新增切换器）。
 * - `tgi`：按**当前生效月份的 TGI** 倒序。这就是改动前一直在用的口径
 *   （`b.tgi[effectiveMonthIndex] - a.tgi[...]`，未选月份时生效月份 = 窗口内最新自然月），
 *   所以把它设为默认值，切换器不改变任何人已经习惯的初始视图。
 * - `gmv`：按**同一个月份的体量**倒序，回答「这个月哪些类目量最大」。
 *
 * ⚠️ 两条硬约束：
 * ① 体量只参与排序，页面不新增任何展示金额的列或标签（对外脱敏）；
 * ② 排序取的是 `row.scale[月]` —— 所选国家自己当月体量的**规模指数**
 *   （构建期把该市场日均 GMV 取 log10 后 min-max 归一化到 0~1 的无量纲值，
 *   与金额严格单调同序，所以排序结果与改造前逐行一致，但产物里没有任何金额）。
 *   与 TGI 同国家、同月份，口径自洽；趋势品体量门槛用的是 SEA 六国总和口径
 *   （构建期已算成 `volumeOk` 布尔），刻意不拿来排序，否则各分国会排出一样的顺序。
 */
type HeatSort = 'tgi' | 'gmv';

const SORT_ITEMS: Array<{ key: HeatSort; label: string; hint: string }> = [
  {
    key: 'tgi',
    label: 'TGI descending',
    hint: 'Sort by selected month TGI, highest first (default)',
  },
  {
    key: 'gmv',
    label: 'Demo scale descending',
    hint: 'Sort by fictional scale, highest first',
  },
];

/** 排序切换：统一的大圆角分段控件（与页头主题切换同款），高度与同排的类目下拉一致 */
function SortToggle({
  value,
  onChange,
}: {
  value: HeatSort;
  onChange: (next: HeatSort) => void;
}) {
  return (
    <SegmentedToggle
      label="Sort"
      ariaLabel="Sort order"
      items={SORT_ITEMS}
      value={value}
      onChange={onChange}
    />
  );
}

/** L1/L2/L3 级联筛选（三个控件必须同一排） */
export function CategoryFilterBar({
  categories,
  value,
  onChange,
  extra,
}: {
  categories: CategoryTrend[];
  value: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
  extra?: React.ReactNode;
}) {
  const options = useMemo(() => {
    const l1 = new Set<string>();
    const l2 = new Set<string>();
    const l3 = new Set<string>();
    for (const item of categories) {
      if (item.l1) {
        l1.add(item.l1);
      }
      if (value.l1 === ALL || item.l1 === value.l1) {
        if (item.l2) {
          l2.add(item.l2);
        }
      }
      if (
        (value.l1 === ALL || item.l1 === value.l1) &&
        (value.l2 === ALL || item.l2 === value.l2)
      ) {
        if (item.l3) {
          l3.add(item.l3);
        }
      }
    }
    const sort = (set: Set<string>) =>
      [...set].sort((a, b) => a.localeCompare(b, 'en-US'));
    return { l1: sort(l1), l2: sort(l2), l3: sort(l3) };
  }, [categories, value.l1, value.l2]);

  const triggerClass =
    'h-8 w-[132px] shrink-0 border-line-5 bg-fill-1 text-[12px] text-fg-2';

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-[11px] text-fg-5">Category</span>
      <Select
        value={value.l1}
        onValueChange={next => onChange({ l1: next, l2: ALL, l3: ALL })}
      >
        <SelectTrigger className={triggerClass} aria-label="CBEC L1">
          <SelectValue placeholder="CBEC L1" />
        </SelectTrigger>
        <SelectContent className="border-line-3 bg-overlay text-fg-2">
          <SelectItem value={ALL}>All L1</SelectItem>
          {options.l1.map(item => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={value.l2}
        onValueChange={next => onChange({ ...value, l2: next, l3: ALL })}
      >
        <SelectTrigger className={triggerClass} aria-label="CBEC L2">
          <SelectValue placeholder="CBEC L2" />
        </SelectTrigger>
        <SelectContent className="border-line-3 bg-overlay text-fg-2">
          <SelectItem value={ALL}>All L2</SelectItem>
          {options.l2.map(item => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={value.l3}
        onValueChange={next => onChange({ ...value, l3: next })}
      >
        <SelectTrigger className={triggerClass} aria-label="CBEC L3">
          <SelectValue placeholder="CBEC L3" />
        </SelectTrigger>
        <SelectContent className="border-line-3 bg-overlay text-fg-2">
          <SelectItem value={ALL}>All L3</SelectItem>
          {options.l3.map(item => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ResetButton
        disabled={value.l1 === ALL && value.l2 === ALL && value.l3 === ALL}
        title="Reset all category levels"
        onClick={() => onChange(EMPTY_FILTER)}
      />
      {extra}
    </div>
  );
}

export function filterCategories(
  categories: CategoryTrend[],
  filter: CategoryFilter,
): CategoryTrend[] {
  return categories.filter(
    item =>
      (filter.l1 === ALL || item.l1 === filter.l1) &&
      (filter.l2 === ALL || item.l2 === filter.l2) &&
      (filter.l3 === ALL || item.l3 === filter.l3),
  );
}

/**
 * 阶段图例：只标颜色与阶段名；鼠标悬停时用自定义浮层给出该阶段的定义
 * （不用原生 title：有延迟且样式不可控）。
 */
function PhaseLegend() {
  const mode = useThemeMode();
  const phaseMeta = getPhaseMeta(mode);
  const [hovered, setHovered] = useState<Phase | null>(null);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-fg-3">
      {(['burst', 'stock', 'clear'] as const).map(phase => (
        <span
          key={phase}
          data-phase-legend={phase}
          className="relative inline-flex cursor-help items-center gap-2"
          onMouseEnter={() => setHovered(phase)}
          onMouseLeave={() => setHovered(null)}
        >
          <span
            data-phase-swatch={phase}
            /* swatch-ring：浅色底上给色块补一圈极细描边，避免淡黄档与白底糊在一起 */
            /* 圆点而不是色条：图例只是"这个颜色代表什么"的色标，
             色条那么大一块会和热力图里真正的高亮格抢视觉权重 */
            className="swatch-ring h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: phaseColor(phase, mode) }}
          />
          {phaseMeta[phase].label}
          {hovered === phase ? (
            <span
              role="tooltip"
              data-phase-tip={phase}
              className="absolute bottom-[calc(100%+7px)] left-0 z-50 whitespace-nowrap rounded-md border border-line-5 bg-overlay px-2.5 py-1.5 text-[12px] leading-none text-fg-2 shadow-card"
            >
              {PHASE_RULE[phase]}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

/**
 * 自定义 hover 浮层（挂到 body 上的 fixed 层）。
 * 表格容器带 `overflow-x-auto`，浮层若跟着单元格定位会被裁掉，
 * 因此用 portal + 鼠标坐标定位，并按视口尺寸做翻转避让。
 */
function HoverTip({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 280, h: 64 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    setBox(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
  });
  const left = Math.max(8, Math.min(x + 14, window.innerWidth - box.w - 10));
  const top =
    y + 20 + box.h > window.innerHeight ? Math.max(8, y - 14 - box.h) : y + 20;
  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      data-hover-tip="true"
      className="pointer-events-none fixed z-[80] max-w-[360px] rounded-md border border-line-5 bg-overlay px-2.5 py-2 text-[11.5px] leading-relaxed text-fg-2 shadow-card"
      style={{ left, top }}
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * 「相关节日」列的标签组：单行不换行，最多展示 2 个标签并以 +N 收口，
 * 全量标签与关联强度交给自定义 hover 浮层展示。
 */
function FestivalTagCell({ tags }: { tags: FestivalTag[] }) {
  const mode = useThemeMode();
  if (tags.length === 0) {
    return <span className="text-[11.5px] text-fg-5">—</span>;
  }
  const shown = tags.slice(0, 2);
  const rest = tags.length - shown.length;
  return (
    <span className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
      {shown.map(tag => {
        const style = festivalTagStyle(tag.nameCn, tag.score, mode);
        return (
          <span
            key={tag.nameCn}
            data-festival-tag={tag.nameCn}
            data-score={tag.score}
            className="max-w-[92px] shrink-0 truncate rounded-full border px-1.5 py-[1px] text-[10px] leading-[14px]"
            style={style}
          >
            {tag.nameCn}
          </span>
        );
      })}
      {rest > 0 ? (
        <span className="shrink-0 whitespace-nowrap rounded-full border border-line-5 bg-fill-2 px-1.5 py-[1px] text-[10px] leading-[14px] text-fg-4">
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

/** hover 浮层里展示某类目的全部节日标签 + 关联强度 */
function FestivalTipBody({ tags }: { tags: FestivalTag[] }) {
  const mode = useThemeMode();
  if (tags.length === 0) {
    return <p className="text-fg-4">No related events for this category</p>;
  }
  return (
    <>
      <p className="mb-1 font-medium text-fg">Related events: {tags.length}</p>
      <span className="flex flex-wrap items-center gap-1">
        {tags.map(tag => (
          <span
            key={tag.nameCn}
            className="whitespace-nowrap rounded-full border px-1.5 py-[1px] text-[10.5px] leading-[15px]"
            style={festivalTagStyle(tag.nameCn, tag.score, mode)}
          >
            {tag.nameCn}（{tag.level}）
          </span>
        ))}
      </span>
    </>
  );
}

/**
 * 口径说明（原先挂在页头，现移入本模块）：
 * TGI 公式、趋势品规则、阶段判定、月份回绕、默认月份全部服务于本模块的
 * 热力图与阶段配色，放在页头等于让人先读四行公式才看到看板。
 *
 * 位置选在表格与分页下方做脚注：模块主阅读流是「筛选 → 阶段图例 → 热力表格」，
 * 口径属于「看到异常再回头核对」的参考信息，压在标题下方会把表格推得很低。
 * 常驻展示、不做折叠，样式沿用页头那块灰底小字（全部走语义色变量，深浅色自适应）。
 *
 * 脱敏：本轮删掉了「窗口内任一月缺值的类目整体剔除（本次剔除 N 个）」整句 ——
 * 「本次剔除 N 个」会暴露内部数据规模。同理这里只讲 TGI 门槛，体量门槛只说
 * 「已剔除长尾类目」，不披露内部 GMV 量级。**过滤逻辑本身一行未动**，
 * 缺值清洗仍在 `buildTrendDataset` 里照旧执行，只是不再对外报数。
 */
function CaliberNote({ windowLabel }: { windowLabel: string }) {
  return (
    <div className="mt-3 rounded-lg border border-line-3 bg-fill-1 px-3.5 py-2.5 text-[clamp(10.5px,0.78vw,12px)] leading-relaxed text-fg-4">
      <div className="text-fg-3">Demo information:</div>
      <div>
        TGI, scale, price bands and event associations are generated examples.
      </div>
      <div>Demo window: {windowLabel}；</div>
      <div>
        Demo trend criteria: monthly TGI&gt;120 and the fictional scale condition;
      </div>
      <div>
        Peak: TGI&gt;120. Stock-up: two months before peak. Clearance: first post-peak month with TGI&lt;100. Priority: Peak &gt; Stock-up &gt; Clearance. Months wrap across year-end.
      </div>
    </div>
  );
}

function HeatmapModuleImpl({
  dataset,
  monthIndex,
  effectiveMonthIndex,
  effectiveMonthLabel,
  filter,
  onFilterChange,
  selectedKey,
  onSelect,
  onOpenTrend,
  festivalTags,
  country,
  categoryCn = EMPTY_CATEGORY_CN,
  extra,
  sourceIds,
  fallback,
  windowLabel,
}: {
  dataset: TrendDataset | null;
  monthIndex: number | null;
  effectiveMonthIndex: number;
  effectiveMonthLabel: string;
  filter: CategoryFilter;
  onFilterChange: (next: CategoryFilter) => void;
  selectedKey?: string;
  onSelect: (category: CategoryTrend) => void;
  onOpenTrend: (category: CategoryTrend) => void;
  /** 类目 × 节日关联标签，key = categoryKey(l3, leaf)；读取失败时为空 Map */
  festivalTags: Map<string, FestivalTag[]>;
  /** 全局国家筛选：非 SEA 时「相关节日」列只显示覆盖该国的标签 */
  country: CountryCode;
  /** 三级类目英文名 → 中文名（仅 hover 提示用，读不到时为空映射） */
  categoryCn?: CategoryCnMap;
  extra?: React.ReactNode;
  sourceIds: string;
  fallback?: React.ReactNode;
  /** 口径说明用：分析窗口文案（如 2025年07月 ~ 2026年06月） */
  windowLabel: string;
}) {
  const mode = useThemeMode();
  const [page, setPage] = useState(0);
  /** 排列方式：默认沿用既有口径「当月 TGI 倒序」（见 HeatSort 注释） */
  const [sort, setSort] = useState<HeatSort>('tgi');
  /** 自定义 hover 浮层：跟随鼠标坐标，内容由触发单元格给出 */
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    node: React.ReactNode;
  } | null>(null);
  const hideTip = useCallback(() => setTip(null), []);
  const moveTip = useCallback((event: React.MouseEvent) => {
    const { clientX, clientY } = event;
    setTip(prev => (prev ? { ...prev, x: clientX, y: clientY } : prev));
  }, []);
  const categories = dataset?.categories ?? [];
  /** 选中了具体月份时，热力图只保留该月处于爆发期（TGI>120）的三级类目 */
  const monthSelected = monthIndex !== null;

  /** 先按 L1/L2/L3 过滤，得到爆发期筛选前的基础范围（用于占比统计与图例口径） */
  const baseRows = useMemo(
    () => filterCategories(categories, filter),
    [categories, filter],
  );

  /**
   * 当月爆发期类目数。国家维度：dataset 已由上层按「所选国家」取数
   * （分国底表为空时回落 SEA 总和），故这里的爆发期判定天然跟随所选国家。
   */
  const burstCount = useMemo(
    () =>
      baseRows.filter(item => isTrendProduct(item, effectiveMonthIndex)).length,
    [baseRows, effectiveMonthIndex],
  );

  const rows = useMemo(() => {
    const list = monthSelected
      ? baseRows.filter(item => isTrendProduct(item, effectiveMonthIndex))
      : baseRows.filter(item => item.volumeOk);
    /*
      两种排列方式都以「生效月份」为准，只是比较字段不同：
      TGI 倒序 = 既有口径（默认）；Daily GMV 倒序比的是规模指数（与金额单调同序），
      金额本身既不落地到页面、也不落地到产物。
      同值时回落到类目名，保证顺序稳定、翻页不抖。
    */
    return [...list].sort((a, b) => {
      const diff =
        sort === 'gmv'
          ? b.scale[effectiveMonthIndex] - a.scale[effectiveMonthIndex]
          : b.tgi[effectiveMonthIndex] - a.tgi[effectiveMonthIndex];
      return diff !== 0 ? diff : a.leaf.localeCompare(b.leaf);
    });
  }, [baseRows, monthSelected, effectiveMonthIndex, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  /** 换筛选 / 换月 / 换排序都回到第 1 页，否则第 9 页的内容会整页变成别的类目 */
  useEffect(() => {
    setPage(0);
  }, [filter, monthIndex, effectiveMonthIndex, sort, country]);
  const current = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE),
    [rows, current],
  );

  const title = !dataset
    ? 'Category TGI heatmap'
    : monthSelected
      ? `${effectiveMonthLabel} · ${rows.length} categories in peak phase (TGI>120)`
      : `Total ${rows.length} categories after scale filtering · ${effectiveMonthLabel} · ${burstCount} meet the trend criteria (TGI>120)`;

  return (
    <SectionCard
      tag="SEA Trend Dashboard"
      title={title}
      sourceIds={sourceIds}
      extra={extra}
      toolbar={
        /*
          阶段图例（爆发 / 备货 / 清仓）与类目筛选（CBEC L1/L2/L3）+ 排序**同一排**，
          且图例在**最左边**、筛选跟在图例右边：
          图例是"读图必需的色彩说明"，优先级高于操作项，靠左才符合从左到右的阅读顺序；
          筛选那一排自身仍带 overflow-x-auto，空间不够时 flex-wrap 折行 + 横向滑动，
          不会把下拉挤变形。
        */
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
          <PhaseLegend />
          <CategoryFilterBar
            categories={categories}
            value={filter}
            onChange={onFilterChange}
            /*
              排序切换塞进筛选条自己的那一排（`extra` 槽）：
              它和 L1/L2/L3 一样是"改变列表内容"的控件，必须同排；
              放在这里还能白拿筛选条的 overflow-x-auto，窄屏跟着横向滑动不换行。
            */
            extra={
              <>
                <span className="h-4 w-px shrink-0 bg-line-4" />
                <SortToggle value={sort} onChange={setSort} />
              </>
            }
          />
        </div>
      }
    >
      {fallback ?? (
        <>
          {rows.length === 0 ? (
            <EmptyBlock label="No categories match these filters" height={260} />
          ) : (
            <div className="relative min-w-0 overflow-x-auto rounded-lg border border-line-3">
              <table className="w-full min-w-[1300px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="bg-inset">
                    {[
                      'CBEC L1',
                      'CBEC L2',
                      'CBEC L3',
                      'Category',
                      'Related events',
                    ].map(label => (
                      <th
                        key={label}
                        className="whitespace-nowrap border-b border-line-3 px-2.5 py-2 text-[11px] font-medium text-fg-4"
                      >
                        {label}
                      </th>
                    ))}
                    {MONTH_LABELS.map((label, index) => (
                      <th
                        key={label}
                        className={cn(
                          'whitespace-nowrap border-b border-line-3 px-1 py-2 text-center text-[11px] font-medium',
                          monthIndex === index
                            ? 'bg-fill-4 font-semibold text-fg'
                            : 'text-fg-4',
                        )}
                      >
                        {label}
                      </th>
                    ))}
                    {/* 表头文案写明这一列是干什么的（原来只有图标 + 读屏文本，肉眼看不出） */}
                    <th className="whitespace-nowrap border-b border-line-3 px-2 py-2 text-center text-[11px] font-medium text-fg-4">
                      <span className="inline-flex items-center justify-center gap-1">
                        <TrendIcon className="h-4 w-4" />
                        View TGI trend
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(row => {
                    const rowTags = tagsForCategory(
                      festivalTags,
                      row.l3,
                      row.leaf,
                      country,
                    );
                    /** 三级类目中文名（查不到就是空串 → hover 只显示英文） */
                    const leafCn = categoryCnName(categoryCn, row.l1, row.leaf);
                    return (
                      <tr
                        key={row.key}
                        className={cn(
                          'transition-colors hover:bg-fill-hover',
                          selectedKey === row.key && 'bg-accent-soft',
                        )}
                      >
                        {(
                          [
                            { field: 'l1', value: row.l1 },
                            { field: 'l2', value: row.l2 },
                            { field: 'l3', value: row.l3 },
                            { field: 'leaf', value: row.leaf, cn: leafCn },
                          ] as Array<{
                            field: string;
                            value: string;
                            cn?: string;
                          }>
                        ).map(({ field, value, cn: valueCn }) => (
                          <td
                            key={field}
                            className={cn(
                              ROW_HEIGHT,
                              'max-w-[170px] border-b border-line-1 px-2.5 text-[11.5px] text-fg-3',
                            )}
                            onClick={() => onSelect(row)}
                            onMouseEnter={event => {
                              const text =
                                event.currentTarget.firstElementChild;
                              /**
                               * 浮层触发条件：单元格被省略号截断（看不全原文），
                               * 或者这一格有中文翻译要带出（三级类目列）。
                               */
                              const clipped = Boolean(
                                text && text.scrollWidth > text.clientWidth + 1,
                              );
                              if (!clipped && !valueCn) {
                                return;
                              }
                              setTip({
                                x: event.clientX,
                                y: event.clientY,
                                node: (
                                  <>
                                    <p className="font-medium text-fg">
                                      {value}
                                    </p>
                                    {valueCn ? (
                                      <p className="mt-0.5 text-fg-4">
                                        {valueCn}
                                      </p>
                                    ) : null}
                                  </>
                                ),
                              });
                            }}
                            onMouseMove={moveTip}
                            onMouseLeave={hideTip}
                          >
                            <span className="block truncate whitespace-nowrap">
                              {value || '—'}
                            </span>
                          </td>
                        ))}
                        <td
                          className={cn(
                            ROW_HEIGHT,
                            'w-[210px] max-w-[210px] overflow-hidden border-b border-line-1 px-2.5',
                          )}
                          onClick={() => onSelect(row)}
                          onMouseEnter={event =>
                            setTip({
                              x: event.clientX,
                              y: event.clientY,
                              node: <FestivalTipBody tags={rowTags} />,
                            })
                          }
                          onMouseMove={moveTip}
                          onMouseLeave={hideTip}
                        >
                          <FestivalTagCell tags={rowTags} />
                        </td>
                        {row.tgi.map((value, index) => {
                          const phase = row.phases[index];
                          const cell = heatCellStyle(phase, value, mode);
                          return (
                            <td
                              key={MONTH_LABELS[index]}
                              className={cn(
                                ROW_HEIGHT,
                                'cursor-pointer border-b border-l border-line-1 px-1 text-center text-[11.5px] tabular-nums',
                                phase !== 'normal' && 'font-semibold',
                                /* 选中月份列的强调：深色底提亮、浅色底压深，方向由 CSS 变量决定 */
                                monthIndex === index &&
                                  'heat-emph font-semibold',
                              )}
                              style={{
                                backgroundColor:
                                  monthIndex === index && phase === 'normal'
                                    ? 'var(--fill-3)'
                                    : cell.background,
                                color: cell.color,
                                textShadow: cell.textShadow,
                              }}
                              title={`${MONTH_LABELS[index]} · TGI ${formatTgi(value)} · ${PHASE_RULE[phase]}`}
                              onClick={() => onSelect(row)}
                            >
                              {formatTgi(value)}
                            </td>
                          );
                        })}
                        <td
                          className={cn(
                            ROW_HEIGHT,
                            'border-b border-l border-line-1 px-2 text-center',
                          )}
                        >
                          <Button
                            aria-label="View TGI trend"
                            title="View TGI trend"
                            /* 圆形（rounded-full）：全站交互按钮统一圆形语言，不留方角图标钮 */
                            className="h-7 w-7 shrink-0 justify-center rounded-full bg-accent p-0 text-accent-fg hover:bg-accent-hover"
                            onClick={() => onOpenTrend(row)}
                          >
                            <TrendIcon className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11.5px] text-fg-4">
            <span className="shrink-0">
              Total {rows.length} categories · Page {current + 1} / {pageCount}
            </span>
            <Pager current={current} pageCount={pageCount} onChange={setPage} />
          </div>
        </>
      )}
      {/*
        口径说明常驻在模块最底部：放在 fallback 之外，加载中 / 读取失败时也能看到口径，
        不随表格状态闪进闪出。
      */}
      <CaliberNote windowLabel={windowLabel} />
      {tip ? (
        <HoverTip x={tip.x} y={tip.y}>
          {tip.node}
        </HoverTip>
      ) : null}
    </SectionCard>
  );
}

/** 用 memo 包裹：热力图是 20 行 × 12 列的重表格，浮层开关不应触发它重绘 */
export const HeatmapModule = memo(HeatmapModuleImpl);
