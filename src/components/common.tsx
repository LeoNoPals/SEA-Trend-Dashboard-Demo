import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CARD_CLASS } from '@/data/theme';
import type { DataError } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';

/** 统一的视图卡片：模块名（主标题）+ 结论句 + 口径副标题 + 右上角插槽 + 内容区（等高对齐） */
export function SectionCard({
  tag,
  badge,
  title,
  description,
  extra,
  toolbar,
  children,
  className,
  bodyClassName,
  sourceIds,
}: {
  /** 模块名（卡片主标题，突出展示） */
  tag: string;
  /** 模块名右侧的小标签（如实时两模块的「数据周期 9.7–9.13」）；不传时排版与原来完全一致 */
  badge?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  sourceIds: string;
}) {
  return (
    <Card className={cn(CARD_CLASS, className)} role="region" aria-label={tag} data-demo-section={sourceIds}>
      <CardHeader className="gap-2 p-4 pb-2 sm:p-5 sm:pb-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          {/* 标题区必须 `flex-1 min-w-0`：不给 flex-1 时它的基准宽度是那段很长的口径说明，
              会把右上角的 extra（页码组 / 角标）整个挤到下一行去；给了之后标题区可压缩，
              extra 永远停在标题右侧的空白处 */}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="h-[1.05em] w-[3px] shrink-0 rounded-full bg-accent" />
              <h2 className="min-w-0 whitespace-nowrap font-display text-[clamp(17px,1.5vw,26px)] font-bold leading-tight tracking-tight text-fg">
                {tag}
              </h2>
              {badge}
            </div>
            {title ? (
              <p className="mt-1.5 text-[clamp(12px,0.95vw,15px)] font-medium leading-snug text-fg-2">
                {title}
              </p>
            ) : null}
            {description ? (
              <p className="mt-1 text-[clamp(11px,0.8vw,12.5px)] leading-relaxed text-fg-4">
                {description}
              </p>
            ) : null}
          </div>
          {extra ? <div className="min-w-0 max-w-full">{extra}</div> : null}
        </div>
        {toolbar}
      </CardHeader>
      <CardContent
        className={cn(
          'flex min-w-0 flex-1 flex-col p-4 pt-1 sm:p-5 sm:pt-1',
          bodyClassName,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * 全站统一的「关闭浮层」按钮：**右上角的圆形叉号图标按钮**。
 *
 * 之前四个浮层（TGI 走势、价格区间下钻明细、素材预览、商品主图灯箱）各写了一个
 * 带「关闭」/「关闭（Esc）」文字的矩形按钮 —— 文字按钮宽度参差、还会和标题抢视觉重心。
 * 现在一律收口到这一个组件：
 * - 形状是**正圆**（与页码、重置、分段控件同一套圆形语言，全站不再有方角交互按钮）；
 * - 图标是纯几何叉号（1.7 描边 + 圆头，随字色走，深浅主题通吃）；
 * - **无障碍不退化**：`aria-label` 由调用方按浮层语义给（如「关闭素材预览」），
 *   `title` 里仍带「Esc」提示，键盘 Esc 关闭的行为由各浮层自己保留。
 */
export function CloseIconButton({
  onClick,
  ariaLabel,
  className,
}: {
  onClick: () => void;
  /** 无障碍名称，必须写清关的是哪个浮层（如「关闭素材预览」） */
  ariaLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={`${ariaLabel}（Esc）`}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-5 bg-fill-1 text-fg-3 transition-colors',
        'hover:border-accent-ring hover:bg-fill-2 hover:text-fg',
        className,
      )}
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        aria-hidden
        focusable="false"
      >
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  );
}

/**
 * 模块标题旁的小标签（当前只有实时两模块的「数据周期」在用）。
 *
 * 刻意做得克制：11px、圆角胶囊、浅底描边、`whitespace-nowrap` 不换行，
 * 只承担「这批数据是哪几天的」这一个信息，不恢复上一轮被删掉的大段灰色口径小字。
 */
export function SectionBadge({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="shrink-0 whitespace-nowrap rounded-full border border-line-5 bg-fill-2 px-2 py-[1px] text-[11px] font-medium leading-[1.5] text-fg-4"
    >
      {children}
    </span>
  );
}

/** 可点击 chip（国家 / 月份 / 筛选项）；传 `icon` 时在文字左侧渲染一个图标并保持同行 */
export function Chip({
  active,
  children,
  onClick,
  title,
  className,
  icon,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
  /** 文字前的小图标（如国旗）；不传时排版与原来完全一致 */
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[clamp(11px,0.8vw,13px)] font-medium transition-colors',
        icon ? 'inline-flex items-center gap-1.5' : '',
        active
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-line-5 bg-fill-2 text-fg-3 hover:border-accent-ring hover:text-fg',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * 重置图标：一圈带箭头的回转弧线，线性、随字色走（currentColor），深浅主题通吃。
 * 光有「重置」两个字太像一段说明文字，加了图标才让人一眼认出这是个按钮。
 */
function ResetIcon({ className }: { className?: string }) {
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
      <path d="M13.2 8a5.2 5.2 0 1 1-1.6-3.75" />
      <path d="M13.4 2.6v2.9h-2.9" />
    </svg>
  );
}

/**
 * 统一的「重置」按钮：热力图（东南亚趋势品仪表盘）、趋势品价格区间分布、
 * 实时 Top 商品三个模块共用同一个实现，观感与交互完全一致。
 *
 * 两个刻意的取舍：
 * ① **常驻显示、不再「脏了才出现」**：按钮凭空冒出来会让筛选条整排抖动，
 *    而且用户在没筛过之前根本不知道「这里可以一键还原」。没有可重置内容时
 *    渲染成 disabled 态（半透明 + 禁用光标），位置永远固定；
 * ② 用描边按钮而不是纯文字 ghost：它和旁边的下拉框在同一排，
 *    只有同样带边框和底色才不会被读成一段说明文字。
 */
export function ResetButton({
  onClick,
  disabled,
  title,
  className,
}: {
  onClick: () => void;
  /** 无可重置内容（全是默认值）时置灰 */
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-reset-button="true"
      disabled={disabled}
      title={title ?? 'Reset default filters'}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line-5 bg-fill-1 px-3 text-[11.5px] text-fg-3 transition-colors',
        'hover:border-accent-ring hover:bg-fill-2 hover:text-fg',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-5 disabled:hover:bg-fill-1 disabled:hover:text-fg-3',
        className,
      )}
    >
      <ResetIcon className="h-3.5 w-3.5" />
      Reset
    </button>
  );
}

export type SegmentedItem<T extends string> = {
  key: T;
  label: ReactNode;
  hint?: string;
};

/** 放大镜：线性、随字色走，与重置图标同一套画法（1.6 描边 + 圆头） */
function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="7" cy="7" r="4.4" />
      <path d="M10.4 10.4 14 14" />
    </svg>
  );
}

/**
 * 统一的**关键词搜索框**：当前实时 Top 商品按商品名模糊匹配；实现保持通用，
 * 提供清空按钮、Esc 清空及统一的圆角与高度。
 *
 * 三个刻意的取舍：
 * ① 大圆角胶囊 + 灰底、与同排的下拉筛选等高（h-8）：它就是一个筛选项，不该做成
 *    比筛选更抢眼的白底输入框；
 * ② **即输即筛，没有搜索按钮**：这份数据已经全量在前端内存里，逐字过滤是纯本地计算，
 *    多一次点击只是让人多一步；
 * ③ 有内容时右侧才出现清空「×」，并支持 Esc 清空 —— 输入框自带的浏览器清空按钮
 *    在各浏览器上样式不一，这里显式禁掉（`[&::-webkit-search-cancel-button]:hidden`）。
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-5">
        <SearchIcon className="h-3.5 w-3.5" />
      </span>
      <input
        type="search"
        value={value}
        aria-label={ariaLabel ?? placeholder}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape' && value) {
            event.stopPropagation();
            onChange('');
          }
        }}
        className={cn(
          'h-8 w-full rounded-full border border-line-5 bg-fill-1 pl-8 pr-7 text-[12px] text-fg-1 transition-colors',
          'placeholder:text-fg-5 hover:border-accent-ring focus:border-accent focus:outline-none',
          '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
        )}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          title="Clear search"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-fg-5 transition-colors hover:bg-fill-3 hover:text-fg-2"
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            aria-hidden
            focusable="false"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/**
 * 全站统一的**二选一/多选一分段控件**（segmented control）。
 *
 * 视觉基准取自页头的「浅色 / 深色」主题切换：**大圆角胶囊容器 + 胶囊选中块**。
 * 页面上原本有三套形态各异的切换器（热力图的排序切成小圆角方块、日历甘特视角是
 * 两个拼接的方按钮、底部「货品 / 素材」又是另一套尺寸），并排出现时观感割裂。
 * 现在全部收口到这一个组件：容器与选中块都是 `rounded-full`，
 * 选中态一律品牌红实底，未选态只有文字 + hover 浅底，不再各写各的。
 *
 * `size` 只影响尺寸档位，不影响形态：
 * - `sm`：与同排的下拉筛选（h-8）等高，用在筛选条里；
 * - `md`：稍大一档，用在承担「切换整块视图」职责的入口（货品 / 素材）。
 */
export function SegmentedToggle<T extends string>({
  label,
  items,
  value,
  onChange,
  size = 'sm',
  ariaLabel,
  className,
}: {
  /** 控件左侧的说明词（如「排序」）；不传就只渲染胶囊本体 */
  label?: string;
  items: ReadonlyArray<SegmentedItem<T>>;
  value: T;
  onChange: (next: T) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  className?: string;
}) {
  const outer = size === 'md' ? 'h-10 p-1' : 'h-8 p-0.5';
  const inner =
    size === 'md' ? 'h-8 px-5 text-[12.5px]' : 'h-7 px-3 text-[11.5px]';
  return (
    <div className={cn('flex shrink-0 items-center gap-1.5', className)}>
      {label ? (
        <span className="shrink-0 whitespace-nowrap text-[11px] text-fg-5">
          {label}
        </span>
      ) : null}
      <fieldset
        aria-label={ariaLabel ?? label}
        className={cn(
          'm-0 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-line-5 bg-fill-1',
          outer,
        )}
      >
        {items.map(item => (
          <button
            key={item.key}
            type="button"
            aria-pressed={item.key === value}
            title={item.hint}
            onClick={() => onChange(item.key)}
            className={cn(
              'inline-flex shrink-0 items-center whitespace-nowrap rounded-full transition-colors',
              inner,
              item.key === value
                ? 'bg-accent font-semibold text-accent-fg'
                : 'text-fg-3 hover:bg-fill-2 hover:text-fg',
            )}
          >
            {item.label}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/**
 * 分页按钮：**正圆**、等径，当前页 Blaze 实底高亮，其余浅描边空心。
 *
 * 从「首页 / 上一页」这种文字按钮换成圆形图标按钮的原因：
 * 文字按钮宽度各不相同（两字 vs 三字 vs 一位数 vs 三位数），一排下来参差不齐，
 * 而且中英混排里「首页」和页码「1」的视觉权重完全不对等。现在四个翻页动作
 * 一律用双箭头 / 单箭头图标，和页码共享同一个圆形尺寸，整排是等距圆点，
 * 页数从 1 位变到 3 位时也只是圆里的字变多，排布不跳。
 */
export function PagerButton({
  children,
  active,
  disabled,
  title,
  ariaLabel,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 min-w-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-1 text-[11.5px] tabular-nums leading-none transition-colors',
        /* 一位数时是正圆；页数上三位时才顺势拉成胶囊，而不是把数字压出边界 */
        '[&>span]:px-[2px]',
        active
          ? 'border-accent bg-accent font-semibold text-accent-fg'
          : 'border-line-5 bg-transparent text-fg-3 hover:border-accent-ring hover:bg-fill-2 hover:text-fg',
        disabled &&
          'cursor-not-allowed opacity-40 hover:border-line-5 hover:bg-transparent hover:text-fg-3',
      )}
    >
      {children}
    </button>
  );
}

/** 翻页箭头：单箭头 = 相邻一页，双箭头 = 直达首 / 末页；线性、随字色走 */
function PagerArrow({
  direction,
  double,
}: { direction: 'prev' | 'next'; double?: boolean }) {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      style={{
        transform: direction === 'next' ? 'scaleX(-1)' : undefined,
      }}
    >
      {double ? (
        <>
          <path d="M10.5 3.5 6 8l4.5 4.5" />
          <path d="M6.5 3.5 2 8l4.5 4.5" />
        </>
      ) : (
        <path d="M10 3.5 5.5 8l4.5 4.5" />
      )}
    </svg>
  );
}

/**
 * 分页控件（首页 / 上一页 / 页码 / 下一页 / 末页）。
 * 东南亚趋势品仪表盘、实时 Top 商品、实时 Top 素材三处共用，观感完全一致：
 * 一排等径圆点，两端是双箭头（直达首 / 末页）与单箭头（相邻页）。
 * 差别只有 `span`（当前页前后展示几个页码）。
 */
export function Pager({
  current,
  pageCount,
  onChange,
  span = 5,
  className,
}: {
  /** 0 基的当前页 */
  current: number;
  pageCount: number;
  onChange: (next: number) => void;
  span?: number;
  className?: string;
}) {
  const cur = current + 1;
  const start = Math.max(1, cur - span);
  const end = Math.min(pageCount, cur + span);
  const numbers: number[] = [];
  for (let p = start; p <= end; p += 1) {
    numbers.push(p);
  }
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1 overflow-x-auto pb-0.5',
        className,
      )}
    >
      <PagerButton
        disabled={current === 0}
        title="First page"
        ariaLabel="First page"
        onClick={() => onChange(0)}
      >
        <PagerArrow direction="prev" double />
      </PagerButton>
      <PagerButton
        disabled={current === 0}
        title="Previous page"
        ariaLabel="Previous page"
        onClick={() => onChange(current - 1)}
      >
        <PagerArrow direction="prev" />
      </PagerButton>
      {numbers.map(p => (
        <PagerButton
          key={p}
          active={p === cur}
          title={`Page ${p}`}
          onClick={() => onChange(p - 1)}
        >
          <span>{p}</span>
        </PagerButton>
      ))}
      <PagerButton
        disabled={current >= pageCount - 1}
        title="Next page"
        ariaLabel="Next page"
        onClick={() => onChange(current + 1)}
      >
        <PagerArrow direction="next" />
      </PagerButton>
      <PagerButton
        disabled={current >= pageCount - 1}
        title="Last page"
        ariaLabel="Last page"
        onClick={() => onChange(pageCount - 1)}
      >
        <PagerArrow direction="next" double />
      </PagerButton>
    </div>
  );
}

export type L1LegendItem = { name: string; count: number; color: string };

/**
 * CBEC L1 图例（可多选筛选）：气泡图、TOP 排名与价格区间共用这一个组件，
 * 保证三个模块的交互与观感完全一致 —— 点击图例项多选、默认不选即全选、
 * 全部取消自动视为全选（避免点成空图）、未选中项弱化成空心色环。
 *
 * ── 本轮改动：把图例做大、做成"看起来就能点"的按钮 ────────────────────
 * 旧版是 10.5px 纯文字 + 一个 10px 色点，浏览者看不出可交互。现在：
 * - 每一项都是**药丸按钮**（边框 + 底色 + hover 变色 + cursor-pointer），
 *   选中态用实底 + 更深的边框，未选中态是空心 + 半透明；
 * - 字号 10.5px → 12px，色点 10px → 12px，点按区域从"文字高度"扩到 26px 上下；
 * - 仍然保持**一排**（flex-wrap + overflow-x-auto），不抢主图表的视觉重心：
 *   按钮只有描边与浅底，没有阴影/渐变，颜色语义仍由色点承担。
 * - 选中态色点是**纯品牌原色、不加任何描边**（浅色下粉彩在白底对比度低，
 *   属既定设计取舍）；未选中态仍是「空心色环」这一既有的状态区分。
 */
export function L1Legend({
  items,
  active,
  onToggle,
  onReset,
  className,
}: {
  items: L1LegendItem[];
  /** 生效的选中集合（空数组 = 全选） */
  active: string[];
  onToggle: (name: string) => void;
  onReset: () => void;
  /** 外层样式覆写：需要与同排的其它控件（如气泡图的展示数量）拼在一行时用 */
  className?: string;
}) {
  const filtered = active.length > 0 && active.length < items.length;
  return (
    <div
      className={cn(
        'mb-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 overflow-x-auto text-[12px] text-fg-4',
        className,
      )}
    >
      <span className="shrink-0 text-[11px] text-fg-5">CBEC L1</span>
      <button
        type="button"
        onClick={onReset}
        aria-pressed={!filtered}
        title="Reset all L1 groups"
        className={cn(
          'shrink-0 cursor-pointer rounded-full border px-2.5 py-1 font-medium transition-colors',
          filtered
            ? 'border-line-5 bg-fill-1 text-fg-4 hover:border-accent-ring hover:text-fg-2'
            : 'border-line-8 bg-fill-3 text-fg-1',
        )}
      >
        All
      </button>
      {items.map(item => {
        const on = active.length === 0 || active.includes(item.name);
        return (
          <button
            key={item.name}
            type="button"
            data-l1={item.name}
            aria-pressed={on}
            onClick={() => onToggle(item.name)}
            title={`${item.name}（${item.count} trending categories) · Click to filter`}
            className={cn(
              'inline-flex min-w-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-colors',
              on
                ? 'border-line-6 bg-fill-1 text-fg-2 hover:border-accent-ring hover:text-fg'
                : 'border-line-4 bg-transparent text-fg-5 opacity-70 hover:border-line-6 hover:opacity-100',
            )}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{
                backgroundColor: on ? item.color : 'transparent',
                /* 选中态：纯原色实心、无描边；未选中态：空心色环（既有状态区分） */
                border: on ? undefined : `1.5px solid ${item.color}`,
              }}
            />
            <span className="truncate">{item.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** 数据待接入角标 */
export function PendingBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-info-border bg-info-bg px-2.5 py-1 text-[11px] font-medium text-info-fg">
      <span className="h-1.5 w-1.5 rounded-full bg-info-dot" />
      {text}
    </span>
  );
}

export function LoadingBlock({
  label,
  height = 240,
}: {
  label: string;
  height?: number;
}) {
  return (
    <div
      className="flex w-full flex-col items-center justify-center gap-3"
      style={{ height }}
    >
      <Skeleton className="h-2 w-40 bg-fill-3" />
      <p className="text-xs text-fg-4">{label}</p>
    </div>
  );
}

export function EmptyBlock({
  label,
  height = 240,
}: {
  label: string;
  height?: number;
}) {
  return (
    <div
      className="flex w-full items-center justify-center text-xs text-fg-5"
      style={{ height }}
    >
      {label}
    </div>
  );
}

/** 飞书两类权限失败与通用失败的中文引导 */
export function FailureBlock({
  error,
  sourceUrl,
  height = 240,
}: {
  error?: DataError;
  sourceUrl?: string;
  height?: number;
}) {
  return (
    <div className="flex w-full items-center justify-center" style={{ height }}>
      <Alert className="max-w-xl border-danger-border bg-danger-bg text-fg-1">
        <AlertTitle className="text-sm text-fg">Demo data could not be loaded</AlertTitle>
        <AlertDescription className="mt-1 text-xs leading-relaxed text-fg-3">
          {error?.message ?? 'Refresh the page to try again.'}
        </AlertDescription>
      </Alert>
    </div>
  );
}
