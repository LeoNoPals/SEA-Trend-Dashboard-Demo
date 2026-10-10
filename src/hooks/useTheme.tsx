import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { ThemeMode } from '@/data/theme';

/**
 * 主题（深 / 浅）运行时。
 *
 * 约定（必须与 config/html/head.html 里的内联脚本保持一致）：
 * - 真值写在 `<html data-theme="dark|light">` 上，所有颜色由 CSS 变量派生；
 * - 同时给 `<html>` 挂 / 摘 `dark` 类：Tailwind 的 `darkMode: ['class']` 与
 *   shadcn 基础组件的 `dark:` 变体依赖它；
 * - 用户选择持久化在 localStorage[`cnob-theme`]，URL 上的 `?theme=light|dark`
 *   可以直接指定主题（由 head 内联脚本处理并写回存储，方便分享指定主题的链接）；
 * - **首次访问默认深色**，刻意不跟随系统偏好 —— 现有深色版是既定观感，
 *   不能因为访问者系统是浅色就自动变脸。
 */
export const THEME_STORAGE_KEY = 'sea-demo-theme';

const DEFAULT_MODE: ThemeMode = 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (next: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: DEFAULT_MODE,
  setMode: () => undefined,
  toggle: () => undefined,
});

function isMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light';
}

/** 首帧直接读 `<html>` 上已被内联脚本写好的值，保证 React 接管时不发生回跳闪烁 */
function readInitialMode(): ThemeMode {
  if (typeof document === 'undefined') {
    return DEFAULT_MODE;
  }
  const attr = document.documentElement.dataset.theme;
  if (isMode(attr)) {
    return attr;
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isMode(stored)) {
      return stored;
    }
  } catch {
    // localStorage 被禁用时静默回落默认值
  }
  return DEFAULT_MODE;
}

function applyMode(mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle('dark', mode === 'dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readInitialMode);

  /** 挂载即同步一次：内联脚本没跑到（比如被 CSP 拦掉）时兜底 */
  useEffect(() => {
    applyMode(mode);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // 忽略：无痕模式下写不进去也不该影响页面
    }
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
  }, []);

  const toggle = useCallback(() => {
    setModeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, toggle }),
    [mode, setMode, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** 取当前主题（组件里用它去 src/data/theme.ts 拿对应色板） */
export function useThemeMode(): ThemeMode {
  return useContext(ThemeContext).mode;
}

/** 取切换能力（只有页头的切换按钮需要） */
export function useThemeControl(): ThemeContextValue {
  return useContext(ThemeContext);
}
