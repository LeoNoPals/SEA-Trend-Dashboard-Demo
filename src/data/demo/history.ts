import festivalRows from './festivals.json';
import climateRows from './climate.json';
import { categoryKey, computePhases, type CategoryTrend, type TrendDataset } from '../dataset';
import { COUNTRY_CODES, MARKET_CODES, parseFestivals, parseClimate, resolveRamadanMarkets, type CountryCode } from '../market';
import { parseCategoryCn } from '../categoryCn';
import type { FestivalTag } from '../festivalTag';
import type { SheetMatrix } from '../sheet';

export const DEMO_NOTICE = '数据均为非真实业务数据，仅用于交互功能演示。';
export const DEMO_VERSION = '2026-09-28';
export const DEMO_WINDOW_LABEL = 'Sep 2025 – Aug 2026';

/** Fixed seed: repeatable demonstrations, with no input from business datasets. */
export function randomFor(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state += 0x6D2B79F5;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

const L1_ROOTS = ['Aster', 'Cobalt', 'Juniper', 'Lumen', 'Mosaic', 'Vela'];
const L2_WORDS = ['Horizon', 'Meadow', 'Orbit', 'Prism', 'Ripple', 'Summit', 'Tide', 'Willow'];
const L3_WORDS = ['Arc', 'Bloom', 'Drift', 'Echo', 'Halo', 'Nova', 'Quartz', 'Wisp'];
const LEAF_ADJECTIVES = ['Bright', 'Calm', 'Cloud', 'Gentle', 'Modern', 'Pure', 'Soft', 'Swift', 'Vivid', 'Warm'];
const LEAF_NOUNS = ['Accent', 'Canvas', 'Form', 'Idea', 'Object', 'Piece', 'Shape', 'Spark', 'Touch', 'Utility'];
type DemoLabel = [string, string, string, string, string];

/**
 * Fully fictional taxonomy generated from a fixed seed.
 * It does not preserve any source category name, branch, count or ordering.
 */
function buildDemoLabels(): DemoLabel[] {
  const random = randomFor('fictional-taxonomy-v3');
  return Array.from({ length: 480 }, (_, index) => {
    const l1Index = Math.floor(index / 80);
    const l2Index = Math.floor(index / 20) % 4;
    const l3Index = Math.floor(index / 5) % 4;
    const root = L1_ROOTS[l1Index];
    const l2Word = L2_WORDS[(l1Index * 4 + l2Index) % L2_WORDS.length];
    const l3Word = L3_WORDS[(l1Index * 5 + l2Index * 2 + l3Index) % L3_WORDS.length];
    const adjective = LEAF_ADJECTIVES[Math.floor(random() * LEAF_ADJECTIVES.length)];
    const noun = LEAF_NOUNS[Math.floor(random() * LEAF_NOUNS.length)];
    return [
      `${root} Market`,
      `${root} ${l2Word} Collection ${l2Index + 1}`,
      `${root} ${l3Word} Studio ${l2Index * 4 + l3Index + 1}`,
      `${adjective} ${noun} Concept ${String(index + 1).padStart(3, '0')}`,
      '',
    ];
  });
}

export const demoLabels = buildDemoLabels();
export const demoCategoryCn = parseCategoryCn(demoLabels);
const cache = new Map<CountryCode, TrendDataset>();

export function demoHistory(market: CountryCode): TrendDataset {
  const existing = cache.get(market);
  if (existing) return existing;
  const categories: CategoryTrend[] = demoLabels.map(([l1, l2, l3, leaf], i) => {
    const random = randomFor(`${market}:${l3}:${leaf}:synthetic-v1`);
    const peak = Math.floor(random() * 12);
    const width = 0.8 + random() * 1.4;
    const amplitude = 85 + random() * 280;
    const raw = Array.from({ length: 12 }, (_, month) => {
      const distance = Math.min(Math.abs(month - peak), 12 - Math.abs(month - peak));
      return 38 + random() * 38 + amplitude * Math.exp(-(distance ** 2) / (2 * width ** 2));
    });
    const mean = raw.reduce((sum, n) => sum + n, 0) / 12;
    const tgi = raw.map(n => Math.round(n / mean * 10000) / 100);
    const volumeOk = i % 8 !== 0;
    const scale = tgi.map(() => Math.round(random() * 1000) / 1000);
    const priceBand = i % 10;
    return {
      key: categoryKey(l3, leaf), l1, l2, l3, leaf, tgi,
      phases: computePhases(tgi),
      scale, band: tgi.map(() => priceBand),
      trend: tgi.map(n => n > 120 && volumeOk), volumeOk,
    };
  });
  const window = Array.from({ length: 12 }, (_, i) => ({
    year: i < 4 ? 2025 : 2026, month: ((i + 8) % 12) + 1,
  }));
  const dataset: TrendDataset = {
    window,
    monthOfIndex: Array.from({ length: 12 }, (_, i) => window.find(ym => ym.month === i + 1)!),
    categories,
    partials: new Map(categories.map(item => [item.key, {
      key: item.key, tgi: item.tgi, monthsWithData: 12,
    }])),
    totalCategories: categories.length, droppedCategories: 0,
  };
  cache.set(market, dataset);
  return dataset;
}

/** Original calendar dates and climate values, explicitly retained by request. */
export const demoFestivals = parseFestivals(festivalRows as SheetMatrix);
export const demoMarketContext = {
  festivals: demoFestivals,
  ramadanMarkets: resolveRamadanMarkets(demoFestivals),
  climate: parseClimate(climateRows as SheetMatrix),
  loading: false,
};
export const demoAvailability = Object.fromEntries(MARKET_CODES.map(m => [m, true])) as Record<Exclude<CountryCode, 'SEA'>, boolean>;
export const demoTags = new Map<string, FestivalTag[]>(
  demoLabels.map(([, , l3, leaf], i) => {
    const names = ['New Year', "Valentine’s Day", 'Back to School', 'Travel Peak', 'School Vacation', 'Christmas'];
    const months = [1, 2, 1, 4, 10, 12];
    return [categoryKey(l3, leaf), [0, 2].map(offset => {
      const index = (i + offset) % names.length;
      return {
        nameCn: names[index], score: offset === 0 ? 3 : 2, level: 'Demo association',
        countryScope: [...MARKET_CODES], reason: 'Fictional association for exploring tags and tooltips.',
        demandType: 'Demo', festivalMonth: months[index], stockUpMonth: (months[index] + 9) % 12 + 1,
      };
    })];
  }),
);
export { COUNTRY_CODES };
