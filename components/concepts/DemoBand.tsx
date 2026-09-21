'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ConceptPreview from '../concept-previews';
import type { DemoMeta } from '@/content/concepts';

/** В каких координатах грузится страница демо внутри кадра. */
const W = 1280;
const H = 800;

export type BandItem = {
  slug: string;
  kind: string;
  title: string;
  niche: string;
  points: readonly string[];
};

/**
 * Полоса собранного демо.
 *
 * Витрина обещает «демо, которое проходится насквозь», а показывала
 * схематичный каркас в карточке 320×200. Здесь в рамке идёт сама
 * страница демо: тот же адрес, тот же код, живые проверки и живая
 * переписка. Картинка продукта, нарисованная нами, всегда выглядит
 * лучше продукта — и ровно поэтому ей не верят.
 *
 * Кадр грузится не всем и не сразу: только на широком экране с мышью,
 * только когда полоса подошла к экрану, и только если человек не просил
 * беречь трафик или движение. Во всех остальных случаях остаётся
 * схема — та же, что в карточках на главной.
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
  const frame = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [shown, setShown] = useState(false);
  const [k, setK] = useState(0);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;

    const measure = () => setK(el.clientWidth / W);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    const heavyOk =
      matchMedia('(min-width: 1024px)').matches &&
      matchMedia('(pointer: fine)').matches &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches &&
      // «экономия трафика» в браузере — просьба не грузить лишнее
      !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

    if (!heavyOk) return () => ro.disconnect();

    /**
     * Два наблюдателя с разным запасом — гистерезис.
     *
     * Кадров на витрине четыре, и каждый — полноценная страница
     * со своими таймерами: держать все четыре живыми ради одной
     * видимой незачем. Ближний включает кадр за 300 пикселей до входа,
     * дальний гасит его, только когда полоса ушла больше чем на экран.
     * Один порог на оба события дал бы мигание на границе.
     */
    const near = new IntersectionObserver(([e]) => e.isIntersecting && setLive(true), { rootMargin: '300px' });
    const far = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) return;
        setLive(false);
        setShown(false);
      },
      { rootMargin: '1200px' }
    );
    near.observe(el);
    far.observe(el);
    return () => {
      ro.disconnect();
      near.disconnect();
      far.disconnect();
    };
  }, []);

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
          <span className="flex items-center gap-2">
            <i className="relative flex h-1.5 w-1.5">
              <i className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
              <i className="relative h-1.5 w-1.5 rounded-full bg-accent" />
            </i>
            <span className="rail-label">{meta.domain}</span>
          </span>
          <span className="rail-label">{item.niche}</span>
        </div>

        <div
          ref={frame}
          data-cursor="ring"
          data-reveal="clip"
          className="group relative aspect-[16/10] overflow-hidden rounded-[10px] border border-line bg-elev"
        >
          {/* схема: то, что видно до загрузки кадра и всегда на телефоне */}
          <svg viewBox="0 0 320 200" className="block h-full w-full text-fg" aria-hidden>
            <ConceptPreview kind={item.kind} />
          </svg>

          {live && (
            <iframe
              src={`/concepts/${item.slug}`}
              title={meta.title}
              aria-hidden
              tabIndex={-1}
              scrolling="no"
              loading="lazy"
              onLoad={() => setShown(true)}
              className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-700"
              style={{ width: W, height: H, transform: `scale(${k || 0.5})`, opacity: shown ? 1 : 0 }}
            />
          )}

          {/* ссылка поверх всего кадра */}
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
          className="mt-8 inline-flex items-center gap-2 border border-fg bg-fg px-[22px] py-[13px] font-mono text-[11px] uppercase tracking-label text-bg transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-white"
        >
          Открыть демо
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}
