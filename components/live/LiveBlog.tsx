'use client';

import { useRef } from 'react';
import { LiveScreen, countTo, useLoop, type LiveProps } from './kit';

/**
 * Визитка и блог: статья пишется, переключатель уходит в «опубликовано»,
 * падает штамп, растут прочтения. Стиль — молочная бумага и антиква:
 * единственный светлый кадр атласа, чтобы шесть направлений не слились
 * в один тон.
 */
export default function LiveBlog({ playing }: LiveProps) {
  const root = useRef<HTMLDivElement>(null);

  useLoop(root, playing, (tl) => {
    const q = (s: string) => root.current?.querySelector(s) ?? null;

    tl.from('[data-nav]', { opacity: 0, x: -10, duration: 0.5, stagger: 0.06 }, 0)
      .from('[data-rule]', { scaleY: 0, duration: 0.8, ease: 'power3.inOut' }, 0.1)
      .from('[data-kicker]', { opacity: 0, duration: 0.4 }, 0.3)
      .from('[data-hl]', { yPercent: 105, duration: 0.9, ease: 'expo.out', stagger: 0.12 }, 0.35)
      // строки текста «печатаются» слева направо
      .from('[data-line]', { scaleX: 0, duration: 0.45, ease: 'power2.out', stagger: 0.14 }, 0.95)
      .from('[data-quote-rule]', { scaleY: 0, duration: 0.4, ease: 'power2.out' }, 1.6)
      .from('[data-quote]', { opacity: 0, x: -6, duration: 0.5 }, 1.7)
      .from('[data-line2]', { scaleX: 0, duration: 0.45, ease: 'power2.out', stagger: 0.14 }, 2.0)
      // публикация
      .to('[data-knob]', { x: 14, duration: 0.35, ease: 'power2.inOut' }, 2.7)
      .to('[data-track]', { backgroundColor: '#2f6b47', duration: 0.35 }, 2.7)
      .to('[data-draft]', { opacity: 0, duration: 0.2 }, 2.75)
      .from('[data-live]', { opacity: 0, duration: 0.25 }, 2.9)
      .from('[data-stamp]', { scale: 1.8, rotate: -20, opacity: 0, duration: 0.45, ease: 'back.out(1.6)' }, 3.0)
      .from('[data-readers]', { opacity: 0, y: 6, duration: 0.4 }, 3.2)
      .to('[data-page]', { opacity: 0, duration: 0.45 }, 5.6)
      .set({}, {}, 6.1);
    countTo(tl, q('[data-count]'), 0, 1204, 3.3, { duration: 1.6 });
  });

  const lines = ['100%', '94%', '97%', '58%'];
  const lines2 = ['96%', '88%'];

  return (
    <LiveScreen>
      <div ref={root} className="absolute inset-0 bg-[#eeebe4] font-sans text-[#141414]">
        <div data-page className="absolute inset-0">
          {/* колонка автора */}
          <aside className="absolute left-7 top-8 w-[118px]">
            <div data-nav className="h-9 w-9 rounded-full bg-[#cfc7b8]" />
            <p data-nav className="m-0 mt-3 text-[12px] font-semibold leading-tight">Мария Орлова</p>
            <p data-nav className="m-0 text-[10px] text-[#6b665e]">психолог</p>
            <ul className="m-0 mt-6 flex list-none flex-col gap-2 p-0 text-[11px] text-[#6b665e]">
              <li data-nav className="text-[#141414] underline decoration-[#141414] underline-offset-4">
                Заметки
              </li>
              <li data-nav>Практики</li>
              <li data-nav>Обо мне</li>
              <li data-nav>Запись</li>
            </ul>
          </aside>
          <i data-rule className="absolute left-[164px] top-8 block h-[316px] w-px origin-top bg-[#d6d0c4]" />

          {/* статья */}
          <article className="absolute left-[188px] top-8 w-[344px]">
            <p data-kicker className="m-0 font-mono text-[9px] uppercase tracking-[0.18em] text-[#8a8479]">
              Заметки · 4 мин
            </p>
            <h4
              // Антиква здесь — примета чужого блога в рамке демо, а не
              // типографика сайта: своя гарнитура на сайте ровно одна.
              // Курсива нет и тут: он ушёл со всего проекта.
              className="m-0 mt-2 text-[33px] leading-[1.04] tracking-[-0.01em]"
              style={{ fontFamily: 'Georgia, \'Times New Roman\', serif', fontWeight: 500 }}
            >
              <span className="block overflow-hidden pb-1">
                <span data-hl className="block">
                  Как перестать
                </span>
              </span>
              <span className="block overflow-hidden pb-1">
                <span data-hl className="block">
                  откладывать
                </span>
              </span>
            </h4>
            <div className="mt-4 flex flex-col gap-[9px]">
              {lines.map((w, i) => (
                <i key={i} data-line className="block h-[6px] origin-left rounded-full bg-[#cdc6b8]" style={{ width: w }} />
              ))}
            </div>
            <div className="relative mt-4 pl-4">
              <i data-quote-rule className="absolute left-0 top-0 block h-full w-[2px] origin-top bg-[#141414]" />
              <p
                data-quote
                className="m-0 text-[16px] leading-snug"
                style={{ fontFamily: 'Georgia, \'Times New Roman\', serif', fontWeight: 500 }}
              >
                «Начните с пяти минут — остальное подтянется»
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-[9px]">
              {lines2.map((w, i) => (
                <i key={i} data-line2 className="block h-[6px] origin-left rounded-full bg-[#cdc6b8]" style={{ width: w }} />
              ))}
            </div>
          </article>

          {/* публикация */}
          <div className="absolute bottom-6 left-[188px] flex items-center gap-3">
            <span data-track className="relative block h-[18px] w-8 rounded-full bg-[#bdb6a8]">
              <i data-knob className="absolute left-[2px] top-[2px] block h-[14px] w-[14px] rounded-full bg-white shadow" />
            </span>
            <span className="relative h-4 w-[92px] text-[11px]">
              <span data-draft className="absolute inset-0 text-[#6b665e]">
                Черновик
              </span>
              <span data-live className="absolute inset-0 font-semibold text-[#2f6b47]">
                Опубликовано
              </span>
            </span>
            <span data-readers className="font-mono text-[10px] text-[#6b665e]">
              <span data-count>1 204</span> прочтения
            </span>
          </div>

          <span
            data-stamp
            className="absolute right-6 top-6 rounded-md border-2 border-[#2f6b47] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2f6b47]"
            style={{ rotate: '-8deg' }}
          >
            В эфире
          </span>
        </div>
      </div>
    </LiveScreen>
  );
}
