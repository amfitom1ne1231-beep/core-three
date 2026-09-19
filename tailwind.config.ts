import type { Config } from 'tailwindcss';

// Цвета живут в CSS-переменных: одна вёрстка обслуживает тёмную и светлую темы.
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './content/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        elev: 'var(--bg-elev)',
        fg: 'var(--fg)',
        dim: 'var(--fg-dim)',
        faint: 'var(--fg-faint)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        accent: 'var(--accent)',
        brand: {
          deep: 'var(--brand-deep)',
          core: 'var(--brand-core)',
          steel: 'var(--brand-steel)'
        }
      },
      fontFamily: {
        sans: ['var(--font-onest)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace']
      },
      letterSpacing: {
        rail: '0.18em',
        label: '0.14em'
      },
      transitionTimingFunction: {
        silk: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  },
  plugins: []
} satisfies Config;
