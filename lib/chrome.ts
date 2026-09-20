/**
 * Состояние шапки, общее для шапки и пульта навигации.
 *
 * Знак на странице один: пока шапка на экране, он в шапке; как только она
 * уезжает при движении вниз — он же появляется плавающим пультом. Два
 * одинаковых знака одновременно выглядели бы недосмотром, поэтому пульт
 * должен знать, спрятана шапка или нет.
 *
 * Обычного события `scroll` для этого мало: шапка прячется не по позиции,
 * а по направлению движения, и повторять её логику в пульте — значит
 * завести второй источник правды, который однажды разойдётся с первым.
 */

type Listener = (hidden: boolean) => void;

let hidden = false;
const listeners = new Set<Listener>();

export function setHeaderHidden(next: boolean) {
  if (next === hidden) return;
  hidden = next;
  listeners.forEach((fn) => fn(hidden));
}

export function isHeaderHidden() {
  return hidden;
}

export function onHeaderToggle(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
