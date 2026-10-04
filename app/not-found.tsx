import Link from 'next/link';

/**
 * Запасная 404 корневого сегмента. Неизвестные адреса до неё не доходят —
 * их ловит `app/(site)/[...missing]` и показывает 404 сайта. Здесь нет
 * ни шапки, ни шрифта сайта намеренно: всё, что подключает корневая 404,
 * предзагружается на каждой странице, включая демо.
 */
export default function RootNotFound() {
  return (
    <main id="content" className="flex min-h-[100svh] flex-col items-start justify-center gap-6 px-6 font-mono">
      <span className="text-[12px] uppercase tracking-[0.18em] text-dim">404 / Не найдено</span>
      <Link href="/" className="text-fg underline underline-offset-4">
        На главную
      </Link>
    </main>
  );
}
