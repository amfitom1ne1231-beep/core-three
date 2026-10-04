import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

// Цвета живут в CSS-переменных: одна вёрстка обслуживает тёмную и светлую темы.
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './content/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)',
        elev: 'var(--bg-elev)',
        fg: 'rgb(var(--fg-rgb) / <alpha-value>)',
        dim: 'var(--fg-dim)',
        faint: 'var(--fg-faint)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        accent: 'var(--accent)',
        danger: 'var(--danger)',
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
  plugins: [
    // Планшет в портрете — от iPad mini до iPad Pro 12.9. Сюда попадала
    // телефонная раскладка (заголовок на 39 px, полэкрана пусто), а на 1024 —
    // десктопная в две колонки с пустотой сверху и снизу. Экраном в `screens`
    // его не завести: с нестандартным экраном Tailwind перестаёт собирать
    // `max-sm:`, а на нём держится схема на телефоне. Вариант плагина
    // в CSS стоит раньше `lg:`, поэтому `:root` — чтобы `tp:` перебивал
    // и `lg:`, и классы вроде `section-y`, объявленные после утилит.
    plugin(({ addVariant }) => {
      addVariant('tp', '@media (min-width: 700px) and (max-width: 1100px) and (orientation: portrait) { :root & }');
    })
  ]
} satisfies Config;
