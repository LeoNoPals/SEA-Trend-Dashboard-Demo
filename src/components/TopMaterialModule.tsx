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
import { DEMO_NOTICE } from '@/data/demo/history';
import { useModalDialog } from '@/hooks/useModalDialog';
import { DemoImage } from '@/components/DemoImage';
import {
  type TopMaterial,
  formatDuration,
  formatRate,
} from '@/data/topMaterial';

const EMPTY_HEIGHT = 320;

/** 本模块自治的默认国家口径：SEA = 六国全量 */
const DEFAULT_COUNTRY: CountryCode = SELF_DEFAULT_COUNTRY;

/** 播放三角：叠在封面上（以及无封面时的占位块里），说明「这是一条可播放的视频」 */
function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
    </svg>
  );
}

/**
 * 单个核心指标：**一行一个「标签 — 数值」**，标签左、数值右，中间用一条细虚线连起来。
 *
 * 为什么从原来的「小方格」改成这种两列对齐的行（本轮改版）：
 * 方格版把 7 个指标塞进 4+3 两行、每格宽度只有 ~70px，标签「50% 留存」和数值
 * 「21.35%」双双被 `truncate` 截成「50% 留…」「21.3…」—— 用户截图指出的正是这个。
 * 换成整行后每个指标独占一行的宽度，标签与数值都 `whitespace-nowrap` 且**不再截断**，
 * 数值还能顺势加大到 13px、右对齐 + tabular-nums，同一列上下扫视时小数点是对齐的。
 *
 * 颜色语义沿用原来的语义色：CTR / CVR（转化侧）用品牌红，播放侧指标用荧光青。
 */
function Metric({
  label,
  value,
  tone,
}: { label: string; value: string; tone: 'accent' | 'info' }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5 border-line-4 border-b border-dashed py-[3.5px] last:border-b-0">
      <span className="whitespace-nowrap text-[11px] leading-none text-fg-5">
        {label}
      </span>
      <span className="min-w-0 flex-1" />
      <span
        className={`whitespace-nowrap text-[13px] font-bold leading-none tabular-nums ${
          tone === 'accent' ? 'text-accent-text' : 'text-info-fg'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * 一张素材的**七个核心指标**，卡片与预览浮层共用同一份排布（口径与顺序必须一致）：
 * 视频长度 / 3s 留存 / 50% 留存 / 75% 留存 / 完播率 / CTR / CVR。
 *
 * 版式：**单列七行**的「标签—数值」表。刻意不做两列 ——
 * 两列在窄卡片上又会把每格压回 80px 上下、重新出现截断，而 Tailwind 的断点是按
 * **视口**而不是按卡片宽度生效的，卡片列数一变就会失控。单列的最小宽度只有
 * 「最长标签 + 最长数值」（约 100px），任何断点下都装得下，7 个指标因此永远完整可读。
 *
 * 所有数值由固定随机种子生成，刷新后保持稳定。
 */
export function MaterialMetrics({ material }: { material: TopMaterial }) {
  return (
    <div className="flex min-w-0 flex-col">
      <Metric
        label="Demo duration"
        value={formatDuration(material.duration)}
        tone="info"
      />
      <Metric
        label="3s retention"
        value={formatRate(material.play3sRate)}
        tone="info"
      />
      <Metric
        label="50% retention"
        value={formatRate(material.play50)}
        tone="info"
      />
      <Metric
        label="75% retention"
        value={formatRate(material.play75)}
        tone="info"
      />
      <Metric
        label="Completion"
        value={formatRate(material.playover)}
        tone="info"
      />
      <Metric label="CTR" value={formatRate(material.ctr)} tone="accent" />
      <Metric label="CVR" value={formatRate(material.cvr)} tone="accent" />
    </div>
  );
}

/**
 * Local creative preview. The iframe loads this demo's own animated player;
 * it never connects to a source video platform.
 */
function MaterialPreview({
  material,
  onClose,
}: {
  material: TopMaterial;
  onClose: () => void;
}) {
  const dialogRef = useModalDialog(true);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [material.videoUrl]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source === playerRef.current?.contentWindow && event.origin === window.location.origin && event.data === 'demo-player-close') onClose();
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onClose]);

  const breadcrumb = [material.l1, material.l2, material.l3]
    .filter(Boolean)
    .join(' › ');

  return createPortal(
    // biome-ignore lint/a11y/useSemanticElements: 原生 <dialog> 需要命令式 showModal()，与这里「由 React state 控制显隐 + portal 到 body」的模型不兼容
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Creative preview"
      data-material-preview="true"
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-8"
    >
      <button
        type="button"
        aria-label="Close creative preview"
        onClick={onClose}
        className="absolute inset-0 cursor-zoom-out bg-black/80 backdrop-blur-sm"
      />
      <div className="demo-material-dialog relative z-10 flex max-h-full w-full max-w-[980px] flex-col items-center gap-3 overflow-y-auto sm:flex-row sm:items-start sm:justify-center">
        {/* Local player uses a stable portrait preview frame on desktop and mobile. */}
        <div className="demo-player-frame relative w-full max-w-[520px] shrink-0 overflow-hidden rounded-xl border border-line-3 bg-black">
          {loaded ? null : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-[11.5px] leading-relaxed text-fg-5">
              Loading preview…
            </div>
          )}
          <iframe
            ref={playerRef}
            key={material.videoUrl}
            src={`${import.meta.env.BASE_URL}?demoPlayer=${encodeURIComponent(material.vid)}`}
            title="Demo creative player"
            aria-label="Demo creative player"
            onLoad={() => setLoaded(true)}
            allow="fullscreen"
            referrerPolicy="no-referrer"
            className="relative h-full w-full border-0 bg-black"
          />
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-line-3 bg-card p-4 sm:max-w-[340px]">
          {/* 标题行：左侧身份信息，右侧是全站统一的圆形叉号关闭按钮 */}
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] text-fg-5" title={breadcrumb}>
                {material.country || '—'} · {breadcrumb || 'Uncategorized'}
              </p>
            </div>
            <CloseIconButton onClick={onClose} ariaLabel="Close creative preview" />
          </div>
          <MaterialMetrics material={material} />
          <p lang="zh-CN" className="demo-inline-notice">{DEMO_NOTICE}</p>
          <p className="text-[11px] leading-relaxed text-fg-5">
            AI-generated illustration, local animation and fictional performance metrics.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              href={material.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center rounded-full border border-accent-ring bg-accent-soft px-3 text-[11.5px] text-accent-text transition-colors hover:bg-fill-2"
            >
              Open demo details
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 单张素材卡：**左封面 + 右指标表**的横向版式（本轮按用户截图改版）。
 *
 * 为什么从「竖版大封面在上、指标方格在下」改成横向：
 * 原版把封面按 9:16 铺满整张卡宽（一行 5 张时封面高 ~300px），指标只剩卡底那点空间，
 * 7 个指标被压成 4+3 两行、每格 ~70px，标签和数值双双被截断（「50% 留…」「21.3…」）。
 * 横过来之后封面收成左侧一条 ~96px 的竖条（仍是竖版比例、仍是同一张首帧图），
 * 右侧整块宽度让给指标，7 个指标排成**单列七行**的对齐表格，一个都不用截断；
 * 顺带把卡高从 ~380px 压到 ~180px，同屏能看到的素材条数反而更多。
 *
 * 其余取舍延续不变：
 * ① 点封面打开站内预览浮层，信息区胶囊在新页打开站内演示详情；
 * ② 封面区永远占同样的尺寸，图片加载状态不改变卡片高度；
 * ③ 国家码标签浮在封面左上角（半透明深底 + 白字，压得住任何画面）；
 * ④ 所有指标均为固定种子生成的模拟值。
 */
function MaterialCard({
  material,
  onPreview,
}: {
  material: TopMaterial;
  onPreview: (material: TopMaterial) => void;
}) {
  const breadcrumb = [material.l1, material.l2, material.l3]
    .filter(Boolean)
    .join(' › ');

  return (
    <article className="flex min-w-0 gap-2.5 overflow-hidden rounded-xl border border-line-3 bg-card p-2.5 transition-colors duration-200 hover:border-accent-ring hover:bg-fill-1">
      {/*
        封面竖条：宽度固定、高度靠 flex 拉伸到与右侧指标表齐平（约 180px），
        因此不会出现「封面比内容矮 / 高一截」的参差。min-h 兜底防止内容异常收缩。
      */}
      <button
        type="button"
        onClick={() => onPreview(material)}
        title="Preview creative"
        className="group relative block w-[84px] min-h-[150px] shrink-0 self-stretch overflow-hidden rounded-lg bg-fill-2 sm:w-[96px]"
      >
        <DemoImage
          src={material.image}
          alt={`${material.name} AI creative cover`}
          loading="lazy"
          className="h-full w-full"
          imageClassName="object-cover"
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white">
            <PlayIcon className="ml-[2px] h-[18px] w-[18px]" />
          </span>
        </span>

        {/* 身份标签浮在封面上：深色半透明底 + 白字，任何画面上都读得清 */}
        <span className="pointer-events-none absolute left-1 top-1 flex max-w-[calc(100%-8px)] flex-wrap gap-1">
          <span className="rounded-md bg-black/55 px-1.5 py-[1px] text-[10px] text-white backdrop-blur-[2px]">
            {material.country || '—'}
          </span>
        </span>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[10.5px] text-fg-5" title={breadcrumb}>
          {breadcrumb || 'Uncategorized'}
        </p>
        <a
          href={material.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open demo creative details"
          aria-label="Open demo creative details"
          className="inline-flex h-7 w-fit items-center rounded-full border border-accent-ring bg-accent-soft px-2.5 text-[11px] font-medium text-accent-text transition-colors hover:bg-fill-2"
        >
          Open demo
        </a>
        <div className="mt-auto pt-0.5">
          <MaterialMetrics material={material} />
        </div>
      </div>
    </article>
  );
}

function TopMaterialModuleImpl({
  materials,
  sourceIds,
  fallback,
}: {
  /** Fully fictional creatives; this component only filters and paginates. */
  materials: TopMaterial[];
  sourceIds: string;
  fallback?: React.ReactNode;
}) {
  /**
   * 国家与类目筛选都是本模块**自治**的 state：既不接页面全局的日历筛选，
   * 也不与虚构商品共享，避免两个独立演示模块互相改变筛选状态。
   */
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [filter, setFilter] = useState<CategoryFilter>(EMPTY_FILTER);
  const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(0);
  /** 当前预览的素材；null = 浮层关闭 */
  const [previewed, setPreviewed] = useState<TopMaterial | null>(null);
  const moduleRef = useRef<HTMLDivElement | null>(null);

  /** 国家先收敛一层：类目下拉的可选项也只应包含该国真实存在的类目 */
  const scoped = useMemo(
    () =>
      country === 'SEA'
        ? materials
        : materials.filter(item => item.country === country),
    [materials, country],
  );

  const filtered = useMemo(
    () =>
      scoped.filter(
        item =>
          (filter.l1 === FILTER_ALL || item.l1 === filter.l1) &&
          (filter.l2 === FILTER_ALL || item.l2 === filter.l2) &&
          (filter.l3 === FILTER_ALL || item.l3 === filter.l3),
      ),
    [scoped, filter],
  );

  /** 每页条数由右上角「每页」下拉决定（50 / 100 / 200，默认 100），与实时 Top 商品同一套 */
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => filtered.slice(current * pageSize, current * pageSize + pageSize),
    [filtered, current, pageSize],
  );

  /** 换国家 / 换类目 / 改每页条数后回到第一页（否则会停在一页空白上） */
  useEffect(() => {
    setPage(0);
  }, [country, filter, pageSize]);

  /** 翻页后把视口拉回模块顶部；首次挂载不滚（否则一切到素材视图就自己往下跳） */
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) {
      moduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    mountedRef.current = true;
  }, [current]);

  const closePreview = useCallback(() => setPreviewed(null), []);

  const title =
    filtered.length > 0
      ? `Demo Top Creatives · ${country} · ${filtered.length.toLocaleString('en-US')} creatives with demo metrics`
      : 'Demo Top Creatives';

  const showPager = !fallback && filtered.length > 0;

  return (
    <div ref={moduleRef} className="scroll-mt-4">
      <SectionCard
        tag="Top Creatives · Demo"
        title={title}
        sourceIds={sourceIds}
        /* 与实时 Top 商品完全一致：页码组在标题右侧的 extra 槽，筛选条独占一排 */
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
          />
        }
      >
        {fallback ??
          (filtered.length === 0 ? (
            <EmptyBlock label="No creatives match these filters" height={EMPTY_HEIGHT} />
          ) : (
            <div className="min-w-0 flex-1">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {/* vid 可能跨国家重复；解析层已把 vid、国家与源行序组合成稳定 key */}
                {visible.map(material => (
                  <MaterialCard
                    key={material.key}
                    material={material}
                    onPreview={setPreviewed}
                  />
                ))}
              </div>
            </div>
          ))}
      </SectionCard>
      {previewed ? (
        <MaterialPreview material={previewed} onClose={closePreview} />
      ) : null}
    </div>
  );
}

export const TopMaterialModule = memo(TopMaterialModuleImpl);
