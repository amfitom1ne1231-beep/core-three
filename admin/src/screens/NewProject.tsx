import { useState, type FormEvent } from 'react';
import { useProjectChange } from '../api';
import { back, navigate } from '../router';
import { hasNativeBack } from '../tg';
import { Field, Icon, useMeData } from '../ui';

/**
 * Проект вручную — когда работа началась без заявки. Этапы подставятся
 * по направлению; дальше их можно править в самом проекте.
 */

export function NewProject() {
  const { dict } = useMeData();
  const create = useProjectChange();
  const [form, setForm] = useState({ client: '', kind: 'sites', title: '', contact: '' });
  const [tried, setTried] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const noClient = tried && !form.client.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!form.client.trim()) return;
    create.mutate(
      { path: '/projects', body: { client: form.client.trim(), kind: form.kind, title: form.title.trim() || undefined, contact: form.contact.trim() || undefined } },
      { onSuccess: (v) => navigate({ name: 'project', id: v.project.id }, { replace: true }) }
    );
  };

  return (
    <main className="screen">
      {!hasNativeBack() && (
        <button type="button" className="backlink" onClick={back}>
          <Icon name="back" size={18} />
          Проекты
        </button>
      )}
      <header className="top">
        <h1 className="top__title">Новый проект</h1>
      </header>

      <form className="form" onSubmit={submit} noValidate>
        <div className="section section--pad form__fields">
          <Field id="client" label="Клиент" error={noClient ? 'Для кого проект?' : undefined}>
            <input id="client" type="text" autoComplete="off" maxLength={120} value={form.client} onChange={(e) => set('client', e.target.value)} aria-invalid={noClient} aria-describedby={noClient ? 'client-err' : undefined} />
          </Field>
          <Field id="contact" label="Контакт" hint="Телефон, Telegram или почта — необязательно">
            <input id="contact" type="text" autoComplete="off" autoCapitalize="none" maxLength={160} value={form.contact} onChange={(e) => set('contact', e.target.value)} aria-describedby="contact-hint" />
          </Field>
          <Field id="title" label="Название" hint="Пусто — «Сайт — Клиент», по направлению">
            <input id="title" type="text" autoComplete="off" maxLength={160} value={form.title} onChange={(e) => set('title', e.target.value)} aria-describedby="title-hint" />
          </Field>
        </div>

        <fieldset className="kinds">
          <legend className="group">Направление — от него этапы</legend>
          <div className="kinds__list">
            {dict.kinds.map((k) => (
              <label key={k.id} className="kind">
                <input type="radio" name="kind" value={k.id} checked={form.kind === k.id} onChange={() => set('kind', k.id)} />
                <span>{k.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {create.isError && (
          <p className="alert" role="alert">
            Проект не сохранился — нет связи с сервисом. Попробуйте ещё раз.
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--wide" disabled={create.isPending}>
          {create.isPending ? 'Сохраняю…' : 'Завести проект'}
        </button>
      </form>
    </main>
  );
}
