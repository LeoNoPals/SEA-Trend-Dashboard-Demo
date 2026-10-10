import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  type CategoryFilter,
  EMPTY_FILTER,
  FILTER_ALL,
} from '@/components/HeatmapModule';
import {
  CloseIconButton,
  EmptyBlock,
  Pager,
  SectionCard,
} from '@/components/common';
import {
  CountryCategoryFilterBar,
  DEFAULT_PAGE_SIZE,
  type PageSizeOption,
  PageSizeSelect,
  SELF_DEFAULT_COUNTRY,
} from '@/components/topFilters';
import type { CountryCode } from '@/data/market';
import { type TopProduct, formatPrice, largeImageUrl } from '@/data/topProduct';
import { DEMO_NOTICE } from '@/data/demo/history';
import { useModalDialog } from '@/hooks/useModalDialog';
import { DemoImage } from '@/components/DemoImage';
import { cn } from '@/lib/utils';

/**
 * 每页条数的默认值 = 100（大屏网格一行 5 张卡，正好 20 行）。
 * 现在这个值可由用户在卡片右上角的「每页」下拉里改成 50 / 100 / 200：
 * 窄屏列数变少、行数相应变多，但每页始终是同样的条数，翻页节奏不随屏宽漂移。
 */
const EMPTY_HEIGHT = 320;

/** 本模块自治的默认国家口径：SEA = 六国全量（与实时 Top 素材共用同一个常量） */
const DEFAULT_COUNTRY: CountryCode = SELF_DEFAULT_COUNTRY;

/**
 * 商品名模糊匹配：**空格分词、逐词 AND、大小写与多余空白全部无视**。
 *
 * 为什么不是整串 `includes`：底表里的商品名是一长串卖点堆叠
 * （"Wireless Earbuds Bluetooth 5.3 Noise Cancelling..."），商家心里想的是
 * 「earbuds + bluetooth」这两个词，但记不住它们在标题里的先后与中间夹了什么。
 * 拆词后每个词各自 `includes`、全部命中才算匹配，既能容忍词序，也不会像
 * 单串匹配那样一遇到中间多一个词就落空。
 */
function matchesName(name: string, tokens: string[]): boolean {
  if (tokens.length === 0) {
    return true;
  }
  const haystack = name.toLowerCase();
  return tokens.every(token => haystack.includes(token));
}

/** 卡片上的小标签（Bundle / 新品），样式与页面其它 chip 同源 */
function Tag({
  children,
  tone,
}: { children: string; tone: 'accent' | 'mute' }) {
  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-1.5 py-[1px] text-[10px] font-medium',
        tone === 'accent'
          ? 'border-accent-ring bg-accent-soft text-accent-text'
          : 'border-line-5 bg-fill-2 text-fg-3',
      )}
    >
      {children}
    </span>
  );
}

/**
 * 主图放大预览（灯箱）。
 *
 * AI image URLs contain generic prompts only. The overlay uses a semantic button
 * for click-away close and mounts through a portal to avoid grid clipping.
 */
function ImageLightbox({
  product,
  onClose,
}: {
  product: TopProduct;
  onClose: () => void;
}) {
  const dialogRef = useModalDialog(true);
  const [src, setSrc] = useState(() => largeImageUrl(product.image));

  useEffect(() => {
    setSrc(largeImageUrl(product.image));
  }, [product.image]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const breadcrumb = [product.l1, product.l2, product.l3]
    .filter(Boolean)
    .join(' › ');

  return createPortal(
    // biome-ignore lint/a11y/useSemanticElements: 原生 <dialog> 需要命令式 showModal()，与这里「由 React state 控制显隐 + portal 到 body」的模型不兼容
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Product image preview"
      data-image-lightbox="true"
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-8"
    >
      <button
        type="button"
        aria-label="Close image preview"
        onClick={onClose}
        className="absolute inset-0 cursor-zoom-out bg-black/80 backdrop-blur-sm"
      />
      <div className="relative z-10 flex max-h-full w-full max-w-[760px] flex-col items-center gap-3">
        <div className="flex max-h-[68vh] w-full items-center justify-center overflow-hidden rounded-xl border border-line-3 bg-card">
          <DemoImage
            src={src}
            fallbackSrc={product.image}
            alt={`${product.name} product image`}
            loading="eager"
            className="h-[min(58vh,600px)] w-full"
          />
        </div>
        <div className="w-full rounded-xl border border-line-3 bg-card px-4 py-3">
          <p lang="zh-CN" className="demo-inline-notice mb-2">{DEMO_NOTICE}</p>
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="min-w-0 truncate text-[11px] text-fg-5">
              {product.country} · {breadcrumb || 'Uncategorized'}
            </p>
            {/* 关闭入口统一成右上角的圆形叉号（点遮罩 / Esc 同样可关） */}
            <CloseIconButton onClick={onClose} ariaLabel="Close image preview" />
          </div>
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-[13.5px] font-medium leading-snug text-fg-1 transition-colors hover:text-accent-text hover:underline"
          >
            {product.name}
          </a>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[16px] font-bold tabular-nums text-accent-text">
              {formatPrice(product.price)}
            </span>
            {product.bundle ? <Tag tone="mute">Bundle</Tag> : null}
            {product.fresh ? <Tag tone="accent">New</Tag> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 单张商品卡。
 *
 * 四个刻意的取舍：
 * ① 图片区固定 1:1 比例 + 标题固定两行高度，卡片高度天然对齐，
 *    图裂 / 缺图时用中性占位块占住同样的位置，网格不会塌陷；
 * ② 图片区本身是一个 `<button>`：点击弹出放大预览（cursor-zoom-in + 悬浮提示条），
 *    缺图 / 图裂时退化为不可点的占位块，不给假入口；
 * ③ 卡片整体的 hover 反馈（描边变品牌色 + 底色轻微提亮）保留 ——
 *    卡上不再有任何悬浮才出现的数据，这层反馈是「这张卡可交互」的唯一提示；
 * ④ 卡片上的价格和标签 are generated locally from a fixed seed.
 */
function ProductCard({
  product,
  onZoom,
}: { product: TopProduct; onZoom: (product: TopProduct) => void }) {
  const [broken, setBroken] = useState(false);
  const breadcrumb = [product.l1, product.l2, product.l3]
    .filter(Boolean)
    .join(' › ');
  const zoomable = Boolean(product.image) && !broken;

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line-3 bg-card transition-colors duration-200 hover:border-accent-ring hover:bg-fill-1">
      {zoomable ? (
        <button
          type="button"
          onClick={() => onZoom(product)}
          title="Enlarge image"
          className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-fill-2"
        >
          <DemoImage
            src={product.image}
            alt={`${product.name} product image`}
            loading="lazy"
            className="h-full w-full"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/55 py-1 text-[10.5px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            Enlarge image
          </span>
        </button>
      ) : (
        <div className="relative aspect-square w-full overflow-hidden bg-fill-2">
          <div className="flex h-full w-full items-center justify-center text-[11px] text-fg-5">
            Image unavailable
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
        <p className="truncate text-[10.5px] text-fg-5" title={breadcrumb}>
          {breadcrumb || 'Uncategorized'}
        </p>
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          title={product.name}
          className="line-clamp-2 min-h-[2.6em] text-[12.5px] font-medium leading-[1.3] text-fg-1 transition-colors hover:text-accent-text hover:underline"
        >
          {product.name}
        </a>
        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
          <span className="text-[15px] font-bold tabular-nums text-accent-text">
            {formatPrice(product.price)}
          </span>
          {product.bundle ? <Tag tone="mute">Bundle</Tag> : null}
          {product.fresh ? <Tag tone="accent">New</Tag> : null}
        </div>
      </div>
    </article>
  );
}

function TopProductModuleImpl({
  products,
  sourceIds,
  fallback,
}: {
  /** Fully fictional products; this component only filters and paginates. */
  products: TopProduct[];
  sourceIds: string;
  fallback?: React.ReactNode;
}) {
  /**
   * 国家筛选是本模块**自治**的 state，刻意不接页面全局的 `country`：
   * 这份虚构商品数据与日历那套「国家 + 月份」联动的 TGI 口径没有关系，
   * 共用一个 state 会让「点日历里的节日」意外改掉商品列表，两边互相误导。
   * 因此上层不再传 country prop，本模块的切换也不会外溢到其它模块。
   */
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [filter, setFilter] = useState<CategoryFilter>(EMPTY_FILTER);
  /** 商品名关键词（原样保存用户输入，匹配时才做小写与分词） */
  const [keyword, setKeyword] = useState('');
  const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(0);
  /** 当前放大预览的商品；null = 灯箱关闭 */
  const [zoomed, setZoomed] = useState<TopProduct | null>(null);
  const moduleRef = useRef<HTMLDivElement | null>(null);

  /** 国家先收敛一层：类目下拉的可选项也只应包含该国真实存在的类目 */
  const scoped = useMemo(
    () =>
      country === 'SEA'
        ? products
        : products.filter(item => item.country === country),
    [products, country],
  );

  /** 关键词切成小写词元；空串 / 纯空格 = 不过滤 */
  const tokens = useMemo(
    () => keyword.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [keyword],
  );

  const filtered = useMemo(
    () =>
      scoped.filter(
        item =>
          (filter.l1 === FILTER_ALL || item.l1 === filter.l1) &&
          (filter.l2 === FILTER_ALL || item.l2 === filter.l2) &&
          (filter.l3 === FILTER_ALL || item.l3 === filter.l3) &&
          matchesName(item.name, tokens),
      ),
    [scoped, filter, tokens],
  );

  /**
   * 分页而不是无限瀑布流：每页条数由右上角的「每页」下拉决定（50 / 100 / 200，默认 100），
   * 页码常驻在筛选同排的行尾。
   */
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => filtered.slice(current * pageSize, current * pageSize + pageSize),
    [filtered, current, pageSize],
  );

  /** 换国家 / 换类目 / 改关键词 / 改每页条数后回到第一页（否则会停在一页空白上） */
  useEffect(() => {
    setPage(0);
  }, [country, filter, keyword, pageSize]);

  /**
   * 翻页后把视口拉回模块顶部 —— 不复位的话点「下一页」看到的是新一页的中段。
   * 首次挂载不滚（否则页面一加载就自己往下跳）。
   */
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) {
      moduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    mountedRef.current = true;
  }, [current]);

  const closeZoom = useCallback(() => setZoomed(null), []);

  const title =
    filtered.length > 0
      ? `Demo Top Products · ${country} · ${filtered.length.toLocaleString('en-US')} demo products`
      : 'Demo Top Products';

  const showPager = !fallback && filtered.length > 0;

  return (
    <div ref={moduleRef} className="scroll-mt-4">
      <SectionCard
        tag="Top Products · Demo"
        title={title}
        sourceIds={sourceIds}
        /* 页码组挪到标题右侧的空白区（SectionCard 的 extra 槽）：
           标题只有两三行、右边一直是空的，而筛选条本身已经占满一整排，
           两者挤在同一排时窄屏必然横向滚动。放到标题右侧后页码永远可见、
           不用先横滑找页码，筛选条也回到独占一排、不再被压缩。 */
        extra={
          showPager ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="whitespace-nowrap text-[11.5px] text-fg-4">
                Total {filtered.length.toLocaleString('en-US')} items · Page{' '}
                {current + 1} / {pageCount}
              </span>
              <PageSizeSelect value={pageSize} onChange={setPageSize} />
              <Pager
                current={current}
                pageCount={pageCount}
                onChange={setPage}
                span={5}
              />
            </div>
          ) : undefined
        }
        toolbar={
          <CountryCategoryFilterBar
            items={scoped}
            country={country}
            onCountryChange={setCountry}
            value={filter}
            onChange={setFilter}
            search={keyword}
            onSearchChange={setKeyword}
            searchPlaceholder="Search product name"
          />
        }
      >
        {fallback ??
          (filtered.length === 0 ? (
            <EmptyBlock
              label={
                tokens.length > 0
                  ? `No product matches all keywords: "${tokens.join('」「')}". Try another search or reset filters.`
                  : 'No products match these filters'
              }
              height={EMPTY_HEIGHT}
            />
          ) : (
            <div className="min-w-0 flex-1">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {/* 同一个 product_id 可能在底表里出现多行（不同口径的重复行），
                    所以 key 里带上位序，避免 React 复用错卡片 */}
                {visible.map((product, index) => (
                  <ProductCard
                    key={`${product.productId}-${index}`}
                    product={product}
                    onZoom={setZoomed}
                  />
                ))}
              </div>
            </div>
          ))}
      </SectionCard>
      {zoomed ? <ImageLightbox product={zoomed} onClose={closeZoom} /> : null}
    </div>
  );
}

export const TopProductModule = memo(TopProductModuleImpl);
