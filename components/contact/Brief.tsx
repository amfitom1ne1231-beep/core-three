'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import MarkVideo, { type MarkVideoHandle } from '../MarkVideo';
import { LIVE_H, LIVE_W } from '../live/kit';
import { LIVE_BY_KEY } from '../live/map';
import { DEADLINES, EXTRAS, NEEDS, STAGES, estimate, formatEstimate, stagesFor } from '@/content/brief';
import { checkLead, kindFromLocation, LEAD_KINDS, LIMITS, type LeadField, type LeadKind } from '@/lib/lead';
import { readSource } from '@/lib/source';
import { SITE } from '@/content/site';

type Status = 'idle' | 'sending' | 'done' | 'rate' | 'down';
type Errors = Partial<Record<LeadField | 'need', string>>;

const PREVIEW_W = 336;

/**
 * Бриф на странице заявки — главный разговор сайта.
 *
 * Пустая форма «имя, контакт, задача» заставляла человека сочинять
 * письмо. Здесь он отвечает на пять коротких вопросов кликами, а справа
 * на его глазах собирается бриф: что запускаем, на каком этапе, что
 * подключить, к какому сроку — и честный ориентир по неделям. Знак
 * в карточке собирается из трёх лучей по мере заполнения: проект
 * складывается буквально.
 *
 * Можно пропустить всё и написать своими словами — вопросы помогают,
 * а не стоят на входе. В заявку уходит собранный текст брифа плюс то,
 * что человек дописал сам; тип проекта — по первому выбранному пункту.
 */
export default function Brief({ intro }: { intro?: ReactNode }) {
  const [needs, setNeeds] = useState<string[]>([]);
  const [stagePick, setStage] = useState<string | null>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [task, setTask] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Errors>({});
  const [typeParam, setTypeParam] = useState<LeadKind | null>(null);

  const started = useRef(0);
  const mark = useRef<MarkVideoHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  /**
   * Пункт из финала страницы и тип раздела — из адреса.
   *
   * Номера брифа больше нет. Он собирался из даты и часа, у двоих в один
   * час выходил одинаковым и в заявку не уходил — то есть был выдуман,
   * и это на странице, где первое ядро — честность.
   */
  useEffect(() => {
    started.current = Date.now();
    const q = new URLSearchParams(location.search);
    const need = q.get('need');
    if (need && NEEDS.some((n) => n.id === need)) setNeeds([need]);
    const type = q.get('type');
    if (type && (LEAD_KINDS as readonly string[]).includes(type)) {
      setTypeParam(type as LeadKind);
      if (!need) {
        const byKind = NEEDS.find((n) => n.kind === type);
        if (byKind) setNeeds([byKind.id]);
      }
    }
  }, []);

  const picked = NEEDS.filter((n) => needs.includes(n.id));
  // ответ на второй вопрос живёт, только пока он уместен: сняли сайт
  // и магазин — «нужен новый» уходит вместе со своим вариантом
  const stages = stagesFor(needs);
  const stage = stages.some((s) => s.id === stagePick) ? stagePick : null;
  const eta = estimate(needs, stage);
  const etaText = eta ? formatEstimate(eta) : null;
  /**
   * Пять шагов, как и вопросов на странице. Третий необязателен,
   * поэтому он пройден, когда в нём что-то выбрали или ответили на
   * следующий: иначе счётчик «0 из 4» спорил с «пятью вопросами»,
   * а заполненный целиком бриф не доходил бы до пяти из пяти.
   */
  const steps = [
    needs.length > 0,
    stage !== null,
    extras.length > 0 || deadline !== null,
    deadline !== null,
    name.trim() !== '' && contact.trim() !== ''
  ];
  const done = steps.filter(Boolean).length;

  // знак собирается ходом брифа: разобран — на старте, собран — после отправки
  useEffect(() => {
    mark.current?.seek(status === 'done' ? 1 : 0.08 + (done / steps.length) * 0.72);
  }, [done, status, steps.length]);

  useEffect(() => {
    if (status === 'done') doneRef.current?.focus();
  }, [status]);

  const last = picked[picked.length - 1];
  const Live = last?.live ? LIVE_BY_KEY[last.live] : null;

  const summary = useMemo(() => {
    const lines = [
      picked.length && `Что: ${picked.map((n) => n.label).join(', ')}`,
      stage && `Этап: ${STAGES.find((s) => s.id === stage)?.label}`,
      extras.length && `Подключить: ${extras.join(', ')}`,
      deadline && `Срок: ${DEADLINES.find((d) => d.id === deadline)?.label}`,
      etaText && `Ориентир: ${etaText.value} ${etaText.unit}`
    ].filter(Boolean);
    return lines.join('\n');
  }, [picked, stage, extras, deadline, etaText]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const clear = (field: keyof Errors) => {
    if (errors[field]) setErrors(({ [field]: _gone, ...rest }) => rest);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const full = [summary, task.trim()].filter(Boolean).join('\n\n');
    const payload = {
      name,
      contact,
      task: full,
      consent,
      website: fd.get('website'),
      kind: typeParam ?? picked[0]?.kind ?? kindFromLocation(location.pathname),
      page: location.pathname,
      elapsed: Date.now() - started.current,
      // откуда человек пришёл: метки из ссылки, страница входа, сайт-источник
      meta: readSource()
    };
    const local = checkLead(payload);
    if (!local.ok) {
      const errs: Errors = { ...local.errors };
      // пустая задача значит «ничего не выбрано и ничего не написано»
      if (errs.task && !summary) {
        errs.need = 'Выберите, что запускаем, — или напишите пару слов ниже';
        delete errs.task;
      }
      setErrors(errs);
      const first = (['need', 'name', 'contact', 'task', 'consent'] as const).find((f) => errs[f]);
      document.getElementById(`brief-${first}`)?.focus();
      return;
    }
    setErrors({});
    setStatus('sending');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
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

  const err = (field: keyof Errors) =>
    errors[field] ? (
      <p id={`brief-${field}-error`} className="m-0 mt-2 text-[12.5px] leading-snug text-danger">
        {errors[field]}
      </p>
    ) : null;

  return (
    <div className="grid items-start gap-[clamp(32px,5vw,88px)] lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.85fr)]">
      {/* ---------------- вопросы ---------------- */}
      <div>
        {intro}
        {status === 'done' ? (
          <div role="status" className="brief-done">
            <span className="rail-label">Бриф отправлен</span>
            <h2 ref={doneRef} tabIndex={-1} className="display m-0 mt-6 text-[clamp(36px,5vw,76px)] outline-none">
              Бриф у нас.
              <span className="block font-bold tracking-[-0.035em]">Ответим в течение дня.</span>
            </h2>
            <p className="m-0 mt-6 max-w-[48ch] text-[16px] leading-relaxed text-dim">
              Напишем туда, где вы оставили контакт: что реально сделать, в какой срок и что нужно уточнить. Созвон — только если
              он вам нужен.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/concepts" className="need-chip">
                Пока посмотреть демо
              </Link>
              <a href={`https://t.me/${SITE.telegram}`} target="_blank" rel="noreferrer noopener" className="need-chip">
                Написать в Telegram
              </a>
            </div>
          </div>
        ) : (
          <form ref={formRef} onSubmit={submit} noValidate className="brief-steps">
            {/* 01 — что запускаем */}
            <fieldset className="brief-step" data-done={steps[0] || undefined}>
              <legend className="brief-legend">
                <span className="brief-num">01</span> Что запускаем?
                <span className="brief-hint">можно несколько</span>
              </legend>
              <div id="brief-need" tabIndex={-1} className="grid grid-cols-2 gap-2 outline-none sm:gap-2.5 xl:grid-cols-3">
                {NEEDS.map((n) => {
                  const on = needs.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        toggle(needs, setNeeds, n.id);
                        clear('need');
                      }}
                      className="brief-card"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-mono text-[10px] tracking-rail text-faint">{n.n}</span>
                        <span className="brief-check" aria-hidden>
                          <svg viewBox="0 0 16 16">
                            <path d="M3.5 8.4 6.6 11.4 12.5 4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </span>
                      <span className="mt-4 block text-[15px] font-medium leading-tight sm:mt-5 sm:text-[16px]">{n.label}</span>
                      <span className="mt-1.5 hidden text-[12.5px] leading-snug text-dim sm:block">{n.scope}</span>
                    </button>
                  );
                })}
              </div>
              {err('need')}
            </fieldset>

            {/* 02 — этап */}
            <fieldset className="brief-step" data-done={steps[1] || undefined}>
              <legend className="brief-legend">
                <span className="brief-num">02</span> Где вы сейчас?
              </legend>
              <div role="radiogroup" aria-label="Этап" className="flex flex-wrap gap-2">
                {stages.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={stage === s.id}
                    onClick={() => setStage(s.id)}
                    className="brief-pill"
                  >
                    {s.label}
                    <span className="brief-pill-note">{s.note}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* 03 — что подключить */}
            <fieldset className="brief-step" data-done={extras.length > 0 || undefined}>
              <legend className="brief-legend">
                <span className="brief-num">03</span> Что подключить?
                <span className="brief-hint">необязательно</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {EXTRAS.map((x) => (
                  <button key={x} type="button" aria-pressed={extras.includes(x)} onClick={() => toggle(extras, setExtras, x)} className="brief-chip">
                    {x}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* 04 — срок */}
            <fieldset className="brief-step" data-done={steps[2] || undefined}>
              <legend className="brief-legend">
                <span className="brief-num">04</span> К какому сроку?
              </legend>
              <div role="radiogroup" aria-label="Срок" className="flex flex-wrap gap-2">
                {DEADLINES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={deadline === d.id}
                    onClick={() => setDeadline(d.id)}
                    className="brief-chip"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* 05 — контакт */}
            <fieldset className="brief-step" data-done={steps[3] || undefined}>
              <legend className="brief-legend">
                <span className="brief-num">05</span> Куда ответить?
              </legend>
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                <label className="block">
                  <span className="rail-label !text-dim">{SITE.form.name.label}</span>
                  <input
                    id="brief-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clear('name');
                    }}
                    autoComplete="name"
                    maxLength={LIMITS.name}
                    placeholder={SITE.form.name.placeholder}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={errors.name ? 'brief-name-error' : undefined}
                    className="brief-input"
                  />
                  {err('name')}
                </label>
                <label className="block">
                  <span className="rail-label !text-dim">{SITE.form.contact.label}</span>
                  <input
                    id="brief-contact"
                    value={contact}
                    onChange={(e) => {
                      setContact(e.target.value);
                      clear('contact');
                    }}
                    autoComplete="on"
                    maxLength={LIMITS.contact}
                    placeholder={SITE.form.contact.placeholder}
                    aria-invalid={errors.contact ? true : undefined}
                    aria-describedby={errors.contact ? 'brief-contact-error' : undefined}
                    className="brief-input"
                  />
                  {err('contact')}
                </label>
                <label className="block sm:col-span-2">
                  <span className="rail-label !text-dim">Пара слов о проекте · необязательно</span>
                  <textarea
                    id="brief-task"
                    value={task}
                    onChange={(e) => {
                      setTask(e.target.value);
                      clear('task');
                      clear('need');
                    }}
                    rows={2}
                    maxLength={LIMITS.task - 400}
                    placeholder="Что уже есть, чего хотите добиться, есть ли примеры, которые нравятся"
                    aria-invalid={errors.task ? true : undefined}
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

              <label className="mt-7 flex cursor-pointer items-start gap-3 py-1.5 text-[13px] leading-snug text-dim">
                <span className="relative mt-px flex h-4 w-4 shrink-0">
                  <input
                    id="brief-consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked);
                      clear('consent');
                    }}
                    aria-invalid={errors.consent ? true : undefined}
                    className="peer absolute inset-0 m-0 cursor-pointer appearance-none border border-line-strong bg-transparent transition-colors duration-300 checked:border-accent checked:bg-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg aria-[invalid=true]:border-danger"
                  />
                  <svg viewBox="0 0 16 16" className="pointer-events-none absolute inset-0 hidden text-bg peer-checked:block" aria-hidden>
                    <path d="M4 8.2 6.7 11 12 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </span>
                <span>
                  {SITE.form.consent}{' '}
                  <Link href="/consent" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent">
                    {SITE.form.consentLink}
                  </Link>
                </span>
              </label>
              {err('consent')}

              <div aria-live="polite">
                {(status === 'rate' || status === 'down') && (
                  <p className="m-0 mt-6 border-l border-danger pl-4 text-[13px] leading-relaxed text-dim">
                    {status === 'rate' ? SITE.form.errors.rate : SITE.form.errors.down}{' '}
                    <a href={`mailto:${SITE.email}`} className="text-fg underline decoration-line-strong underline-offset-4">
                      {SITE.email}
                    </a>{' '}
                    или{' '}
                    <a href={`https://t.me/${SITE.telegram}`} target="_blank" rel="noreferrer noopener" className="text-fg underline decoration-line-strong underline-offset-4">
                      {SITE.telegramLabel}
                    </a>
                  </p>
                )}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <button type="submit" data-magnetic disabled={status === 'sending'} className="cta cta-lg cta-primary">
                  <span className="cta-fill" aria-hidden />
                  <span className="cta-label">
                    <span>{status === 'sending' ? SITE.form.sending : 'Отправить бриф'}</span>
                    <span aria-hidden>{status === 'sending' ? SITE.form.sending : 'Отправить бриф'}</span>
                  </span>
                  <span className="cta-arrow" aria-hidden>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="cta-shine" aria-hidden />
                </button>
                <span className="rail-label">{SITE.form.note}</span>
              </div>
            </fieldset>
          </form>
        )}

        {/* На телефоне карточка брифа стоит под всеми вопросами, и как он
            собирается, не видно. Полоска внизу держит главное на экране. */}
        {status !== 'done' && done > 0 && (
          <a href="#brief-live" className="brief-dock lg:hidden">
            <span className="font-mono text-[10px] uppercase tracking-rail text-faint">Бриф</span>
            <span className="text-[13px] font-medium">
              {done} из {steps.length}
              {etaText && (
                <span className="text-dim">
                  {' '}
                  · {etaText.value} {etaText.unit}
                </span>
              )}
            </span>
            <i className="brief-dock-bar" style={{ transform: `scaleX(${done / steps.length})` }} aria-hidden />
          </a>
        )}
      </div>

      {/* ---------------- собранный бриф ---------------- */}
      <aside id="brief-live" className="brief-card-live scroll-mt-24 lg:sticky lg:top-[96px]" aria-label="Собранный бриф">
        <div className="flex items-center gap-4">
          <MarkVideo ref={mark} variant="build" initial={0.08} className="aspect-square w-[112px] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="m-0 flex items-baseline justify-between gap-3">
              <span className="rail-label">Бриф</span>
              <span className="font-mono text-[10px] tracking-rail text-faint">
                {status === 'done' ? 'отправлен' : `${done} из ${steps.length}`}
              </span>
            </p>
            <p className="m-0 mt-2 text-[20px] font-medium leading-tight tracking-[-0.01em]">
              {status === 'done' ? 'Собран и у нас' : done === 0 ? 'Начнём с главного' : done < steps.length ? 'Собирается' : 'Готов к отправке'}
            </p>
            <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-line">
              <i
                className="block h-full origin-left rounded-full bg-accent transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: `scaleX(${status === 'done' ? 1 : done / steps.length})` }}
              />
            </div>
          </div>
        </div>

        <dl className="m-0 mt-6 space-y-3 border-t border-line pt-5 text-[13.5px]">
          <BriefRow term="Что" value={picked.map((n) => n.label).join(' + ')} />
          <BriefRow term="Этап" value={STAGES.find((s) => s.id === stage)?.label} />
          <BriefRow term="Подключить" value={extras.join(', ')} />
          <BriefRow term="Срок" value={DEADLINES.find((d) => d.id === deadline)?.label} />
        </dl>

        <div className="mt-5 rounded-[12px] border border-line p-4">
          <p className="m-0 flex items-baseline justify-between gap-3">
            <span className="rail-label">Ориентир по срокам</span>
            <span className="font-mono text-[10px] text-faint">уточним на созвоне</span>
          </p>
          <p className="m-0 mt-2 text-[28px] font-medium leading-none tracking-[-0.02em]">
            {etaText ? (
              <>
                {etaText.value} <span className="text-[15px] font-normal text-dim">{etaText.unit}</span>
              </>
            ) : needs.includes('unsure') ? (
              <span className="text-[17px] font-normal text-dim">Посчитаем после разбора — бесплатно</span>
            ) : (
              <span className="text-[17px] font-normal text-faint">Выберите, что запускаем</span>
            )}
          </p>
        </div>

        {/* так это может выглядеть: живой экран последнего выбранного */}
        {Live && (
          <div className="mt-5">
            <p className="m-0 mb-2 rail-label">Так это может выглядеть</p>
            <div
              key={last.id}
              className="brief-preview relative overflow-hidden rounded-[12px] border border-line"
              style={{ height: Math.round((PREVIEW_W / LIVE_W) * LIVE_H), ['--live-k' as string]: (PREVIEW_W / LIVE_W).toFixed(4) }}
              aria-hidden
            >
              <Live playing />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function BriefRow({ term, value }: { term: string; value?: string }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
      <dt className="font-mono text-[10px] uppercase leading-[1.9] tracking-rail text-faint">{term}</dt>
      <dd className={`m-0 leading-snug ${value ? 'brief-value text-fg' : 'text-faint'}`} key={value || 'empty'}>
        {value || '—'}
      </dd>
    </div>
  );
}
