/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Century Gothic',
          'Source Han Sans CN',
          'PingFang SC',
          'Noto Sans SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Arial',
          'sans-serif',
        ],
        display: [
          'Century Gothic',
          'Source Han Sans CN',
          'PingFang SC',
          'Noto Sans SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        /* 卡片投影：深色主题下变量为 none，浅色主题下才是一层极浅的投影 */
        card: 'var(--card-shadow)',
      },
      colors: {
        /*
          语义色板：唯一色值来源是 src/routes/index.css 里的 data-theme 变量。
          组件里只允许用这些语义名（bg-card / border-line-3 / text-fg-4 …），
          切换主题时不需要改任何组件代码。
          - page / card / inset / overlay：页面底 → 卡片底 → 卡片内嵌区 → 浮层
          - fill-1~5：状态填充由弱到强（底纹 / hover / 选中 / 高亮）
          - line-1~8：分割线与边框由细到实
          - fg / fg-1~6：文字由强到弱（fg 为标题级）
          - accent：主强调色及其在两套主题下的实底 / 文字 / 低强度底
          - info / danger：信息角标、失败提示
        */
        page: 'var(--surface-page)',
        card: 'var(--surface-card)',
        inset: 'var(--surface-inset)',
        overlay: 'var(--surface-overlay)',
        /* 图表 tooltip 底色（比卡片更实，压住曲线） */
        tooltip: 'var(--surface-tooltip)',
        scrim: 'var(--scrim)',
        fill: {
          1: 'var(--fill-1)',
          2: 'var(--fill-2)',
          3: 'var(--fill-3)',
          4: 'var(--fill-4)',
          5: 'var(--fill-5)',
          hover: 'var(--fill-hover)',
        },
        line: {
          1: 'var(--line-1)',
          2: 'var(--line-2)',
          3: 'var(--line-3)',
          4: 'var(--line-4)',
          5: 'var(--line-5)',
          6: 'var(--line-6)',
          7: 'var(--line-7)',
          8: 'var(--line-8)',
        },
        fg: {
          DEFAULT: 'var(--text-strong)',
          1: 'var(--text-1)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
          4: 'var(--text-4)',
          5: 'var(--text-5)',
          6: 'var(--text-6)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          fg: 'var(--accent-fg)',
          soft: 'var(--accent-soft)',
          text: 'var(--accent-text)',
          thumb: 'var(--accent-thumb)',
          ring: 'var(--accent-ring)',
        },
        info: {
          fg: 'var(--info-fg)',
          dot: 'var(--info-dot)',
          border: 'var(--info-border)',
          bg: 'var(--info-bg)',
        },
        danger: {
          border: 'var(--danger-border)',
          bg: 'var(--danger-bg)',
        },
        /* 吸附列右侧渐隐投影（日历首列）用的渐变起点色 */
        fade: 'var(--sticky-fade)',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
