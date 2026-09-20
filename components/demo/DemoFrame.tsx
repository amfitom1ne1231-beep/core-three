'use client';

import Link from 'next/link';
import Mark from '../Mark';
import type { DemoMeta } from '@/content/concepts';

/**
 * Рамка демо: единственное наше, что остаётся поверх сайта клиента.
 *
 * Почему полоса, а не кнопка в углу: из демо нужен выход, и выход должен
 * быть виден без поиска. Кнопка в углу ложится на содержимое клиента
 * и спорит с его собственными элементами; полоса занимает свои 36 пикселей
 * честно и ни на что не наезжает.
 *
 * Почему она не уезжает по скроллу: потерять дорогу назад из чужого
 * на вид сайта неприятнее, чем отдать полоски высоты.
 *
 * Слот controls — для того, что относится к демо, а не к сайту клиента:
 * кнопка «устроить сбой» на настоящей странице статуса выглядела бы дико,
 * а здесь, в нашей полосе, читается ровно как наша подсказка.
 */
export default function DemoFrame({
  meta,
  controls,
  children
}: {
  meta: DemoMeta;
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-[200] flex h-[var(--demo-bar)] items-center gap-3 border-b border-white/10 bg-[#07080a] px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55 sm:px-5"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      >
        {/* На телефоне от имени остаётся знак и слово «демо»: справа стоят
            две кнопки, и полное «CoreThree демо» рядом с ними выталкивает
            выход за край. Считано для 375: знак с подписью 51, кнопки 225,
            зазор 12 — 288 из 351 доступных. */}
        <Link
          href="/concepts"
          className="flex shrink-0 items-center gap-2 text-white/85 transition-colors duration-300 hover:text-white"
        >
          <Mark className="h-[13px] w-[13px]" flat />
          <span className="hidden sm:inline">CoreThree</span>
          <span className="text-white/35">демо</span>
        </Link>

        {/* адрес клиента: демо честно говорит, что оно вымышленное */}
        <span className="hidden min-w-0 flex-1 items-center gap-3 truncate text-white/35 md:flex">
          <span className="h-3 w-px bg-white/15" />
          {meta.domain}
          <span className="truncate normal-case tracking-normal">{meta.hint}</span>
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          {controls}
          <Link
            href="/concepts"
            className="border border-white/15 px-2.5 py-[5px] text-white/70 transition-colors duration-300 hover:border-white/40 hover:text-white"
          >
            <span aria-hidden>←&nbsp;</span>К витрине
          </Link>
        </div>
      </div>

      {/* отступ, а не padding на body: у демо своя разметка от края до края */}
      <div style={{ paddingTop: 'var(--demo-bar)' }}>{children}</div>
    </>
  );
}
