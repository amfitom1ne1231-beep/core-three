import { Inter, Oswald } from 'next/font/google';

/**
 * Шрифты курса. Четвёртый голос в витрине — и он обязан отличаться
 * от трёх соседних: антиквы «Сороки», инженерного Plex «Лавки»
 * и широкого Unbounded «Мотка».
 *
 * Oswald — узкий плакатный гротеск с полной кириллицей: так набирают
 * афиши выставок, и для курса рисунка это родная интонация. Inter
 * на текст — он не спорит с плакатом и хорошо держит длинные абзацы
 * программы.
 */
export const display = Oswald({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--course-display',
  display: 'swap'
});

export const text = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--course-text',
  display: 'swap'
});
