'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Mark from './Mark';
import { checkLead, kindFromLocation, LIMITS, type LeadField } from '@/lib/lead';
import { SITE } from '@/content/site';

type Status = 'idle' | 'sending' | 'done' | 'rate' | 'down';
type Errors = Partial<Record<LeadField, string>>;

const ORDER: LeadField[] = ['name', 'contact', 'task', 'consent'];

const input =
  'w-full rounded-none border-0 border-b border-line-strong bg-transparent px-0 pb-3 pt-2 text-[16px] text-fg ' +
  'outline-none transition-colors duration-300 placeholder:text-faint ' +
  'hover:border-faint focus:border-accent aria-[invalid=true]:border-danger';

/**
 * Форма заявки: имя, контакт, задача. Тип проекта не спрашиваем —
 * он берётся из раздела, откуда пришёл человек.
 *
 * Проверка та же, что на сервере (lib/lead.ts), поэтому ошибки видны
 * сразу, без круга до сервера. Введённое не теряется ни при ошибке
 * проверки, ни при сбое отправки.
 */
export default function LeadForm() {
  const { form } = SITE;
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const started = useRef(0);
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    started.current = Date.now();
  }, []);

  useEffect(() => {
    if (status === 'done') doneRef.current?.focus();
  }, [status]);

  const focusFirst = (errs: Errors) => {
    const field = ORDER.find((f) => errs[f]);
    const el = field && formRef.current?.elements.namedItem(field);
    if (el instanceof HTMLElement) el.focus();
  };

  const clear = (field: LeadField) => {
    if (errors[field]) setErrors(({ [field]: _gone, ...rest }) => rest);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'sending') return;

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get('name'),
      contact: fd.get('contact'),
      task: fd.get('task'),
      consent: fd.get('consent') === 'on',
      website: fd.get('website'),
      kind: kindFromLocation(location.pathname, new URLSearchParams(location.search).get('type')),
      page: location.pathname,
      elapsed: Date.now() - started.current
    };

    const local = checkLead(payload);
    if (!local.ok) {
      setErrors(local.errors);
      focusFirst(local.errors);
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
      if (res.ok) {
        setStatus('done');
        return;
      }
      if (res.status === 422) {
        const data = (await res.json().catch(() => ({}))) as { fields?: Errors };
        setErrors(data.fields ?? {});
        focusFirst(data.fields ?? {});
        setStatus('idle');
        return;
      }
      setStatus(res.status === 429 ? 'rate' : 'down');
    } catch {
      setStatus('down');
    }
  };

  const again = () => {
    formRef.current?.reset();
    started.current = Date.now();
    setStatus('idle');
  };

  if (status === 'done') {
    return (
      <div role="status" className="animate-[ct-rise_0.7s_cubic-bezier(0.2,0.7,0.2,1)_both]">
        <span aria-hidden>
          <Mark className="h-10 w-10 text-accent" />
        </span>
        <h3
          ref={doneRef}
          tabIndex={-1}
          className="display m-0 mt-8 text-[clamp(28px,3.4vw,48px)] outline-none"
        >
          {form.success.title}
        </h3>
        <p className="m-0 mt-4 max-w-[36ch] text-[15px] leading-relaxed text-dim">{form.success.text}</p>
        <button
          type="button"
          onClick={again}
          className="mt-8 border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-rail text-faint underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-fg"
        >
          {form.success.again}
        </button>
      </div>
    );
  }

  const fieldError = (field: LeadField) =>
    errors[field] ? (
      <p id={`${field}-error`} className="m-0 mt-2 text-[12.5px] leading-snug text-danger">
        {errors[field]}
      </p>
    ) : null;

  const aria = (field: LeadField) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${field}-error` : undefined
  });

  const sending = status === 'sending';

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="relative">
      <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
        <label className="block">
          <span className="rail-label !text-dim">{form.name.label}</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            maxLength={LIMITS.name}
            placeholder={form.name.placeholder}
            className={input}
            onChange={() => clear('name')}
            {...aria('name')}
          />
          {fieldError('name')}
        </label>

        <label className="block">
          <span className="rail-label !text-dim">{form.contact.label}</span>
          <input
            name="contact"
            type="text"
            autoComplete="on"
            maxLength={LIMITS.contact}
            placeholder={form.contact.placeholder}
            className={input}
            onChange={() => clear('contact')}
            {...aria('contact')}
          />
          {fieldError('contact')}
        </label>

        <label className="block sm:col-span-2">
          <span className="rail-label !text-dim">{form.task.label}</span>
          <textarea
            name="task"
            rows={3}
            maxLength={LIMITS.task}
            placeholder={form.task.placeholder}
            className={`${input} max-h-[40vh] min-h-[5.5rem] resize-none [field-sizing:content]`}
            onChange={() => clear('task')}
            {...aria('task')}
          />
          {fieldError('task')}
        </label>
      </div>

      {/* ловушка: человек поле не видит, бот заполняет */}
      <div aria-hidden className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label>
          Сайт
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="mt-8">
        <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-snug text-dim">
          <span className="relative mt-px flex h-4 w-4 shrink-0">
            <input
              name="consent"
              type="checkbox"
              className="peer absolute inset-0 m-0 cursor-pointer appearance-none border border-line-strong bg-transparent transition-colors duration-300 checked:border-accent checked:bg-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg aria-[invalid=true]:border-danger"
              onChange={() => clear('consent')}
              {...aria('consent')}
            />
            <svg
              viewBox="0 0 16 16"
              className="pointer-events-none absolute inset-0 hidden text-bg peer-checked:block"
              aria-hidden
            >
              <path d="M4 8.2 6.7 11 12 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <span>
            {form.consent}{' '}
            <Link href="/consent" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent">
              {form.consentLink}
            </Link>
          </span>
        </label>
        {fieldError('consent')}
      </div>

      <div aria-live="polite">
        {(status === 'rate' || status === 'down') && (
          <p className="m-0 mt-7 border-l border-danger pl-4 text-[13px] leading-relaxed text-dim">
            {status === 'rate' ? form.errors.rate : form.errors.down}{' '}
            <a href={`mailto:${SITE.email}`} className="text-fg underline decoration-line-strong underline-offset-4">
              {SITE.email}
            </a>{' '}
            или{' '}
            <a
              href={`https://t.me/${SITE.telegram}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-fg underline decoration-line-strong underline-offset-4"
            >
              {SITE.telegramLabel}
            </a>
          </p>
        )}
      </div>

      <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
        <button
          type="submit"
          disabled={sending}
          className="relative overflow-hidden border border-fg bg-fg px-[26px] py-[15px] font-mono text-[11px] uppercase tracking-label text-bg transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-white disabled:cursor-wait"
        >
          {sending ? form.sending : form.submit}
          {/* пока идёт отправка, по нижней кромке бежит полоса */}
          {sending && (
            <span
              className="absolute bottom-0 left-0 h-[2px] w-1/3 animate-[ct-run_1s_ease-in-out_infinite] bg-accent"
              aria-hidden
            />
          )}
        </button>
        <span className="rail-label">{form.note}</span>
      </div>
    </form>
  );
}
