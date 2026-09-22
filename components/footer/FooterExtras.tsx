'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Mark from '../Mark';
import { SITE } from '@/content/site';

/**
 * Бегущая строка направлений. Две одинаковые половины и сдвиг на −50%:
 * стык невидим. Под курсором строка замирает — её можно прочитать.
 */
export function Marquee() {
  const words = ['Лендинги', 'Интернет-магазины', 'Боты', 'Telegram Web App', 'Мониторинг', 'Сайты-визитки'];
  const half = (
    <span className="flex shrink-0 items-center">
      {words.map((w) => (
        <span key={w} className="flex items-center">
          <span className="marquee-word">{w}</span>
          {/* разделитель — сам знак: строка читается подписью студии */}
          <span className="mx-[clamp(18px,2.4vw,40px)] block h-[clamp(22px,3vw,48px)] w-[clamp(22px,3vw,48px)] text-accent">
            <Mark className="h-full w-full" label="" />
          </span>
        </span>
      ))}
    </span>
  );
  return (
    <div className="marquee relative overflow-hidden border-y border-line py-[clamp(18px,3vh,32px)]" aria-hidden>
      <div className="marquee-track flex w-max">
        {half}
        {half}
      </div>
    </div>
  );
}

/**
 * «Дальше» — страница не обрывается на подвале, а предлагает следующую.
 * Порядок — тот, в котором сайт и стоит читать: от главной через
 * направления к демо, к нам и к заявке. С заявки — снова на главную.
 */
const ORDER = [
  { href: '/', label: 'Главная' },
  { href: '/sites', label: 'Сайты и лендинги' },
  { href: '/ecommerce', label: 'Интернет-магазины' },
  { href: '/bots', label: 'Боты и Telegram Web App' },
  { href: '/monitoring', label: 'Мониторинг и поддержка' },
  { href: '/concepts', label: 'Концепты' },
  { href: '/about', label: 'О нас' },
  { href: '/contact', label: 'Обсудить проект' }
];

export function NextPage() {
  const pathname = usePathname() ?? '/';
  const at = ORDER.findIndex((p) => p.href === pathname);
  const next = ORDER[(at + 1) % ORDER.length] ?? ORDER[1];
  return (
    <Link href={next.href} className="next-page group flex items-end justify-between gap-6 py-[clamp(28px,5vh,56px)]">
      <span>
        <span className="rail-label block">Дальше</span>
        <span className="next-page-label mt-3 block text-[clamp(28px,4.6vw,76px)] font-medium leading-none tracking-[-0.02em]">
          {next.label}
        </span>
      </span>
      <span className="next-page-arrow mb-1 grid h-[clamp(48px,5vw,76px)] w-[clamp(48px,5vw,76px)] shrink-0 place-items-center rounded-full border border-line-strong">
        <svg viewBox="0 0 24 24" className="h-1/3 w-1/3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}

/**
 * Гигантское имя внизу. Буквы поднимаются из-под кромки, когда подвал
 * входит в кадр, а свет в них следует за курсором — последнее, что
 * видит человек, отзывается на него.
 */
export function Wordmark() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.dataset.in = '';
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);

    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => io.disconnect();
    // координаты окна: градиент букв привязан к нему (background-attachment: fixed)
    const onMove = (e: PointerEvent) => {
      el.style.setProperty('--mx', `${e.clientX}px`);
      el.style.setProperty('--my', `${e.clientY}px`);
    };
    const host = el.closest('footer') ?? el;
    host.addEventListener('pointermove', onMove as EventListener);
    return () => {
      io.disconnect();
      host.removeEventListener('pointermove', onMove as EventListener);
    };
  }, []);

  return (
    <div ref={ref} className="wordmark relative select-none overflow-hidden" aria-hidden>
      <div className="wordmark-text flex justify-between">
        {SITE.name.split('').map((ch, i) => (
          <span key={i} style={{ transitionDelay: `${i * 45}ms` }}>
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}
