import { MARKET_CODES, type MarketCode } from '@/data/market';
import { demoLabels, randomFor } from '@/data/demo/history';

export type DemoSearchTerm = {
  country: MarketCode;
  rank: number;
  term: string;
  searchIndex: number;
  growth7d: number;
  trend: number[];
  l1: string;
  l2: string;
  l3: string;
};

const TERM_ADJECTIVES = [
  'bright',
  'calm',
  'cloud',
  'compact',
  'fresh',
  'gentle',
  'modern',
  'pure',
  'soft',
  'swift',
  'vivid',
  'warm',
] as const;

const TERM_SUBJECTS = [
  'aster',
  'bloom',
  'echo',
  'halo',
  'lumen',
  'meadow',
  'nova',
  'orbit',
  'prism',
  'quartz',
  'ripple',
  'willow',
] as const;

const TERM_ENDINGS = [
  'daily set',
  'easy pack',
  'home edit',
  'mini pair',
  'new concept',
  'smart kit',
  'studio pick',
  'travel bundle',
] as const;

function buildTermPool(): string[] {
  const pool: string[] = [];
  for (const adjective of TERM_ADJECTIVES) {
    for (const subject of TERM_SUBJECTS) {
      for (const ending of TERM_ENDINGS) {
        pool.push(`${adjective} ${subject} ${ending}`);
      }
    }
  }

  const random = randomFor('fictional-search-term-pool-v1');
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [pool[index], pool[target]] = [pool[target], pool[index]];
  }
  return pool;
}

const termPool = buildTermPool();

function buildTrend(random: () => number): number[] {
  let level = 36 + random() * 36;
  const drift = -4.5 + random() * 9;
  return Array.from({ length: 7 }, () => {
    level = Math.min(98, Math.max(8, level + drift + (random() - 0.5) * 13));
    return Math.round(level * 10) / 10;
  });
}

/**
 * Six country-specific Top 100 lists generated from a fixed seed.
 * Terms, scores, order and trends are fictional and do not use search logs.
 */
export const demoSearches: DemoSearchTerm[] = MARKET_CODES.flatMap(
  (country, countryIndex) => {
    const random = randomFor(`fictional-search:${country}:v1`);
    return Array.from({ length: 100 }, (_, index) => {
      const [l1, l2, l3] =
        demoLabels[(countryIndex * 100 + index * 37) % demoLabels.length];
      const trend = buildTrend(random);
      return {
        country,
        rank: index + 1,
        term: termPool[countryIndex * 100 + index],
        searchIndex: Math.round(1_000_000 - index * 8_200 - random() * 1_800),
        growth7d:
          Math.round(((trend[6] - trend[0]) / trend[0]) * 1_000) / 10,
        trend,
        l1,
        l2,
        l3,
      };
    });
  },
);
