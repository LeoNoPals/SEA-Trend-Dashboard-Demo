export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type SheetMatrix = JsonValue[][];

/** 文本单元格：一律 trim（底表里 p_date 等列存在前导空格） */
export function asText(value: JsonValue | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

/**
 * 数值单元格：去掉千分位逗号与空格。
 * 公式列（read_range 会把公式原文返回，如 `XLOOKUP(...)`）解析为 null。
 */
export function asNumber(value: JsonValue | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const text = value.replace(/[,\s]/g, '');
    if (!text || !/^-?\d*\.?\d+(e[+-]?\d+)?$/i.test(text)) {
      return null;
    }
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * 「这个单元格算缺失吗」的统一判定。
 *
 * 底表里的空值写法不止一种：真正的空单元格、字符串 `NULL`（Hive 导出最常见）、`\N`、
 * `n/a`、单个短横线，以及**字面量单个空格**（实时商品表 L 列有 3489 行是 `" "`）。
 * 传进来的文本一般已经过 `asText` 的 trim，这里再 trim 一次以防调用方直接给原始串。
 * 缺失的类目层级由各解析层归一成空串，UI 再决定显示「未分类」还是「—」。
 */
export function isNullish(value: string): boolean {
  return /^(|null|\\n|n\/a|na|none|nan|undefined|-|--)$/i.test(value.trim());
}

export function asBoolean(value: JsonValue | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return /^(true|1|yes)$/i.test(asText(value));
}

export type YearMonth = { year: number; month: number };

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

/**
 * p_date 解析。飞书 read_range 对日期格式单元格返回 Excel 序列号（45839），
 * 但同一列在别的表里也可能是 `2025年7月` 这类文本，两种都要认。
 */
export function parseYearMonth(value: JsonValue | undefined): YearMonth | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000) {
    const date = new Date(EXCEL_EPOCH_UTC + value * 86400000);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
  }
  const text = asText(value);
  if (!text) {
    return null;
  }
  const cn = /^(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(text);
  if (cn) {
    return { year: Number(cn[1]), month: Number(cn[2]) };
  }
  const iso = /^(\d{4})[-/](\d{1,2})/.exec(text);
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]) };
  }
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 20000) {
    const date = new Date(EXCEL_EPOCH_UTC + serial * 86400000);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
  }
  return null;
}

export type SheetDate = {
  /** 归一化成 `YYYY-MM-DD`，用于合并判定（同期节日必须日期串完全一致） */
  iso: string;
  year: number;
  /** 1..12 */
  month: number;
  day: number;
};

function toSheetDate(date: Date): SheetDate {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return {
    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    year,
    month,
    day,
  };
}

/**
 * 单个日期单元格解析（start_date / end_date 列用）。
 * 飞书 read_range 对「日期」格式单元格返回 Excel 序列号（46019），
 * 但同一列手工录入时也可能是 `2026-07-01` / `2026/7/1` / `2026年7月1日` 文本，
 * 三种形态都要认；只有年月（`2026年7月`）时落到当月 1 日。
 */
export function parseSheetDate(value: JsonValue | undefined): SheetDate | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000) {
    return toSheetDate(new Date(EXCEL_EPOCH_UTC + value * 86400000));
  }
  const text = asText(value);
  if (!text) {
    return null;
  }
  const ymd = /^(\d{4})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})/.exec(text);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        year,
        month,
        day,
      };
    }
  }
  const serial = Number(text.replace(/[,\s]/g, ''));
  if (Number.isFinite(serial) && serial > 20000) {
    return toSheetDate(new Date(EXCEL_EPOCH_UTC + serial * 86400000));
  }
  const ym = parseYearMonth(text);
  if (ym) {
    return {
      iso: `${ym.year}-${String(ym.month).padStart(2, '0')}-01`,
      year: ym.year,
      month: ym.month,
      day: 1,
    };
  }
  return null;
}

export function ymKey(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, '0')}`;
}

export function ymLabel(ym: YearMonth): string {
  return new Date(Date.UTC(ym.year, ym.month - 1, 1)).toLocaleDateString('en-US', {
    month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}
