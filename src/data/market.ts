import {
  type SheetMatrix,
  asBoolean,
  asNumber,
  asText,
  parseSheetDate,
} from './sheet';

export const COUNTRY_CODES = [
  'SEA',
  'MY',
  'TH',
  'VN',
  'PH',
  'SG',
  'ID',
] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];
export type MarketCode = Exclude<CountryCode, 'SEA'>;

export const MARKET_CODES: MarketCode[] = ['MY', 'TH', 'VN', 'PH', 'SG', 'ID'];

export const COUNTRY_NAMES: Record<CountryCode, string> = {
  SEA: 'Southeast Asia',
  MY: 'Malaysia',
  TH: 'Thailand',
  VN: 'Vietnam',
  PH: 'Philippines',
  SG: 'Singapore',
  ID: 'Indonesia',
};

/** 节点类型：六国共同节日 / 本国法定节日 / 营销节点（返校季、婚礼旺季等） */
export type FestivalSection = 'common' | 'country' | 'marketing_node';

export type Festival = {
  sortOrder: number;
  year: number;
  countryCode: string;
  section: FestivalSection;
  code: string;
  nameCn: string;
  nameEn: string;
  /** 归一化后的 `YYYY-MM-DD`，合并同期节日时按它比对 */
  startDate: string;
  endDate: string;
  /** 0-based 起始 / 结束月（由 start_date / end_date 解析，跨月节日 end > start） */
  startMonthIndex: number;
  endMonthIndex: number;
  /** 1-based 起始月，保留旧字段口径（= startMonthIndex + 1） */
  monthNum: number;
  isMultiDay: boolean;
  datePrecision: string;
};

/** 斋月 / 开斋节类节日的 code 特征（数据驱动判定斋月国） */
const RAMADAN_CODE_PATTERN = /(ramadan|eid_al|hari_raya)/i;

/**
 * Public SEA festival data column mapping. Start and end dates use separate columns:
 * A(0) sort_order       B(1) year               C(2) country_code
 * D(3) section          E(4) festival_code      F(5) festival_name_cn
 * G(6) festival_name_en H(7) start_date         I(8) end_date
 * J(9) month_num        K(10) is_multi_day      L(11) date_precision
 *
 * 关键点：
 * 1. section 现在有三种取值 `common` / `country` / `marketing_node`（旧代码只认前两种，
 *    会把营销节点误并进本国节日，这里保留原值）；
 * 2. 节日区间一律以 H/I 两列为准（跨月节日靠它算出横跨的月份），
 *    J 列 month_num 只是起始月的冗余列，仅在 H 列解析失败时兜底；
 * 3. 日期列可能是文本（`2026-07-01`）也可能是 Excel 日期序列号，parseSheetDate 两种都认；
 * 4. end_date 早于 start_date（跨年区间）时把结束月钳到 12 月，日历只画本年度这一段。
 */
export function parseFestivals(matrix: SheetMatrix): Festival[] {
  const list: Festival[] = [];
  for (const row of matrix) {
    if (!row) {
      continue;
    }
    const code = asText(row[4]);
    const countryCode = asText(row[2]);
    const start = parseSheetDate(row[7]);
    const end = parseSheetDate(row[8]);
    const fallbackMonth = asNumber(row[9]);
    const startMonth = start?.month ?? fallbackMonth;
    if (!code || !countryCode || !startMonth) {
      continue;
    }
    const startMonthIndex = Math.min(11, Math.max(0, startMonth - 1));
    const endMonthIndex = Math.min(
      11,
      Math.max(startMonthIndex, (end?.month ?? startMonth) - 1),
    );
    const rawSection = asText(row[3]);
    const section: FestivalSection =
      rawSection === 'common'
        ? 'common'
        : rawSection === 'marketing_node'
          ? 'marketing_node'
          : 'country';
    list.push({
      sortOrder: asNumber(row[0]) ?? 0,
      year: asNumber(row[1]) ?? 0,
      countryCode,
      section,
      code,
      nameCn: asText(row[5]),
      nameEn: asText(row[6]),
      startDate: start?.iso ?? '',
      endDate: end?.iso ?? start?.iso ?? '',
      startMonthIndex,
      endMonthIndex,
      monthNum: startMonthIndex + 1,
      isMultiDay: asBoolean(row[10]) || endMonthIndex > startMonthIndex,
      datePrecision: asText(row[11]),
    });
  }
  list.sort((a, b) => a.sortOrder - b.sortOrder);
  return list;
}

/**
 * 日历里的一个渲染块：同名同期的多国节日合并后的产物。
 * 单月节日 monthSpan = 1，跨月节日 monthSpan = 跨越的自然月数。
 */
export type FestivalBlock = {
  id: string;
  /** 合并进来的国家（按 MY / TH / VN / PH / SG / ID 固定顺序），共同节日为 ['SEA'] */
  countries: string[];
  section: FestivalSection;
  code: string;
  /** 合并进来的全部中文名（按原 sortOrder 去重排序），单事件块长度为 1 */
  names: string[];
  /** 与 `names` 一一对应的英文名 */
  namesEn: string[];
  /** 首个中文名 / 英文名（保留旧字段口径，供只需要单个名字的调用方使用） */
  nameCn: string;
  nameEn: string;
  startDate: string;
  endDate: string;
  startMonthIndex: number;
  endMonthIndex: number;
  /** 横跨的自然月数，> 1 即为跨月块 */
  monthSpan: number;
  sortOrder: number;
  datePrecision: string;
  /**
   * 合并进来的每条原始记录（国家 + 名字 + 真实起止日期）。
   * 旺季块按月窗口跨国跨名合并后，块面上只能并列名字与国家标签，
   * 靠它在 tooltip 里还原「哪个国家的哪个旺季、具体哪几天」。
   */
  details: string[];
  /** 合并后同时含斋月国与非斋月国（跨类块），由 buildFestivalGroups 标注 */
  crossCategory?: boolean;
};

/** 国家标签固定顺序 */
const COUNTRY_TAG_ORDER: string[] = ['MY', 'TH', 'VN', 'PH', 'SG', 'ID'];

function countryRank(code: string): number {
  const index = COUNTRY_TAG_ORDER.indexOf(code);
  return index === -1 ? COUNTRY_TAG_ORDER.length : index;
}

/** 单条原始记录的可读摘要，用于合并块的 tooltip 明细 */
function detailOf(item: Festival): string {
  const span =
    item.endDate && item.endDate !== item.startDate
      ? `${item.startDate} ~ ${item.endDate}`
      : item.startDate;
  return `${item.countryCode} ${item.nameEn}${span ? ` · ${span}` : ''}`;
}

/**
 * 合并日历上的节日块，两套规则：
 *
 * 1. `common` / `country`（六国共同节日、本国法定节日）：
 *    **节日名（中文 + 英文）相同且 start_date / end_date 都相同** 才视为同一个节日，
 *    多个国家的记录合并成一个块并同时标注多个国家标签
 *    （例如 ID / MY 的「斋月 Ramadan」2/18–3/20 合并成一块，标 MY、ID 两个标签）。
 * 2. `marketing_node`（返校季 / 婚礼旺季 / 装修旺季 / 旅游旺季 / 学生假期 等旺季类）：
 *    **只要落在同一个「起止月」窗口就合并**，允许把不同名字、不同国家、起止日期相差几天到
 *    半个月的旺季并进同一个块（例如 ID 1/2–1/11、MY 1/1–1/18、SG 1/1–1/10 的返校季都是
 *    1 月窗口 → 合并成 1 个块，国家标签标 MY / SG / ID）。
 *    旺季本身是「月级别的需求周期」而不是某个具体日子，日历也只画到月粒度，
 *    因此合并 key 只有 `(section, 起始月, 结束月)`，刻意不含名字与具体日期；
 *    合并后 `startDate` / `endDate` 取并集（最早开始 ~ 最晚结束）作为区间提示。
 *    这样 SEA 视图的「旺季营销节点」行从十几条车道压到 4 条以内，不再霸占大半屏。
 *
 * 合并进来的所有事件名放在 `names` / `namesEn` 里（按原 sortOrder 去重排序）。
 */
export function mergeFestivals(list: Festival[]): FestivalBlock[] {
  const groups = new Map<string, FestivalBlock>();
  /** 每个块内收集的事件名（含 sortOrder，用于稳定排序与去重） */
  const nameBuckets = new Map<
    string,
    Array<{ cn: string; en: string; order: number }>
  >();
  for (const item of list) {
    const marketing = item.section === 'marketing_node';
    const key = [
      marketing ? 'marketing' : item.section === 'common' ? 'common' : 'local',
      // 旺季类只按「起止月窗口」合并，因此 key 里不含名字，也不含具体日期
      marketing ? '' : item.nameCn,
      marketing ? '' : item.nameEn,
      marketing ? '' : item.startDate,
      marketing ? '' : item.endDate,
      item.startMonthIndex,
      item.endMonthIndex,
    ].join('|');
    const bucket = nameBuckets.get(key);
    if (bucket) {
      bucket.push({ cn: item.nameCn, en: item.nameEn, order: item.sortOrder });
    } else {
      nameBuckets.set(key, [
        { cn: item.nameCn, en: item.nameEn, order: item.sortOrder },
      ]);
    }
    const existing = groups.get(key);
    if (existing) {
      if (!existing.countries.includes(item.countryCode)) {
        existing.countries.push(item.countryCode);
      }
      existing.sortOrder = Math.min(existing.sortOrder, item.sortOrder);
      existing.details.push(detailOf(item));
      /** 旺季块按月窗口合并，日期区间取并集，tooltip 才不会只显示某一国的日子 */
      if (item.startDate && item.startDate < existing.startDate) {
        existing.startDate = item.startDate;
      }
      if (item.endDate && item.endDate > existing.endDate) {
        existing.endDate = item.endDate;
      }
      continue;
    }
    groups.set(key, {
      id: key,
      countries: [item.countryCode],
      section: item.section,
      code: item.code,
      names: [item.nameCn],
      namesEn: [item.nameEn],
      nameCn: item.nameCn,
      nameEn: item.nameEn,
      startDate: item.startDate,
      endDate: item.endDate,
      startMonthIndex: item.startMonthIndex,
      endMonthIndex: item.endMonthIndex,
      monthSpan: item.endMonthIndex - item.startMonthIndex + 1,
      sortOrder: item.sortOrder,
      datePrecision: item.datePrecision,
      details: [detailOf(item)],
    });
  }
  const blocks = [...groups.values()];
  for (const block of blocks) {
    block.countries.sort((a, b) => countryRank(a) - countryRank(b));
    const bucket = nameBuckets.get(block.id) ?? [];
    const seen = new Set<string>();
    const ordered = [...bucket]
      .sort((a, b) => a.order - b.order)
      .filter(entry => {
        const dedupe = `${entry.cn}|${entry.en}`;
        if (seen.has(dedupe)) {
          return false;
        }
        seen.add(dedupe);
        return true;
      });
    block.names = ordered.map(entry => entry.cn);
    block.namesEn = ordered.map(entry => entry.en);
    block.nameCn = block.names[0] ?? '';
    block.nameEn = block.namesEn[0] ?? '';
    /** 明细按国家固定顺序去重排序，tooltip 里逐行列出 */
    block.details = [...new Set(block.details)].sort(
      (a, b) =>
        countryRank(a.slice(0, a.indexOf(' '))) -
          countryRank(b.slice(0, b.indexOf(' '))) || a.localeCompare(b),
    );
  }
  return blocks.sort(
    (a, b) =>
      a.startMonthIndex - b.startMonthIndex ||
      b.monthSpan - a.monthSpan ||
      a.sortOrder - b.sortOrder,
  );
}

/** 含斋月 / 开斋节类节日的市场 = 斋月国 */
export function resolveRamadanMarkets(festivals: Festival[]): Set<string> {
  const set = new Set<string>();
  for (const festival of festivals) {
    if (
      festival.section !== 'common' &&
      RAMADAN_CODE_PATTERN.test(festival.code)
    ) {
      set.add(festival.countryCode);
    }
  }
  return set;
}

export type FestivalGroup = {
  id: string;
  label: string;
  labelEn: string;
  /** 是否在节日名前显示国家标签 */
  showCountryTag: boolean;
  /** 配色语义：与 theme.ts 的 CALENDAR_COLORS 一一对应 */
  tone: 'common' | 'ramadan' | 'nonRamadan' | 'mixed' | 'seasonal';
  /** 合并后的节日块（可能跨月） */
  blocks: FestivalBlock[];
};

/**
 * 本国法定节日块（`section === 'country'`）的分组归属策略（合并后一个块可能带多个国家）：
 * - 国家全为斋月国 → 「斋月国节日」
 * - 国家全为非斋月国 → 「非斋月国节日」
 * - 合并后同时含两类（跨类块）→ 归入**国家数更多**的那一组，数量相同时归「斋月国节日」；
 *   只在这一组渲染一次，绝不复制到另一组，避免同一节日在日历里出现两遍；
 *   这类块用 Muse 色（`tone: 'mixed'`）单独标色，让人看出它同时覆盖两类市场。
 *   之所以不放进「六国共同节日」：那一组的语义是六国全覆盖的节日，
 *   把只覆盖部分国家的合并块塞进去会破坏该组口径。
 *
 * 旺季营销节点（`section === 'marketing_node'`）**不走这里**：它按时间跨度跨国跨名合并，
 * 天然覆盖多个市场，用斋月 / 非斋月去归类只会把新加坡这类非斋月国拽进「斋月国节日」行，
 * 因此单独成行（「旺季营销节点」）。
 */
function classifyBlock(
  block: FestivalBlock,
  ramadanMarkets: Set<string>,
): { group: 'ramadan' | 'non-ramadan'; mixed: boolean } {
  const ramadanCount = block.countries.filter(code =>
    ramadanMarkets.has(code),
  ).length;
  const otherCount = block.countries.length - ramadanCount;
  const mixed = ramadanCount > 0 && otherCount > 0;
  return {
    group: ramadanCount >= otherCount ? 'ramadan' : 'non-ramadan',
    mixed,
  };
}

/** 旺季营销节点行的固定标题（SEA 视图与单国视图共用同一口径） */
const SEASONAL_ROW = {
  id: 'seasonal',
  label: 'Seasonal peaks',
  labelEn: 'Seasonal Peaks',
  tone: 'seasonal',
} as const;

/**
 * 按当前国家筛选构造日历行分组（节日已按同期同名合并）。
 * - `SEA`：4 行 —— 六国共同节日 / 斋月国节日 / 非斋月国节日 / 旺季营销节点
 * - 具体国家：3 行 —— 六国共同节日 / 该国本国节日（仅法定节日） / 旺季营销节点
 *   旺季（返校季 / 婚礼旺季 / 装修旺季 / 旅游旺季 / 学生假期）是自造的营销周期而非节日，
 *   混进「本国节日」会让商家把它当成法定假日，因此单国视图也单独成行。
 */
export function buildFestivalGroups(
  festivals: Festival[],
  country: CountryCode,
  ramadanMarkets: Set<string>,
): FestivalGroup[] {
  /**
   * 先按当前国家裁剪再合并：单国视图必须只用该国自己的记录去合并，
   * 否则「3–5 月」这种月窗口会把别国的旺季名字（学生假期 / 旅游旺季 …）一起并进来，
   * 让该国的块显示出它其实没有的旺季。
   */
  const scoped =
    country === 'SEA'
      ? festivals
      : festivals.filter(
          item => item.section === 'common' || item.countryCode === country,
        );
  const blocks = mergeFestivals(scoped);
  const common = blocks.filter(block => block.section === 'common');
  const local = blocks.filter(block => block.section !== 'common');

  const commonGroup: FestivalGroup = {
    id: 'common',
    label: 'Common holidays',
    labelEn: 'Common',
    showCountryTag: false,
    tone: 'common',
    blocks: common,
  };

  if (country === 'SEA') {
    const ramadan: FestivalBlock[] = [];
    const nonRamadan: FestivalBlock[] = [];
    const seasonal: FestivalBlock[] = [];
    for (const block of local) {
      if (block.section === 'marketing_node') {
        /** 旺季块不参与斋月 / 非斋月判定，也不标跨类色 */
        block.crossCategory = false;
        seasonal.push(block);
        continue;
      }
      const verdict = classifyBlock(block, ramadanMarkets);
      block.crossCategory = verdict.mixed;
      (verdict.group === 'ramadan' ? ramadan : nonRamadan).push(block);
    }
    return [
      commonGroup,
      {
        id: 'ramadan',
        label: 'Ramadan markets',
        labelEn: `Ramadan · ${[...ramadanMarkets]
          .sort((a, b) => countryRank(a) - countryRank(b))
          .join('/')}`,
        showCountryTag: true,
        tone: 'ramadan',
        blocks: ramadan,
      },
      {
        id: 'non-ramadan',
        label: 'Non-Ramadan markets',
        labelEn: `Non-Ramadan · ${MARKET_CODES.filter(
          code => !ramadanMarkets.has(code),
        )
          .sort((a, b) => countryRank(a) - countryRank(b))
          .join('/')}`,
        showCountryTag: true,
        tone: 'nonRamadan',
        blocks: nonRamadan,
      },
      {
        ...SEASONAL_ROW,
        showCountryTag: true,
        blocks: seasonal,
      },
    ];
  }

  /** 单国视图：本国法定节日与旺季营销节点分成两行，单国内无需再标国家标签 */
  const countryFestivals: FestivalBlock[] = [];
  const seasonal: FestivalBlock[] = [];
  for (const block of local) {
    /** 单国视图不存在跨类问题 */
    block.crossCategory = false;
    (block.section === 'marketing_node' ? seasonal : countryFestivals).push(
      block,
    );
  }

  return [
    commonGroup,
    {
      id: `country-${country}`,
      label: `${COUNTRY_NAMES[country]} local holidays`,
      labelEn: `${country} Local`,
      showCountryTag: false,
      /** 单国视图：该国是斋月国就用绿色调，否则蓝色调，与 SEA 视图语义一致 */
      tone: ramadanMarkets.has(country) ? 'ramadan' : 'nonRamadan',
      blocks: countryFestivals,
    },
    {
      ...SEASONAL_ROW,
      showCountryTag: false,
      blocks: seasonal,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * 旺季营销节点 —— 甘特条带聚合（两种视角）
 *
 * 旧口径只按 `(起始月, 结束月)` 窗口合并（见 mergeFestivals 的 marketing 分支），
 * 窗口逐国逐季不同 → 十几个块在同一条时间轴上互相重叠、靠车道堆叠后同一批国家 /
 * 旺季名反复出现在相邻窗口块里，读起来像「重复」。
 *
 * 现在换聚合维度，并提供两种视角（页面顶部小切换器）：
 * 1. **按旺季甘特**：先按旺季类型分行，行内把「同旺季 + 同起止月窗口」的多国记录
 *    并成一条甘特条；每个旺季一支主题色；
 * 2. **按国家甘特**：先按国家分行，行内每条原始记录就是一条甘特条（条上写旺季名）；
 *    每个国家一支主题色（与 TGI 曲线的分国色同源）。
 *
 * 两种视角都满足：
 * - 不漏：每条原始 marketing_node 记录都进且只进一条条带；
 * - 不重：(国家 × 旺季 × 时段) 与原始记录一一对应，绝不会同一段被画两次；
 * - 简洁：同一问题只需扫一行。
 * ------------------------------------------------------------------ */

/** 甘特条带：同一旺季 + 同一起止月窗口的记录合并后的产物 */
export type SeasonalPeakBar = {
  id: string;
  /** 合并进来的国家（固定顺序），按旺季视角下 SEA 会有多国、单国视角只有一个 */
  countries: string[];
  /** 该条带的旺季类型（按国家视角时要写在条带上） */
  peakCn: string;
  peakEn: string;
  startMonthIndex: number;
  endMonthIndex: number;
  monthSpan: number;
  /** 区间并集（最早开始 ~ 最晚结束），tooltip 用 */
  startDate: string;
  endDate: string;
  /** 每条原始记录的可读明细（国家 + 名称 + 真实起止），tooltip 用 */
  details: string[];
};

/** 甘特的一行：按旺季视角 = 一个旺季类型；按国家视角 = 一个国家 */
export type GanttRow = {
  id: string;
  /** 行主键：旺季视角 = 旺季中文名；国家视角 = 国家码（取主题色用） */
  key: string;
  labelCn: string;
  labelEn: string;
  bars: SeasonalPeakBar[];
};

/**
 * 旺季类型的固定行顺序与中英文对照（口径与底表 festival_name_cn / _en 一致，
 * 只固定「怎么排 / 怎么显示」，不改数据本身）。
 */
export const SEASONAL_PEAK_ORDER: Array<{ cn: string; en: string }> = [
  { cn: '婚礼旺季', en: 'Wedding Peak' },
  { cn: '旅游旺季', en: 'Travel Peak' },
  { cn: '学生假期', en: 'School Vacation' },
  { cn: '返校季', en: 'Back to School' },
  { cn: '装修旺季', en: 'Home Renovation Peak' },
];

/** 旺季中文名 → 英文名（底表里同名记录的英文一致，这里只做兜底显示） */
const PEAK_EN_BY_CN = new Map(
  SEASONAL_PEAK_ORDER.map(item => [item.cn, item.en]),
);

/** 国家英文名（甘特行副标题用） */
export const COUNTRY_NAMES_EN: Record<CountryCode, string> = {
  SEA: 'Southeast Asia',
  MY: 'Malaysia',
  TH: 'Thailand',
  VN: 'Vietnam',
  PH: 'Philippines',
  SG: 'Singapore',
  ID: 'Indonesia',
};

/** 取当前视图口径下的旺季营销节点记录（与 buildFestivalGroups 的裁剪口径一致） */
function scopedMarketingNodes(
  festivals: Festival[],
  country: CountryCode,
): Festival[] {
  const scoped =
    country === 'SEA'
      ? festivals
      : festivals.filter(item => item.countryCode === country);
  return scoped.filter(item => item.section === 'marketing_node');
}

/**
 * 构造「按旺季类型」的甘特行。
 * - `SEA`：用全部六国的 marketing_node 记录；
 * - 具体国家：只用该国自己的记录。
 */
export function buildSeasonalPeakRows(
  festivals: Festival[],
  country: CountryCode,
): GanttRow[] {
  const marketing = scopedMarketingNodes(festivals, country);

  const byPeak = new Map<string, Festival[]>();
  for (const item of marketing) {
    const bucket = byPeak.get(item.nameCn);
    if (bucket) {
      bucket.push(item);
    } else {
      byPeak.set(item.nameCn, [item]);
    }
  }

  const rows: GanttRow[] = [];
  for (const { cn, en } of SEASONAL_PEAK_ORDER) {
    const items = byPeak.get(cn);
    if (!items || items.length === 0) {
      continue;
    }
    /** 行内按「起止月窗口」合并同旺季的多国记录 */
    const barMap = new Map<string, SeasonalPeakBar>();
    for (const item of items) {
      const key = `${item.startMonthIndex}-${item.endMonthIndex}`;
      const bar = barMap.get(key);
      if (bar) {
        if (!bar.countries.includes(item.countryCode)) {
          bar.countries.push(item.countryCode);
        }
        bar.details.push(detailOf(item));
        if (item.startDate && item.startDate < bar.startDate) {
          bar.startDate = item.startDate;
        }
        if (item.endDate && item.endDate > bar.endDate) {
          bar.endDate = item.endDate;
        }
      } else {
        barMap.set(key, {
          id: `${cn}-${key}`,
          countries: [item.countryCode],
          peakCn: cn,
          peakEn: en,
          startMonthIndex: item.startMonthIndex,
          endMonthIndex: item.endMonthIndex,
          monthSpan: item.endMonthIndex - item.startMonthIndex + 1,
          startDate: item.startDate,
          endDate: item.endDate || item.startDate,
          details: [detailOf(item)],
        });
      }
    }
    const bars = [...barMap.values()];
    for (const bar of bars) {
      bar.countries.sort((a, b) => countryRank(a) - countryRank(b));
      bar.details = [...new Set(bar.details)].sort(
        (a, b) =>
          countryRank(a.slice(0, a.indexOf(' '))) -
            countryRank(b.slice(0, b.indexOf(' '))) || a.localeCompare(b),
      );
    }
    bars.sort(
      (a, b) =>
        a.startMonthIndex - b.startMonthIndex ||
        a.endMonthIndex - b.endMonthIndex ||
        countryRank(a.countries[0]) - countryRank(b.countries[0]),
    );
    rows.push({ id: `peak-${cn}`, key: cn, labelCn: cn, labelEn: en, bars });
  }
  return rows;
}

/**
 * 构造「按国家」的甘特行：一个国家一行，行内每条原始 marketing_node 记录
 * 就是一条甘特条（同国 + 同旺季 + 完全相同起止月的重复记录才会被并成一条）。
 * - `SEA`：六国各一行（MY/TH/VN/PH/SG/ID 固定顺序）；
 * - 具体国家：只有该国一行。
 */
export function buildCountryPeakRows(
  festivals: Festival[],
  country: CountryCode,
): GanttRow[] {
  const marketing = scopedMarketingNodes(festivals, country);
  const codes = country === 'SEA' ? MARKET_CODES : [country as MarketCode];

  const rows: GanttRow[] = [];
  for (const code of codes) {
    const items = marketing.filter(item => item.countryCode === code);
    if (items.length === 0) {
      continue;
    }
    const barMap = new Map<string, SeasonalPeakBar>();
    for (const item of items) {
      const key = `${item.nameCn}-${item.startMonthIndex}-${item.endMonthIndex}`;
      const bar = barMap.get(key);
      if (bar) {
        bar.details.push(detailOf(item));
        if (item.startDate && item.startDate < bar.startDate) {
          bar.startDate = item.startDate;
        }
        if (item.endDate && item.endDate > bar.endDate) {
          bar.endDate = item.endDate;
        }
        continue;
      }
      barMap.set(key, {
        id: `${code}-${key}`,
        countries: [code],
        peakCn: item.nameCn,
        peakEn: item.nameEn || PEAK_EN_BY_CN.get(item.nameCn) || '',
        startMonthIndex: item.startMonthIndex,
        endMonthIndex: item.endMonthIndex,
        monthSpan: item.endMonthIndex - item.startMonthIndex + 1,
        startDate: item.startDate,
        endDate: item.endDate || item.startDate,
        details: [detailOf(item)],
      });
    }
    const bars = [...barMap.values()];
    for (const bar of bars) {
      bar.details = [...new Set(bar.details)].sort();
    }
    /** 先按起始月、再按跨度（长条在上，短条往下排车道），最后按固定旺季顺序 */
    const peakRank = (cn: string) =>
      SEASONAL_PEAK_ORDER.findIndex(item => item.cn === cn);
    bars.sort(
      (a, b) =>
        a.startMonthIndex - b.startMonthIndex ||
        b.monthSpan - a.monthSpan ||
        peakRank(a.peakCn) - peakRank(b.peakCn),
    );
    rows.push({
      id: `market-${code}`,
      key: code,
      labelCn: COUNTRY_NAMES[code],
      labelEn: COUNTRY_NAMES_EN[code],
      bars,
    });
  }
  return rows;
}

export type ClimateRow = {
  countryCode: string;
  monthNum: number;
  monthLabel: string;
  tempMin: number | null;
  tempMax: number | null;
  tempDisplay: string;
  humidityMin: number | null;
  humidityMax: number | null;
  humidityDisplay: string;
  precipitation: number | null;
  uvMin: number | null;
  uvMax: number | null;
  uvDisplay: string;
  season: string;
};

/**
 * SEA Climate 表列位（2026 版）：
 * A sort_order / B year / C country_code / D month_num / E month_label
 * F temp_min_c / G temp_max_c / H temperature_range_display
 * I humidity_min_pct / J humidity_max_pct / K humidity_range_display
 * L precipitation_mm / M uv_index_min / N uv_index_max / O uv_index_range_display
 * P season
 */
export function parseClimate(matrix: SheetMatrix): ClimateRow[] {
  const list: ClimateRow[] = [];
  for (const row of matrix) {
    if (!row) {
      continue;
    }
    const countryCode = asText(row[2]);
    const monthNum = asNumber(row[3]);
    if (!countryCode || monthNum === null) {
      continue;
    }
    list.push({
      countryCode,
      monthNum,
      monthLabel: asText(row[4]) || `Month ${monthNum}`,
      tempMin: asNumber(row[5]),
      tempMax: asNumber(row[6]),
      tempDisplay: asText(row[7]),
      humidityMin: asNumber(row[8]),
      humidityMax: asNumber(row[9]),
      humidityDisplay: asText(row[10]),
      precipitation: asNumber(row[11]),
      uvMin: asNumber(row[12]),
      uvMax: asNumber(row[13]),
      uvDisplay: asText(row[14]),
      season: asText(row[15]),
    });
  }
  return list;
}

export function findClimate(
  rows: ClimateRow[],
  country: string,
  monthNum: number,
): ClimateRow | undefined {
  return rows.find(
    row => row.countryCode === country && row.monthNum === monthNum,
  );
}

/** 湿度取区间均值，表里改成 min/max 两列后统一在这里换算 */
export function averageHumidity(row: ClimateRow): number | null {
  const values = [row.humidityMin, row.humidityMax].filter(
    (item): item is number => item !== null,
  );
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

/** 一句话总结当月气候特征与选品提示 */
export function summarizeClimate(row: ClimateRow): string {
  const parts: string[] = [];
  const max = row.tempMax ?? 0;
  if (max >= 32) {
    parts.push('Hot');
  } else if (max >= 28) {
    parts.push('Warm');
  } else if (max >= 24) {
    parts.push('Mild');
  } else {
    parts.push('Cool');
  }

  const humidity = averageHumidity(row) ?? 0;
  if (humidity >= 82) {
    parts.push('very humid');
  } else if (humidity >= 72) {
    parts.push('humid');
  } else {
    parts.push('dry');
  }

  const climate = `${parts.join(', ')} · ${row.season || 'transitional season'}`;

  const advices: string[] = [];
  const rain = row.precipitation ?? 0;
  if (rain >= 250) {
    advices.push('Heavy rain; rain protection and fast-drying materials may be useful');
  } else if (rain >= 120) {
    advices.push('Use moisture-resistant packaging and rain protection');
  } else if (rain <= 40) {
    advices.push('Low rainfall; hydration and cooling may be useful');
  } else {
    advices.push('Moderate rainfall; consider seasonal changes');
  }
  if ((row.uvMax ?? 0) >= 3) {
    advices.push('Stronger UV; plan sun protection');
  }
  if (max >= 32) {
    advices.push('Consider cool, breathable materials');
  } else if (max <= 22) {
    advices.push('Consider warmer materials');
  }

  return `${climate}. ${advices.join('; ')}.`;
}
