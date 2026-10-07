'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MessengerMark from '@/components/MessengerMark';
import Sheet from './Sheet';
import { DEADLINES, EXTRAS, NEEDS, STAGES, estimate, formatEstimate, stagesFor } from '@/content/brief';
import { checkLead, kindFromLocation, LEAD_KINDS, LIMITS, type LeadField, type LeadKind } from '@/lib/lead';
import { navigate } from '@/lib/phone';
import { readSource } from '@/lib/source';
import { SITE } from '@/content/site';

type Status = 'idle' | 'sending' | 'done' | 'rate' | 'down';
type Errors = Partial<Record<LeadField, string>>;

/** Четыре вопроса, выбор пути и поля контакта. */
const ASK = 4;
const SEND = 4;
const FORM = 5;
/** Пауза после ответа в один выбор: галочка успевает встать, экран листается сам. */
const AUTO_NEXT = 280;

/** «Нужна помощь?» на телефоне — не пункт, а выход в подбор. */
const PICKS = NEEDS.filter((n) => n.id !== 'unsure');

const QUESTIONS = [
  { title: 'Что запускаем?', hint: 'Можно несколько' },
  { title: 'На каком вы этапе?', hint: 'От этого зависит, с чего начнём' },
  { title: 'Что подключить?', hint: 'Необязательно — можно пропустить' },
  { title: 'К какому сроку?', hint: 'Честный ориентир назовём в ответе' },
  { title: 'Куда отправить бриф?', hint: 'Ответим в течение дня' },
  { title: 'Как с вами связаться?', hint: 'Напишем туда, где вам удобно' }
];

/**
 * Заявка на телефоне — по шагам (MOBILE.md): вопрос на экран, ответ
 * касанием. В конце два пути: «Отправить в Telegram» — открывается чат
 * с готовым текстом брифа, печатать ничего не нужно, — или «Оставить
 * контакт»: имя, контакт и согласие, заявка ложится карточкой в рабочую
 * группу, как с ноутбука. Рядом ссылка на Max.
 *
 * Экран занят заявкой целиком: нижней панели здесь нет, закрывает её
 * крестик в верхней строке. Вопросы, сроки и проверки — те же, что
 * у брифа на ноутбуке (`content/brief.ts`, `lib/lead.ts`); пункты из
 * адреса (`/contact?need=…&stage=…`) подхватываются так же.
 */
export default function PhoneBrief() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [needs, setNeeds] = useState<string[]>([]);
  const [stagePick, setStage] = useState<string | null>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Errors>({});
  const [typeParam, setTypeParam] = useState<LeadKind | null>(null);
  // бриф ушёл в Telegram: человеку осталось нажать «Отправить» уже там
  const [viaTelegram, setViaTelegram] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState(false);

  const started = useRef(0);
  const body = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  // пункты из адреса: из подбора в «Помощи», со страниц направлений
  useEffect(() => {
    started.current = Date.now();
    const q = new URLSearchParams(location.search);
    const list = (key: string) => (q.get(key) ?? '').split(',').filter(Boolean);
    let picked = list('need').filter((id) => PICKS.some((n) => n.id === id));
    const type = q.get('type');
    if (type && (LEAD_KINDS as readonly string[]).includes(type)) {
      setTypeParam(type as LeadKind);
      const byKind = PICKS.find((n) => n.kind === type);
      if (!picked.length && byKind) picked = [byKind.id];
    }
    if (picked.length) setNeeds(picked);
    const stageParam = q.get('stage');
    const stage = stageParam && STAGES.some((s) => s.id === stageParam) ? stageParam : null;
    if (stage) setStage(stage);
    const extrasParam = list('extras').filter((x) => (EXTRAS as readonly string[]).includes(x));
    if (extrasParam.length) setExtras(extrasParam);
    // подбор уже ответил на первые вопросы — начинаем с первого неотвеченного
    if (q.has('need') && picked.length) setStep(stage ? 2 : 1);
  }, []);

  const picked = PICKS.filter((n) => needs.includes(n.id));
  const stages = stagesFor(needs);
  const stage = stages.some((s) => s.id === stagePick) ? stagePick : null;
  const eta = estimate(needs, stage);
  const etaText = eta ? formatEstimate(eta) : null;

  const lines = useMemo(() => {
    const rows: ([string, string] | null)[] = [
      picked.length ? ['Что', picked.map((n) => n.label).join(', ')] : null,
      stage ? ['Этап', STAGES.find((s) => s.id === stage)?.label ?? ''] : null,
      extras.length ? ['Подключить', extras.join(', ')] : null,
      deadline ? ['Срок', DEADLINES.find((d) => d.id === deadline)?.label ?? ''] : null,
      etaText ? ['Ориентир', `${etaText.value} ${etaText.unit}`] : null
    ];
    return rows.filter((l): l is [string, string] => l !== null);
  }, [picked, stage, extras, deadline, etaText]);
  const summary = lines.map(([k, v]) => `${k}: ${v}`).join('\n');
  const message = summary ? `Здравствуйте! Бриф с сайта CoreThree:\n${summary}` : 'Здравствуйте! Хочу обсудить проект.';
  const telegram = `https://t.me/${SITE.telegram}?text=${encodeURIComponent(message)}`;

  // новый экран — с начала, заголовок получает фокус: читалка называет вопрос
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
    title.current?.focus({ preventScroll: true });
  }, [step, viaTelegram, status]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  /** Ответ в один выбор: отметили — и дальше. */
  const choose = (set: (v: string) => void, id: string, from: number) => {
    set(id);
    window.setTimeout(() => setStep((s) => (s === from ? from + 1 : s)), AUTO_NEXT);
  };
  const clear = (field: LeadField) => {
    if (errors[field]) setErrors(({ [field]: _gone, ...rest }) => rest);
  };

  const answered = [needs.length > 0, stage !== null, extras.length > 0, deadline !== null][step] ?? false;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const payload = {
      name,
      contact,
      task: [summary, note.trim()].filter(Boolean).join('\n\n'),
      consent,
      website: fd.get('website'),
      kind: typeParam ?? picked[0]?.kind ?? kindFromLocation(location.pathname),
      page: location.pathname,
      elapsed: Date.now() - started.current,
      meta: readSource()
    };
    const local = checkLead(payload);
    if (!local.ok) {
      setErrors(local.errors);
      const first = (['name', 'contact', 'task', 'consent'] as const).find((f) => local.errors[f]);
      document.getElementById(`pb-${first}`)?.focus();
      return;
    }
    setErrors({});
    setStatus('sending');
    try {
      const res = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) return setStatus('done');
      if (res.status === 422) {
        const data = (await res.json().catch(() => ({}))) as { fields?: Errors };
        setErrors(data.fields ?? {});
        return setStatus('idle');
      }
      setStatus(res.status === 429 ? 'rate' : 'down');
    } catch {
      setStatus('down');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      // буфер недоступен — текст остаётся на экране, его можно выделить пальцем
    }
  };

  const leave = (href: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(() => router.push(href));
  };

  const err = (field: LeadField) =>
    errors[field] ? (
      <p id={`pb-${field}-error`} className="m-0 mt-2 text-[12.5px] leading-snug text-danger">
        {errors[field]}
      </p>
    ) : null;

  const option = (on: boolean) =>
    `flex w-full items-center justify-between gap-3 rounded-[18px] border px-4 py-3.5 text-left transition-[border-color,background-color,transform] duration-200 active:scale-[0.985] ${
      on ? 'border-fg bg-fg/10' : 'border-line-strong bg-elev/75'
    }`;
  const tick = (on: boolean) => (
    <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${on ? 'border-fg bg-fg text-bg' : 'border-line-strong text-transparent'}`} aria-hidden>
      <svg viewBox="0 0 16 16" className="h-3 w-3">
        <path d="M3.5 8.4 6.6 11.4 12.5 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
  const primary = 'flex w-full items-center justify-center gap-2.5 rounded-[18px] bg-fg px-4 py-4 text-[16px] font-medium text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-40';
  const ghost = 'flex w-full items-center justify-center gap-2.5 rounded-[18px] border border-line-strong bg-elev/75 px-4 py-4 text-[16px] font-medium text-fg transition-transform duration-200 active:scale-[0.98]';

  const brief = lines.length > 0 && (
    <dl className="m-0 rounded-[18px] border border-line-strong bg-elev/75 px-4 py-1.5">
      {lines.map(([k, v]) => (
        <div key={k} className="flex gap-4 border-t border-line py-2.5 first:border-t-0">
          <dt className="rail-label w-[86px] shrink-0 pt-0.5">{k}</dt>
          <dd className="m-0 text-[14.5px] leading-[1.45] text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );

  const finished = status === 'done' || viaTelegram;
  const q = QUESTIONS[step];

  return (
    <section
      data-chapter="contact"
      aria-label="Заявка"
      className="phone-brief fixed inset-0 z-[60] flex flex-col sm:hidden"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 52px)' }}
    >
      <h1 className="sr-only">Заявка: бриф по шагам</h1>

      {/* где мы: четыре вопроса и отправка */}
      <div className="flex gap-1.5 px-4 pt-1.5" role="img" aria-label={finished ? 'Бриф собран' : `Шаг ${Math.min(step, SEND) + 1} из ${SEND + 1}`}>
        {Array.from({ length: SEND + 1 }, (_, i) => (
          <span key={i} className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${finished || i <= Math.min(step, SEND) ? 'bg-fg' : 'bg-fg/20'}`} />
        ))}
      </div>

      <div ref={body} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {status === 'done' ? (
          <div role="status">
            <span className="rail-label">Бриф отправлен</span>
            <h2 ref={title} tabIndex={-1} className="display m-0 mt-3 text-[34px] outline-none">
              Бриф у нас. <span className="title-accent">Ответим в течение дня</span>
            </h2>
            <p className="m-0 mt-4 text-[15px] leading-[1.55] text-dim">Напишем туда, где вы оставили контакт: что реально сделать, в какой срок и что нужно уточнить. Созвон — только если он вам нужен.</p>
            <div className="mt-7 flex flex-col gap-2.5">
              <Link href="/concepts" onClick={leave('/concepts')} className={primary}>
                Пока посмотреть демо
              </Link>
              <Link href="/" onClick={leave('/')} className={ghost}>
                На главную
              </Link>
            </div>
          </div>
        ) : viaTelegram ? (
          <div>
            <span className="rail-label">Почти всё</span>
            <h2 ref={title} tabIndex={-1} className="display m-0 mt-3 text-[32px] outline-none">
              Нажмите «Отправить» <span className="title-accent">в Telegram</span>
            </h2>
            <p className="m-0 mt-4 text-[15px] leading-[1.55] text-dim">Бриф уже стоит в поле сообщения чата {SITE.telegramLabel}. Не открылся — скопируйте текст и напишите нам сами.</p>
            <p className="m-0 mt-4 whitespace-pre-line rounded-[18px] border border-line-strong bg-elev/75 px-4 py-3.5 text-[14px] leading-[1.5] text-fg">{message}</p>
            <div className="mt-5 flex flex-col gap-2.5">
              <a href={telegram} target="_blank" rel="noreferrer noopener" className={primary}>
                <MessengerMark kind="telegram" size={18} />
                Открыть Telegram ещё раз
              </a>
              <button type="button" onClick={copy} className={ghost} aria-live="polite">
                {copied ? 'Скопировано' : 'Скопировать текст'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setViaTelegram(false);
                  setStep(FORM);
                }}
                className="py-3 text-[14.5px] text-fg underline decoration-line-strong underline-offset-4"
              >
                Лучше оставлю контакт на сайте
              </button>
            </div>
          </div>
        ) : (
          <div key={step} className="animate-[ct-rise_0.36s_cubic-bezier(0.2,0.7,0.2,1)_both]">
            {/* на последних экранах низ свободен под кнопки отправки — возврат стоит здесь */}
            {step >= SEND && (
              <button type="button" onClick={() => setStep(step === FORM ? SEND : ASK - 1)} className="-ml-1 mb-4 flex items-center gap-1.5 py-1 text-[14px] text-dim">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 3.5 5.5 8 10 12.5" />
                </svg>
                {step === FORM ? 'К выбору, куда отправить' : 'К вопросам'}
              </button>
            )}
            <span className="rail-label">{step < ASK ? `Вопрос ${step + 1} из ${ASK}` : 'Бриф собран'}</span>
            <h2 ref={title} tabIndex={-1} className="display m-0 mt-3 text-[32px] outline-none">
              {q.title}
            </h2>
            <p className="m-0 mt-2 text-[14.5px] leading-[1.5] text-dim">{q.hint}</p>

            {step === 0 && (
              <>
                <div className="mt-5 flex flex-col gap-2">
                  {PICKS.map((n) => {
                    const on = needs.includes(n.id);
                    return (
                      <button key={n.id} type="button" aria-pressed={on} onClick={() => toggle(needs, setNeeds, n.id)} className={option(on)}>
                        <span className="flex min-w-0 flex-col">
                          <span className="text-[16px] font-medium leading-tight text-fg">{n.label}</span>
                          <span className="mt-1 text-[12.5px] leading-snug text-dim">{n.scope}</span>
                        </span>
                        {tick(on)}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-col items-start gap-1">
                  <Link href="/help#start" onClick={leave('/help#start')} className="py-2 text-[14.5px] text-fg underline decoration-line-strong underline-offset-4">
                    Не знаю, что выбрать — подобрать за четыре вопроса
                  </Link>
                  <button type="button" onClick={() => setStep(SEND)} className="py-2 text-[14.5px] text-dim underline decoration-line-strong underline-offset-4">
                    Пропустить вопросы и написать своими словами
                  </button>
                </div>
              </>
            )}

            {step === 1 && (
              <div className="mt-5 flex flex-col gap-2" role="radiogroup" aria-label={q.title}>
                {stages.map((s) => {
                  const on = stage === s.id;
                  return (
                    <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => choose(setStage, s.id, 1)} className={option(on)}>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[16px] font-medium leading-tight text-fg">{s.label}</span>
                        <span className="mt-1 text-[12.5px] leading-snug text-dim">{s.note}</span>
                      </span>
                      {tick(on)}
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {EXTRAS.map((x) => {
                  const on = extras.includes(x);
                  return (
                    <button
                      key={x}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(extras, setExtras, x)}
                      className={`rounded-full border px-4 py-2.5 text-[14.5px] font-medium transition-[border-color,background-color,color,transform] duration-200 active:scale-95 ${
                        on ? 'border-fg bg-fg text-bg' : 'border-line-strong bg-elev/75 text-fg'
                      }`}
                    >
                      {x}
                    </button>
                  );
                })}
              </div>
            )}

            {step === 3 && (
              <div className="mt-5 flex flex-col gap-2" role="radiogroup" aria-label={q.title}>
                {DEADLINES.map((d) => {
                  const on = deadline === d.id;
                  return (
                    <button key={d.id} type="button" role="radio" aria-checked={on} onClick={() => choose(setDeadline, d.id, 3)} className={option(on)}>
                      <span className="text-[16px] font-medium leading-tight text-fg">{d.label}</span>
                      {tick(on)}
                    </button>
                  );
                })}
              </div>
            )}

            {step === SEND && (
              <>
                {brief && <div className="mt-5">{brief}</div>}
                <div className="mt-5 flex flex-col gap-2.5">
                  <a href={telegram} target="_blank" rel="noreferrer noopener" onClick={() => setViaTelegram(true)} className={primary}>
                    <MessengerMark kind="telegram" size={18} />
                    Отправить в Telegram
                  </a>
                  <p className="m-0 px-1 text-[12.5px] leading-snug text-dim">Откроется чат {SITE.telegramLabel} с готовым текстом — останется нажать «Отправить».</p>
                  <button type="button" onClick={() => setStep(FORM)} className={`${ghost} mt-2`}>
                    Оставить контакт — напишем сами
                  </button>
                  <a href={SITE.max} target="_blank" rel="noreferrer noopener" className="flex items-center justify-center gap-2 py-3 text-[14.5px] text-fg underline decoration-line-strong underline-offset-4">
                    <MessengerMark kind="max" />
                    Или напишите в {SITE.maxLabel}
                  </a>
                </div>
              </>
            )}

            {step === FORM && (
              <form onSubmit={submit} noValidate className="mt-5">
                <div className="flex flex-col gap-5">
                  <label className="block">
                    <span className="rail-label !text-dim">{SITE.form.name.label}</span>
                    <input
                      id="pb-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        clear('name');
                      }}
                      maxLength={LIMITS.name}
                      placeholder={SITE.form.name.placeholder}
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? 'pb-name-error' : undefined}
                      className="brief-input"
                    />
                    {err('name')}
                  </label>
                  <label className="block">
                    <span className="rail-label !text-dim">{SITE.form.contact.label}</span>
                    <input
                      id="pb-contact"
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      autoCapitalize="none"
                      value={contact}
                      onChange={(e) => {
                        setContact(e.target.value);
                        clear('contact');
                      }}
                      maxLength={LIMITS.contact}
                      placeholder={SITE.form.contact.placeholder}
                      aria-invalid={errors.contact ? true : undefined}
                      aria-describedby={errors.contact ? 'pb-contact-error' : undefined}
                      className="brief-input"
                    />
                    {err('contact')}
                  </label>
                  <label className="block">
                    <span className="rail-label !text-dim">Пара слов о проекте{summary ? ' · необязательно' : ''}</span>
                    <textarea
                      id="pb-task"
                      value={note}
                      onChange={(e) => {
                        setNote(e.target.value);
                        clear('task');
                      }}
                      rows={2}
                      maxLength={LIMITS.task - 400}
                      placeholder="Что уже есть, чего хотите добиться"
                      aria-invalid={errors.task ? true : undefined}
                      aria-describedby={errors.task ? 'pb-task-error' : undefined}
                      className="brief-input max-h-[30vh] min-h-[4.5rem] resize-none [field-sizing:content]"
                    />
                    {err('task')}
                  </label>
                </div>

                {/* ловушка: человек поле не видит, бот заполняет */}
                <div aria-hidden className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
                  <label>
                    Сайт
                    <input name="website" type="text" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>

                <label className="mt-6 flex cursor-pointer items-start gap-3 py-1.5 text-[13.5px] leading-snug text-dim">
                  <span className="relative mt-px flex h-[18px] w-[18px] shrink-0">
                    <input
                      id="pb-consent"
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => {
                        setConsent(e.target.checked);
                        clear('consent');
                      }}
                      aria-invalid={errors.consent ? true : undefined}
                      aria-describedby={errors.consent ? 'pb-consent-error' : undefined}
                      className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-transparent transition-colors duration-300 checked:border-accent checked:bg-accent"
                    />
                    <svg viewBox="0 0 16 16" className="pointer-events-none absolute inset-0 hidden text-bg peer-checked:block" aria-hidden>
                      <path d="M4 8.2 6.7 11 12 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </span>
                  <span>
                    {SITE.form.consent}{' '}
                    <Link href="/consent" className="text-fg underline decoration-line-strong underline-offset-4">
                      {SITE.form.consentLink}
                    </Link>
                  </span>
                </label>
                {err('consent')}

                <div aria-live="polite">
                  {(status === 'rate' || status === 'down') && (
                    <p className="m-0 mt-5 border-l border-danger pl-4 text-[13.5px] leading-relaxed text-dim">
                      {status === 'rate' ? SITE.form.errors.rate : SITE.form.errors.down}{' '}
                      <a href={telegram} target="_blank" rel="noreferrer noopener" className="text-fg underline decoration-line-strong underline-offset-4">
                        {SITE.telegramLabel}
                      </a>{' '}
                      или{' '}
                      <a href={`mailto:${SITE.email}`} className="text-fg underline decoration-line-strong underline-offset-4">
                        {SITE.email}
                      </a>
                    </p>
                  )}
                </div>

                <button type="submit" disabled={status === 'sending'} className={`${primary} mt-6`}>
                  {status === 'sending' ? SITE.form.sending : 'Отправить бриф'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* низ: что уже собрано и куда дальше — под большим пальцем */}
      {!finished && step < SEND && (
        <div className="border-t border-line bg-bg/85 px-4 pt-3 backdrop-blur-xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}>
          {lines.length > 0 && (
            <button type="button" onClick={() => setSheet(true)} className="mb-3 flex w-full items-center justify-between gap-3 text-left">
              <span className="min-w-0 truncate text-[13px] text-dim">
                <span className="rail-label mr-2">Бриф</span>
                {picked.map((n) => n.label).join(', ') || 'собирается'}
              </span>
              {etaText && (
                <span className="shrink-0 text-[13px] font-medium text-fg">
                  {etaText.value} {etaText.unit}
                </span>
              )}
            </button>
          )}
          <div className="flex gap-2.5">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="rounded-[18px] border border-line-strong bg-elev/75 px-5 py-4 text-[16px] font-medium text-fg transition-transform duration-200 active:scale-[0.97]">
                Назад
              </button>
            )}
            <button type="button" onClick={() => setStep(step + 1)} disabled={step === 0 && !answered} className={primary}>
              {answered ? 'Дальше' : step === 0 ? 'Выберите хотя бы одно' : 'Пропустить'}
            </button>
          </div>
        </div>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} label="Бриф">
        <span className="rail-label">Бриф</span>
        <h2 className="m-0 mt-2 text-[22px] font-medium leading-tight text-fg">Что уже собрано</h2>
        <div className="mt-4">{brief}</div>
        <p className="m-0 mt-4 text-[13px] leading-snug text-dim">Срок — ориентир, а не обещание: точный назовём после разговора.</p>
      </Sheet>
    </section>
  );
}
