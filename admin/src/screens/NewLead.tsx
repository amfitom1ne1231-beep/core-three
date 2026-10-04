import { useState, type FormEvent } from 'react';
import { ApiError, useCreateLead } from '../api';
import { back, navigate } from '../router';
import { hasNativeBack } from '../tg';
import { Field, Icon, useMeData } from '../ui';

/**
 * Заявка вручную: клиент написал кому-то из команды напрямую. Правила
 * полей — те же, что у формы на сайте; их проверяет сервис, а ошибки
 * встают под своими полями.
 */

export function NewLead() {
  const { dict } = useMeData();
  const create = useCreateLead();
  const [form, setForm] = useState({ name: '', contact: '', task: '', kind: 'general', take: true });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const fields = create.error instanceof ApiError && create.error.status === 422 ? (create.error.body?.fields ?? {}) : {};
  const failed = create.isError && !Object.keys(fields).length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(form, { onSuccess: (d) => navigate({ name: 'lead', id: d.lead.id }, { replace: true }) });
  };

  return (
    <main className="screen">
      {!hasNativeBack() && (
        <button type="button" className="backlink" onClick={back}>
          <Icon name="back" size={18} />
          Заявки
        </button>
      )}
      <header className="top">
        <h1 className="top__title">Новая заявка</h1>
      </header>

      <form className="form" onSubmit={submit} noValidate>
        <div className="section section--pad form__fields">
          <Field id="name" label="Имя" error={fields.name}>
            <input id="name" type="text" autoComplete="off" maxLength={120} value={form.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!fields.name} aria-describedby={fields.name ? 'name-err' : undefined} />
          </Field>
          <Field id="contact" label="Контакт" hint="Телефон, Telegram или почта" error={fields.contact}>
            <input id="contact" type="text" autoComplete="off" autoCapitalize="none" maxLength={160} value={form.contact} onChange={(e) => set('contact', e.target.value)} aria-invalid={!!fields.contact} aria-describedby={fields.contact ? 'contact-err' : 'contact-hint'} />
          </Field>
          <Field id="task" label="Задача" error={fields.task}>
            <textarea id="task" rows={4} maxLength={4000} value={form.task} onChange={(e) => set('task', e.target.value)} aria-invalid={!!fields.task} aria-describedby={fields.task ? 'task-err' : undefined} />
          </Field>
        </div>

        <fieldset className="kinds">
          <legend className="group">Направление</legend>
          <div className="kinds__list">
            {dict.kinds.map((k) => (
              <label key={k.id} className="kind">
                <input type="radio" name="kind" value={k.id} checked={form.kind === k.id} onChange={() => set('kind', k.id)} />
                <span>{k.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="section check">
          <span>Веду эту заявку я</span>
          <input type="checkbox" checked={form.take} onChange={(e) => set('take', e.target.checked)} />
        </label>

        {failed && (
          <p className="alert" role="alert">
            Заявка не сохранилась — нет связи с сервисом. Попробуйте ещё раз.
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--wide" disabled={create.isPending}>
          {create.isPending ? 'Сохраняю…' : 'Сохранить заявку'}
        </button>
      </form>
    </main>
  );
}
