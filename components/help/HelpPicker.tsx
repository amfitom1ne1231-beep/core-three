'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Cta from '../Cta';
import { ADVICE_KEY } from './CallMe';
import Jump from './Jump';
import Picker from './Picker';
import { formatEstimate, NEEDS } from '@/content/brief';
import { demoBySlug } from '@/content/concepts';
import { adviceHref, needLabel, stageNote, type Advice } from '@/content/picker';

// живые экраны тянут свои таймлайны — грузим, только когда дошло до итога
const LivePreview = dynamic(() => import('./LivePreview'), { ssr: false });

const actionLink =
  '-my-2 inline-flex items-center gap-2 border-0 bg-transparent py-2 font-mono text-[10px] uppercase tracking-rail text-dim transition-colors duration-300 hover:text-accent';

/**
 * Подбор в «Помощи»: вопросы, потом совет.
 *
 * Совет — не одно слово, а объяснение (HELP.md): что советуем и почему
 * словами из ответов человека, второе решение, если на него указывают
 * ответы, ориентир по сроку из той же функции, что в брифе, и живой
 * экран — как это выглядит. Главная кнопка ведёт в заявку, где всё
 * уже отмечено: остаётся оставить контакт.
 */
export default function HelpPicker() {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [round, setRound] = useState(0);
  const result = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!advice) return;
    result.current?.focus({ preventScroll: true });
    // совет уйдёт в заявку «Мы напишем сами», если до неё дойдёт
    try {
      sessionStorage.setItem(ADVICE_KEY, needLabel(advice.main) + (advice.second ? ` + ${needLabel(advice.second)}` : ''));
    } catch {
      // приватный режим: заявка уйдёт без совета
    }
  }, [advice]);

  if (!advice) return <Picker key={round} onAdvice={setAdvice} />;

  const eta = advice.eta ? formatEstimate(advice.eta) : null;
  const note = stageNote(advice.stage);
  const demo = demoBySlug(advice.demo);
  const live = NEEDS.find((n) => n.id === advice.main)?.live;

  return (
    <div
      ref={result}
      tabIndex={-1}
      aria-label="Совет"
      className="brief-preview grid gap-[clamp(28px,4vh,40px)] outline-none lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.9fr)] lg:gap-[clamp(40px,5vw,96px)]"
    >
      {/* min-w-0: иначе колонку распирает рамка живого экрана, пока он
          не измерил место, — на 320 px совет уезжал за край */}
      <div className="min-w-0">
        <span className="rail-label">Советуем</span>
        <p className="display m-0 mt-3 text-[clamp(30px,3.6vw,52px)] leading-[1.02]">{needLabel(advice.main)}</p>
        <p className="m-0 mt-4 max-w-[54ch] text-[15px] leading-relaxed text-dim">{advice.why}</p>

        {advice.second && (
          <div className="mt-6 border-t border-line pt-5">
            <span className="rail-label">И ещё</span>
            <p className="m-0 mt-2 text-[18px] font-medium leading-snug">{needLabel(advice.second)}</p>
            <p className="m-0 mt-2 max-w-[54ch] text-[14.5px] leading-relaxed text-dim">{advice.secondWhy}</p>
          </div>
        )}

        {eta && (
          <p className="m-0 mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-5">
            <span className="rail-label">Ориентир</span>
            <span className="text-[22px] font-medium leading-none">
              {eta.value} <span className="text-[14px] font-normal text-dim">{eta.unit}</span>
            </span>
            {note && <span className="text-[13.5px] text-dim">· {note}</span>}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Cta href={adviceHref(advice)}>Перейти к заявке</Cta>
          <span className="max-w-[26ch] text-[13px] leading-snug text-dim">Всё уже отмечено — останется оставить контакт</span>
        </div>
        <div className="mt-6 flex flex-wrap gap-x-7 gap-y-3">
          {demo && (
            <Link href={`/concepts/${demo.slug}`} className={actionLink}>
              Пример: «{demo.client}»
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setAdvice(null);
              setRound((r) => r + 1);
            }}
            className={actionLink}
          >
            Пройти заново
          </button>
          <Jump to="write" className={actionLink}>
            Не то? Мы напишем сами
          </Jump>
        </div>
      </div>

      {live && (
        <div className="min-w-0">
          <span className="rail-label">Так это может выглядеть</span>
          <div className="mt-3">
            <LivePreview live={live} />
          </div>
        </div>
      )}
    </div>
  );
}
