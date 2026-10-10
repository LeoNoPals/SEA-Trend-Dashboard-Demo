import { useCallback, useMemo, useState } from 'react';
import { BubbleModule } from '@/components/BubbleModule';
import { CalendarModule } from '@/components/CalendarModule';
import { HeatmapModule, EMPTY_FILTER, type CategoryFilter } from '@/components/HeatmapModule';
import { PageHeader } from '@/components/PageHeader';
import { PriceBandModule } from '@/components/PriceBandModule';
import { TopCategoryModule } from '@/components/TopCategoryModule';
import { TopProductModule } from '@/components/TopProductModule';
import { TopMaterialModule } from '@/components/TopMaterialModule';
import { TopSearchModule } from '@/components/TopSearchModule';
import { TrendOverlay } from '@/components/TrendOverlay';
import { SegmentedToggle } from '@/components/common';
import { DemoAssetPage } from '@/components/DemoAssetPage';
import { DEMO_NOTICE, DEMO_WINDOW_LABEL } from '@/data/demo/history';
import { MONTH_LABELS, type CategoryTrend } from '@/data/dataset';
import { MARKET_CODES, type CountryCode, type MarketCode } from '@/data/market';
import { buildL1Colors } from '@/data/theme';
import { ymLabel } from '@/data/sheet';
import { useThemeMode } from '@/hooks/useTheme';
import {
  useSeaTrend, useMarketTrends, useMarketAvailability, useMarketContext,
  useCategoryCn, useFestivalTags, useTopProducts, useTopMaterials, useTopSearches,
} from '@/hooks/useDashboardData';

function Dashboard() {
  const mode = useThemeMode();
  const sea = useSeaTrend();
  const context = useMarketContext();
  const categoryCn = useCategoryCn();
  const tags = useFestivalTags();
  const { availability } = useMarketAvailability();
  const products = useTopProducts();
  const materials = useTopMaterials();
  const searches = useTopSearches();
  const [country, setCountry] = useState<CountryCode>('SEA');
  const [monthIndex, setMonthIndex] = useState<number | null>(null);
  const [heatFilter, setHeatFilter] = useState<CategoryFilter>(EMPTY_FILTER);
  const [priceFilter, setPriceFilter] = useState<CategoryFilter>(EMPTY_FILTER);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [trendKey, setTrendKey] = useState<string | null>(null);
  const [assetView, setAssetView] = useState<'product' | 'material' | 'search'>('product');
  const [materialSeen, setMaterialSeen] = useState(false);
  const [searchSeen, setSearchSeen] = useState(false);
  const wanted = useMemo(() => Object.fromEntries(MARKET_CODES.map(m => [m, true])) as Record<MarketCode, boolean>, []);
  const marketTrends = useMarketTrends(availability, wanted);
  const dataset = country === 'SEA' ? sea.dataset : marketTrends[country].dataset;
  const categories = dataset!.categories;
  const effectiveMonthIndex = monthIndex ?? 7;
  const effectiveMonthLabel = `${MONTH_LABELS[effectiveMonthIndex]}／${ymLabel(dataset!.monthOfIndex[effectiveMonthIndex]!)}`;
  const l1Colors = useMemo(() => buildL1Colors(categories.map(item => item.l1), mode), [categories, mode]);
  const openTrend = useCallback((category: CategoryTrend) => setTrendKey(category.key), []);
  const closeTrend = useCallback(() => setTrendKey(null), []);
  const selectRow = useCallback((category: CategoryTrend) => setSelectedKey(category.key), []);
  const trendCategory = categories.find(item => item.key === trendKey) ?? null;
  const seaCategory = sea.dataset!.categories.find(item => item.key === trendKey) ?? null;

  return (
    <main className="min-h-screen w-full bg-page text-fg-1">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader windowLabel={DEMO_WINDOW_LABEL} updatedAt={sea.updatedAt} />
        <CalendarModule context={context} country={country} monthIndex={monthIndex}
          onCountryChange={setCountry} onMonthChange={setMonthIndex} />
        <HeatmapModule dataset={dataset} monthIndex={monthIndex}
          effectiveMonthIndex={effectiveMonthIndex} effectiveMonthLabel={effectiveMonthLabel}
          filter={heatFilter} onFilterChange={setHeatFilter} selectedKey={selectedKey}
          onSelect={selectRow} onOpenTrend={openTrend} festivalTags={tags.tags} country={country}
          categoryCn={categoryCn.map} sourceIds="demo-heatmap" windowLabel={DEMO_WINDOW_LABEL} />
        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            <TopCategoryModule categories={categories} l1Colors={l1Colors} monthIndex={effectiveMonthIndex}
              monthLabel={effectiveMonthLabel} categoryCn={categoryCn.map} onOpenTrend={openTrend} sourceIds="demo-ranking" />
          </div>
          <div className="min-w-0">
            <PriceBandModule categories={categories} l1Colors={l1Colors} monthIndex={effectiveMonthIndex}
              monthLabel={effectiveMonthLabel} filter={priceFilter} onFilterChange={setPriceFilter}
              categoryCn={categoryCn.map} sourceIds="demo-prices" />
          </div>
        </div>
        <BubbleModule categories={categories} l1Colors={l1Colors} monthIndex={effectiveMonthIndex}
          monthLabel={effectiveMonthLabel} categoryCn={categoryCn.map} onOpenTrend={openTrend} sourceIds="demo-bubbles" />
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
            <SegmentedToggle size="md" ariaLabel="Realtime content view" value={assetView}
              onChange={next => {
                setAssetView(next);
                if (next === 'material') setMaterialSeen(true);
                if (next === 'search') setSearchSeen(true);
              }}
              items={[
                { key: 'product', label: 'Products' },
                { key: 'material', label: 'Creatives' },
                { key: 'search', label: 'Search' },
              ]} />
            <span className="shrink-0 whitespace-nowrap text-xs text-fg-4">Demo metrics · Filters apply to this section</span>
          </div>
          <div hidden={assetView !== 'product'}>
            <TopProductModule products={products.products} sourceIds="demo-products" />
          </div>
          {materialSeen && (
            <div hidden={assetView !== 'material'}>
              <TopMaterialModule materials={materials.materials} sourceIds="demo-materials" />
            </div>
          )}
          {searchSeen && (
            <div hidden={assetView !== 'search'}>
              <TopSearchModule searches={searches.searches} sourceIds="demo-searches" />
            </div>
          )}
        </div>
        <footer className="py-3 text-center text-xs text-fg-4">{DEMO_NOTICE}</footer>
      </div>
      <TrendOverlay open={trendKey !== null} category={seaCategory ?? trendCategory}
        focusCategory={trendCategory} categoryCn={categoryCn.map} country={country}
        marketTrends={marketTrends} availability={availability} onClose={closeTrend} />
    </main>
  );
}

export default function App() {
  const query = new URLSearchParams(window.location.search);
  if (query.has('demoProduct') || query.has('demoMaterial') || query.has('demoPlayer')) {
    return <DemoAssetPage query={query} />;
  }
  return <Dashboard />;
}
