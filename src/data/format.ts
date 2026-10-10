/** 按数量级选单位，同一张图共用一个单位 */
export function autoScale(values: number[]): { scale: number; unit: string } {
  const max = Math.max(
    ...values.map(v => Math.abs(v)).filter(v => Number.isFinite(v)),
    0,
  );
  if (max >= 1e6) {
    return { scale: 1e6, unit: 'M' };
  }
  if (max >= 1e3) {
    return { scale: 1e3, unit: 'K' };
  }
  return { scale: 1, unit: '' };
}

/** 整数不留小数，其余保留 decimals 位；一律加千分位 */
export function formatValue(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return Math.round(value).toLocaleString('en-US');
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** 百分比。signed=true 时正数带 + 号 */
export function formatPct(value: number, decimals = 1, signed = false): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const prefix = signed && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}%`;
}

/** TGI 显示：保留 0 位小数 */
export function formatTgi(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(0);
}

/** 美元金额（日均 GMV / AOV） */
export function formatUsd(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const { scale, unit } = autoScale([value]);
  return `$${formatValue(value / scale, decimals)}${unit}`;
}

/** 生成"整齐"的坐标刻度，避免 recharts 给出 397.3 这类小数刻度 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [];
  }
  const rawStep = (max - min) / Math.max(1, count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const candidates = [1, 2, 2.5, 5, 10].map(m => m * magnitude);
  const step = candidates.find(value => value >= rawStep) ?? magnitude * 10;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 1e-6; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return ticks;
}

/** 对称对数：环比跨度可达数万个百分点，线性轴会把所有点压成一条线 */
export function symlog(value: number, linearThreshold = 20): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  if (abs <= linearThreshold) {
    return value / linearThreshold;
  }
  return sign * (1 + Math.log10(abs / linearThreshold));
}

/** symlog 的反函数，用于把刻度位置还原成真实百分比 */
export function symlogInverse(value: number, linearThreshold = 20): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  if (abs <= 1) {
    return value * linearThreshold;
  }
  return sign * linearThreshold * 10 ** (abs - 1);
}

/** 长文本截断（图表轴标签用），保留完整值给 tooltip */
export function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}
