import type { CSSProperties } from 'react';

/**
 * Цвета демо «Бритва».
 *
 * Сцена вокруг телефона — графит и латунь барбершопа: она одна в обеих
 * темах, это голос салона. Внутри телефона — тема Telegram, светлая или
 * тёмная, как у человека в системе. Мини-приложение красится не своими
 * цветами, а переменными темы — под теми же именами, что Telegram
 * подставляет настоящим мини-приложениям (`--tg-theme-*`). Переключили
 * тему — приложение перекрасилось само, ровно как в жизни.
 *
 * Контраст проверен: подписи 4,6:1 и выше в обеих темах, белое на кнопке
 * 5,3:1 (светлая) и 5,4:1 (тёмная). Фирменные #2481cc и #3a7bbd давали
 * 4,1:1 и 4,4:1 — по главной кнопке нажимают вживую, её надпись обязана
 * читаться, поэтому синий глубже.
 */

export const B = {
  bg: '#121110',
  raise: '#1b1a18',
  card: '#1f1d1a',
  fg: '#efe9e0',
  dim: '#b3aa9d',
  faint: '#958b7e',
  line: 'rgba(239,233,224,0.10)',
  lineStrong: 'rgba(239,233,224,0.18)',
  brass: '#c9a46a',
  brassInk: '#1a1408'
} as const;

export type TgTheme = 'light' | 'dark';

const THEMES: Record<TgTheme, Record<string, string>> = {
  light: {
    'bg-color': '#ffffff',
    'secondary-bg-color': '#f1f1f4',
    'section-bg-color': '#ffffff',
    'header-bg-color': '#ffffff',
    'text-color': '#000000',
    'hint-color': '#686d72',
    'subtitle-text-color': '#686d72',
    'link-color': '#1c6fb8',
    'accent-text-color': '#1c6fb8',
    'button-color': '#1f6fb5',
    'button-text-color': '#ffffff',
    'section-separator-color': '#e4e4e7',
    'destructive-text-color': '#d93a3a'
  },
  dark: {
    'bg-color': '#17212b',
    'secondary-bg-color': '#0e1621',
    'section-bg-color': '#17212b',
    'header-bg-color': '#17212b',
    'text-color': '#f5f5f5',
    'hint-color': '#8b9aa8',
    'subtitle-text-color': '#8b9aa8',
    'link-color': '#5eb5f7',
    'accent-text-color': '#5eb5f7',
    'button-color': '#2f6ea5',
    'button-text-color': '#ffffff',
    'section-separator-color': 'rgba(255,255,255,0.08)',
    'destructive-text-color': '#ef6461'
  }
};

/** Переписка: у неё своя подложка и пузыри, их тема тоже задаёт. */
const CHAT: Record<TgTheme, Record<string, string>> = {
  light: {
    '--chat-bg': '#dfe6e9',
    '--chat-in': '#ffffff',
    '--chat-out': '#e1fec6',
    '--chat-out-meta': '#357a36',
    '--chat-in-meta': '#686d72',
    '--chat-chip': 'rgba(0,0,0,0.32)',
    '--chat-key': 'rgba(255,255,255,0.86)'
  },
  dark: {
    '--chat-bg': '#0e1621',
    '--chat-in': '#182533',
    '--chat-out': '#2b5278',
    '--chat-out-meta': '#a7c4e0',
    '--chat-in-meta': '#8b9aa8',
    '--chat-chip': 'rgba(255,255,255,0.10)',
    '--chat-key': 'rgba(24,37,51,0.92)'
  }
};

/** Переменные темы для корня телефона. */
export function themeVars(theme: TgTheme): CSSProperties {
  const vars: Record<string, string> = {};
  Object.entries(THEMES[theme]).forEach(([k, v]) => {
    vars[`--tg-theme-${k}`] = v;
  });
  Object.assign(vars, CHAT[theme]);
  return vars as CSSProperties;
}

/** Короткая запись переменной темы: `tg('hint-color')`. */
export const tg = (name: string) => `var(--tg-theme-${name})`;

/** Системный шрифт — им Telegram рисует и себя, и мини-приложения. */
export const SYSTEM = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Roboto, "Segoe UI", system-ui, sans-serif';
