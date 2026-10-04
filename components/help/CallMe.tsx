'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { checkLead, LIMITS, type LeadField } from '@/lib/lead';
import { readSource } from '@/lib/source';
import { SITE } from '@/content/site';

type Status = 'idle' | 'sending' | 'done' | 'rate' | 'down';
type Errors = Partial<Record<LeadField, string>>;

/** Совет подбора на этой же странице — его кладёт `HelpPicker`. */
export const ADVICE_KEY = 'ct-help-advice';

/**
 * «Мы напишем сами» — последний выход для того, кто не разобрался
 * и с помощью (HELP.md, этап 3): имя и телефон, больше ничего.
 *
 * Студия не звонит, а пишет в мессенджер по номеру — это обещано прямо
 * под формой, поэтому контакт здесь только телефон. Заявка идёт тем же
 * путём, что бриф, с пометкой `help`: в группе карточка «Нужна помощь»,
 * в метриках — своя строка. Если человек перед этим прошёл подбор,
 * его совет уходит в заявку — команде не придётся начинать с нуля.
 */
export default function CallMe() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Errors>({});
  const started = useRef(0);
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    started.current = Date.now();
  }, []);
  useEffect(() => {
    if (status === 'done') doneRef.current?.focus();
  }, [status]);

  const clear = (field: LeadField) => {
    if (errors[field]) setErrors(({ [field]: _gone, ...rest }) => rest);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'sending') return;
    let advice = '';
    try {
      advice = sessionStorage.getItem(ADVICE_KEY) ?? '';
    } catch {
      // приватный режим: совета просто не будет
    }
    const payload = {
      name,
      contact: phone,
      task: ['Нужна помощь: просит написать по номеру в мессенджер.', advice && `Подбор советовал: ${advice}.`].filter(Boolean).join('\n'),
      consent,
      website: new FormData(e.currentTarget).get('website'),
      kind: 'general',
      page: location.pathname,
      elapsed: Date.now() - started.current,
      meta: readSource(),
      help: true
    };
    const local = checkLead(payload);
    if (!local.ok) {
      setErrors(local.errors);
      const first = (['name', 'contact', 'consent'] as const).find((f) => local.errors[f]);
      document.getElementById(`callme-${first}`)?.focus();
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

  const err = (field: LeadField) =>
    errors[field] ? (
      <p id={`callme-${field}-error`} className="m-0 mt-2 text-[12.5px] leading-snug text-danger">
        {errors[field]}
      </p>
    ) : null;

  if (status === 'done') {
    return (
      <div role="status" className="brief-picker !mt-0">
        <span className="rail-label">Заявка у нас</span>
        <p ref={doneRef} tabIndex={-1} className="m-0 mt-3 text-[clamp(20px,2vw,26px)] font-medium leading-snug outline-none">
          Напишем в течение рабочего дня.
        </p>
        <p className="m-0 mt-3 max-w-[44ch] text-[14.5px] leading-relaxed text-dim">
          В Telegram, Max или WhatsApp на номер <span className="whitespace-nowrap">{phone.trim()}</span>. Звонить не будем.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="brief-picker !mt-0" aria-label="Мы напишем сами">
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <label className="block">
          <span className="rail-label !text-dim">{SITE.form.name.label}</span>
          <input
            id="callme-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clear('name');
            }}
            autoComplete="name"
            maxLength={LIMITS.name}
            placeholder={SITE.form.name.placeholder}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'callme-name-error' : undefined}
            className="brief-input"
          />
          {err('name')}
        </label>
        <label className="block">
          <span className="rail-label !text-dim">Телефон</span>
          <input
            id="callme-contact"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clear('contact');
            }}
            autoComplete="tel"
            maxLength={LIMITS.contact}
            placeholder="+7 900 000-00-00"
            aria-invalid={errors.contact ? true : undefined}
            aria-describedby={errors.contact ? 'callme-contact-error' : undefined}
            className="brief-input"
          />
          {err('contact')}
        </label>
      </div>

      {/* ловушка: человек поле не видит, бот заполняет */}
      <div aria-hidden className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label>
          Сайт
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 py-1.5 text-[13px] leading-snug text-dim">
        <span className="relative mt-px flex h-4 w-4 shrink-0">
          <input
            id="callme-consent"
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
          <p className="m-0 mt-5 border-l border-danger pl-4 text-[13px] leading-relaxed text-dim">
            {status === 'rate' ? SITE.form.errors.rate : SITE.form.errors.down}{' '}
            <a href={`https://t.me/${SITE.telegram}`} target="_blank" rel="noreferrer noopener" className="text-fg underline decoration-line-strong underline-offset-4">
              {SITE.telegramLabel}
            </a>
            , в{' '}
            <a href={SITE.max} target="_blank" rel="noreferrer noopener" className="text-fg underline decoration-line-strong underline-offset-4">
              {SITE.maxLabel}
            </a>{' '}
            или на{' '}
            <a href={`mailto:${SITE.email}`} className="text-fg underline decoration-line-strong underline-offset-4">
              {SITE.email}
            </a>
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="submit" data-magnetic disabled={status === 'sending'} className="cta cta-primary">
          <span className="cta-fill" aria-hidden />
          <span className="cta-label">
            <span>{status === 'sending' ? SITE.form.sending : 'Напишите мне'}</span>
            <span aria-hidden>{status === 'sending' ? SITE.form.sending : 'Напишите мне'}</span>
          </span>
          <span className="cta-arrow" aria-hidden>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="cta-shine" aria-hidden />
        </button>
        <span className="max-w-[30ch] text-[12.5px] leading-snug text-dim">
          Напишем в Telegram, Max или WhatsApp в течение рабочего дня
        </span>
      </div>
    </form>
  );
}
