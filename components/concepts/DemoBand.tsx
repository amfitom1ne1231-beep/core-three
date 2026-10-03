'use client';

import Link from 'next/link';
import DemoView from './DemoView';
import type { DemoMeta } from '@/content/concepts';

export type BandItem = {
  slug: string;
  kind: string;
  title: string;
  niche: string;
  points: readonly string[];
};

/**
 * Полоса собранного демо на странице витрины.
 *
 * Кадр живёт в `DemoView` — он общий с главой на главной. Здесь
 * остаётся только раскладка: медиа с одной стороны, состав и переход
 * с другой, стороны чередуются.
 *
 * Внутри рамки страница не кликается (`pointer-events: none`), а сверху
 * лежит настоящая ссылка: иначе половина нажатий уходила бы кнопкам
 * чужой страницы, которые в кадре ничего не значат.
 */
export default function DemoBand({
  item,
  meta,
  flip
}: {
  item: BandItem;
  meta: DemoMeta;
  /** Чередование сторон: медиа то слева, то справа. */
  flip: boolean;
}) {
  return (
    <article
      className={`grid items-center gap-[clamp(24px,4vh,56px)] lg:gap-[clamp(40px,5vw,96px)] ${
        // Колонки меняются местами вместе с кадром: иначе у перевёрнутой
        // полосы кадр попадал в узкую колонку и был на четверть мельче
        // соседнего — разнобой читался сбоем вёрстки.
        flip
          ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]'
          : 'lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]'
      }`}
    >
      {/* ---------- кадр ---------- */}
      <div className={flip ? 'lg:order-2' : undefined}>
        <div className="mb-3 flex items-center justify-between gap-4">
          {/* адрес без пульсирующей точки: «онлайн»-точки сняты по всему сайту */}
          <span className="rail-label">{meta.domain}</span>
          <span className="rail-label">{item.niche}</span>
        </div>

        <div
          data-cursor="ring"
          data-reveal="clip"
          className="group relative aspect-[16/10] overflow-hidden rounded-[10px] border border-line bg-elev"
        >
          <DemoView slug={item.slug} kind={item.kind} title={meta.title} className="h-full w-full" />

          <Link
            href={`/concepts/${item.slug}`}
            className="absolute inset-0 flex items-end justify-end p-4"
            aria-label={`Открыть демо: ${meta.title}`}
          >
            <span className="flex items-center gap-2 border border-line-strong bg-bg/70 px-3.5 py-2 font-mono text-[10px] uppercase tracking-rail text-fg opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
              Открыть
              <span aria-hidden>→</span>
            </span>
          </Link>
        </div>
      </div>

      {/* ---------- текст ---------- */}
      <div className={flip ? 'lg:order-1' : undefined}>
        <h2 className="display m-0 text-[clamp(24px,3.2vw,46px)]">
          <Link href={`/concepts/${item.slug}`} className="transition-colors duration-300 hover:text-accent">
            {item.title}
          </Link>
        </h2>
        <p className="m-0 mt-5 max-w-[42ch] text-[clamp(14px,1.15vw,17px)] leading-relaxed text-dim">{meta.hint}</p>

        <ul className="m-0 mt-7 list-none p-0">
          {item.points.map((p) => (
            <li key={p} className="flex gap-3 border-t border-line py-3.5 text-[14px] leading-relaxed text-dim last:border-b">
              <span className="mt-2.5 h-px w-4 shrink-0 bg-line-strong" aria-hidden />
              {p}
            </li>
          ))}
        </ul>

        <Link
          data-magnetic
          href={`/concepts/${item.slug}`}
          className="btn btn-primary mt-8"
        >
          Открыть демо
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}
