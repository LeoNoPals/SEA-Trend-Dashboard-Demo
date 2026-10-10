import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { CountryFlag } from '@/components/CountryFlag';
import {
  Chip,
  EmptyBlock,
  FailureBlock,
  LoadingBlock,
  SectionCard,
  SegmentedToggle,
} from '@/components/common';
import { MONTH_LABELS } from '@/data/dataset';
import {
  COUNTRY_CODES,
  COUNTRY_NAMES,
  type CountryCode,
  type FestivalBlock,
  type FestivalGroup,
  type GanttRow,
  type SeasonalPeakBar,
  buildCountryPeakRows,
  buildFestivalGroups,
  buildSeasonalPeakRows,
  findClimate,
  summarizeClimate,
} from '@/data/market';
import {
  type GanttTone,
  type ThemeMode,
  getCalendarColors,
  getFestivalBarTone,
  getGanttTone,
} from '@/data/theme';
import type { MarketContext } from '@/hooks/useDashboardData';
import { useThemeMode } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

/** 旺季营销节点的两种呈现视角 */
type GanttView = 'peak' | 'country';

const MONTH_COL = 'w-[112px] min-w-[112px] sm:w-[124px] sm:min-w-[124px]';
/** 第一列（节点类型）始终吸附在左侧 */
const TYPE_COL =
  'sticky left-0 w-[112px] min-w-[112px] sm:w-[132px] sm:min-w-[132px]';

/* ------------------------------------------------------------------ *
 * 日历表格字号（想整体微调日历字号，只改这一组常量即可）
 * ------------------------------------------------------------------ */
/** 月份表头 Jan.~Dec. */
const FONT_MONTH = 'text-[12.5px]';
/** 表头首格「节点类型 Type」 */
const FONT_HEAD = 'text-[12px]';
/** 分组中文名（六国共同节日 / 斋月国节日 / …） */
const FONT_GROUP = 'text-[13px]';
/** 分组英文名（Common / Ramadan · … / Seasonal Peaks） */
const FONT_GROUP_EN = 'text-[11px]';
/** 节日块中文名（常规：块内并列 1~2 个名字） */
const FONT_NAME = 'text-[12.5px]';
/** 节日块中文名（并列 3 个以上名字时收小一档，保证不溢出） */
const FONT_NAME_DENSE = 'text-[11.5px]';
/** 节日块英文副名 + 跨月区间 */
const FONT_NAME_EN = 'text-[10.5px]';
/** 节日块内的国家标签（MY / SG / ID …） */
const FONT_TAG = 'text-[10.5px]';
/** 跨月块内每一段右下角的月份标注 */
const FONT_SPAN = 'text-[9.5px]';

/** 节日块的车道高度（与旺季甘特条同一套实色条风格，两行文字刚好压住） */
const LANE_MIN_HEIGHT = 40;

/** 旺季甘特条带的车道高度（条带内只有国旗/区间，可比节日块矮一档） */
const SEASONAL_LANE_HEIGHT = 34;

/** 取分组 / 单个块的配色：跨类合并块单独用 mixed 档；节日块与旺季条同一套实色配色 */
function toneOf(
  mode: ThemeMode,
  group: FestivalGroup,
  block?: FestivalBlock,
): GanttTone {
  return getFestivalBarTone(block?.crossCategory ? 'mixed' : group.tone, mode);
}

/**
 * 同一分组内把节日块排进互不重叠的车道：
 * 跨月块要占多个月份列，单靠一行排不开，按区间贪心分配车道（类甘特图）。
 */
function packLanes(blocks: FestivalBlock[]): FestivalBlock[][] {
  const lanes: FestivalBlock[][] = [];
  const ordered = [...blocks].sort(
    (a, b) =>
      a.startMonthIndex - b.startMonthIndex ||
      b.monthSpan - a.monthSpan ||
      a.sortOrder - b.sortOrder,
  );
  for (const block of ordered) {
    const lane = lanes.find(items =>
      items.every(
        item =>
          item.endMonthIndex < block.startMonthIndex ||
          item.startMonthIndex > block.endMonthIndex,
      ),
    );
    if (lane) {
      lane.push(block);
    } else {
      lanes.push([block]);
    }
  }
  return lanes;
}

/**
 * 旺季甘特：把已排序的条带贪心排进互不重叠的车道（同一行内一个旺季的多段时段
 * 彼此错开）。与 packLanes 同一策略，但作用于任意含起止月的对象。
 */
function packBarLanes(bars: SeasonalPeakBar[]): SeasonalPeakBar[][] {
  const lanes: SeasonalPeakBar[][] = [];
  for (const bar of bars) {
    const lane = lanes.find(items =>
      items.every(
        item =>
          item.endMonthIndex < bar.startMonthIndex ||
          item.startMonthIndex > bar.endMonthIndex,
      ),
    );
    if (lane) {
      lane.push(bar);
    } else {
      lanes.push([bar]);
    }
  }
  return lanes;
}

/**
 * 节日块：与旺季营销节点的甘特条**同一套设计语言**——实色圆角条 + 条内自动配字色 +
 * 右侧起止月。跨月块（monthSpan > 1）横跨多个月份列，点击时按 x 坐标换算落在第几段，
 * 从而把「点左边 → 左边那个月、点右边 → 右边那个月」的诉求落到具体月份。
 */
function FestivalChip({
  block,
  tone,
  selected,
  showCountryTag,
  laneIndex,
  onPickMonth,
}: {
  block: FestivalBlock;
  tone: GanttTone;
  /** 当前全局月份筛选是否落在该块覆盖的月份内 */
  selected: boolean;
  showCountryTag: boolean;
  laneIndex: number;
  onPickMonth: (monthIndex: number) => void;
}) {
  const months = Array.from(
    { length: block.monthSpan },
    (_, index) => block.startMonthIndex + index,
  );
  const cross = block.monthSpan > 1;
  const text = selected ? tone.textActive : tone.text;
  const subText = selected ? tone.subTextActive : tone.subText;
  const tagBg = selected ? tone.tagBgActive : tone.tagBg;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = event.detail === 0 ? 0 : (event.clientX - rect.left) / Math.max(1, rect.width);
    const segment = Math.min(
      block.monthSpan - 1,
      Math.max(0, Math.floor(ratio * block.monthSpan)),
    );
    onPickMonth(block.startMonthIndex + segment);
  };

  const rangeText = cross
    ? `${MONTH_LABELS[block.startMonthIndex]} – ${MONTH_LABELS[block.endMonthIndex]}`
    : '';

  /** 合并进来的事件名并列展示（名字多时字号收小一档，保证一行内不溢出） */
  const namesCn = block.namesEn.length ? block.namesEn : [block.nameEn];
  const namesEn = block.namesEn.length ? block.namesEn : [block.nameEn];
  const manyNames = namesCn.length > 2;
  const nameCnText = namesCn.join(' / ');
  const nameEnText = namesEn.filter(Boolean).join(' / ');

  /**
   * 合并块（尤其旺季：跨国跨名按月窗口合并）只能在块面上并列名字，
   * tooltip 逐行列出「国家 + 旺季 + 真实起止日期」，避免商家看不出对应关系。
   */
  const tooltip =
    block.details.length > 1
      ? `${nameCnText}${rangeText ? `｜${rangeText}` : ''}\n${block.details.join('\n')}`
      : `${nameCnText} | ${block.startDate} ~ ${block.endDate} | ${block.countries.join(' / ')}`;

  return (
    <button
      type="button"
      data-festival={block.code}
      data-names={nameCnText}
      data-countries={block.countries.join(',')}
      data-span={block.monthSpan}
      data-months={months.join(',')}
      data-cross={cross ? 'true' : 'false'}
      title={tooltip}
      onClick={handleClick}
      style={{
        gridColumn: `${block.startMonthIndex + 1} / span ${block.monthSpan}`,
        gridRow: laneIndex + 1,
        background: selected ? tone.fillActive : tone.fill,
        borderColor: selected ? tone.borderActive : tone.border,
        boxShadow: selected ? tone.ringActive : undefined,
        color: text,
      }}
      /* 左内边距 = 胶囊圆角半径（车道 40px − 上下 my-3px = 34px 高，半径 17px）：
         原来 8px 时文字压在左端那段圆弧上，视觉上像被切了一刀；
         现在从"弧线结束的位置"起排文字。右侧仍是 8px，下方旺季甘特条不动。 */
      className="emph-hover relative mx-[2px] my-[3px] flex min-w-0 items-center justify-between gap-1 overflow-hidden rounded-full border py-1 pl-[18px] pr-2 text-left transition-colors"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-[3px]">
          {showCountryTag
            ? block.countries.map(code => (
                <span
                  key={code}
                  className={cn(
                    'shrink-0 rounded-full px-1 font-medium leading-[15px]',
                    FONT_TAG,
                  )}
                  style={{ background: tagBg, color: text }}
                >
                  {code}
                </span>
              ))
            : null}
          <span
            className={cn(
              'truncate font-medium leading-tight',
              manyNames ? FONT_NAME_DENSE : FONT_NAME,
            )}
            style={{ color: text }}
          >
            {nameCnText}
          </span>
        </span>
        {block.startDate ? (
          <span
            className={cn('truncate leading-tight', FONT_NAME_EN)}
            style={{ color: subText }}
          >
            {block.startDate.slice(5)}{block.endDate !== block.startDate ? ` – ${block.endDate.slice(5)}` : ''}
          </span>
        ) : null}
      </span>
      {rangeText ? (
        <span
          className={cn('shrink-0 font-medium leading-none', FONT_SPAN)}
          style={{ color: subText }}
        >
          {rangeText}
        </span>
      ) : null}
    </button>
  );
}

/**
 * 甘特条带：一条横跨其起止月的**实色**圆角条，点击按 x 坐标落到具体月份。
 * 两种视角共用这一个组件，只有条内写什么不同：
 * - 按旺季甘特（行=旺季）：条上写覆盖的国家码（SEA 视图）或起止月（单国视图）；
 * - 按国家甘特（行=国家）：条上写旺季中英文名 + 起止月。
 */
function GanttBar({
  bar,
  view,
  tone,
  selected,
  showCountryTag,
  laneIndex,
  onPickMonth,
}: {
  bar: SeasonalPeakBar;
  view: GanttView;
  tone: GanttTone;
  selected: boolean;
  showCountryTag: boolean;
  laneIndex: number;
  onPickMonth: (monthIndex: number) => void;
}) {
  const months = Array.from(
    { length: bar.monthSpan },
    (_, index) => bar.startMonthIndex + index,
  );
  const cross = bar.monthSpan > 1;
  const rangeText = cross
    ? `${MONTH_LABELS[bar.startMonthIndex]} – ${MONTH_LABELS[bar.endMonthIndex]}`
    : MONTH_LABELS[bar.startMonthIndex];
  const text = selected ? tone.textActive : tone.text;
  const subText = selected ? tone.subTextActive : tone.subText;
  const tagBg = selected ? tone.tagBgActive : tone.tagBg;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = event.detail === 0 ? 0 : (event.clientX - rect.left) / Math.max(1, rect.width);
    const segment = Math.min(
      bar.monthSpan - 1,
      Math.max(0, Math.floor(ratio * bar.monthSpan)),
    );
    onPickMonth(bar.startMonthIndex + segment);
  };

  const tooltip = `${bar.peakEn} | ${rangeText}\n${bar.details.join('\n')}`;

  return (
    <button
      type="button"
      data-seasonal={bar.peakCn}
      data-countries={bar.countries.join(',')}
      data-span={bar.monthSpan}
      data-months={months.join(',')}
      data-cross={cross ? 'true' : 'false'}
      title={tooltip}
      onClick={handleClick}
      style={{
        gridColumn: `${bar.startMonthIndex + 1} / span ${bar.monthSpan}`,
        gridRow: laneIndex + 1,
        background: selected ? tone.fillActive : tone.fill,
        borderColor: selected ? tone.borderActive : tone.border,
        boxShadow: selected ? tone.ringActive : undefined,
        color: text,
      }}
      className="emph-hover relative mx-[3px] my-[3px] flex min-w-0 items-center justify-between gap-1.5 overflow-hidden rounded-full border px-2 py-1 text-left transition-colors"
    >
      <span className="flex min-w-0 items-center gap-1">
        {view === 'country' ? (
          <>
            <span
              className={cn('truncate font-medium leading-tight', FONT_NAME)}
              style={{ color: text }}
            >
              {bar.peakEn}
            </span>
          </>
        ) : showCountryTag ? (
          bar.countries.map(code => (
            <span
              key={code}
              className={cn(
                'rounded-full px-1.5 font-medium leading-[15px]',
                FONT_TAG,
              )}
              style={{ background: tagBg, color: text }}
            >
              {code}
            </span>
          ))
        ) : (
          /* 单国视角的按旺季甘特：行首已经写了旺季名，条上只留右侧起止月 */
          <span className="sr-only">{bar.peakEn}</span>
        )}
      </span>
      <span
        className={cn('shrink-0 font-medium leading-none', FONT_SPAN)}
        style={{ color: subText }}
      >
        {rangeText}
      </span>
    </button>
  );
}

/** 气候信息卡：选中具体国家 + 月份时出现；底色按国家所属类别分色 */
function ClimateCard({
  context,
  country,
  monthIndex,
}: {
  context: MarketContext;
  country: CountryCode;
  monthIndex: number;
}) {
  const colors = getCalendarColors(useThemeMode());
  const row = findClimate(context.climate, country, monthIndex + 1);
  const tone = context.ramadanMarkets.has(country)
    ? colors.ramadan
    : colors.nonRamadan;
  if (!row) {
    return null;
  }
  const rawTemp =
    row.tempDisplay || `${row.tempMin ?? '—'}~${row.tempMax ?? '—'}`;
  const humidityText =
    row.humidityMin !== null && row.humidityMax !== null
      ? `${Math.round(row.humidityMin)}~${Math.round(row.humidityMax)}%`
      : row.humidityDisplay || '—';
  const uvText =
    row.uvMin !== null && row.uvMax !== null
      ? `${row.uvMin.toFixed(1)}~${row.uvMax.toFixed(1)}`
      : row.uvDisplay || '—';
  const items: Array<[string, string]> = [
    ['Temperature', /[℃°]/.test(rawTemp) ? rawTemp : `${rawTemp}℃`],
    ['Humidity', humidityText],
    [
      'Rainfall',
      row.precipitation === null ? '—' : `${Math.round(row.precipitation)}mm`,
    ],
    ['UV', uvText],
    ['Season', row.season || '—'],
  ];
  return (
    <div
      data-climate={country}
      className="h-full w-full overflow-hidden rounded-lg border p-3"
      style={{ background: tone.panelBg, borderColor: tone.panelBorder }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-fg-1">
          {COUNTRY_NAMES[country]} · {MONTH_LABELS[monthIndex]} Climate
        </p>
        <span className="text-[10px] text-fg-5">2026</span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {items.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <p className="text-[10px] text-fg-5">{label}</p>
            <p
              className="truncate text-[11.5px] font-medium text-fg-1"
              title={value}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
      <p
        className="mt-2 line-clamp-2 text-[11px] leading-relaxed"
        style={{ color: tone.text }}
      >
        {summarizeClimate(row)}
      </p>
    </div>
  );
}

function CalendarModuleImpl({
  context,
  country,
  monthIndex,
  onCountryChange,
  onMonthChange,
  sourceUrl,
}: {
  context: MarketContext;
  country: CountryCode;
  monthIndex: number | null;
  onCountryChange: (next: CountryCode) => void;
  onMonthChange: (next: number | null) => void;
  sourceUrl?: string;
}) {
  const mode = useThemeMode();
  const colors = getCalendarColors(mode);
  const groups = useMemo(
    () =>
      /**
       * 空分组直接不出行：例如选新加坡时底表里没有 SG 本国节日，
       * 与其留一行「暂无数据」占着高度，不如整行去掉（旺季行由甘特数据自己决定）。
       */
      buildFestivalGroups(
        context.festivals,
        country,
        context.ramadanMarkets,
      ).filter(group => group.id === 'seasonal' || group.blocks.length > 0),
    [context.festivals, context.ramadanMarkets, country],
  );

  /**
   * 旺季营销节点的甘特行：两种视角同源数据、不同聚合，都天然不重不漏。
   * - peak：一个旺季一行，行内条带按「同旺季 + 同起止月」合并多国；
   * - country：一个国家一行，行内每条原始记录一条条带（条上写旺季名）。
   */
  const seasonalRows = useMemo(
    () => buildSeasonalPeakRows(context.festivals, country),
    [context.festivals, country],
  );
  const countryRows = useMemo(
    () => buildCountryPeakRows(context.festivals, country),
    [context.festivals, country],
  );

  /** 顶部小切换器：按旺季甘特（默认） ↔ 按国家甘特 */
  const [seasonalView, setSeasonalView] = useState<GanttView>('peak');
  const ganttRows: GanttRow[] =
    seasonalView === 'peak' ? seasonalRows : countryRows;

  const selectedFestivalCount = useMemo(
    () =>
      monthIndex === null
        ? 0
        : groups.reduce(
            (sum, group) =>
              sum +
              group.blocks.filter(
                block =>
                  block.startMonthIndex <= monthIndex &&
                  block.endMonthIndex >= monthIndex,
              ).length,
            0,
          ),
    [groups, monthIndex],
  );

  /** 点节日 / 月份表头：再次点同一月份取消筛选 */
  const pickMonth = useCallback(
    (next: number) => {
      onMonthChange(monthIndex === next ? null : next);
    },
    [monthIndex, onMonthChange],
  );

  /** 用 state 持有节点：数据加载完成后表格才挂载，callback ref 能保证测量时机 */
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [scroll, setScroll] = useState({ left: 0, client: 1, total: 1 });

  const syncEdge = useCallback(() => {
    if (!scrollEl) {
      return;
    }
    setScroll({
      left: scrollEl.scrollLeft,
      client: scrollEl.clientWidth,
      total: scrollEl.scrollWidth,
    });
  }, [scrollEl]);

  useEffect(() => {
    if (!scrollEl) {
      return;
    }
    syncEdge();
    const raf = requestAnimationFrame(syncEdge);
    const timer = window.setTimeout(syncEdge, 300);
    const observer = new ResizeObserver(syncEdge);
    observer.observe(scrollEl);
    if (scrollEl.firstElementChild) {
      observer.observe(scrollEl.firstElementChild);
    }
    window.addEventListener('resize', syncEdge);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', syncEdge);
    };
  }, [scrollEl, syncEdge]);

  /** 选中的月份若在可视区外，自动滚动到可见位置 */
  useEffect(() => {
    if (!scrollEl || monthIndex === null) {
      return;
    }
    const cell = scrollEl.querySelector<HTMLElement>(
      `th[data-month="${monthIndex}"]`,
    );
    if (!cell) {
      return;
    }
    const cellLeft = cell.offsetLeft;
    const cellRight = cellLeft + cell.offsetWidth;
    const viewLeft = scrollEl.scrollLeft + 140;
    const viewRight = scrollEl.scrollLeft + scrollEl.clientWidth - 40;
    if (cellRight > viewRight) {
      scrollEl.scrollLeft += cellRight - viewRight;
    } else if (cellLeft < viewLeft) {
      scrollEl.scrollLeft -= viewLeft - cellLeft;
    }
  }, [scrollEl, monthIndex]);

  const maxScroll = Math.max(0, scroll.total - scroll.client);
  const edge = {
    start: scroll.left <= 2,
    end: scroll.left >= maxScroll - 2,
  };
  const scrollable = maxScroll > 2;
  const thumbWidth = scrollable
    ? Math.max(12, (scroll.client / scroll.total) * 100)
    : 100;
  const thumbLeft = scrollable
    ? (scroll.left / maxScroll) * (100 - thumbWidth)
    : 0;

  const [dragging, setDragging] = useState(false);

  /** 点击/拖动自绘滚动条：把轨道上的位置映射成 scrollLeft */
  const seek = useCallback(
    (clientX: number, track: HTMLElement) => {
      if (!scrollEl) {
        return;
      }
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)),
      );
      scrollEl.scrollLeft =
        ratio * (scrollEl.scrollWidth - scrollEl.clientWidth);
    },
    [scrollEl],
  );

  const onTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    seek(event.clientX, event.currentTarget);
  };

  const onTrackPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) {
      seek(event.clientX, event.currentTarget);
    }
  };

  const endTrackDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const scrollBy = (direction: 1 | -1) => {
    if (!scrollEl) {
      return;
    }
    scrollEl.scrollBy({
      left: direction * Math.max(240, scrollEl.clientWidth * 0.6),
    });
  };

  const title =
    monthIndex === null
      ? `${COUNTRY_NAMES[country]} · ${groups.reduce((s, g) => s + g.blocks.length, 0)} calendar events · Click an event to select its month`
      : `${MONTH_LABELS[monthIndex]} · ${selectedFestivalCount} calendar events · Global month filter active`;

  const body = () => {
    if (context.failure && context.festivals.length === 0) {
      return (
        <FailureBlock
          error={context.failure}
          sourceUrl={sourceUrl}
          height={280}
        />
      );
    }
    if (context.loading && context.festivals.length === 0) {
      return <LoadingBlock label="Loading calendar and climate…" height={280} />;
    }
    if (context.festivals.length === 0) {
      return <EmptyBlock label="No calendar events available" height={280} />;
    }

    return (
      <div className="relative min-w-0">
        {/* 旺季营销节点的呈现视角切换：按旺季甘特 ↔ 按国家甘特（统一的大圆角分段控件） */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <SegmentedToggle
            label="Seasonal peaks"
            ariaLabel="Seasonal calendar view"
            value={seasonalView}
            onChange={setSeasonalView}
            items={[
              {
                key: 'peak' as const,
                label: 'By season',
                hint: 'One row per season; bars show the countries',
              },
              {
                key: 'country' as const,
                label: 'By country',
                hint: 'One row per country; bars show the seasons',
              },
            ]}
          />
        </div>
        <div
          id="calendar-scroll"
          ref={setScrollEl}
          onScroll={syncEdge}
          className="cal-scroll relative overflow-x-auto rounded-lg border border-line-3"
        >
          <table className="w-max border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                <th
                  className={cn(
                    TYPE_COL,
                    FONT_HEAD,
                    "z-30 border-b border-r border-line-3 bg-inset px-3 py-2 font-medium text-fg-4 after:absolute after:-right-3 after:top-0 after:h-full after:w-3 after:bg-gradient-to-r after:from-fade after:to-transparent after:content-['']",
                  )}
                >
                  Event type
                </th>
                {MONTH_LABELS.map((label, index) => (
                  <th
                    key={label}
                    data-month={index}
                    aria-current={monthIndex === index ? 'true' : undefined}
                    className={cn(
                      MONTH_COL,
                      FONT_MONTH,
                      'border-b border-r px-2 py-2 text-center transition-colors',
                      monthIndex === index
                        ? 'border-accent bg-accent font-bold text-accent-fg'
                        : 'border-line-3 bg-inset font-semibold text-fg-3',
                    )}
                  >
                    <button
                      type="button"
                      className="w-full"
                      onClick={() => pickMonth(index)}
                    >
                      {label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(group => {
                const groupTone = toneOf(mode, group);

                /**
                 * 旺季营销节点：按当前视角展开成多行甘特（一行一色）。
                 * 复用与其它分组行完全一致的「月份背景层 + 定位层」结构，
                 * 保证 12 个月列与表头严格对齐。
                 */
                if (group.id === 'seasonal') {
                  return ganttRows.map((row, rowIndex) => {
                    const lanes = packBarLanes(row.bars);
                    const rowTone = getGanttTone(seasonalView, row.key, mode);
                    /**
                     * 按国家甘特的行首写法分两种：
                     * - SEA（六国各一行）：保持现状「国旗 + 国家名」，靠国旗快速区分六行；
                     * - 已选中具体国家（只有一行）：顶部筛选已经明确是哪个国家，
                     *   行首不再重复国旗，中文标题直接写成「国家名 + 旺季营销节点」。
                     */
                    const countryGantt = seasonalView === 'country';
                    const singleCountry = countryGantt && country !== 'SEA';
                    const labelCn = row.labelEn;
                    return (
                      <tr
                        key={row.id}
                        className="align-top"
                        data-seasonal-row={row.key}
                      >
                        <td
                          className={cn(
                            TYPE_COL,
                            "z-20 border-b border-r border-line-3 bg-card px-3 py-2.5 after:absolute after:-right-3 after:top-0 after:h-full after:w-3 after:bg-gradient-to-r after:from-fade after:to-transparent after:content-['']",
                          )}
                        >
                          <p
                            className={cn(
                              'flex items-center gap-1.5 font-semibold text-fg-1',
                              FONT_GROUP,
                            )}
                          >
                            <span
                              className="h-[0.95em] w-[3px] shrink-0 rounded-full"
                              style={{ background: rowTone.accent }}
                            />
                            {countryGantt && !singleCountry ? (
                              <CountryFlag code={row.key as CountryCode} />
                            ) : null}
                            {labelCn}
                          </p>
                          <p
                            className={cn(
                              'mt-0.5',
                              FONT_GROUP_EN,
                            )}
                            style={{ color: rowTone.accent }}
                          >
                            {countryGantt ? 'Seasonal peaks' : 'Marketing season'}
                          </p>
                        </td>
                        <td
                          colSpan={12}
                          className="relative border-b border-r border-line-3 p-0 align-top"
                        >
                          <div className="pointer-events-none absolute inset-0 grid grid-cols-12">
                            {MONTH_LABELS.map((label, index) => (
                              <div
                                key={label}
                                className={cn(
                                  index < 11 && 'border-r border-line-3',
                                )}
                                style={{
                                  background:
                                    monthIndex === index
                                      ? colors.selectedMonth
                                      : undefined,
                                }}
                              />
                            ))}
                          </div>
                          <div
                            className="relative grid grid-cols-12"
                            style={{
                              gridTemplateRows: `repeat(${Math.max(1, lanes.length)}, minmax(${SEASONAL_LANE_HEIGHT}px, auto))`,
                            }}
                          >
                            {lanes.map((lane, laneIndex) =>
                              lane.map(bar => (
                                <GanttBar
                                  key={bar.id}
                                  bar={bar}
                                  view={seasonalView}
                                  tone={rowTone}
                                  selected={
                                    monthIndex !== null &&
                                    bar.startMonthIndex <= monthIndex &&
                                    bar.endMonthIndex >= monthIndex
                                  }
                                  showCountryTag={group.showCountryTag}
                                  laneIndex={laneIndex}
                                  onPickMonth={pickMonth}
                                />
                              )),
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  });
                }

                const lanes = packLanes(group.blocks);
                return (
                  <tr key={group.id} className="align-top">
                    <td
                      className={cn(
                        TYPE_COL,
                        "z-20 border-b border-r border-line-3 bg-card px-3 py-3 after:absolute after:-right-3 after:top-0 after:h-full after:w-3 after:bg-gradient-to-r after:from-fade after:to-transparent after:content-['']",
                      )}
                    >
                      <p
                        className={cn(
                          'flex items-center gap-1.5 font-semibold text-fg-1',
                          FONT_GROUP,
                        )}
                      >
                        <span
                          className="h-[0.95em] w-[3px] shrink-0 rounded-full"
                          style={{ background: groupTone.accent }}
                        />
                        {group.label}
                      </p>
                      <p
                        className={cn(
                          'mt-0.5',
                          FONT_GROUP_EN,
                        )}
                        style={{ color: groupTone.accent }}
                      >
                        {group.labelEn}
                      </p>
                    </td>
                    {/*
                      12 个月合成一个 td：跨月节日要作为一个连续色块横跨多个月份列，
                      逐月单元格的结构做不到，改成「月份列背景层 + 节日块定位层」两层网格，
                      两层都是 grid-cols-12，列边界与表头 12 个月份列严格对齐。
                    */}
                    <td
                      colSpan={12}
                      className="relative border-b border-r border-line-3 p-0 align-top"
                    >
                      <div className="pointer-events-none absolute inset-0 grid grid-cols-12">
                        {MONTH_LABELS.map((label, index) => (
                          <div
                            key={label}
                            className={cn(
                              index < 11 && 'border-r border-line-3',
                            )}
                            style={{
                              background:
                                monthIndex === index
                                  ? colors.selectedMonth
                                  : undefined,
                            }}
                          />
                        ))}
                      </div>
                      <div
                        className="relative grid grid-cols-12"
                        style={{
                          gridTemplateRows: `repeat(${Math.max(1, lanes.length)}, minmax(${LANE_MIN_HEIGHT}px, auto))`,
                        }}
                      >
                        {lanes.length === 0 ? (
                          <p className="col-span-12 flex items-center px-3 text-[11px] text-fg-5">
                            No events in this group
                          </p>
                        ) : null}
                        {lanes.map((lane, laneIndex) =>
                          lane.map(block => (
                            <FestivalChip
                              key={block.id}
                              block={block}
                              tone={toneOf(mode, group, block)}
                              selected={
                                monthIndex !== null &&
                                block.startMonthIndex <= monthIndex &&
                                block.endMonthIndex >= monthIndex
                              }
                              showCountryTag={group.showCountryTag}
                              laneIndex={laneIndex}
                              onPickMonth={pickMonth}
                            />
                          )),
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 右侧渐隐蒙层 + 箭头：提示日历还可以继续向右滑动 */}
        {scrollable && !edge.end ? (
          <>
            <div className="scroll-fade-right pointer-events-none absolute bottom-6 right-px top-px w-16 rounded-r-lg" />
            <button
              type="button"
              aria-label="Scroll calendar right"
              onClick={() => scrollBy(1)}
              className="absolute right-2 top-[calc(50%-12px)] z-40 -translate-y-1/2 rounded-full border border-line-6 bg-inset px-2.5 py-1.5 text-[13px] leading-none text-fg-2 transition-colors hover:border-accent hover:text-fg"
            >
              ›
            </button>
          </>
        ) : null}
        {scrollable && !edge.start ? (
          <button
            type="button"
            aria-label="Scroll calendar left"
            onClick={() => scrollBy(-1)}
            className="absolute left-[118px] top-[calc(50%-12px)] z-40 -translate-y-1/2 rounded-full border border-line-6 bg-inset px-2.5 py-1.5 text-[13px] leading-none text-fg-2 transition-colors hover:border-accent hover:text-fg sm:left-[138px]"
          >
            ‹
          </button>
        ) : null}

        {/* 常驻横向滚动条：明确告知日历可以左右滑动，且当前只看到一部分月份 */}
        {scrollable ? (
          <div className="mt-2 flex items-center gap-3">
            <div
              role="scrollbar"
              tabIndex={0}
              aria-label="Calendar horizontal scrollbar"
              aria-controls="calendar-scroll"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((scroll.left / (maxScroll || 1)) * 100)}
              className="relative h-2 min-w-0 flex-1 cursor-pointer rounded-full bg-fill-3"
              onKeyDown={event => {
                if (!scrollEl) return;
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) event.preventDefault();
                if (event.key === 'ArrowLeft') scrollBy(-1);
                if (event.key === 'ArrowRight') scrollBy(1);
                if (event.key === 'Home') scrollEl.scrollLeft = 0;
                if (event.key === 'End') scrollEl.scrollLeft = maxScroll;
              }}
              onPointerDown={onTrackPointerDown}
              onPointerMove={onTrackPointerMove}
              onPointerUp={endTrackDrag}
              onPointerCancel={endTrackDrag}
            >
              <div
                className="pointer-events-none absolute top-0 h-2 rounded-full bg-accent-thumb"
                style={{ width: `${thumbWidth}%`, left: `${thumbLeft}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] text-fg-5">
              Drag to explore all 12 months
            </span>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <SectionCard
      tag="SEA Marketing Calendar"
      title={title}
      sourceIds="festivals,climate"
      toolbar={
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/*
              国家与月份**分成上下两排**（曾并成一排，用户反馈还是两排好读，已改回）：
              7 个国家 + 12 个月份挤在一行时，一屏放不下就得横向滑动才能看到后面的月份，
              而这两组是全局筛选、必须一眼全见。每一排自己 overflow-x-auto，
              窄屏各自横向滑动、都不折行（页面既有硬约束）。
            */}
            {/* 第一行：国家 */}
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5">
              <span className="shrink-0 text-[11px] text-fg-5">Country</span>
              {COUNTRY_CODES.map(code => (
                <Chip
                  key={code}
                  active={country === code}
                  onClick={() => onCountryChange(code)}
                  title={COUNTRY_NAMES[code]}
                  icon={<CountryFlag code={code} />}
                >
                  {code}
                </Chip>
              ))}
            </div>
            {/* 第二行：月份 */}
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5">
              <span className="shrink-0 text-[11px] text-fg-5">Month</span>
              {MONTH_LABELS.map((label, index) => (
                <Chip
                  key={label}
                  active={monthIndex === index}
                  onClick={() => pickMonth(index)}
                >
                  {label}
                </Chip>
              ))}
            </div>
            <p className="max-w-[560px] text-[11px] leading-relaxed text-fg-5">
              Scroll to explore all 12 months. Click an event or month to filter; click again to clear. For multi-month events, click the relevant month segment.
            </p>
          </div>
          {/*
            气候位固定预留：无论是否选中具体国家 + 月份都占同样的空间，
            气候卡出现 / 消失都不会挤动筛选行与日历。
          */}
          <div className="h-[124px] w-full shrink-0 lg:w-[420px]">
            {country !== 'SEA' && monthIndex !== null ? (
              <ClimateCard
                context={context}
                country={country}
                monthIndex={monthIndex}
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line-3 px-3 text-center text-[11px] leading-relaxed text-fg-5">
                Select a country and month to view climate information
              </div>
            )}
          </div>
        </div>
      }
    >
      {body()}
    </SectionCard>
  );
}

export const CalendarModule = memo(CalendarModuleImpl);
