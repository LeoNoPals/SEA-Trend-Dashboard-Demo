/**
 * TikTok for Business 品牌视觉体系（深色 + 浅色两套色板）。
 * 颜色全部取自 TT4B 品牌规范：
 * - Core colors：TikTok Black #000000、TikTok White #FFFFFF、Glint #2DCCD3、Blaze #F1204A
 * - Secondary colors：Thrive #033624、Shimmer #BAF6F0、Dawn #EDBBE8、Ember #4A0505、
 *   Glow #FBEB35、Muse #EDD4B2
 * 配色遵循品牌 pairing 规则（Hero：Blaze × Glint；Tertiary：Blaze/Glint × 辅助色）。
 *
 * ── 本文件与 CSS 变量的分工 ────────────────────────────────────────────────
 * DOM 上能用 CSS 的地方（底色 / 文字 / 边框）一律走 src/routes/index.css 的
 * `data-theme` 语义变量；这里只保留 **必须是真实色值字符串** 的部分 ——
 * Recharts 的 stroke/fill、内联 style 里的数据可视化色值等（拿不到 var()）。
 * 所以下面每个与主题相关的导出都是 `getXxx(mode)` 形式，由组件通过
 * `useThemeMode()` 取到当前主题后再取色板；同一主题下返回同一个对象引用，
 * 不会破坏 `React.memo` 的浅比较。
 *
 * ── 浅色色板的总体决策（本版：严格按 TT4B 官方色板重建）────────────────────
 * 品牌色板的结构特点是「只有极饱和核心色 + 极浅粉彩 / 极深墨色两端，没有中间调」。
 * 上一版浅色是把深色色值「提亮 / 压深一档」硬凑的，产出了一批品牌色板里不存在的
 * 杂色（最扎眼的是 #3F6ACF 蓝 —— 品牌色板里根本没有蓝色），这才是「配色奇怪」的
 * 根因。本版重建时守住四条硬规则：
 *
 * 1. **色相锁定**：浅色所有配色的色相只能来自品牌色板的 7 个色相 ——
 *    Blaze 347.9° / Ember 0° / Muse 34.6° / Glow 55.2° / Thrive 158.8° /
 *    Shimmer 174.0° / Glint 182.5° / Dawn 306.0°，外加黑 / 白 / 中性灰。
 *    **严禁出现品牌色板里没有的色相，尤其是蓝色（200°~270°）。**
 * 2. **只调明度 / 饱和度，不改色相**：品牌色在白底上对比度不够时（Shimmer 1.20:1、
 *    Glow 1.23:1、Muse 1.43:1、Dawn 1.63:1、Glint 1.96:1 全部不能当线 / 当字），
 *    沿该色的色相往深处取一档；极深色（Thrive 13.49:1、Ember 15.97:1）当浅底或
 *    当中间调时往浅处取。每个派生色下面都注明「沿 Xxx 色相压深 / 提亮」。
 * 3. **能用品牌原色就直接用**：白底 #FFFFFF、主文字 #000000、数据可视化主色
 *    Blaze #F1204A、色块底 Shimmer #BAF6F0 / Glint #2DCCD3 / Glow #FBEB35、
 *    深色文字锚点 Thrive #033624 / Ember #4A0505 全部是品牌原色，未做任何微调。
 * 4. **遵循官方 Pairings**：色块底 + 其上文字的搭配落在官方 pairing 上 ——
 *    爆发期＝Ember + Blaze（Blaze Tertiary）、清仓期＝Thrive + Glint（Secondary）
 *    与 Shimmer + Glint（Glint Tertiary）、备货期＝Glow + Blaze 的暖感延伸。
 *
 * ── 可读性门槛（两档，不要混用）──────────────────────────────────────────
 * - **色块上的文字**（热力图单元格 / 节日 pill / 阶段标注）：文字 vs 底色 ≥ 4.5:1；
 * - **非文本图形**（折线 / 柱体 / 气泡 / 图例色块 / 参考线）：≥ 3:1 即可。
 *   WCAG 里 4.5:1 是文本门槛、3:1 才是图形门槛；把图形也按文本门槛压深，白底上
 *   就会得到一屏又重又闷的深浊色（这是上一版的实际问题）。
 * - 正文 / 坐标轴 / 数据标签走 CSS 语义变量或 ColorTokens.axis / muted，
 *   白底 ≥ 4.5:1，与「线条色」是两套独立取值，提亮线条不会拉低任何文字对比度。
 *
 * ── 本轮「深浅配色总原则」（用户口径：深色更深、浅色更浅）──────────────────
 * 1. **热力图色阶**：浅色的备货（Glow 黄）与清仓（Glint 青）两条 5 档色阶整体
 *    「再浅一档」（爆发红按要求原样不动）；深色三条色阶整体「再深一档」
 *    （往卡片黑底多压一个档距，5 档跨度不变、层级差异保持）。
 * 2. **分类色板（CBEC L1）与分国折线色**：浅色**直接复用深色模式的品牌原色**，
 *    不再单独维护一套「压深过的中间调」（那套在白底上显得脏重）。
 *    色块 / 折线一律是**纯品牌原色单层渲染**：不描边、不加深、不外发光。
 *    Shimmer / Glow / Muse / Dawn 在白底上的对比度只有 1.2~1.6:1，这是
 *    用户明确知晓并确认的设计取舍，代码里不做任何「可见性补偿」。
 *    - 唯一无法照搬的是 TikTok White：白底上 1:1、彻底不可见，
 *      按「深色主线＝全图最重的锚定色」的同构关系换成品牌原色 TikTok Black。
 */

/** 当前主题（真值挂在 `<html data-theme>` 上，见 src/hooks/useTheme.tsx） */
export type ThemeMode = 'dark' | 'light';

/** TT4B 品牌色板（唯一色值来源，禁止在组件里另造颜色） */
export const BRAND = {
  black: '#000000',
  white: '#FFFFFF',
  glint: '#2DCCD3',
  blaze: '#F1204A',
  thrive: '#033624',
  shimmer: '#BAF6F0',
  dawn: '#EDBBE8',
  ember: '#4A0505',
  glow: '#FBEB35',
  muse: '#EDD4B2',
} as const;

/* ------------------------------------------------------------------ *
 * 色值工具（纯函数，与主题无关）
 * ------------------------------------------------------------------ */

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map(v =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** 在两个色值间线性插值，t=0 取 from、t=1 取 to */
export function mixHex(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const k = clamp01(t);
  const out = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `#${out.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/** 给品牌色加透明度：深色底上做低强度底色 / 描边 */
export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** RGB(0-255) → HSL(0-1) */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

/** HSL(0-1) → RGB(0-255) */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) {
      tt += 1;
    }
    if (tt > 1) {
      tt -= 1;
    }
    if (tt < 1 / 6) {
      return p + (q - p) * 6 * tt;
    }
    if (tt < 1 / 2) {
      return q;
    }
    if (tt < 2 / 3) {
      return p + (q - p) * (2 / 3 - tt) * 6;
    }
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  ];
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

/** 感知亮度，用于自动选深色 / 浅色文字 */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** HSV 提亮：等比放大 RGB，色相与饱和度不变，只把明度往上推（深底色 → 黑底可读） */
function brighten(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const peak = Math.max(r, g, b, 1);
  const k = Math.min(factor, 255 / peak);
  return rgbToHex(r * k, g * k, b * k);
}

/**
 * 浅色底专用「色墨化」：把品牌色压到指定明度（默认 32%）并保底饱和度，
 * 得到白底上可读的同色相深色（文字 / 描边用）。
 * 无彩色（白 / 灰）不能按色相压深，否则会凭空长出色相，直接落到中性深灰。
 */
function inkOf(hex: string, targetL = 0.32): string {
  const [h, s, l] = hexToHsl(hex);
  if (s < 0.06) {
    return hslToHex(0, 0, Math.min(l, targetL));
  }
  return hslToHex(h, Math.max(s, 0.45), Math.min(l, targetL));
}

/* ------------------------------------------------------------------ *
 * 基础语义色（图表坐标轴 / 网格 / 参考线等必须给真实色值的地方）
 * ------------------------------------------------------------------ */

export type ColorTokens = {
  /** 页面背景 */
  page: string;
  /** 卡片背景（图表内标注垫底、末端点描边等要与卡片底色一致） */
  surface: string;
  /** 卡片内嵌区（表头）背景 */
  surfaceStrong: string;
  /** 主色：Blaze */
  primary: string;
  /** 强调色：Glint */
  accent: string;
  /** Glint 深一档：辅助线用 */
  accentDeep: string;
  /** 备货期：Glow */
  warn: string;
  /** 负向：Blaze */
  alert: string;
  /** 中性灰：对照组、常规期、大盘均值线 */
  base: string;
  /** 次要文字（图表标签） */
  muted: string;
  /** 网格线 */
  grid: string;
  /** 坐标轴文字 */
  axis: string;
};

const COLORS_BY_MODE: Record<ThemeMode, ColorTokens> = {
  /** 深色：与改造前 `COLORS` 逐值一致 */
  dark: {
    page: '#000000',
    surface: '#0D0D0D',
    surfaceStrong: '#171717',
    primary: BRAND.blaze,
    accent: BRAND.glint,
    accentDeep: '#1E9CA1',
    warn: BRAND.glow,
    alert: BRAND.blaze,
    base: '#737373',
    muted: '#A3A3A3',
    grid: 'rgba(255,255,255,0.10)',
    axis: '#A3A3A3',
  },
  /**
   * 浅色（本版全部沿品牌色相推导，逐值标注来源）：
   * - page / surfaceStrong 用**纯中性灰**（R=G=B），上一版 #F7F7F8 / #F1F2F4 带蓝味，
   *   是「一屏发闷」的隐形来源之一；中性灰属中性色，不算越界，但绝不能染色相；
   * - primary / alert 直接用 **品牌原色 Blaze #F1204A**（白底 4.16:1，作为柱体 /
   *   气泡 / 参考线这类非文本图形已过 3:1 门槛，不需要压深）；
   * - accent 沿 Glint 色相（182.5°）压深到 #1CA4A9（白底 3.03:1）：Glint 本色
   *   #2DCCD3 只有 1.96:1，做不了参考线；accentDeep 再深一档到 #186D71（6.06:1）；
   * - warn 沿 Glow 色相（55.2°）压深到 #A39500（3.06:1）：Glow 本色仅 1.23:1；
   * - muted / axis 是**真文字**（Recharts 坐标轴与数据标签），取中性 #5A5A5A，
   *   白底 6.90:1 过 AA；base 是对照线（图形）取 #8E8E8E（3.28:1）；
   * - grid 用纯黑 4%~10%（不再是带蓝的 rgba(15,18,25)）。
   */
  light: {
    /** 中性浅灰页面底（纯中性，无色相） */
    page: '#F5F5F5',
    /** 品牌原色 TikTok White */
    surface: '#FFFFFF',
    /** 中性灰内嵌区（表头），比卡片低一档 */
    surfaceStrong: '#EFEFEF',
    /** 品牌原色 Blaze */
    primary: BRAND.blaze,
    /** 沿 Glint 色相压深（白底 3.03:1，图形门槛 3:1） */
    accent: '#1CA4A9',
    /** 沿 Glint 色相压深两档（白底 6.06:1） */
    accentDeep: '#186D71',
    /** 沿 Glow 色相压深（白底 3.06:1） */
    warn: '#A39500',
    /** 品牌原色 Blaze */
    alert: BRAND.blaze,
    /** 中性灰，对照线用（白底 3.28:1，图形门槛） */
    base: '#8E8E8E',
    /** 中性灰，图表文字用（白底 6.90:1，过 AA） */
    muted: '#5A5A5A',
    /** 品牌原色 TikTok Black 10% */
    grid: 'rgba(0,0,0,0.10)',
    /** 中性灰，坐标轴文字（白底 6.90:1） */
    axis: '#5A5A5A',
  },
};

/** 取当前主题的基础语义色 */
export function getColors(mode: ThemeMode): ColorTokens {
  return COLORS_BY_MODE[mode];
}

/* ------------------------------------------------------------------ *
 * 图表专用零散色值（象限辅助线、hover 描边、标注垫底…）
 * ------------------------------------------------------------------ */

export type ChartTokens = {
  /** 象限辅助线 / 刻度线的蓝色点缀 */
  guide: string;
  /** 坐标轴线 */
  axisLine: string;
  /** 坐标轴标题文字（TGI） */
  axisLabel: string;
  /** 爆发线标注文字 */
  burstLabel: string;
  /** hover 十字线 */
  cursorStroke: string;
  /** hover 柱体高亮底 */
  cursorFill: string;
  /** 气泡 hover 描边 */
  hoverStroke: string;
  /** 图内文字标注的垫底色（与卡片底同色） */
  plate: string;
  /** 垫底透明度：浅色底要更实一点才能压住曲线 */
  plateOpacity: number;
};

const CHART_BY_MODE: Record<ThemeMode, ChartTokens> = {
  dark: {
    guide: 'rgba(45,204,211,0.55)',
    axisLine: 'rgba(45,204,211,0.35)',
    axisLabel: BRAND.shimmer,
    burstLabel: '#F8657F',
    cursorStroke: 'rgba(255,255,255,0.15)',
    cursorFill: 'rgba(255,255,255,0.05)',
    hoverStroke: '#FFFFFF',
    plate: '#0D0D0D',
    plateOpacity: 0.82,
  },
  /**
   * 浅色：象限辅助线 / 坐标轴装饰沿 **Glint 色相**推导（品牌里这支青就是「点缀色」），
   * hover 十字线与柱体高亮底改用 **品牌原色 TikTok Black** 的低透明度
   * （上一版用带蓝的 rgba(15,18,25)）。
   */
  light: {
    /** 沿 Glint 色相压深 50% 透明（图形装饰） */
    guide: 'rgba(28,164,169,0.50)',
    /** 沿 Glint 色相压深 32% 透明 */
    axisLine: 'rgba(28,164,169,0.32)',
    /** 坐标轴标题是真文字：沿 Glint 色相压深到白底 6.06:1 */
    axisLabel: '#186D71',
    /** 爆发线标注是真文字：沿 Blaze 色相压深到白底 6.44:1 */
    burstLabel: '#BD0C30',
    /** 品牌原色 TikTok Black 16% */
    cursorStroke: 'rgba(0,0,0,0.16)',
    /** 品牌原色 TikTok Black 5% */
    cursorFill: 'rgba(0,0,0,0.05)',
    /** 品牌原色 TikTok Black */
    hoverStroke: BRAND.black,
    /** 品牌原色 TikTok White（与卡片底同色） */
    plate: BRAND.white,
    plateOpacity: 0.9,
  },
};

export function getChartTokens(mode: ThemeMode): ChartTokens {
  return CHART_BY_MODE[mode];
}

/**
 * 爆发期主色：品牌红 Blaze（#F1204A）。
 *
 * 历史：曾一度改成 Thrive 品牌绿（commit 664e127），实际使用后确认「爆发 = 红」
 * 才是运营心智里最直觉的映射（绿在电商语境更像「安全 / 达标」），因此回退到
 * 改绿之前的那一支红，深浅两套主题的爆发期都用它派生。
 *
 * 与品牌红强调色的关系（会不会分不清「爆发色块」和「可点元素」）：
 * - 深色：强调色实底就是 Blaze 本色 #F1204A，而热力图爆发 5 档是 Blaze 往卡片黑底
 *   压深后的 #A32740~#D22F50，最亮一档也比强调色暗一档（明度 50% vs 54%、
 *   饱和度 64% vs 88%），且爆发色块只出现在热力表格单元格里、强调色只出现在
 *   按钮 / 链接 / 选中态上，位置与形态都不重叠；
 * - 浅色：爆发 5 档是白 → Blaze 的淡化梯度 #FEEEF2~#F77E96（明度 73%~96%），
 *   与强调色 Blaze #F1204A / #E90F3B（明度 49%~54%）之间留着 20% 以上的明度差，
 *   不会互相冒充。
 * 命名刻意不带颜色语义（不叫 BURST_RED），下次再换色时不用改调用方。
 */
export const BURST_COLOR = BRAND.blaze;

/** Blaze 阶梯色板（浅 → 深），排名 / 堆叠用；Top1 取最深 */
export const SEQ_ROSE = [
  '#3A0A17',
  '#5C0F23',
  '#8C1630',
  '#B81A3A',
  '#D71D44',
  '#F1204A',
] as const;

/** Glint 阶梯色板（浅 → 深），点缀用 */
export const SEQ_CYAN = ['#2DCCD3', '#26B2B8', '#1E9CA1', '#178489'] as const;

/* ------------------------------------------------------------------ *
 * 浅色底上的「同色相压深档」（唯一色值来源）
 *
 * ── 本轮定位变化（重要）────────────────────────────────────────────
 * 上一版这张表是**浅色分类色板本体**：一级行业（CBEC L1）色板与分国折线色在
 * 浅色下都从这里逐位取色，也就是把品牌粉彩（Glow / Shimmer / Muse / Dawn）
 * 统统压成中间调再用。用户实际观感是「脏、重」，本轮按指示改为
 * **浅色直接复用深色模式的品牌原色**（见 L1_PALETTE_BY_MODE / SERIES_COLORS_BY_MODE）。
 *
 * 所以这张表现在只保留三类仍然需要「压深档」的角色：
 *   1. 柱体渐变的混色目标（barColor 的浅色分支）；
 *   2. 阶段色块的描边（PHASE_META light 的 border）；
 *   3. 分国折线里 TTL 主线的锚定色（品牌黑）与图例灰位替补。
 * 「品牌原色在白底上看不见」这件事**不做任何补偿**：既不换色，也不描边 ——
 * 浅色下的色块与折线就是纯品牌原色，这是用户确认过的设计取舍。
 * ------------------------------------------------------------------ */
const LIGHT_CATEGORY = {
  /** 品牌原色 Blaze #F1204A（347.9°）：白底 4.16:1 */
  red: '#F1204A',
  /** 沿 Glint 色相（182.1°）压深：白底 3.03:1（Glint 原色只有 1.96:1） */
  cyan: '#1CA4A9',
  /** 沿 Glow 色相（54.8°）压深：白底 3.06:1（Glow 原色只有 1.23:1） */
  amber: '#A39500',
  /**
   * 中性灰：L1 色板第 7 位在深色是 **TikTok White**，白底上是 1.00:1
   * （完全不可见），只能落到中性灰（中性色不算越界，但绝不染色相）。白底 4.74:1。
   * 说明：当前演示分类只有 6 个 L1，这一位实际用不到，留作扩展。
   */
  gray: '#737373',
  /**
   * 品牌原色 TikTok Black #000000：TTL（大盘总和）主线。
   * 深色主线是 TikTok White（黑底上最重的锚定色），白底上它 1:1 彻底不可见，
   * 按同构关系换成品牌黑 —— 仍是全图最重的一支，6 条分国彩线压不住它。
   */
  ink: '#000000',
} as const;

/**
 * 一级行业（CBEC L1）离散配色。
 *
 * ── 本轮改动：浅色 = 深色（逐值相同）──────────────────────────────
 * 两套主题**共用同一批 TT4B 品牌原色**（Core：Blaze / Glint / White；
 * Secondary：Glow / Dawn / Shimmer / Muse）。上一版浅色是把这批粉彩沿色相
 * 压深成中间调（#1CA4A9 / #A39500 / #8F2884 / #07583C / #68491D），
 * 对比度是够了，但在白底上又重又浊 —— 本轮按指示回到品牌原色。
 *
 * 唯一例外：第 7 位深色是 **TikTok White**，白底上 1:1 完全不可见，
 * 浅色落到中性灰 `LIGHT_CATEGORY.gray`（当前 6 个 L1 用不到这一位）。
 *
 * 白底可见性：Shimmer / Glow / Muse / Dawn / Glint 这几支对比度只有 1.2~2.0:1，
 * 气泡 / 柱体 / 图例方块**一律纯色填充、不加描边**（用户已明确否决描边补偿）。
 * 类目名等文字一律走语义变量，不取这里的色值。
 */
const L1_PALETTE_BY_MODE: Record<ThemeMode, readonly string[]> = {
  dark: [
    BRAND.blaze,
    BRAND.glint,
    BRAND.glow,
    BRAND.dawn,
    BRAND.shimmer,
    BRAND.muse,
    BRAND.white,
    '#F8657F',
  ],
  light: [
    BRAND.blaze,
    BRAND.glint,
    BRAND.glow,
    BRAND.dawn,
    BRAND.shimmer,
    BRAND.muse,
    /** 深色此位是 TikTok White，白底不可见 → 中性灰替补（见 LIGHT_CATEGORY.gray） */
    LIGHT_CATEGORY.gray,
    '#F8657F',
  ],
};

/** 兼容旧引用：深色调色板 */
export const L1_PALETTE = L1_PALETTE_BY_MODE.dark;

export function getL1Palette(mode: ThemeMode): readonly string[] {
  return L1_PALETTE_BY_MODE[mode];
}

/** 按名称稳定分配 L1 颜色（同一份数据每次渲染颜色一致） */
export function buildL1Colors(
  names: string[],
  mode: ThemeMode = 'dark',
): Record<string, string> {
  const palette = L1_PALETTE_BY_MODE[mode];
  const sorted = [...new Set(names.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'en'),
  );
  const map: Record<string, string> = {};
  sorted.forEach((name, index) => {
    map[name] = palette[index % palette.length];
  });
  return map;
}

export type Phase = 'burst' | 'stock' | 'clear' | 'normal';

/** 阶段定义（唯一口径来源，页面所有说明文案都引用这里） */
export const PHASE_RULE: Record<Phase, string> = {
  burst: 'Peak: months with TGI>120',
  stock: 'Stock-up: two months before a peak starts',
  clear: 'Clearance: first post-peak month with TGI<100',
  normal: 'Normal: months outside the other three phases',
};

export type PhaseStyle = {
  label: string;
  short: string;
  /** 单元格底色 */
  bg: string;
  /** 单元格文字色 */
  fg: string;
  /** 单元格描边 */
  border: string;
  /** 折线图阶段条带底色（半透明，不压住曲线） */
  band: string;
  /** 阶段主色文字（条带标注、摘要卡） */
  text: string;
};

/* ------------------------------------------------------------------ *
 * 热力单元格染色
 * 深色：纯色块（无渐变 / 无辉光 / 无描边高光），算法与改造前完全一致
 * 浅色：见 LIGHT_HEAT_SCALE 的注释，改成「浅色调 5 档 + 同色相深字」
 * ------------------------------------------------------------------ */

/** 单元格未着色时的底色（与卡片底一致，保证 depth=0 时无缝） */
const CELL_BASE = '#0D0D0D';

/**
 * 饱和度削减比例：0 = 原色，1 = 完全中性灰。
 * 品牌色（Blaze / Glow / Glint）本身已比霓虹色柔和，这里只做轻度降饱和，
 * 既保留上一轮「不刺眼」的观感，也不偏离品牌色相。
 */
const HEAT_DESATURATE = 0.22;

/** 朝同亮度灰色靠拢，只降饱和不降亮度 */
function desaturate(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const k = clamp01(amount);
  const out = [r, g, b].map(v => Math.round(v + (gray - v) * k));
  return `#${out.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/** 阶段色相（已降饱和），单元格与图例共用同一份，保证观感一致 */
function heatHue(phase: Exclude<Phase, 'normal'>): string {
  return desaturate(HEAT_SCALE[phase].color, HEAT_DESATURATE);
}

/** 色阶数量：每个阶段固定 5 档，避免出现过暗、难以分辨的色块 */
export const HEAT_LEVELS = 5;

/**
 * 染色标尺（染色前先定上下限与阈值，再按 TGI 映射到 5 档色阶）：
 * - `minDepth` / `maxDepth`：颜色深度的下限与上限（**只作用于深色主题**：
 *   深度 = 品牌色往卡片黑底 #0D0D0D 的混色比例，越大越接近品牌原色 = 越亮）
 * - `shallowAt`：落在最浅一档的 TGI 阈值
 * - `deepAt`：落在最深一档的 TGI 阈值
 *
 * 方向由两个阈值的大小关系决定：
 * - 爆发期 `shallowAt(120) → deepAt(300)`：**TGI 越高越深**
 * - 备货期 `shallowAt(115) → deepAt(25)`、清仓期 `shallowAt(100) → deepAt(20)`：**TGI 越低越深**
 *
 * ── 本轮改动：深色三条色阶整体「再深一档」──────────────────────────
 * 按「深色模式的颜色应该深一点」这条总原则，把上下限**同时下移一个档距**
 * （5 档 → 每档 = (max-min)/4），色阶跨度保持原样，所以 5 档之间的层级差
 * 一点没变、只是整体往黑底压了一档：
 *   爆发 0.76~1.00 → 0.70~0.94（白字 4.93~7.19 → 5.41~7.94:1，全档过 AA）
 *   备货 0.73~0.96 → 0.67~0.90（Glow 黄本身高明度，白字仍偏低，见下）
 *   清仓 0.73~0.96 → 0.67~0.90（白字 2.30~3.72 → 2.60~4.27:1）
 * 说明（诚实标注）：深色下三阶段单元格统一用白字（既有决策），Glow 黄与 Glint
 * 青属高明度品牌色，白字本来就达不到 AA 4.5:1；`heatCellStyle` 对感知亮度
 * > 0.5 的底色补一层深色投影兜底。本轮加深让**每一档的白字对比度都变好**
 * （备货 1.39~2.34 → 1.58~2.73、清仓 2.30~3.72 → 2.60~4.27），方向是对的，
 * 但要真正过 AA 只能改成深色字（会破坏「三阶段统一白字」的既有约定），故未动。
 */
export const HEAT_SCALE: Record<
  Exclude<Phase, 'normal'>,
  {
    color: string;
    minDepth: number;
    maxDepth: number;
    shallowAt: number;
    deepAt: number;
  }
> = {
  burst: {
    color: BURST_COLOR,
    minDepth: 0.7,
    maxDepth: 0.94,
    shallowAt: 120,
    deepAt: 300,
  },
  stock: {
    color: BRAND.glow,
    minDepth: 0.67,
    maxDepth: 0.9,
    shallowAt: 115,
    deepAt: 25,
  },
  clear: {
    color: BRAND.glint,
    minDepth: 0.67,
    maxDepth: 0.9,
    shallowAt: 100,
    deepAt: 20,
  },
};

/**
 * 浅色主题的热力 5 档色阶（level0 最浅 → level4 最深）+ 该阶段的字色。
 *
 * 为什么不能直接把深色那套算法搬过来：深色是「从卡片黑底往品牌色叠」，
 * 白底上同样的做法会得到一片高明度荧光块（黄 1.2:1、青 2.0:1），
 * 白字黑字都读不了。
 *
 * ── 本版：三条色阶各自落在一条**官方 Pairing** 上 ────────────────────
 * 品牌粉彩（Shimmer / Glow / Dawn / Muse）天生就是浅底色，正好当浅色模式的
 * 色块底；深墨（Ember / Thrive）天生就是浅底上的字色。所以：
 * - 爆发期 = **Ember + Blaze**（官方 Blaze Tertiary Pairing）：
 *   底 = 白 → Blaze 的 5 档淡化梯度，字 = **Ember #4A0505 原色**；
 * - 备货期 = **Glow + Blaze** 的暖感延伸（官方 Blaze Tertiary Pairing）：
 *   底 = **Glow #FBEB35 原色**居中的 5 档（往白提一档、往深压三档），
 *   字 = **Ember #4A0505 原色**（暖底配暖墨，不用中性黑）；
 * - 清仓期 = **Thrive + Glint**（官方 Secondary Pairing）叠
 *   **Shimmer + Glint**（官方 Glint Tertiary Pairing）：
 *   底 = **Shimmer #BAF6F0 原色 → Glint #2DCCD3 原色**的梯度（两支品牌原色
 *   分别落在 L0 与 L3），字 = **Thrive #033624 原色**。
 * 三条色阶里一共直接用上 4 支品牌原色（Glow / Shimmer / Glint / Ember+Thrive 字色）。
 *
 * ── 本轮改动：备货 / 清仓两条色阶整体「再浅一档」，爆发红一档不动 ────────
 * 按「浅色模式的颜色应该浅一点（除了红色）」这条指示：黄系与青系的 5 档
 * **整体往白提一档**（原 L0~L3 前移一位、顶上各补一档更淡的色、砍掉原来最深
 * 那一档），爆发期 Blaze 红系**逐值保持原样**。
 *
 * 可读性复核（字色 vs 5 档底色实测）——
 * - 爆发（未改）14.24 / 11.69 / 9.48 / 7.80 / 6.37
 * - 备货（沿 Glow 提亮）15.09 / 14.39 / 13.30 / 13.00 / **12.83**
 * - 清仓（新）  12.41 / 11.26 / 9.51 / 8.03 / **6.87**
 * 备货底提亮后同色相饱和度拉满，与深墨字 #4A0505 的对比度只升不降，**最深那一
 * 档 12.83 也仍远超 AA 4.5:1**（清仓最深档 6.87 同理）。相邻档明度差 ≥ 6%，
 * 横排在同一行里 5 档仍肉眼可分。
 * 图例色块（legend = 最深一档）在白底上是 2.0~2.5，靠 `.swatch-ring`
 * 的 1px 描边勾边界（这是既有实现，不是本轮引入）。
 */
const LIGHT_HEAT_SCALE: Record<
  Exclude<Phase, 'normal'>,
  { levels: readonly string[]; fg: string; legend: string }
> = {
  /**
   * 爆发期：Blaze 红系（白 → Blaze 原色的 5 档淡化梯度，色相守在 348° 不动）。
   * 字色 = 品牌原色 Ember #4A0505 ← 官方 "Ember + Blaze" 搭配。
   */
  burst: {
    levels: ['#FEEEF2', '#FCD2DA', '#FAB5C4', '#F99AAD', '#F77E96'],
    fg: BRAND.ember,
    legend: '#F77E96',
  },
  /**
   * 备货期：Glow 黄系。**本轮沿 Glow 色相（约 55°）整体提亮**：原来最深两档
   * #E2D223 / #CABB13 明度只有 51% / 43%、饱和度被压到 77~83%，看起来发橄榄、
   * 是「暗土黄」；本轮把整条色阶朝更亮、更接近纯 Glow 黄的方向提，并把饱和度
   * 拉满到 95~99%，压掉橄榄感，让最深档也是「明亮的黄」：
   *   旧 #FEFBD3 / #FDF69F / #FBEB35(Glow) / #E2D223 / #CABB13   （L≈91/81/60/51/43）
   *   新 #FEFAD5 / #FDF6A8 / #FCEE54      / #FDEB28 / #FEE901   （L≈92/83/66/57/50）
   * 色相全程守在 54~55°（Glow 区间，未漂橙/绿）；5 档明度梯度约 9/17/8/8，
   * 最亮档与最深档仍差 42 个明度点，横排在一行里 5 档肉眼可分。
   * 字色 = 品牌原色 Ember #4A0505 ← 官方 "Glow + Blaze" 暖感延伸；底提亮后与
   * 字色对比度只升不降：15.09 / 14.39 / 13.30 / 13.00 / **12.83**，
   * 最深档远超 WCAG AA 的 4.5:1。
   */
  stock: {
    levels: ['#FEFAD5', '#FDF6A8', '#FCEE54', '#FDEB28', '#FEE901'],
    fg: BRAND.ember,
    legend: '#FEE901',
  },
  /**
   * 清仓期：Glint 青系。**本轮整体往白提一档**（同样前移一档、去掉最深的 #27B4BB）：
   *   旧 Shimmer / #8CE8E6 / #5BDADC / Glint / #27B4BB
   *   新 #E0FBF8 / **Shimmer 原色** / #8CE8E6 / #5BDADC / **Glint 原色**
   * L1 = 品牌原色 Shimmer #BAF6F0、L4 = 品牌原色 Glint #2DCCD3，L0 是 Shimmer
   * 再往白提一档、L2/L3 为两者插值（色相守在 182° 不动）。
   * 字色 = 品牌原色 Thrive #033624 ← 官方 "Thrive + Glint" / "Shimmer + Glint" 搭配。
   */
  clear: {
    levels: ['#E0FBF8', BRAND.shimmer, '#8CE8E6', '#5BDADC', BRAND.glint],
    fg: BRAND.thrive,
    legend: BRAND.glint,
  },
};

/**
 * 阶段配色。
 * - 深色：三个阶段都用实心底色 + 白字，与常规期一眼可分（与改造前逐值一致）；
 * - 浅色：底色取该阶段最深一档、文字取同色相深字；
 *   折线图条带（band）在白底上用 13%~16% 的同色相薄雾，比深色版略实一点，
 *   否则白底上几乎看不见。
 */
const PHASE_META_BY_MODE: Record<ThemeMode, Record<Phase, PhaseStyle>> = {
  dark: {
    burst: {
      label: 'Peak',
      short: 'P',
      bg: BURST_COLOR,
      fg: BRAND.white,
      /** Blaze 提亮档：条带标注 / 摘要卡文字，黑底 8.0:1 */
      border: '#F8657F',
      band: 'rgba(241,32,74,0.14)',
      text: '#F8657F',
    },
    stock: {
      label: 'Stock-up',
      short: 'S',
      bg: BRAND.glow,
      /** 三阶段单元格数字统一白字，图例与单元格保持一致 */
      fg: BRAND.white,
      border: '#FDF489',
      band: 'rgba(251,235,53,0.13)',
      text: BRAND.glow,
    },
    clear: {
      label: 'Clearance',
      short: 'C',
      bg: BRAND.glint,
      /** 三阶段单元格数字统一白字，图例与单元格保持一致 */
      fg: BRAND.white,
      border: '#7FE0E4',
      band: 'rgba(45,204,211,0.14)',
      text: '#7FE0E4',
    },
    normal: {
      label: 'Normal',
      short: '—',
      bg: 'transparent',
      fg: '#C4C4C4',
      border: 'rgba(255,255,255,0.06)',
      band: 'transparent',
      text: '#C4C4C4',
    },
  },
  /**
   * 浅色：底色取该阶段最深一档、文字取该阶段的品牌墨色；
   * 折线图条带（band）改成**品牌原色的低透明度薄雾**（Blaze 10% / Glow 30% /
   * Glint 16%），不再用上一版那批「压深后的中间调 rgba」——
   * 薄雾叠在白底上得到的正是品牌粉彩的观感（#FEE9ED / #FEF9C2 / #DDF7F8）。
   * 阶段文字色沿各自品牌色相压深，条带上实测 5.55 / 5.21 / 5.41:1（≥AA 4.5:1）。
   */
  light: {
    burst: {
      label: 'Peak',
      short: 'P',
      bg: LIGHT_HEAT_SCALE.burst.legend,
      fg: LIGHT_HEAT_SCALE.burst.fg,
      /** 沿 Blaze 色相提亮：色块描边（图形，白底 3.06:1 过 3:1 门槛） */
      border: '#F5607E',
      /**
       * 折线图爆发条带：**品牌原色 Blaze 10%**（比备货 30% / 清仓 16% 更薄）。
       * 红色在白底上的视觉重量高于黄与青，同透明度铺一整段会显得压迫，
       * 也会和同区域的红色虚线「爆发线」糊在一起，所以刻意取最薄的一档。
       */
      band: withAlpha(BRAND.blaze, 0.1),
      /** 沿 Blaze 色相压深：白底 6.44:1、叠在 10% Blaze 条带上 5.55:1 */
      text: '#BD0C30',
    },
    stock: {
      label: 'Stock-up',
      short: 'S',
      bg: LIGHT_HEAT_SCALE.stock.legend,
      fg: LIGHT_HEAT_SCALE.stock.fg,
      /** 沿 Glow 色相压深：色块描边（图形，白底 3.06:1，与 warn 同一支） */
      border: LIGHT_CATEGORY.amber,
      /** **品牌原色 Glow 30%**（黄的视觉重量最轻，透明度要给足才看得见） */
      band: withAlpha(BRAND.glow, 0.3),
      /** 沿 Glow 色相压深：白底 5.60:1、条带上 5.21:1（Glow 原色白底仅 1.23:1，不能当字） */
      text: '#736902',
    },
    clear: {
      label: 'Clearance',
      short: 'C',
      bg: LIGHT_HEAT_SCALE.clear.legend,
      fg: LIGHT_HEAT_SCALE.clear.fg,
      /** 沿 Glint 色相压深：色块描边（图形，白底 3.03:1，与 accent 同一支） */
      border: LIGHT_CATEGORY.cyan,
      /** **品牌原色 Glint 16%** */
      band: withAlpha(BRAND.glint, 0.16),
      /** 沿 Glint 色相压深：白底 6.06:1、条带上 5.41:1（Glint 原色白底仅 1.96:1） */
      text: '#186D71',
    },
    normal: {
      label: 'Normal',
      short: '—',
      bg: 'transparent',
      /** 中性灰（不染任何色相）：白底 6.90:1 */
      fg: '#5A5A5A',
      /** 品牌原色 TikTok Black 6% */
      border: 'rgba(0,0,0,0.06)',
      band: 'transparent',
      text: '#5A5A5A',
    },
  },
};

/** 兼容旧引用：深色阶段配色 */
export const PHASE_META = PHASE_META_BY_MODE.dark;

/** 取当前主题的阶段配色 */
export function getPhaseMeta(mode: ThemeMode): Record<Phase, PhaseStyle> {
  return PHASE_META_BY_MODE[mode];
}

/** TGI → 5 档档位（0..4）；方向由 shallowAt/deepAt 的大小关系决定 */
function heatLevel(phase: Exclude<Phase, 'normal'>, tgi: number): number {
  const scale = HEAT_SCALE[phase];
  const span = scale.deepAt - scale.shallowAt;
  const ratio = span === 0 ? 1 : clamp01((tgi - scale.shallowAt) / span);
  return Math.min(HEAT_LEVELS - 1, Math.floor(ratio * HEAT_LEVELS + 1e-9));
}

/** TGI → 颜色深度（离散 5 档，已按上下限收敛） */
export function heatDepth(phase: Phase, tgi: number): number {
  if (phase === 'normal') {
    return 0;
  }
  const scale = HEAT_SCALE[phase];
  const level = heatLevel(phase, tgi);
  return (
    scale.minDepth +
    ((scale.maxDepth - scale.minDepth) * level) / (HEAT_LEVELS - 1)
  );
}

/**
 * 爆发期深色 5 档色阶（level0..4）：#A32740 → #D22F50。
 * 与备货 / 清仓完全同一套算法（同色相往卡片黑底 #0D0D0D 压深，深度 0.76→1.00），
 * 所以逐值等于「改成品牌绿之前」的爆发期观感。这里显式导出一份，
 * 只为让 5 档色值在代码里可读、可核对，染色逻辑仍走 heatCellStyle 的通用分支。
 */
export const BURST_SCALE: readonly string[] = Array.from(
  { length: HEAT_LEVELS },
  (_, level) =>
    mixHex(
      CELL_BASE,
      heatHue('burst'),
      HEAT_SCALE.burst.minDepth +
        ((HEAT_SCALE.burst.maxDepth - HEAT_SCALE.burst.minDepth) * level) /
          (HEAT_LEVELS - 1),
    ),
);

/**
 * 热力单元格样式。
 * 阶段决定色相（爆发期红 / 备货期黄 / 清仓期青），
 * TGI 决定同色相内的深浅：爆发期越高越深，备货期与清仓期越低越深。
 *
 * 深色：三个阶段统一白字，不按底色亮度切黑字；备货期黄与清仓期青偏亮，
 * 底色感知亮度 > 0.5 时额外返回一层深色投影补足可读性（底色本身不动）。
 * 浅色：底色取 LIGHT_HEAT_SCALE 的 5 档淡色，文字取同色相深字，不需要投影。
 */
export function heatCellStyle(
  phase: Phase,
  tgi: number,
  mode: ThemeMode = 'dark',
): { background: string; color: string; textShadow?: string } {
  const meta = PHASE_META_BY_MODE[mode];
  if (phase === 'normal') {
    return { background: 'transparent', color: meta.normal.fg };
  }
  if (mode === 'light') {
    const scale = LIGHT_HEAT_SCALE[phase];
    return {
      background: scale.levels[heatLevel(phase, tgi)],
      color: scale.fg,
    };
  }
  const background = mixHex(CELL_BASE, heatHue(phase), heatDepth(phase, tgi));
  return {
    background,
    color: BRAND.white,
    textShadow:
      luminance(background) > 0.5 ? '0 1px 2px rgba(0,0,0,0.85)' : undefined,
  };
}

/** 图例用的阶段代表色：取该阶段最深一档，只标颜色不解释深浅口径 */
export function phaseColor(phase: Phase, mode: ThemeMode = 'dark'): string {
  if (phase === 'normal') {
    return 'transparent';
  }
  if (mode === 'light') {
    return LIGHT_HEAT_SCALE[phase].legend;
  }
  return mixHex(CELL_BASE, heatHue(phase), HEAT_SCALE[phase].maxDepth);
}

/* ------------------------------------------------------------------ *
 * 柱状图染色：单色相，数值越高颜色越深
 * ------------------------------------------------------------------ */

/** 柱状图统一色相：品牌主色 Blaze */
export const BAR_HUE = BRAND.blaze;
/** 柱体颜色深度上下限：下限保证小值也看得见，上限即满色 */
export const BAR_DEPTH = { min: 0.42, max: 1 } as const;

/**
 * 数值 → 柱体颜色（同色相，数值越高越深）。
 * 深度按本图的 min~max 归一化，保证同一张图内首尾深浅差异肉眼可辨。
 * 混色基底取当前主题的卡片底色：深色底往黑压、浅色底往白提。
 */
export function barColor(
  value: number,
  max: number,
  min = 0,
  hue = BAR_HUE,
  mode: ThemeMode = 'dark',
): string {
  const span = max - min;
  const ratio = span > 0 ? clamp01((value - min) / span) : 1;
  return mixHex(
    COLORS_BY_MODE[mode].surface,
    mode === 'light' ? LIGHT_CATEGORY.red : hue,
    BAR_DEPTH.min + (BAR_DEPTH.max - BAR_DEPTH.min) * ratio,
  );
}

/* ------------------------------------------------------------------ *
 * 折线图分国配色：每个国家一个固定色
 * ------------------------------------------------------------------ */

/**
 * TTL（SEA 总和）与六国的固定描边色，两两可分。
 *
 * ── 本轮改动：浅色 = 深色（逐值相同，只换 TTL）─────────────────────
 * 上一版浅色把六支品牌色统统沿色相压深成中间调（#1CA4A9 / #A39500 / #8F2884 /
 * #68491D / #07583C），对比度够但观感发浊，而且 SG / ID 两位与深色的色相家族
 * 对不上（深色 SG=Shimmer 薄荷、ID=Muse 米棕，浅色却是棕和墨绿）。
 * 本轮按指示**直接复用深色模式的品牌原色**，只有 TTL 无法照搬：
 * 深色 TTL 是 TikTok White（黑底上最重的主线），白底上 1:1 完全不可见，
 * 换成同为品牌原色的 TikTok Black（21:1），角色完全同构。
 *
 * 白底可见性怎么处理：**不处理**。品牌粉彩当细线在白底上只有 1.2~2.0:1，
 * 这是用户知情后的设计取舍 —— 每条线都是单层纯品牌原色，不垫外描边、
 * 不加深、不外发光。MY（Blaze 4.16:1）与 TTL（黑 21:1）本身够看。
 *
 * 两两区分度（改用品牌原色后的实际情况）：
 *   VN(Glow 亮黄) vs SG(Shimmer 薄荷) —— 上一版这两条是「橄榄 vs 哑棕」，
 *     色相仅差 20° 又都偏暗，用户反馈难分辨；换成品牌原色后一支黄一支青，
 *     色相差 119°，这个问题自然消解；
 *   TH(Glint 饱和青 182.5°) vs SG(Shimmer 薄荷 174.0°) —— 仅差 8.5°，
 *     靠「饱和度 65% vs 71% + 明度 50% vs 84%」拉开：TH 是实心中青、
 *     SG 是更浅的薄荷，这是本轮相对最接近的一对（见交付说明）。
 */
const SERIES_COLORS_BY_MODE: Record<ThemeMode, Record<string, string>> = {
  dark: {
    TTL: BRAND.white,
    MY: BRAND.blaze,
    TH: BRAND.glint,
    VN: BRAND.glow,
    PH: BRAND.dawn,
    SG: BRAND.shimmer,
    ID: BRAND.muse,
  },
  light: {
    /** 深色是 TikTok White；白底不可见 → 品牌原色 TikTok Black（同为「最重的主线」） */
    TTL: LIGHT_CATEGORY.ink,
    /** 品牌原色 Blaze（白底 4.16:1） */
    MY: BRAND.blaze,
    /** 品牌原色 Glint（白底 1.96:1，纯原色单层线，不描边） */
    TH: BRAND.glint,
    /** 品牌原色 Glow（白底 1.23:1，纯原色单层线，不描边） */
    VN: BRAND.glow,
    /**
     * ── 本轮改动：PH / SG / ID 三支在白底上压深 ──────────────────────
     * 这三支品牌粉彩（Dawn 1.63:1 / Shimmer 1.20:1 / Muse 1.43:1）当细线画在
     * 白底上几乎看不见，用户明确要求「浅色模式加深」。做法是**只压明度、锁死色相**
     * （inkOf 保持 H 不变、饱和度保底），所以还是同一支品牌色的深色档，
     * 不引入品牌外色相、也不改深色模式：
     * - PH：Dawn 306° → L 46%，白底 5.12:1（品红）
     * - SG：Shimmer 174° → L 34%，白底 3.52:1（深薄荷；同时与 TH 的 Glint
     *   拉开 50% vs 34% 的明度差，两支青不再糊在一起）
     * - ID：Muse 35° → L 42%，白底 3.91:1（暖棕）
     * MY(Blaze) / TH(Glint) / VN(Glow) 未在本轮要求内，保持品牌原色不动。
     */
    PH: inkOf(BRAND.dawn, 0.46),
    SG: inkOf(BRAND.shimmer, 0.34),
    ID: inkOf(BRAND.muse, 0.42),
  },
};

/** 兼容旧引用：深色分国色 */
export const SERIES_COLORS = SERIES_COLORS_BY_MODE.dark;

export function getSeriesColors(mode: ThemeMode): Record<string, string> {
  return SERIES_COLORS_BY_MODE[mode];
}

/**
 * 卡片统一样式：卡片底 + 细边框 + 圆角，禁止 3D / 渐变。
 * 颜色全部走语义变量（bg-card / border-line-2 / text-fg-1），
 * shadow-card 在深色主题下解析成 none（品牌规范：深色底不投影），
 * 浅色主题下才是一层极浅的投影，用来把白卡片从浅灰页面底上"托"起来。
 */
export const CARD_CLASS =
  'flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-line-2 bg-card text-fg-1 shadow-card';

/* ------------------------------------------------------------------ *
 * 日历配色（营销日历专用）
 * 深色：只在品牌色板已有色相上做「提亮 / 变深 / 透明度」衍生，不引入新色相：
 * - 绿色阶 = Thrive #033624 等比提亮、蓝色阶 = Glint × Shimmer
 * - 共同节日 = Dawn、跨类合并块 = Muse、旺季 = Glow、跨月标注 = Glow
 * 浅色：同样五类语义、同样五个色相，但每类取「同色相深化后的 500 锚点」，
 * 块底改成该锚点 10%~22% 的薄雾（叠在白底上是淡彩），文字改成同色相深墨。
 * 组件里禁止再写裸 hex，统一取 `getCalendarColors(mode)`。
 * ------------------------------------------------------------------ */

export type ColorScale = {
  900: string;
  700: string;
  500: string;
  300: string;
  100: string;
};

/** Thrive 绿色阶（900 = Thrive 原色最深，100 最亮），斋月语义统一用这一档 */
export const GREEN_SCALE: ColorScale = {
  900: BRAND.thrive,
  700: brighten(BRAND.thrive, 2.1),
  500: brighten(BRAND.thrive, 3.1),
  300: brighten(BRAND.thrive, 4.1),
  100: mixHex(brighten(BRAND.thrive, 4.6), BRAND.white, 0.42),
};

/** Glint × Shimmer 蓝色阶，非斋月语义统一用这一档 */
export const BLUE_SCALE: ColorScale = {
  900: mixHex(BRAND.glint, BRAND.black, 0.8),
  700: mixHex(BRAND.glint, BRAND.black, 0.45),
  500: BRAND.glint,
  300: mixHex(BRAND.glint, BRAND.shimmer, 0.5),
  100: BRAND.shimmer,
};

/** 由单个品牌色生成同色相的深浅阶（Dawn / Muse 这类只有一个色值的辅助色用） */
function scaleOf(hex: string): ColorScale {
  return {
    900: mixHex(hex, BRAND.black, 0.82),
    700: mixHex(hex, BRAND.black, 0.5),
    500: hex,
    300: mixHex(hex, BRAND.white, 0.22),
    100: mixHex(hex, BRAND.white, 0.5),
  };
}

export type CalendarTone = {
  /** 节日块未选中底色 */
  bg: string;
  /** 节日块未选中描边 */
  border: string;
  /** 节日块选中底色 */
  bgActive: string;
  /** 节日块选中描边 */
  borderActive: string;
  /** 节日中文名（未选中） */
  text: string;
  /** 节日中文名（选中） */
  textActive: string;
  /** 英文名 / 月份区间等次要文字 */
  subText: string;
  /** 国家标签底色 / 文字色 */
  tagBg: string;
  tagText: string;
  /** 分组标签行的强调色（左侧竖条 + 英文分组名） */
  accent: string;
  /** 气候卡等信息面板底色 / 描边 */
  panelBg: string;
  panelBorder: string;
};

/** 深色：低透明度品牌色底 + 亮色文字（与改造前逐值一致） */
function buildToneDark(scale: ColorScale): CalendarTone {
  return {
    bg: withAlpha(scale[500], 0.11),
    border: withAlpha(scale[300], 0.3),
    bgActive: withAlpha(scale[500], 0.34),
    borderActive: scale[300],
    text: scale[100],
    textActive: BRAND.white,
    subText: withAlpha(scale[100], 0.62),
    tagBg: withAlpha(scale[500], 0.24),
    tagText: scale[100],
    accent: scale[300],
    panelBg: withAlpha(scale[500], 0.14),
    panelBorder: withAlpha(scale[300], 0.34),
  };
}

/** 浅色节日块各文字角色的目标明度（inkOf 的 targetL），逐锚点、逐角色单独反推 */
type ToneInk = {
  /** 未选中中文名 */
  text: number;
  /** 英文副名（选中/未选中共用一色） */
  sub: number;
  /** 英文分组名 + 3px 竖条 */
  accent: number;
  /** 选中态中文名 */
  active: number;
  /** 国家码 chip 文字 */
  tag: number;
};

/**
 * 浅色：同一支色相的「淡彩底 + 同色相字」。
 *
 * ── 本轮「节日标签浅色提亮」改动 ──────────────────────────────────────
 * 上一版所有文字统一压到 L≈0.18~0.28 的深墨（text 0.24 / sub 0.27 / active 0.18 /
 * accent 0.28），红 / 紫 / 棕这类「色相本身够深」的锚点因此被压到白底 8~11:1，
 * 远超 AA 文本门槛 4.5:1，在一屏已经提亮过的浅色模块里显得又重又闷。
 * 这一版不再用统一 targetL，而是「在保证可读性的前提下把每个角色的字色提到最浅」：
 * 逐锚点、逐角色按 WCAG 文本门槛反推「最浅可读明度」——
 * 红 / 紫 / 棕大幅提亮（如 common 中文名 L 0.24→0.44），
 * 绿 / 青 / 琥珀本就贴着门槛、只能微提（受色相所限，见交付说明）。
 *
 * 对比度按「最坏叠底」实测，全部 ≥4.6:1：
 * - text：未选中中文名，叠在 10% 淡彩底（最坏=纯淡彩底），目标 5.0:1；
 * - subText：英文副名，选中/未选中同一色，最坏=选中态 18% bgActive 再叠「选中月份列
 *   5% 红色薄雾」，目标 4.6:1（上一版此角色在选中态仅 4.1~4.3:1，本轮顺带修复）；
 * - accent：英文分组名 + 竖条，叠在白色类型列上，目标 5.0:1；
 * - textActive：选中态中文名，叠在更实的 bgActive 上，目标 6.5:1（比未选中更深＝「选中更重」）；
 * - tagText：国家码 chip，chip 底 16% 淡彩再叠 bgActive+选中月薄雾（最坏），目标 4.6:1。
 *
 * 底色 / 描边 / chip 底 / 面板底的透明度全部不动：它们本就是白底上的淡彩、够通透，
 * 保留原透明度同时保住了各节日色之间的色相区分度（提亮只发生在「字」上）。
 */
function buildToneLight(anchor: string, ink: ToneInk): CalendarTone {
  return {
    bg: withAlpha(anchor, 0.1),
    border: withAlpha(anchor, 0.3),
    bgActive: withAlpha(anchor, 0.18),
    borderActive: withAlpha(anchor, 0.62),
    text: inkOf(anchor, ink.text),
    textActive: inkOf(anchor, ink.active),
    subText: inkOf(anchor, ink.sub),
    tagBg: withAlpha(anchor, 0.16),
    tagText: inkOf(anchor, ink.tag),
    accent: inkOf(anchor, ink.accent),
    panelBg: withAlpha(anchor, 0.09),
    panelBorder: withAlpha(anchor, 0.28),
  };
}

export type CalendarColors = {
  common: CalendarTone;
  ramadan: CalendarTone;
  nonRamadan: CalendarTone;
  mixed: CalendarTone;
  seasonal: CalendarTone;
  /** 选中月份列底色 */
  selectedMonth: string;
  /** 跨月块内的月份分段标注 */
  spanLabel: string;
};

const CALENDAR_BY_MODE: Record<ThemeMode, CalendarColors> = {
  dark: {
    /** 六国共同节日：Dawn */
    common: buildToneDark(scaleOf(BRAND.dawn)),
    /** 斋月国节日 + 斋月国气候：Thrive 绿 */
    ramadan: buildToneDark(GREEN_SCALE),
    /** 非斋月国节日 + 非斋月国气候：Glint 蓝 */
    nonRamadan: buildToneDark(BLUE_SCALE),
    /** 合并后同时含斋月国与非斋月国的跨类块：Muse */
    mixed: buildToneDark(scaleOf(BRAND.muse)),
    /**
     * 旺季营销节点（返校季 / 婚礼旺季 / 装修旺季 …）：Glow 黄。
     * 黑底上黄色与共同节日的 Dawn 粉、斋月的 Thrive 绿、非斋月的 Glint 蓝
     * 三档色相距离都最远，一眼就能把「旺季行」与三类节日行分开。
     */
    seasonal: buildToneDark(scaleOf(BRAND.glow)),
    /** 选中月份列底色（与月份表头的 Blaze 选中态同源） */
    selectedMonth: withAlpha(BRAND.blaze, 0.08),
    /** 跨月块内的月份分段标注：Glow */
    spanLabel: withAlpha(BRAND.glow, 0.8),
  },
  /**
   * 浅色：五类语义各锁一支品牌色相，锚点全部是「沿品牌色相调明度」得到
   * （品牌粉彩本色在白底上都是 1.2~1.6:1，做不了描边与字，只能当 10%~20% 的薄雾底）：
   * - common     沿 Dawn 306° 压深 → #C93EBB
   * - ramadan    沿 Thrive 159° 提亮 → #0F8B60
   * - nonRamadan 沿 Glint 183° 压深 → #17878C
   * - mixed      沿 Muse 35° 压深 → #86612D
   * - seasonal   沿 Glow 55° 压深 → #B0A204
   * 上一版这五支锚点是 #B44FA9 / #0E8F60 / #0E8A93 / #96632B / #B08405，
   * 色相虽然对得上，但都是「凭手感调的中间调」；本版逐支按品牌色相 ±1° 重算，
   * 并保持「块底 = 锚点 10%/18% 薄雾、字 = 同色相深墨」的既有结构不动。
   */
  light: {
    /** 共同节日：沿 Dawn 色相（306.0°）压深。字色白底 5.02~8.96:1 */
    common: buildToneLight('#C93EBB', {
      text: 0.431,
      sub: 0.405,
      accent: 0.468,
      active: 0.312,
      tag: 0.355,
    }),
    /** 斋月：沿 Thrive 色相（159.2°）提亮。字色白底 5.01~8.85:1 */
    ramadan: buildToneLight('#0F8B60', {
      text: 0.255,
      sub: 0.24,
      accent: 0.276,
      active: 0.185,
      tag: 0.212,
    }),
    /** 非斋月：沿 Glint 色相（182.6°）压深。字色白底 5.01~8.79:1 */
    nonRamadan: buildToneLight('#17878C', {
      text: 0.271,
      sub: 0.254,
      accent: 0.292,
      active: 0.197,
      tag: 0.226,
    }),
    /** 跨类合并：沿 Muse 色相（35.1°）压深。字色白底 5.02~8.90:1 */
    mixed: buildToneLight('#86612D', {
      text: 0.345,
      sub: 0.323,
      accent: 0.35,
      active: 0.25,
      tag: 0.284,
    }),
    /** 旺季：沿 Glow 色相（55.1°）压深。字色白底 5.01~8.22:1 */
    seasonal: buildToneLight('#B0A204', {
      text: 0.233,
      sub: 0.225,
      accent: 0.245,
      active: 0.175,
      tag: 0.208,
    }),
    /** 选中月份列底色：**品牌原色 Blaze 5%**（与月份表头的 Blaze 选中态同源） */
    selectedMonth: withAlpha(BRAND.blaze, 0.05),
    /**
     * 跨月块内的月份分段标注（单色，会落在任意节日块的淡彩上）。
     * 沿 Glow 色相压深：白底 6.32:1，在「选中态 bgActive + 选中月 Blaze 薄雾」
     * 的最坏叠底上仍有 4.62:1（≥AA 4.5:1）。
     */
    spanLabel: '#6A6102',
  },
};

/** 兼容旧引用：深色日历配色 */
export const CALENDAR_COLORS = CALENDAR_BY_MODE.dark;

export function getCalendarColors(mode: ThemeMode): CalendarColors {
  return CALENDAR_BY_MODE[mode];
}

export type CalendarToneName =
  | 'common'
  | 'ramadan'
  | 'nonRamadan'
  | 'mixed'
  | 'seasonal';

/* ------------------------------------------------------------------ *
 * 旺季甘特条带配色（日历里的「按旺季甘特 / 按国家甘特」）
 *
 * 与节日块的淡彩 chip 不同，甘特条带是**实色条**（参考稿即为实色 pill）：
 * 每一行一支主题色 —— 按旺季视角是「一个旺季一色」，按国家视角是
 * 「一个国家一色，且与 TGI 曲线的分国色同源」。
 * 五支旺季色与六支国家色全部取自 TT4B 品牌色板，只做「同色相调明度」，
 * 不引入品牌外色相；条内文字色由底色亮度自动选白 / 近黑，保证任何色相都可读。
 * ------------------------------------------------------------------ */

export type GanttTone = {
  /** 条带底色（未选中 / 选中） */
  fill: string;
  fillActive: string;
  /** 条带描边（未选中 / 选中） */
  border: string;
  borderActive: string;
  /** 条内主文字（旺季名 / 国家码） */
  text: string;
  textActive: string;
  /** 条内次要文字（英文名、起止月） */
  subText: string;
  subTextActive: string;
  /** 条内国家码 chip */
  tagBg: string;
  tagBgActive: string;
  /** 选中态的外发光（box-shadow），让「更亮」的选中条同时更突出 */
  ringActive: string;
  /** 行首竖条 + 行英文名 */
  accent: string;
};

/** WCAG 相对亮度（对比度计算用，与上面的感知亮度 luminance 不是一回事） */
function relLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(value => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 两色对比度（1 ~ 21） */
function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * 条内文字一律白色（业务要求：日历 / 甘特模块深浅两种模式的条内字都是白字），
 * 所以底色反过来要「压到能托住白字」为止：沿同一色相只降明度（色相 / 饱和度不动），
 * 逐档下探到与纯白的对比度达标的第一档，绿 / 青 / 黄这类偏亮色相因此会自动压深。
 */
function fillForWhiteInk(base: string, minContrast: number): string {
  const [h, s, l] = hexToHsl(base);
  for (let next = l; next >= 0.14; next -= 0.01) {
    const hex = hslToHex(h, s, next);
    if (contrastRatio(hex, BRAND.white) >= minContrast) {
      return hex;
    }
  }
  return hslToHex(h, s, 0.14);
}

/**
 * 浅色模式的「选中＝更亮」实色：沿同一色相把饱和度拉满、明度往上提。
 * 只往上找到「白字仍然可读」为止：从 L=0.55 逐档下探，取第一档使得
 * 底色与白字对比度 ≥4.5:1 的明度，避免为了亮牺牲可读性。
 */
function vividFill(base: string, maxL = 0.55, minL = 0.18): string {
  const [h, s] = hexToHsl(base);
  const sat = Math.max(s, 0.8);
  for (let l = maxL; l >= minL; l -= 0.01) {
    const hex = hslToHex(h, sat, l);
    if (contrastRatio(hex, BRAND.white) >= WHITE_INK_ACTIVE) {
      return hex;
    }
  }
  return hslToHex(h, sat, minL);
}

/** 白字对比度门槛：未选中条压得更深（≥5.6:1），选中条允许更亮（≥4.5:1） */
const WHITE_INK_IDLE = 5.6;
const WHITE_INK_ACTIVE = 4.5;

function buildGanttTone(base: string, mode: ThemeMode): GanttTone {
  /* 深色：实色条压向卡片底（黑），保证一屏十几条彩条不刺眼；浅色：沿色相压深到中深档 */
  const fill = fillForWhiteInk(
    mode === 'dark' ? mixHex(base, CELL_BASE, 0.56) : inkOf(base, 0.4),
    WHITE_INK_IDLE,
  );
  /**
   * 选中态一律「更亮」，不再压深：
   * - 深色：朝品牌原色提亮（离黑底更远）；
   * - 浅色：沿色相提亮 + 加饱和（上一版是压深，看起来像被按灭，改成高亮）。
   * 两种模式都再过一遍白字对比度门槛，保证「更亮」不会把白字糊掉。
   */
  const fillActive = fillForWhiteInk(
    mode === 'dark' ? mixHex(base, CELL_BASE, 0.2) : vividFill(base),
    WHITE_INK_ACTIVE,
  );
  /** 条内主文字：深浅模式、选中与否统一纯白 */
  const text = BRAND.white;
  const textActive = BRAND.white;
  return {
    fill,
    fillActive,
    border: withAlpha(base, mode === 'dark' ? 0.42 : 0.32),
    borderActive: mode === 'dark' ? base : withAlpha(fillActive, 0.9),
    text,
    textActive,
    /* 次要文字（英文副名 / 起止月）同样是白字，只压一点透明度做主次层级 */
    subText: withAlpha(text, 0.86),
    subTextActive: withAlpha(textActive, 0.92),
    tagBg: withAlpha(text, 0.2),
    tagBgActive: withAlpha(textActive, 0.26),
    /** 选中条外圈一层同色薄光晕：亮起来的同时仍然「跳」出来 */
    ringActive:
      mode === 'dark'
        ? `0 0 0 1px ${withAlpha(base, 0.55)}`
        : `0 0 0 2px ${withAlpha(vividFill(base), 0.3)}`,
    accent: mode === 'dark' ? scaleOf(base)[300] : inkOf(base, 0.4),
  };
}

/**
 * 节日块与旺季甘特条统一成同一套「实色圆角条」风格（以营销节点风格为准），
 * 因此三类节日行也各取一支 GanttTone，只是色相沿用日历既有语义：
 * 共同 Dawn 粉 / 斋月 Thrive 绿 / 非斋月 Glint 青 / 跨类合并 Muse 棕 / 旺季 Glow 黄。
 */
const FESTIVAL_BAR_HUES: Record<CalendarToneName, string> = {
  common: BRAND.dawn,
  ramadan: GREEN_SCALE[500],
  nonRamadan: BRAND.glint,
  mixed: BRAND.muse,
  seasonal: BRAND.glow,
};

const FESTIVAL_BAR_TONES: Record<
  ThemeMode,
  Record<CalendarToneName, GanttTone>
> = {
  dark: Object.fromEntries(
    Object.entries(FESTIVAL_BAR_HUES).map(([key, hue]) => [
      key,
      buildGanttTone(hue, 'dark'),
    ]),
  ) as Record<CalendarToneName, GanttTone>,
  light: Object.fromEntries(
    Object.entries(FESTIVAL_BAR_HUES).map(([key, hue]) => [
      key,
      buildGanttTone(hue, 'light'),
    ]),
  ) as Record<CalendarToneName, GanttTone>,
};

/** 取节日块的实色条配色（与旺季甘特条同一套生成规则） */
export function getFestivalBarTone(
  name: CalendarToneName,
  mode: ThemeMode,
): GanttTone {
  return FESTIVAL_BAR_TONES[mode][name];
}

/**
 * 旺季类型 → 主题色（五支品牌色相各一支，两两色相距离最大化）：
 * 婚礼 Dawn 粉 / 旅游 Blaze 红 / 学生假期 Glow 黄 / 返校季 Glint 青 / 装修 Muse 棕。
 */
const SEASONAL_PEAK_HUES: Record<string, string> = {
  婚礼旺季: BRAND.dawn,
  旅游旺季: BRAND.blaze,
  学生假期: BRAND.glow,
  返校季: BRAND.glint,
  装修旺季: BRAND.muse,
};

/** 国家 → 主题色：与 TGI 曲线的分国色同源，保证「同一个国家全站同一支色」 */
const COUNTRY_HUES: Record<string, string> = {
  MY: BRAND.blaze,
  TH: BRAND.glint,
  VN: BRAND.glow,
  PH: BRAND.dawn,
  SG: BRAND.shimmer,
  ID: BRAND.muse,
};

/** 兜底色（底表出现色板里没登记的旺季名时用）：Glow */
const GANTT_FALLBACK_HUE = BRAND.glow;

const GANTT_TONES_BY_MODE: Record<
  ThemeMode,
  { peak: Record<string, GanttTone>; country: Record<string, GanttTone> }
> = {
  dark: {
    peak: Object.fromEntries(
      Object.entries(SEASONAL_PEAK_HUES).map(([key, hue]) => [
        key,
        buildGanttTone(hue, 'dark'),
      ]),
    ),
    country: Object.fromEntries(
      Object.entries(COUNTRY_HUES).map(([key, hue]) => [
        key,
        buildGanttTone(hue, 'dark'),
      ]),
    ),
  },
  light: {
    peak: Object.fromEntries(
      Object.entries(SEASONAL_PEAK_HUES).map(([key, hue]) => [
        key,
        buildGanttTone(hue, 'light'),
      ]),
    ),
    country: Object.fromEntries(
      Object.entries(COUNTRY_HUES).map(([key, hue]) => [
        key,
        buildGanttTone(hue, 'light'),
      ]),
    ),
  },
};

const GANTT_FALLBACK_TONE: Record<ThemeMode, GanttTone> = {
  dark: buildGanttTone(GANTT_FALLBACK_HUE, 'dark'),
  light: buildGanttTone(GANTT_FALLBACK_HUE, 'light'),
};

/** 取甘特行主题色：view=peak 按旺季中文名、view=country 按国家码 */
export function getGanttTone(
  view: 'peak' | 'country',
  key: string,
  mode: ThemeMode,
): GanttTone {
  return GANTT_TONES_BY_MODE[mode][view][key] ?? GANTT_FALLBACK_TONE[mode];
}

/* ------------------------------------------------------------------ *
 * 节日标签配色（热力图「相关节日」列）
 * 深色：只允许从 TT4B 品牌色板衍生（Blaze / Glint / Glow / Dawn / Shimmer /
 * Muse 之间混色），绿色阶（Thrive）保留给穆斯林 / 斋月国节日专用。
 * 浅色：同样的绿色语义，色相环取 8 档（原因见 FESTIVAL_HUES_LIGHT 的注释：
 * 品牌色板凑不出 10 支互相可分且不越界的浅色相），每支都是「沿品牌色相调明度」得到。
 * ------------------------------------------------------------------ */

/** 穆斯林 / 斋月国节日：硬性统一用绿色阶（Thrive） */
const FESTIVAL_GREEN_NAMES = new Set([
  '斋月',
  '开斋节',
  '宰牲节',
  '伊斯兰新年',
]);

/**
 * 非绿色节日的品牌色相环（10 档，全部由品牌色板混色得到，刻意不含绿色系，
 * 免得与「穆斯林节日 = 绿色」的语义撞车；也不含纯白，避免与普通文字混淆）。
 */
const FESTIVAL_HUES_DARK: string[] = [
  BRAND.blaze,
  BRAND.glint,
  BRAND.glow,
  BRAND.dawn,
  BRAND.muse,
  /** Blaze × Glow：橙 */
  mixHex(BRAND.blaze, BRAND.glow, 0.5),
  /** Dawn × Glint：雾蓝 */
  mixHex(BRAND.dawn, BRAND.glint, 0.5),
  BRAND.shimmer,
  /** Blaze × Dawn：玫粉 */
  mixHex(BRAND.blaze, BRAND.dawn, 0.5),
  /** Glint 压深：深青 */
  mixHex(BRAND.glint, BRAND.black, 0.35),
];

/**
 * 浅色色相环：**8 档，全部锁在品牌色相上**（深色环是 10 档）。
 *
 * 为什么浅色只有 8 档：深色环里第 7 位「Dawn × Glint 雾蓝」与第 8 位「Shimmer」
 * 在白底上压深后分别会变成**蓝**和**与 Glint 撞车的青**——
 * 品牌色板里没有蓝，Shimmer 与 Glint 色相只差 8.5°。品牌只有 6 个彩色相，
 * 其中 Thrive 绿被「穆斯林节日恒为绿」占用，剩下 5 个色相要撑起一个色相环，
 * 硬凑 10 档必然要么造出品牌外色相、要么两两分不开。所以浅色环取 8 档：
 * 5 个色相各一支中间调（Blaze / Glint / Glow / Dawn / Muse），
 * 再加 3 支「同色相但明显更深」的深墨档（Dawn 深梅 / Glint 深青 / Ember 栗），
 * 靠明度差与前 5 支拉开。代价是 30 个节日名按 `index % 8` 循环，
 * 会有几个节日在浅色下共用同一支色（深色是 `% 10`）—— pill 上本来就带节日
 * 名文字，颜色只是辅助分组，这个取舍换来的是「全环零品牌外色相」。
 */
const FESTIVAL_HUES_LIGHT: string[] = [
  /** ① 沿 Blaze 色相（348°）压深 */
  '#E50E3A',
  /** ② 沿 Glint 色相（183°）压深 */
  '#1C8084',
  /** ③ 沿 Glow 色相（55°）压深 */
  '#7E7402',
  /** ④ 沿 Dawn 色相（306°）压深 */
  '#C137B3',
  /** ⑤ 沿 Muse 色相（35°）压深（taupe） */
  '#654C29',
  /** ⑥ 沿 Dawn 色相再压深两档（深梅，与 ④ 靠明度差区分） */
  '#76216E',
  /** ⑦ 沿 Glint 色相再压深两档（深青，与 ② 靠明度差区分） */
  '#0F4749',
  /** ⑧ 品牌原色 Ember #4A0505 提亮一档（栗，与 ① Blaze 靠明度差区分） */
  '#590606',
];

/**
 * 浅色节日「字色」环：与 FESTIVAL_HUES_LIGHT 逐位对应，沿同一支品牌色相再压一档。
 *
 * 「相关节日」pill 是「淡彩底 + 同色相字」：底 = 该色 12%（strong）/ 6%（normal）
 * 薄雾，字 = 下面这支墨。对比度按**最坏叠底**（strong 12% 底再叠「选中行 7%
 * Blaze 薄雾 bg-accent-soft」）实测全部 ≥ 4.5:1（4.62 ~ 10.17:1），
 * normal 档底更浅、常规行更高。
 */
const FESTIVAL_INK_LIGHT: string[] = [
  '#C10C31', // ① Blaze 红   最坏叠底 4.62 / 白底 6.24
  '#186E72', // ② Glint 青   最坏叠底 4.63 / 白底 5.98
  '#6E6502', // ③ Glow 金    最坏叠底 4.62 / 白底 5.96
  '#A52F99', // ④ Dawn 紫    最坏叠底 4.64 / 白底 6.06
  '#574021', // ⑤ Muse taupe 最坏叠底 7.27 / 白底 9.72
  '#601B5A', // ⑥ Dawn 深梅  最坏叠底 8.52 / 白底 11.66
  '#0D3F41', // ⑦ Glint 深青 最坏叠底 8.53 / 白底 11.64
  '#590606', // ⑧ Ember 栗（与底色同一支，本身就够深）最坏叠底 10.17 / 白底 14.45
];

/**
 * 穆斯林节日绿字（浅色）：沿 Thrive 色相压深，与斋月绿 pill 底同源。
 * 最坏叠底 4.66:1 / 白底 6.02:1。
 */
const FESTIVAL_GREEN_INK_LIGHT = '#0C714E';

/**
 * 节日名 → 色相的固定分配表（顺序即分配顺序，`index % 色相环长度` 取色相：
 * 深色环 10 档、浅色环 8 档）。
 * 用显式清单而不是哈希：同名任何时候都是同一颜色，且清单里相邻的
 * 常见节日（如「黑五/网一」与「圣诞节」）必然落到不同色相。
 */
const FESTIVAL_NAME_ORDER: string[] = [
  '黑五/网一',
  '圣诞节',
  '元旦/新年',
  '情人节',
  '华人春节',
  '妇女节',
  '母亲节',
  '父亲节',
  '复活节',
  '万圣节',
  '华人七夕',
  '华人中秋',
  '华人端午',
  '返校季',
  '婚礼旺季',
  '装修旺季',
  '旅游旺季',
  '学生假期',
  '宋干节',
  '水灯节',
  '守夏节',
  '卫塞节',
  '三宝节',
  '泰国母亲节',
  '泰国国庆',
  '印尼独立日',
  '马来国庆',
  '菲律宾国庆',
  '越南国庆',
  '雄王节',
];

/**
 * 穆斯林节日的绿色：深色取 Thrive 提亮档，
 * 浅色沿 Thrive 色相（159.2°）提亮到 #0F8B60（与日历斋月锚点同一支色）。
 */
const FESTIVAL_GREEN_BY_MODE: Record<ThemeMode, string> = {
  dark: GREEN_SCALE[500],
  light: '#0F8B60',
};

function buildFestivalHueMap(mode: ThemeMode): Record<string, string> {
  const hues = mode === 'light' ? FESTIVAL_HUES_LIGHT : FESTIVAL_HUES_DARK;
  const map: Record<string, string> = {};
  FESTIVAL_NAME_ORDER.forEach((name, index) => {
    map[name] = hues[index % hues.length];
  });
  for (const name of FESTIVAL_GREEN_NAMES) {
    map[name] = FESTIVAL_GREEN_BY_MODE[mode];
  }
  return map;
}

const FESTIVAL_HUE_MAP_BY_MODE: Record<ThemeMode, Record<string, string>> = {
  dark: buildFestivalHueMap('dark'),
  light: buildFestivalHueMap('light'),
};

/** 简单稳定散列：清单外的新节日名也能拿到固定色相（不含绿色） */
function fallbackHue(name: string, mode: ThemeMode): string {
  const hues = mode === 'light' ? FESTIVAL_HUES_LIGHT : FESTIVAL_HUES_DARK;
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  }
  return hues[hash % hues.length];
}

/** 节日名 → 品牌色相（穆斯林节日恒为绿色阶） */
export function festivalHue(nameCn: string, mode: ThemeMode = 'dark'): string {
  return FESTIVAL_HUE_MAP_BY_MODE[mode][nameCn] ?? fallbackHue(nameCn, mode);
}

/**
 * 浅色 pill 字色查表：hue → 提亮后的「最浅可读墨」。
 * 与 FESTIVAL_HUES_LIGHT 逐位对齐，绿色单独并入（key 用浅色绿 pill 底色相）。
 * 只服务浅色；深色字色仍在 festivalTagStyle 里按品牌规则往白提亮，不走这里。
 */
const FESTIVAL_INK_BY_HUE_LIGHT: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  FESTIVAL_HUES_LIGHT.forEach((hue, index) => {
    map[hue] = FESTIVAL_INK_LIGHT[index];
  });
  map[FESTIVAL_GREEN_BY_MODE.light] = FESTIVAL_GREEN_INK_LIGHT;
  return map;
})();

export type FestivalTagStyle = {
  background: string;
  borderColor: string;
  color: string;
  fontWeight: number;
};

/**
 * 节日标签 pill 样式：半透明品牌色底 + 同色系文字 + 细描边。
 * 强关联（score = 3）比中等关联（score = 2）更「实」：底色与描边更不透明、字更粗。
 *
 * 深色：文字往白色提亮（底是深色）；
 * 浅色：文字往深墨压（底是淡彩），透明度整体调低，否则一行两三个 pill 叠在
 * 白底表格上会显得比数据本身还抢眼。
 */
export function festivalTagStyle(
  nameCn: string,
  score: number,
  mode: ThemeMode = 'dark',
): FestivalTagStyle {
  const hue = festivalHue(nameCn, mode);
  const strong = score >= 3;
  if (mode === 'light') {
    /*
      浅底节日标签：淡彩底 + 同色相字。底色 / 描边 / 字重维持上一版（本就是白底淡彩、够通透）；
      本轮只把「字色」从统一深墨（inkOf 0.26/0.27）换成逐色提亮后的「最浅可读墨」
      （见 FESTIVAL_INK_LIGHT），让 pill 与一屏已提亮的其它模块观感统一。
      对比度按最坏叠底（strong 12% 底 + 选中行 7% 红雾）实测全部 ≥4.6:1。
      理论上 festivalHue 只会返回 10 环 / 绿其中之一；?? 分支只是给「查表意外落空」兜底。
    */
    return {
      background: withAlpha(hue, strong ? 0.12 : 0.06),
      borderColor: withAlpha(hue, strong ? 0.45 : 0.22),
      color: FESTIVAL_INK_BY_HUE_LIGHT[hue] ?? inkOf(hue, 0.26),
      fontWeight: strong ? 600 : 500,
    };
  }
  return {
    background: withAlpha(hue, strong ? 0.28 : 0.12),
    borderColor: withAlpha(hue, strong ? 0.65 : 0.3),
    color: mixHex(hue, BRAND.white, strong ? 0.3 : 0.5),
    fontWeight: strong ? 600 : 500,
  };
}
