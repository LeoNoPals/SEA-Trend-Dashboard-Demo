import { useMemo } from 'react';

import { CountryFlag } from '@/components/CountryFlag';
import {
  type CategoryFilter,
  EMPTY_FILTER,
  FILTER_ALL,
} from '@/components/HeatmapModule';
import { ResetButton, SearchInput } from '@/components/common';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COUNTRY_CODES, type CountryCode } from '@/data/market';

/** 两个自治模块（实时 Top 商品 / 实时 Top 素材）共同的默认国家口径：SEA = 六国全量 */
export const SELF_DEFAULT_COUNTRY: CountryCode = 'SEA';

/** 筛选条只关心三级类目字段，商品行与素材行都满足这个最小形状 */
export type CategoryScoped = { l1: string; l2: string; l3: string };

/**
 * 每页展示条数的可选档位。
 *
 * 100 是既有默认值（大屏一行 5 张卡 = 20 行），刻意保持不变；50 给「只想扫一眼头部」
 * 的场景，200 给「一次多铺一屏、少翻页」的场景。不做更大的档位是因为卡片带图，
 * 再往上一页要拉几百张图，首屏观感反而更差。
 */
export const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSizeOption = 100;

/**
 * 「每页 N 条」下拉，实时 Top 商品与实时 Top 素材共用。
 * 放在页码组左侧而不是筛选条里：它调的是**翻页粒度**，和页码是一组，
 * 与「筛哪些数据」的国家 / 类目 / 关键词不是一回事。
 */
export function PageSizeSelect({
  value,
  onChange,
}: {
  value: PageSizeOption;
  onChange: (next: PageSizeOption) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="shrink-0 whitespace-nowrap text-[11px] text-fg-5">
        Per page
      </span>
      <Select
        value={String(value)}
        onValueChange={next => onChange(Number(next) as PageSizeOption)}
      >
        <SelectTrigger
          className="h-8 w-[110px] shrink-0 border-line-5 bg-fill-1 text-[12px] tabular-nums text-fg-2"
          aria-label="Items per page"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-line-3 bg-overlay text-fg-2">
          {PAGE_SIZE_OPTIONS.map(size => (
            <SelectItem key={size} value={String(size)}>
              <span className="tabular-nums">{size} items</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * 「国家 + CBEC L1/L2/L3」自治筛选条，实时 Top 商品与实时 Top 素材共用一套。
 *
 * 三个刻意的取舍：
 * ① 国家用的是**与三个类目筛选完全同一套下拉控件**（同样的 SelectTrigger 尺寸、边框、
 *    弹层配色），而不是日历顶部那种国旗 chip —— 同一排里混两种控件形态会让人以为
 *    这个国家筛选是全局入口；国旗仍然保留在选项里，辨识度不丢；
 * ② 国家项**只写国旗 + 国家码**（SEA / MY / TH / VN / PH / SG / ID），不带中文国名：
 *    页面本身就是给跨境商家看的，国家码是他们的日常口径，加中文只是把控件撑宽；
 * ③ 整排 `overflow-x-auto` 不换行：这是页面既有硬约束（筛选项同排、小屏横向滑动）。
 *
 * 类目级联行为与热力图 / 价格区间那两处完全一致（L1 变了就把 L2/L3 打回全部、下级选项
 * 按当前上级动态收敛、都带「全部」项），但入参是明细行而不是类目行，所以单独实现，
 * 不去改动既有模块的类型签名。
 */
export function CountryCategoryFilterBar({
  items,
  country,
  onCountryChange,
  value,
  onChange,
  search,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
}: {
  /** 已按当前国家收敛过的明细行，用于给类目下拉喂选项 */
  items: ReadonlyArray<CategoryScoped>;
  country: CountryCode;
  onCountryChange: (next: CountryCode) => void;
  value: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
  /**
   * 可选关键词搜索。传入这些 prop 才渲染搜索框；当前由商品模块用于商品名模糊搜索。
   * 控件本体、位置（类目下拉右侧、重置左侧）与「重置一并清空」的行为在这里收口。
   */
  search?: string;
  onSearchChange?: (next: string) => void;
  searchPlaceholder?: string;
  /** 搜索框的无障碍名称；不传时回落成 placeholder（见 SearchInput） */
  searchAriaLabel?: string;
}) {
  const options = useMemo(() => {
    const l1 = new Set<string>();
    const l2 = new Set<string>();
    const l3 = new Set<string>();
    for (const item of items) {
      if (item.l1) {
        l1.add(item.l1);
      }
      if (value.l1 === FILTER_ALL || item.l1 === value.l1) {
        if (item.l2) {
          l2.add(item.l2);
        }
      }
      if (
        (value.l1 === FILTER_ALL || item.l1 === value.l1) &&
        (value.l2 === FILTER_ALL || item.l2 === value.l2)
      ) {
        if (item.l3) {
          l3.add(item.l3);
        }
      }
    }
    const sort = (set: Set<string>) =>
      [...set].sort((a, b) => a.localeCompare(b, 'en-US'));
    return { l1: sort(l1), l2: sort(l2), l3: sort(l3) };
  }, [items, value.l1, value.l2]);

  const triggerClass =
    'h-8 w-[132px] shrink-0 border-line-5 bg-fill-1 text-[12px] text-fg-2';
  /** 只放国旗 + 国家码，控件比类目下拉窄一截就够 */
  const countryTriggerClass =
    'h-8 w-[104px] shrink-0 border-line-5 bg-fill-1 text-[12px] text-fg-2';
  const pristine =
    country === SELF_DEFAULT_COUNTRY &&
    value.l1 === FILTER_ALL &&
    value.l2 === FILTER_ALL &&
    value.l3 === FILTER_ALL &&
    !search;
  const searchable = Boolean(onSearchChange);

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-[11px] text-fg-5">Country</span>
      <Select
        value={country}
        onValueChange={next => onCountryChange(next as CountryCode)}
      >
        <SelectTrigger className={countryTriggerClass} aria-label="Country">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent className="border-line-3 bg-overlay text-fg-2">
          {COUNTRY_CODES.map(code => (
            <SelectItem key={code} value={code}>
              <span className="inline-flex items-center gap-1.5">
                <CountryFlag code={code} />
                {code}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* 竖分隔：提示「国家」与「类目」是两组筛选，但仍在同一排里 */}
      <span className="h-4 w-px shrink-0 bg-line-4" />
      <span className="shrink-0 text-[11px] text-fg-5">Category</span>
      <Select
        value={value.l1}
        onValueChange={next =>
          onChange({ l1: next, l2: FILTER_ALL, l3: FILTER_ALL })
        }
      >
        <SelectTrigger className={triggerClass} aria-label="CBEC L1">
          <SelectValue placeholder="CBEC L1" />
        </SelectTrigger>
        <SelectContent className="border-line-3 bg-overlay text-fg-2">
          <SelectItem value={FILTER_ALL}>All L1</SelectItem>
          {options.l1.map(item => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={value.l2}
        onValueChange={next => onChange({ ...value, l2: next, l3: FILTER_ALL })}
      >
        <SelectTrigger className={triggerClass} aria-label="CBEC L2">
          <SelectValue placeholder="CBEC L2" />
        </SelectTrigger>
        <SelectContent className="border-line-3 bg-overlay text-fg-2">
          <SelectItem value={FILTER_ALL}>All L2</SelectItem>
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
          <SelectItem value={FILTER_ALL}>All L3</SelectItem>
          {options.l3.map(item => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {searchable ? (
        /* 搜索框紧跟在类目下拉之后、重置之前：先「粗筛」（国家 / 类目）再「精找」（关键词），
           顺序与用户的实际动作一致；宽度给足一段商品名的可读长度，仍在同一排里横向滑动 */
        <SearchInput
          value={search ?? ''}
          onChange={next => onSearchChange?.(next)}
          placeholder={searchPlaceholder ?? 'Search'}
          ariaLabel={searchAriaLabel}
          className="w-[168px] sm:w-[204px]"
        />
      ) : null}
      <ResetButton
        disabled={pristine}
        title={
          searchable
            ? 'Reset to SEA and all categories; clear search'
            : 'Reset to SEA and all categories'
        }
        onClick={() => {
          onCountryChange(SELF_DEFAULT_COUNTRY);
          onChange(EMPTY_FILTER);
          onSearchChange?.('');
        }}
      />
    </div>
  );
}
