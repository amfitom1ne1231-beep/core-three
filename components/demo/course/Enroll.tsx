'use client';

import { useEffect, useRef, useState } from 'react';
import { C, DISPLAY, money } from './shared';
import { COURSE, FUNNEL, TIERS, type Tier } from '@/content/concepts/course';

type Step = 'form' | 'paying' | 'done';

/**
 * Запись на курс.
 *
 * Три шага в одном листе: тариф и контакты → оплата → воронка.
 * Последний шаг и есть то, ради чего лендинг эксперта отличается
 * от любого другого: деньги приняты, а дальше человека должен кто-то
 * вести. Здесь видно, кто именно — бот приходит в Telegram сам,
 * с расписанием, списком материалов и ссылкой в чат потока.
 *
 * Сообщения приходят по одному с паузами и «печатает…» перед каждым.
 * Мгновенная выкладка всех четырёх читалась бы списком возможностей,
 * а не перепиской — разница ровно в том, что переписку узнают.
 */
export default function Enroll({ tier: initial, onClose }: { tier: Tier; onClose: () => void }) {
  const [step, setStep] = useState<Step>('form');
  const [tier, setTier] = useState(initial);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [touched, setTouched] = useState(false);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const feed = useRef<HTMLDivElement>(null);

  const badName = name.trim().length < 2;
  const badContact = contact.trim().length < 4;
  const invalid = badName || badContact;

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'paying') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose, step]);

  /** Воронка проигрывается один раз после оплаты. */
  useEffect(() => {
    if (step !== 'done') return;
    const timers: number[] = [];
    FUNNEL.forEach((m, i) => {
      timers.push(window.setTimeout(() => setTyping(true), m.at - 500));
      timers.push(
        window.setTimeout(() => {
          setTyping(i < FUNNEL.length - 1);
          setShown(i + 1);
        }, m.at)
      );
    });
    timers.push(window.setTimeout(() => setTyping(false), FUNNEL[FUNNEL.length - 1].at + 200));
    return () => timers.forEach(clearTimeout);
  }, [step]);

  // лента доезжает до нового сообщения сама, как в настоящем мессенджере
  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: 'smooth' });
  }, [shown, typing]);

  const submit = () => {
    setTouched(true);
    if (invalid) return;
    setStep('paying');
    setTimeout(() => setStep('done'), 1600);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Запись на курс">
      <button
        type="button"
        aria-label="Закрыть"
        onClick={() => step !== 'paying' && onClose()}
        className="absolute inset-0 cursor-default border-0 p-0"
        style={{ background: 'rgba(8,11,16,0.62)', backdropFilter: 'blur(3px)' }}
      />

      <div
        ref={panel}
        tabIndex={-1}
        className="relative max-h-[94vh] w-full max-w-[560px] overflow-y-auto outline-none sm:rounded-[16px]"
        style={{ background: C.card, animation: 'sheet .32s cubic-bezier(0.22,1,0.36,1) both' }}
      >
        <div className="flex items-center justify-between gap-4 border-b px-6 py-4" style={{ borderColor: C.line }}>
          <h2 className="m-0 text-[17px] font-medium uppercase tracking-[0.04em]" style={{ fontFamily: DISPLAY }}>
            {step === 'form' && 'Запись на поток'}
            {step === 'paying' && 'Оплата'}
            {step === 'done' && 'Вы записаны'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={step === 'paying'}
            className="rounded-full border px-3 py-1.5 text-[12px] disabled:opacity-40"
            style={{ borderColor: C.line, color: C.muted }}
          >
            Закрыть
          </button>
        </div>

        {/* ---------- тариф и контакты ---------- */}
        {step === 'form' && (
          <div className="px-6 py-6">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: C.faint }}>
              Тариф
            </p>
            <div className="mt-3 grid gap-2">
              {TIERS.map((t) => {
                const on = t.id === tier.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t)}
                    aria-pressed={on}
                    className="flex items-center justify-between gap-4 rounded-[10px] border px-4 py-3 text-left transition-colors duration-200"
                    style={{ borderColor: on ? C.accent : C.line, background: on ? C.raise : 'transparent' }}
                  >
                    <span>
                      <span className="block text-[14.5px] font-medium">{t.name}</span>
                      <span className="mt-0.5 block text-[12.5px]" style={{ color: C.faint }}>
                        {t.includes[0]}
                      </span>
                    </span>
                    <span className="shrink-0 text-[15px] tabular-nums" style={{ fontFamily: DISPLAY }}>
                      {money(t.price)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px]" style={{ color: C.muted }}>
                  Имя
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Как к вам обращаться"
                  className="w-full rounded-[10px] border px-3.5 py-3 text-[14px] outline-none"
                  style={{
                    borderColor: touched && badName ? '#d9694f' : C.line,
                    background: C.deep,
                    color: C.ink
                  }}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px]" style={{ color: C.muted }}>
                  Telegram или почта
                </span>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="@ник или почта"
                  className="w-full rounded-[10px] border px-3.5 py-3 text-[14px] outline-none"
                  style={{
                    borderColor: touched && badContact ? '#d9694f' : C.line,
                    background: C.deep,
                    color: C.ink
                  }}
                />
              </label>
            </div>

            {touched && invalid && (
              <p className="m-0 mt-3 text-[13px]" style={{ color: '#d9694f' }}>
                {badName ? 'Как вас зовут? ' : ''}
                {badContact ? 'Куда прислать доступ?' : ''}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              className="mt-6 w-full rounded-[10px] px-6 py-3.5 text-[14.5px] font-semibold transition-opacity duration-200 hover:opacity-90"
              style={{ background: C.accent, color: C.onAccent }}
            >
              Оплатить {money(tier.price)}
            </button>
            <p className="m-0 mt-3 text-center text-[12px]" style={{ color: C.faint }}>
              Возврат в первые две недели без вопросов
            </p>
          </div>
        )}

        {/* ---------- оплата ---------- */}
        {step === 'paying' && (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <span
              className="block h-9 w-9 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: C.accent, borderRightColor: C.accent }}
              aria-hidden
            />
            <p className="m-0 mt-5 text-[15px]">Проводим платёж на {money(tier.price)}</p>
            <p className="m-0 mt-2 text-[13px]" style={{ color: C.faint }}>
              Не закрывайте страницу
            </p>
          </div>
        )}

        {/* ---------- воронка ---------- */}
        {step === 'done' && (
          <div className="px-6 py-6">
            <p className="m-0 text-[14px] leading-relaxed" style={{ color: C.muted }}>
              Оплачено {money(tier.price)}, тариф «{tier.name}». Дальше вас ведёт бот — вот что приходит
              в Telegram прямо сейчас.
            </p>

            {/* телефон с перепиской: сообщения приходят по одному */}
            <div
              className="mt-5 overflow-hidden rounded-[18px] border"
              style={{ borderColor: C.line, background: '#0e1621' }}
            >
              <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold"
                  style={{ background: C.accent, color: C.onAccent }}
                >
                  А
                </span>
                <span className="leading-tight">
                  <span className="block text-[13.5px]" style={{ color: '#e9eef3' }}>
                    Курс Анны
                  </span>
                  <span className="block text-[11.5px]" style={{ color: '#8fa0b0' }}>
                    бот · {COURSE.tg}
                  </span>
                </span>
              </div>

              <div ref={feed} className="max-h-[320px] overflow-y-auto px-4 py-4">
                <div className="flex flex-col gap-2.5">
                  {FUNNEL.slice(0, shown).map((m) => (
                    <div key={m.text} style={{ animation: 'feedin .35s ease both' }}>
                      <div
                        className="max-w-[86%] rounded-[14px] rounded-bl-[4px] px-3.5 py-2.5 text-[13.5px] leading-snug"
                        style={{ background: '#1d2733', color: '#e9eef3' }}
                      >
                        {m.text}
                        {m.file && (
                          <span className="mt-2.5 flex items-center gap-2.5 rounded-[10px] px-3 py-2" style={{ background: '#243040' }}>
                            {/* синий Telegram (#4c9ce2) даёт с белым 2,9:1 —
                                стрелка на нём не читается. Глубокий из той же
                                палитры: 5,3:1. */}
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px]"
                              style={{ background: '#256fae', color: '#fff' }}
                              aria-hidden
                            >
                              ↓
                            </span>
                            <span className="text-[12.5px]">{m.file}</span>
                          </span>
                        )}
                        {m.button && (
                          <span
                            className="mt-2.5 block rounded-[10px] px-3 py-2 text-center text-[12.5px]"
                            style={{ background: '#256fae', color: '#fff' }}
                          >
                            {m.button}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {typing && (
                    <div
                      className="flex w-fit items-center gap-1 rounded-[14px] rounded-bl-[4px] px-3.5 py-3"
                      style={{ background: '#1d2733' }}
                      aria-hidden
                    >
                      {[0, 1, 2].map((i) => (
                        <i
                          key={i}
                          className="block h-1.5 w-1.5 rounded-full"
                          style={{
                            background: '#8fa0b0',
                            animation: 'ct-blink 1.2s infinite',
                            animationDelay: `${i * 0.18}s`
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-[10px] border px-6 py-3.5 text-[14.5px] transition-colors duration-200"
              style={{ borderColor: C.line, color: C.ink }}
            >
              Вернуться к курсу
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
