import flagId from '@/assets/flags/id.svg';
import flagMy from '@/assets/flags/my.svg';
import flagPh from '@/assets/flags/ph.svg';
import flagSea from '@/assets/flags/sea.svg';
import flagSg from '@/assets/flags/sg.svg';
import flagTh from '@/assets/flags/th.svg';
import flagVn from '@/assets/flags/vn.svg';
import { COUNTRY_NAMES, type CountryCode } from '@/data/market';
import { cn } from '@/lib/utils';

/**
 * 国旗图标：直接使用 Wikimedia Commons / Wikipedia 上的官方国旗矢量图（SVG 原件）。
 *
 * - SEA 用东盟（ASEAN）旗，其余 6 个为各国官方国旗；
 * - 各国国旗长宽比不同（3:2、2:1、2:3 混杂），统一用「固定 20×13 容器 +
 *   object-cover」裁切成小方旗，保证不拉伸变形、七面旗渲染尺寸一致；
 * - 外层保留一层 rgba(255,255,255,0.25) 细描边，黑底页面上有清晰边界。
 */
const FLAG_SOURCES: Record<CountryCode, string> = {
  SEA: flagSea,
  MY: flagMy,
  TH: flagTh,
  VN: flagVn,
  PH: flagPh,
  SG: flagSg,
  ID: flagId,
};

/** 图片 alt：SEA 走「东盟旗」的说法，其余取国家中文名 + 国旗 */
function altOf(code: CountryCode): string {
  return code === 'SEA' ? 'ASEAN flag' : `${COUNTRY_NAMES[code]} flag`;
}

export function CountryFlag({
  code,
  className,
}: {
  code: CountryCode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'relative inline-block h-[13px] w-[20px] shrink-0 overflow-hidden rounded-[2px] align-middle',
        className,
      )}
    >
      <img
        src={FLAG_SOURCES[code]}
        alt={altOf(code)}
        data-flag={code}
        loading="eager"
        draggable={false}
        className="block h-full w-full object-cover"
      />
      {/* 细描边叠在国旗上层：不占布局，保证国旗本身正好渲染成 20×13。
          深色底上是白色 25%（勾出深色旗面边界），浅色底上换成冷黑半透明
          （白底 + 白色描边 = 旗面边界消失，尤其新加坡 / 印尼这类带白色的旗） */}
      <span className="pointer-events-none absolute inset-0 rounded-[2px] border border-line-7" />
    </span>
  );
}
