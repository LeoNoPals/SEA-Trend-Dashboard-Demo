import { memo, useMemo, useState } from 'react';

import { CountryFlag } from '@/components/CountryFlag';
import {
  Chip,
  EmptyBlock,
  ResetButton,
  SearchInput,
  SectionBadge,
  SectionCard,
} from '@/components/common';
import {
  type DemoSearchTerm,
} from '@/data/demo/search';
import {
  COUNTRY_NAMES,
  MARKET_CODES,
  type MarketCode,
} from '@/data/market';
import { cn } from '@/lib/utils';

const DEFAULT_COUNTRY: MarketCode = 'MY';
const formatIndex = new Intl.NumberFormat('en-US');

function Sparkline({
  values,
  growth,
}: {
  values: number[];
  growth: number;
}) {
  const width = 86;
  const height = 28;
  const padding = 2;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = Math.max(1, high - low);
  const points = values
    .map((value, index) => {
      const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - low) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const [lastX, lastY] = points.split(' ').at(-1)!.split(',');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Seven-day trend ${growth >= 0 ? 'up' : 'down'} ${Math.abs(growth).toFixed(1)} percent`}
      className={cn(
        'h-7 w-[86px]',
        growth >= 0 ? 'text-info-fg' : 'text-accent-text',
      )}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.1" fill="currentColor" />
    </svg>
  );
}

function TopSearchModuleImpl({
  searches,
  sourceIds,
}: {
  searches: DemoSearchTerm[];
  sourceIds: string;
}) {
  const [country, setCountry] = useState<MarketCode>(DEFAULT_COUNTRY);
  const [keyword, setKeyword] = useState('');

  const scoped = useMemo(
    () => searches.filter(item => item.country === country),
    [searches, country],
  );
  const tokens = useMemo(
    () => keyword.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [keyword],
  );
  const filtered = useMemo(
    () =>
      scoped.filter(item => {
        const haystack = item.term.toLowerCase();
        return tokens.every(token => haystack.includes(token));
      }),
    [scoped, tokens],
  );
  const maxIndex = scoped[0]?.searchIndex ?? 1;

  return (
    <SectionCard
      tag="Top Searches · Demo"
      badge={<SectionBadge title="Fixed-seed fictional ranking">Top 100</SectionBadge>}
      title={`Demo Top Search Terms · ${country} · ${filtered.length} terms`}
      sourceIds={sourceIds}
      toolbar={
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-[11px] text-fg-5">Country</span>
          {MARKET_CODES.map(code => (
            <Chip
              key={code}
              active={country === code}
              title={COUNTRY_NAMES[code]}
              icon={<CountryFlag code={code} />}
              onClick={() => setCountry(code)}
              className="h-8"
            >
              {code}
            </Chip>
          ))}
          <span className="h-4 w-px shrink-0 bg-line-4" />
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            placeholder="Search hot term"
            ariaLabel="Search hot term"
            className="w-[190px] sm:w-[220px]"
          />
          <ResetButton
            disabled={country === DEFAULT_COUNTRY && !keyword}
            title="Reset to MY and clear search"
            onClick={() => {
              setCountry(DEFAULT_COUNTRY);
              setKeyword('');
            }}
          />
        </div>
      }
      bodyClassName="min-h-0"
    >
      {filtered.length === 0 ? (
        <EmptyBlock
          label={`No search term matches all keywords: "${tokens.join(' ')}". Try another search or reset filters.`}
          height={320}
        />
      ) : (
        <div className="max-h-[680px] min-w-0 overflow-auto overscroll-contain rounded-lg border border-line-3">
          <table className="w-full min-w-[880px] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="text-[10.5px] uppercase text-fg-5">
                <th className="w-[64px] border-b border-line-3 px-3 py-2.5 font-medium">Rank</th>
                <th className="w-[250px] border-b border-line-3 px-3 py-2.5 font-medium">Search term</th>
                <th className="w-[230px] border-b border-line-3 px-3 py-2.5 font-medium">Demo search index</th>
                <th className="w-[90px] border-b border-line-3 px-3 py-2.5 text-right font-medium">7d growth</th>
                <th className="w-[118px] border-b border-line-3 px-3 py-2.5 font-medium">7d trend</th>
                <th className="border-b border-line-3 px-3 py-2.5 font-medium">Fictional category</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const category = [item.l1, item.l2, item.l3].join(' › ');
                return (
                  <tr
                    key={`${item.country}-${item.rank}`}
                    data-search-row={item.rank}
                    className="text-[12px] text-fg-2 transition-colors hover:bg-fill-1"
                  >
                    <td className="border-b border-line-1 px-3 py-2.5">
                      <span
                        className={cn(
                          'font-display text-[13px] font-bold tabular-nums',
                          item.rank <= 3 ? 'text-accent-text' : 'text-fg-4',
                        )}
                      >
                        {String(item.rank).padStart(2, '0')}
                      </span>
                    </td>
                    <td className="border-b border-line-1 px-3 py-2.5">
                      <span className="font-medium capitalize text-fg-1">{item.term}</span>
                    </td>
                    <td className="border-b border-line-1 px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-[108px] shrink-0 overflow-hidden rounded-full bg-fill-3">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${Math.max(5, item.searchIndex / maxIndex * 100)}%` }}
                          />
                        </div>
                        <span className="font-medium tabular-nums text-fg-2">
                          {formatIndex.format(item.searchIndex)}
                        </span>
                      </div>
                    </td>
                    <td
                      className={cn(
                        'border-b border-line-1 px-3 py-2.5 text-right font-semibold tabular-nums',
                        item.growth7d >= 0 ? 'text-info-fg' : 'text-accent-text',
                      )}
                    >
                      {item.growth7d >= 0 ? '+' : ''}
                      {item.growth7d.toFixed(1)}%
                    </td>
                    <td className="border-b border-line-1 px-3 py-2">
                      <Sparkline values={item.trend} growth={item.growth7d} />
                    </td>
                    <td
                      className="max-w-[330px] truncate border-b border-line-1 px-3 py-2.5 text-[11px] text-fg-4"
                      title={category}
                    >
                      {category}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export const TopSearchModule = memo(TopSearchModuleImpl);
