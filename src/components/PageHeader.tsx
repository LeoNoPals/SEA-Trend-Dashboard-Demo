import { Moon, Sun } from 'lucide-react';

import { DemoNotice } from './DemoNotice';
import { useThemeControl } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

/**
 * 深 / 浅主题切换：双态 segmented 控件，紧贴看板主标题右侧。
 *
 * 为什么不用「单个图标按钮」：上一版是页头右上角一个 28px 的图标按钮，
 * 用户反馈「太不明显」。单图标按钮还有个固有歧义 —— 太阳图标到底表示
 * 「当前是浅色」还是「点一下会变浅色」，只能靠 tooltip 解释。
 * segmented 把两个态并排摊开、当前态用品牌红实底标出，
 * 不用读文案也知道「这是个二选一的开关，现在选的是哪个」。
 *
 * 尺寸：容器 44px 高（命中区），图标本体 20px，比上一版的 28px/14px 明显放大；
 * 但整体仍是 44px 高的胶囊，比 24~44px 的主标题矮一档，不抢标题的视觉重心。
 * 窄屏（< lg）只留图标（每段 40px 命中区仍达标），避免把标题挤断行。
 */
function ThemeToggle() {
  const { mode, setMode } = useThemeControl();
  const options = [
    { value: 'light' as const, label: 'Light', Icon: Sun },
    { value: 'dark' as const, label: 'Dark', Icon: Moon },
  ];
  return (
    <fieldset
      aria-label="Theme"
      className="m-0 inline-flex h-11 shrink-0 items-center gap-0.5 rounded-full border border-line-6 bg-fill-1 p-1 shadow-card"
    >
      {options.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={active}
            title={value === 'light' ? 'Switch to light mode' : 'Switch to dark mode'}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium transition-colors lg:px-3',
              active
                ? 'bg-accent text-accent-fg'
                : 'text-fg-4 hover:bg-fill-3 hover:text-fg',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="hidden lg:inline">{label}</span>
          </button>
        );
      })}
    </fieldset>
  );
}

/**
 * 数据日期只到「天」：历史分析数据是构建期一次性算好内嵌进页面的，
 * 精确到分钟会让人误以为它还在滚动更新。
 */
function formatDay(at?: number): string {
  if (!at) {
    return '—';
  }
  return new Date(at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  });
}

export function PageHeader({
  windowLabel,
  updatedAt,
}: {
  windowLabel: string;
  updatedAt?: number;
}) {
  return (
    <header className="min-w-0">
      <div className="demo-heading">
        <div className="min-w-0">
          {/*
            主标题这一行：标题必须一行展示（whitespace-nowrap），主题切换紧贴标题右侧。
            外层 flex 只给 items-center + 一个 gap，切换控件 shrink-0，
            所以它跟着标题走、不会飘到页面最右边；标题字号本身是 clamp(24~44px)，
            窄屏时标题自己变小、切换控件同时收成纯图标，两者都不会挤断行。
          */}
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="demo-title font-display font-bold leading-tight text-fg">
              CNOB | SEA Trend Selection Guide
            </h1>
          </div>
          <p className="demo-subtitle mt-1 font-display font-medium text-fg-4">
            Trend Calendar &amp; Category Insights
          </p>
          <p className="mt-2 text-[clamp(11px,0.85vw,13px)] text-fg-4">
            Interactive demo · Six markets, fictional categories, AI illustrations
          </p>
        </div>
        <div className="demo-heading-tools">
          <ThemeToggle />
          <div className="text-[11px] leading-relaxed text-fg-4">
            <p>Demo version: {formatDay(updatedAt)}</p>
            <p>Demo window: {windowLabel}</p>
          </div>
        </div>
      </div>

      {/*
        更新口径一句话：只说明「数据什么时候的」，不再暴露任何底层数据源链接
        （对外阅读场景下底表地址属于内部信息，已整段移除）。
      */}
      <DemoNotice />
    </header>
  );
}
