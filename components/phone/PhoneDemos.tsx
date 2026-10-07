'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { contactHref } from '@/lib/lead';
import { isPhone, navigate } from '@/lib/phone';
import { demoBySlug } from '@/content/concepts';
import { SITE } from '@/content/site';

const PAGE = SITE.concepts.page;
/** Собранные демо — с их адресом и подсказкой, что в них можно потрогать. */
const ITEMS = SITE.concepts.items.flatMap((c) => {
  const meta = c.ready ? demoBySlug(c.slug) : undefined;
  return meta ? [{ ...c, meta }] : [];
});

/**
 * «Демо» на телефоне (MOBILE.md): карточки во всю ширину, листаются вбок.
 * В карточке — запись работы демо, снятая скриптом с настоящего демо
 * на телефонном экране (`brand/demo-reels.mjs`): не картинка, а то, как
 * оно нажимается. Карточка при касании вырастает в само демо.
 *
 * Запись играет только у карточки, которая стоит по центру; остальные
 * держат первый кадр (тот же снимок, что в плитке на главной) и ничего
 * не качают, пока до них не долистали.
 */
export default function PhoneDemos() {
  const router = useRouter();
  const rail = useRef<HTMLDivElement>(null);
  const films = useRef<(HTMLVideoElement | null)[]>([]);
  const [at, setAt] = useState(0);
  // до каких карточек уже долистали: их записи подключены
  const [seen, setSeen] = useState<boolean[]>(() => ITEMS.map(() => false));

  // какая карточка по центру ленты
  useEffect(() => {
    const el = rail.current;
    if (!el || !isPhone()) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const i = Number((e.target as HTMLElement).dataset.i);
          setAt(i);
          setSeen((prev) => (prev[i] ? prev : prev.map((v, k) => v || k === i)));
        });
      },
      { root: el, threshold: 0.6 }
    );
    el.querySelectorAll('[data-i]').forEach((card) => io.observe(card));
    return () => io.disconnect();
  }, []);

  // играет запись карточки по центру, остальные стоят
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    films.current.forEach((v, i) => {
      if (!v) return;
      if (i === at && seen[i]) v.play().catch(() => {});
      else v.pause();
    });
  }, [at, seen]);

  const grow = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(() => router.push(href), 'grow', e.currentTarget);
  };

  return (
    <section
      data-chapter="concepts"
      aria-label="Демо"
      className="phone-demos flex min-h-[100svh] flex-col sm:hidden"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 108px)' }}
    >
      <h1 className="sr-only">
        {PAGE.title} {PAGE.titleAccent}
      </h1>
      <p className="m-0 px-4 text-[14.5px] leading-[1.5] text-dim">Пять работающих демо. Откройте любое и пройдите его как клиент.</p>

      <div
        ref={rail}
        className="mt-4 flex min-h-[470px] flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[9vw] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ITEMS.map((c, i) => (
          <Link
            key={c.slug}
            href={`/concepts/${c.slug}`}
            onClick={grow(`/concepts/${c.slug}`)}
            data-i={i}
            aria-label={`Открыть демо: ${c.meta.title}`}
            className="relative flex w-[82vw] max-w-[360px] shrink-0 snap-center flex-col overflow-hidden rounded-[24px] border border-line-strong bg-elev/85 text-fg transition-transform duration-200 active:scale-[0.985]"
          >
            {/* экран демо: запись поверх первого кадра */}
            <span className="relative m-3 mb-0 block min-h-0 flex-1 overflow-hidden rounded-[16px] border border-line bg-bg">
              <video
                ref={(el) => {
                  films.current[i] = el;
                }}
                src={seen[i] ? `/demos/${c.slug}-phone.mp4` : undefined}
                poster={`/demos/${c.slug}-phone.webp`}
                muted
                playsInline
                loop
                preload="none"
                disablePictureInPicture
                tabIndex={-1}
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
            </span>
            <span className="flex flex-col p-4">
              <span className="flex items-center justify-between gap-3">
                <span className="rail-label">{c.niche}</span>
                <span className="rail-label">{c.meta.domain}</span>
              </span>
              <span className="mt-2 text-[19px] font-medium leading-tight">{c.title}</span>
              <span className="mt-1.5 text-[13.5px] leading-[1.45] text-dim">{c.meta.hint}</span>
              <span className="mt-3.5 flex items-center justify-between gap-3 rounded-[14px] bg-fg px-4 py-3 text-[15px] font-medium text-bg">
                Открыть демо
                <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3.5 8h9 M9 4.5 12.5 8 9 11.5" />
                </svg>
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 px-4">
        <ol className="m-0 flex list-none items-center gap-1.5 p-0" aria-label={`Демо ${at + 1} из ${ITEMS.length}`}>
          {ITEMS.map((c, i) => (
            <li key={c.slug} className={`h-[3px] rounded-full transition-[width,background-color] duration-300 ${i === at ? 'w-7 bg-fg' : 'w-3 bg-fg/25'}`} />
          ))}
        </ol>
        <Link href={contactHref('/concepts')} className="text-[13.5px] text-fg underline decoration-line-strong underline-offset-4">
          Нет вашей ниши? Соберём
        </Link>
      </div>
    </section>
  );
}
