import { categoryKey } from './dataset';
import { MARKET_CODES } from './market';
import { type SheetMatrix, asNumber, asText } from './sheet';

/**
 * Fictional category × festival association labels.
 *
 * 列位（0-based）：
 * 0 third_category_name   1 festival_name_cn      2 relevance_score
 * 3 relevance_level       4 demand_type           5 reason_cn
 * 6 cbec_l1               7 cbec_l2               8 cbec_l3
 * 9 festival_country_scope 10 festival_country_cn 11 festival_month
 * 12 stock_up_month       13 tag_pass
 *
 * 关键点：
 * 1. 关联键是 `(cbec_l3, third_category_name)`，与主数据的 `(l3, leaf)` 一一对应，
 *    统一走 `dataset.ts` 的 `categoryKey`；
 * 2. `relevance_score` 只有 2（中等关联）/ 3（强关联），`relevance_level` 是它的中文；
 * 3. `tag_pass` 是内部标记（1/2/3），**不是布尔过滤位**，这里不参与过滤；
 * 4. `festival_country_scope` 的 `SEA` 与 `ID,MY,PH,SG,TH,VN` 都表示六国通用，
 *    一律归一化成六国全集，便于前端按所选国家过滤。
 */
export type FestivalTag = {
  nameCn: string;
  /** 2 = 中等关联，3 = 强关联 */
  score: 2 | 3;
  /** 关联强度中文（直接取表里的 relevance_level） */
  level: string;
  /** 覆盖的市场（`SEA` 已归一化成六国全集） */
  countryScope: string[];
  reason: string;
  /** 需求类型（表里的 demand_type，仅作为 tooltip 补充） */
  demandType: string;
  /** 节日所在月 / 建议备货月（1-based，缺值为 null） */
  festivalMonth: number | null;
  stockUpMonth: number | null;
};

const ALL_MARKETS: string[] = [...MARKET_CODES];

/** `SEA` / `ID,MY,PH,SG,TH,VN` → 六国全集；其余按逗号拆成市场码 */
export function parseCountryScope(raw: string): string[] {
  const text = raw.trim();
  if (!text || text.toUpperCase() === 'SEA') {
    return [...ALL_MARKETS];
  }
  const codes = new Set(
    text
      .split(/[,，/\s]+/)
      .map(item => item.trim().toUpperCase())
      .filter(item => ALL_MARKETS.includes(item)),
  );
  if (codes.size === 0) {
    return [...ALL_MARKETS];
  }
  // 按 MARKET_CODES 的固定顺序输出，保证同一 scope 每次结果一致
  return ALL_MARKETS.filter(code => codes.has(code));
}

/** 关联强度：表里只有 2 / 3，异常值一律回落到中等关联 */
function normalizeScore(value: number | null): 2 | 3 {
  return value === 3 ? 3 : 2;
}

/**
 * 解析节日标签表 → `Map<categoryKey, FestivalTag[]>`。
 * 同一类目下按 `score` 降序、再按节日名排序；同名节日只保留强度最高的一条。
 */
export function parseFestivalTags(
  matrix: SheetMatrix,
): Map<string, FestivalTag[]> {
  const map = new Map<string, FestivalTag[]>();
  for (const row of matrix) {
    if (!row) {
      continue;
    }
    const leaf = asText(row[0]);
    const nameCn = asText(row[1]);
    const l3 = asText(row[8]);
    if (!leaf || !nameCn || !l3) {
      continue;
    }
    const score = normalizeScore(asNumber(row[2]));
    const tag: FestivalTag = {
      nameCn,
      score,
      level: asText(row[3]) || (score === 3 ? 'Strong association' : 'Moderate association'),
      countryScope: parseCountryScope(asText(row[9])),
      reason: asText(row[5]),
      demandType: asText(row[4]),
      festivalMonth: asNumber(row[11]),
      stockUpMonth: asNumber(row[12]),
    };
    const key = categoryKey(l3, leaf);
    const list = map.get(key);
    if (!list) {
      map.set(key, [tag]);
      continue;
    }
    const same = list.find(item => item.nameCn === nameCn);
    if (same) {
      // 同名去重：保留关联更强的一条
      if (tag.score > same.score) {
        Object.assign(same, tag);
      }
      continue;
    }
    list.push(tag);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) => b.score - a.score || a.nameCn.localeCompare(b.nameCn, 'en-US'),
    );
  }
  return map;
}

/** 合并多个分片的解析结果（分批读表时用） */
export function mergeFestivalTags(
  parts: SheetMatrix[],
): Map<string, FestivalTag[]> {
  const flat: SheetMatrix = [];
  for (const part of parts) {
    for (const row of part) {
      flat.push(row);
    }
  }
  return parseFestivalTags(flat);
}

/** 取某个类目的标签，并按所选国家过滤（SEA 不过滤） */
export function tagsForCategory(
  tags: Map<string, FestivalTag[]>,
  l3: string,
  leaf: string,
  country: string,
): FestivalTag[] {
  const list = tags.get(categoryKey(l3, leaf)) ?? [];
  if (country === 'SEA') {
    return list;
  }
  return list.filter(tag => tag.countryScope.includes(country));
}
