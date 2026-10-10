/** Fictional creatives with AI illustrations and local demo links. */
export type TopMaterial = {
  key: string;
  country: string;
  l1: string;
  l2: string;
  l3: string;
  videoUrl: string;
  vid: string;
  image: string;
  name: string;
  duration: number;
  play3sRate: number;
  play50: number;
  play75: number;
  playover: number;
  ctr: number;
  cvr: number;
};

export function formatRate(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(2)}%`;
}
export function formatDuration(value: number | null): string {
  return value === null || !Number.isFinite(value) || value < 0 ? '—' : `${Math.round(value)}s`;
}
