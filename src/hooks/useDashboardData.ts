import { useMemo } from 'react';
import type { TrendDataset } from '@/data/dataset';
import type { MarketCode } from '@/data/market';
import {
  DEMO_VERSION, demoAvailability, demoCategoryCn, demoHistory,
  demoMarketContext, demoTags,
} from '@/data/demo/history';
import { demoProducts, demoMaterials } from '@/data/demo/assets';
import { demoSearches } from '@/data/demo/search';

export type DataError = { code?: string; message: string };
export type TrendState = {
  dataset: TrendDataset | null;
  loaded: number;
  total: number;
  loading: boolean;
  failure?: DataError;
  updatedAt?: number;
};
export type MarketAvailability = Record<MarketCode, boolean>;
export type MarketContext = typeof demoMarketContext & { failure?: DataError };

function stateFor(market: Parameters<typeof demoHistory>[0]): TrendState {
  return { dataset: demoHistory(market), loaded: 1, total: 1, loading: false, updatedAt: Date.parse(DEMO_VERSION) };
}
export function useSeaTrend() { return useMemo(() => stateFor('SEA'), []); }
export function useMarketAvailability() { return { availability: demoAvailability, probing: false }; }
export function useMarketTrends(_availability: MarketAvailability, _wanted: Record<MarketCode, boolean>) {
  return useMemo(() => ({
    MY: stateFor('MY'), TH: stateFor('TH'), VN: stateFor('VN'),
    PH: stateFor('PH'), SG: stateFor('SG'), ID: stateFor('ID'),
  }), []);
}
export function useMarketContext(): MarketContext { return demoMarketContext; }
export function useCategoryCn() { return { map: demoCategoryCn, loading: false }; }
export function useFestivalTags() { return { tags: demoTags, loading: false }; }
export function useTopProducts() { return { products: demoProducts, loading: false }; }
export function useTopMaterials() { return { materials: demoMaterials, loading: false }; }
export function useTopSearches() { return { searches: demoSearches, loading: false }; }
