import { type SheetMatrix, asText } from './sheet';

/**
 * Optional display-only category translation map.
 * The current fictional taxonomy supplies no translations, but the parser remains
 * for component compatibility. Ambiguous duplicate leaf names are omitted.
 */
export type CategoryCnMap = {
  /** key = `cnKey(l1, leaf)` → 中文名 */
  byParent: Map<string, string>;
  /** key = 归一化英文三级类目名 → 中文名（存在歧义的英文名不收录） */
  byLeaf: Map<string, string>;
};

/** 读不到 / 为空时的共享空映射（对象复用，避免下游 memo 无谓失效） */
export const EMPTY_CATEGORY_CN: CategoryCnMap = {
  byParent: new Map(),
  byLeaf: new Map(),
};

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/** 带父级的映射键：`L1|三级类目英文名`（两侧都做 trim + 小写归一） */
export function cnKey(l1: string, leaf: string): string {
  return `${normalize(l1)}\u0001${normalize(leaf)}`;
}

/** 解析中文翻译表 → 两级索引（表头行会被自动跳过，多读到的空行忽略） */
export function parseCategoryCn(matrix: SheetMatrix): CategoryCnMap {
  const byParent = new Map<string, string>();
  const byLeaf = new Map<string, string>();
  /** 英文名重复且中文不一致 → 记入歧义集合，从 byLeaf 里剔除 */
  const ambiguous = new Set<string>();

  for (const row of matrix) {
    if (!row) {
      continue;
    }
    const l1 = asText(row[0]);
    const leaf = asText(row[3]);
    const cn = asText(row[4]);
    if (!leaf || !cn) {
      continue;
    }
    // 万一 range 把表头带进来（或表头位置变动），按列名直接跳过
    if (normalize(leaf) === 'third_category_name') {
      continue;
    }
    byParent.set(cnKey(l1, leaf), cn);

    const leafKey = normalize(leaf);
    const known = byLeaf.get(leafKey);
    if (known === undefined) {
      byLeaf.set(leafKey, cn);
      continue;
    }
    if (known !== cn) {
      ambiguous.add(leafKey);
    }
  }

  for (const key of ambiguous) {
    byLeaf.delete(key);
  }
  return { byParent, byLeaf };
}

/**
 * 取某个三级类目的中文名：先按 `L1|英文名` 精确命中，取不到再退化成只按英文名匹配。
 * 查不到一律返回空串，调用方直接按「只显示英文」处理，不要渲染占位文案。
 */
export function categoryCnName(
  map: CategoryCnMap,
  l1: string,
  leaf: string,
): string {
  if (!leaf) {
    return '';
  }
  return (
    map.byParent.get(cnKey(l1, leaf)) ?? map.byLeaf.get(normalize(leaf)) ?? ''
  );
}
