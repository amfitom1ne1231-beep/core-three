'use client';

import { useRef } from 'react';
import { Check, LiveScreen, countTo, useLoop, type LiveProps } from './kit';

const SERIF = "Georgia, 'Times New Roman', serif";
const GREEN = '#2f6b47';

const LEAD =
  'Откладывание — не лень. Это способ не встречаться с неприятным чувством: страхом ошибки, скукой, неясностью.';
const NEXT = 'Попробуйте правило пяти минут: договоритесь с собой только начать.';

/**
 * Визитка и блог: автор пишет заметку прямо на своём сайте — текст
 * набирается, обложка уже стоит, — жмёт «Опубликовать», заметка выходит
 * в эфир и тут же уходит подписчикам в Telegram. Молочная бумага
 * и антиква: единственный светлый кадр атласа.
 *
 * Серые полосы вместо строк были честны к вёрстке и нечестны к жанру:
 * блог — это текст. Поэтому текст настоящий, обложка снята в Blender
 * (brand/blender/products.py, кадр `desk`).
 */
export default function LiveBlog({ playing }: LiveProps) {
  const root = useRef<HTMLDivElement>(null);

  useLoop(
    root,
    playing,
    (tl) => {
      const q = (s: string) => root.current?.querySelector(s) ?? null;
      const type = (sel: string, text: string, at: number, per: number) => {
        const el = q(sel);
        if (!el) return;
        const box = { n: 0 };
        tl.fromTo(
          box,
          { n: 0 },
          {
            n: text.length,
            duration: text.length * per,
            ease: 'none',
            onUpdate: () => {
              el.textContent = text.slice(0, Math.round(box.n));
            }
          },
          at
        );
      };

      tl.from('[data-nav]', { opacity: 0, y: -6, duration: 0.45, stagger: 0.05 }, 0)
        .from('[data-cover]', { clipPath: 'inset(0 0 100% 0 round 8px)', duration: 0.9, ease: 'expo.inOut' }, 0.1)
        .from('[data-cover-img]', { scale: 1.15, duration: 1.4, ease: 'power3.out' }, 0.1)
        .from('[data-kicker]', { opacity: 0, duration: 0.4 }, 0.55)
        .from('[data-hl]', { yPercent: 105, duration: 0.9, ease: 'expo.out', stagger: 0.1 }, 0.6)
        .from('[data-caret]', { opacity: 0, duration: 0.1 }, 1.1);
      type('[data-lead]', LEAD, 1.15, 0.014);
      type('[data-next]', NEXT, 2.85, 0.014);
      tl.to('[data-caret]', { opacity: 0, duration: 0.1 }, 3.85)
        // публикация: панель автора
        .from('[data-panel]', { y: 16, opacity: 0, duration: 0.5, ease: 'expo.out' }, 1.3)
        .to('[data-knob]', { x: 14, duration: 0.35, ease: 'power2.inOut' }, 3.95)
        .to('[data-track]', { backgroundColor: GREEN, duration: 0.35 }, 3.95)
        .to('[data-state]', { yPercent: -50, duration: 0.35, ease: 'power2.inOut' }, 4.0)
        .from('[data-stamp]', { scale: 1.8, rotate: -20, opacity: 0, duration: 0.45, ease: 'back.out(1.6)' }, 4.2)
        .from('[data-sent]', { opacity: 0, x: -6, duration: 0.4 }, 4.5)
        // подписчикам в Telegram
        .from('[data-tg]', { y: -30, opacity: 0, duration: 0.6, ease: 'expo.out' }, 4.7)
        .from('[data-reads]', { opacity: 0, duration: 0.3 }, 4.6)
        .to('[data-page]', { opacity: 0, duration: 0.45 }, 6.8)
        .set({}, {}, 7.3);
      countTo(tl, q('[data-count]'), 0, 1204, 4.7, { duration: 1.8 });
      // каретка мигает, пока идёт набор
      tl.to('[data-caret]', { opacity: 0.1, duration: 0.3, yoyo: true, repeat: 9, ease: 'steps(1)' }, 1.1);
    },
    0.84
  );

  return (
    <LiveScreen>
      <div ref={root} className="absolute inset-0 bg-[#eeebe4] font-sans text-[#141414]">
        <div data-page className="absolute inset-0">
          {/* шапка сайта автора */}
          <header className="absolute inset-x-6 top-4 flex items-center justify-between">
            <span data-nav className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#cfc3ae] text-[10px] font-semibold text-[#5a4c38]" style={{ fontFamily: SERIF }}>
                МО
              </span>
              <span className="leading-tight">
                <b className="block text-[11px] font-semibold">Мария Орлова</b>
                <span className="text-[9px] text-[#7a746a]">психолог, КПТ</span>
              </span>
            </span>
            <nav className="flex items-center gap-4 text-[10px] text-[#6b665e]">
              <span data-nav className="text-[#141414] underline decoration-[#141414] underline-offset-4">
                Заметки
              </span>
              <span data-nav>Практики</span>
              <span data-nav>Обо мне</span>
              <span data-nav className="rounded-full bg-[#141414] px-2.5 py-1 text-[9.5px] text-[#eeebe4]">
                Записаться
              </span>
            </nav>
          </header>

          {/* статья */}
          <article className="absolute left-6 top-[52px] w-[318px]">
            <div data-cover className="relative h-[92px] overflow-hidden rounded-[8px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img data-cover-img src="/live/desk.webp" alt="" className="h-full w-full object-cover" draggable={false} />
            </div>
            <p data-kicker className="m-0 mt-3 font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#8a8479]">
              Заметки · 4 мин · 22 сентября
            </p>
            <h4 className="m-0 mt-1.5 text-[25px] leading-[1.04] tracking-[-0.01em]" style={{ fontFamily: SERIF, fontWeight: 500 }}>
              <span className="block overflow-hidden pb-0.5">
                <span data-hl className="block">
                  Как перестать откладывать
                </span>
              </span>
            </h4>
            <p className="m-0 mt-2 text-[11px] leading-[1.55] text-[#2c2a26]">
              <span data-lead>{LEAD}</span>
            </p>
            <p className="relative m-0 mt-2 border-l-2 border-[#141414] pl-3 text-[12.5px] leading-snug" style={{ fontFamily: SERIF, fontWeight: 500 }}>
              <span data-next>{NEXT}</span>
              <i data-caret className="ml-0.5 inline-block h-[13px] w-[1.5px] translate-y-[2px] bg-[#141414]" />
            </p>
          </article>

          {/* панель автора: публикация и рассылка */}
          <div
            data-panel
            className="absolute right-5 top-[52px] w-[176px] rounded-[12px] border border-[#ddd6c9] bg-[#f7f5f0] p-3 shadow-[0_14px_34px_rgba(60,48,30,0.12)]"
          >
            <p className="m-0 font-mono text-[8px] uppercase tracking-[0.16em] text-[#8a8479]">Публикация</p>
            <div className="mt-2 flex items-center gap-2.5">
              <span data-track className="relative block h-[18px] w-8 shrink-0 rounded-full bg-[#bdb6a8]">
                <i data-knob className="absolute left-[2px] top-[2px] block h-[14px] w-[14px] rounded-full bg-white shadow" />
              </span>
              <span className="h-4 overflow-hidden text-[11px]">
                <span data-state className="flex flex-col leading-4">
                  <span className="text-[#6b665e]">Черновик</span>
                  <span className="font-semibold" style={{ color: GREEN }}>
                    Опубликовано
                  </span>
                </span>
              </span>
            </div>
            <ul className="m-0 mt-3 list-none space-y-1.5 border-t border-[#e4ddd0] p-0 pt-2.5 text-[9.5px] text-[#6b665e]">
              <li className="flex items-center gap-1.5">
                <Check className="h-3 w-3" color={GREEN} /> Обложка и описание для поиска
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3 w-3" color={GREEN} /> Ссылка в меню «Заметки»
              </li>
              <li data-sent className="flex items-center gap-1.5">
                <Check className="h-3 w-3" color={GREEN} /> Отправлено 2 318 подписчикам
              </li>
            </ul>
            <p data-reads className="m-0 mt-2.5 flex items-baseline justify-between border-t border-[#e4ddd0] pt-2 text-[9.5px] text-[#6b665e]">
              <span>Прочтения за час</span>
              <b data-count className="text-[15px] font-semibold text-[#141414]">
                1 204
              </b>
            </p>
          </div>

          {/* пришло подписчику в Telegram */}
          <div
            data-tg
            className="absolute bottom-5 right-5 flex w-[196px] items-start gap-2 rounded-[12px] bg-[#1f2c3a] p-2.5 text-white shadow-[0_18px_36px_rgba(20,30,40,0.35)]"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#cfc3ae] text-[8.5px] font-semibold text-[#5a4c38]" style={{ fontFamily: SERIF }}>
              МО
            </span>
            <span className="min-w-0 leading-tight">
              <b className="block text-[10px] font-semibold">Заметки Марии Орловой</b>
              <span className="mt-0.5 block text-[9.5px] text-white/70">Новая заметка: «Как перестать откладывать» — 4 минуты чтения</span>
            </span>
          </div>

          <span
            data-stamp
            className="absolute left-[246px] top-[64px] rounded-md border-2 bg-[#eeebe4]/70 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] backdrop-blur-[1px]"
            style={{ rotate: '-8deg', color: GREEN, borderColor: GREEN }}
          >
            В эфире
          </span>
        </div>
      </div>
    </LiveScreen>
  );
}
