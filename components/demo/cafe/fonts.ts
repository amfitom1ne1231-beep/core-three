import { Playfair_Display, Rubik } from 'next/font/google';

/**
 * Шрифты «Сороки». Свои, не наши.
 *
 * Системный стек, которым набрана страница статуса, для приборной панели
 * уместен — там он читается как инструмент. Кофейне он не идёт: сайт
 * заведения сразу выдаёт себя отсутствием шрифта. Onest брать тоже
 * нельзя — это наш голос, а демо должно быть голосом клиента.
 *
 * Playfair на заголовки — высококонтрастная антиква с полной кириллицей,
 * редакционная интонация. Rubik на интерфейс — мягкий гротеск, тёплый
 * там, где Onest сдержанный.
 */
export const display = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  variable: '--cafe-display',
  display: 'swap'
});

export const text = Rubik({
  subsets: ['latin', 'cyrillic'],
  variable: '--cafe-text',
  display: 'swap'
});
