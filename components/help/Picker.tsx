'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { advise, QUESTIONS, type Advice, type Answers } from '@/content/picker';

/**
 * Вопросы подбора — по одному на экран, один ответ, и сразу дальше.
 *
 * Общие для «Помощи» и брифа: что делать с итогом, решает тот, кто
 * поставил подбор (`onAdvice`). Назад можно вернуться — прежний ответ
 * подсвечен. После ответа фокус встаёт на следующий вопрос, иначе
 * клавиатура и читалка остались бы на кнопке, которой уже нет.
 */
export default function Picker({ onAdvice, compact = false }: { onAdvice: (a: Advice) => void; compact?: boolean }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const title = useRef<HTMLParagraphElement>(null);
  const moved = useRef(false);
  const titleId = useId();
  const q = QUESTIONS[step]!;

  // на первом показе фокус не трогаем: подбор не должен утаскивать страницу
  useEffect(() => {
    if (moved.current) title.current?.focus({ preventScroll: true });
  }, [step]);

  const choose = (id: string) => {
    const next = { ...answers, [q.id]: id };
    setAnswers(next);
    moved.current = true;
    if (step < QUESTIONS.length - 1) setStep(step + 1);
    else onAdvice(advise(next as Answers));
  };

  return (
    <div className={compact ? 'brief-picker' : undefined}>
      <div className="flex min-h-11 items-center justify-between gap-4">
        <span className="rail-label" aria-live="polite">
          Вопрос {step + 1} из {QUESTIONS.length}
        </span>
        {step > 0 && (
          <button
            type="button"
            onClick={() => {
              moved.current = true;
              setStep(step - 1);
            }}
            className="-my-2 inline-flex items-center gap-2 border-0 bg-transparent py-2 font-mono text-[10px] uppercase tracking-rail text-dim transition-colors duration-300 hover:text-accent"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M13 8H3.5M7.5 3.5 3 8l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Назад
          </button>
        )}
      </div>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-line" aria-hidden>
        <i
          className="block h-full origin-left rounded-full bg-accent transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `scaleX(${step / QUESTIONS.length})` }}
        />
      </div>

      <p
        id={titleId}
        ref={title}
        tabIndex={-1}
        className={`m-0 mt-5 font-medium leading-snug outline-none ${compact ? 'text-[18px]' : 'text-[clamp(20px,2vw,28px)]'}`}
      >
        {q.title}
      </p>
      <div role="radiogroup" aria-labelledby={titleId} className="mt-4 grid gap-2 sm:grid-cols-2 sm:gap-2.5">
        {q.options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={answers[q.id] === o.id}
            onClick={() => choose(o.id)}
            className="brief-pill group !flex-row w-full items-center justify-between gap-4 !text-[15px]"
          >
            {o.label}
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5 shrink-0 text-faint transition-[color,transform] duration-300 group-hover:translate-x-0.5 group-hover:text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
