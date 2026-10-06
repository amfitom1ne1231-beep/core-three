import { useEffect, useState } from 'react';
import { ApiError, createInvite, useSettings, useSettingsChange, type Prefs, type Settings } from '../api';
import { clock, minutesOf, span } from '../format';
import { back } from '../router';
import { haptic, hasNativeBack, openTg } from '../tg';
import { ConfirmButton, Field, Icon, Notice, RowsPlaceholder, Sheet } from '../ui';

/**
 * Команда и настройки. Раньше рабочие часы, срок реакции и сводки жили
 * в файле на сервере — поменять час напоминания значило идти туда.
 * Теперь их меняют здесь; действовать начинают сразу, без перезапуска.
 *
 * Видят экран все, меняют владельцы. Часовой пояс не меняется: он один
 * на всю студию.
 */

/** Дни недели по порядку, как их читают: с понедельника. */
const WEEK: { id: number; label: string; full: string }[] = [
  { id: 1, label: 'пн', full: 'понедельник' },
  { id: 2, label: 'вт', full: 'вторник' },
  { id: 3, label: 'ср', full: 'среда' },
  { id: 4, label: 'чт', full: 'четверг' },
  { id: 5, label: 'пт', full: 'пятница' },
  { id: 6, label: 'сб', full: 'суббота' },
  { id: 0, label: 'вс', full: 'воскресенье' }
];

const TAKE = [15, 30, 45, 60, 90, 120, 180];
const ALARM = [30, 60, 90, 120];

/** Слова к ошибкам сервиса: он отвечает именем поля. */
const FIELD_ERROR: Partial<Record<keyof Prefs, string>> = {
  workEnd: 'Рабочий день должен длиться хотя бы час.',
  workStart: 'Начало — раньше конца рабочего дня.',
  alarmBeforeEndMin: 'Проверка должна попадать в рабочий день.',
  workDays: 'Нужен хотя бы один рабочий день.'
};

const same = (a: Prefs, b: Prefs) => JSON.stringify({ ...a, workDays: [...a.workDays].sort() }) === JSON.stringify({ ...b, workDays: [...b.workDays].sort() });

export function SettingsScreen() {
  const settings = useSettings();
  return (
    <main className="screen">
      {!hasNativeBack() && (
        <button type="button" className="backlink" onClick={back}>
          <Icon name="back" size={18} />
          Сегодня
        </button>
      )}
      <header className="top">
        <h1 className="top__title">Команда и настройки</h1>
      </header>
      {settings.isPending ? (
        <RowsPlaceholder />
      ) : settings.isError ? (
        <Notice title="Не удалось загрузить настройки" text="Нет связи с сервисом бота." action={{ label: 'Повторить', onClick: () => void settings.refetch() }} />
      ) : (
        <Body s={settings.data} />
      )}
    </main>
  );
}

function Body({ s }: { s: Settings }) {
  const change = useSettingsChange();
  const [draft, setDraft] = useState<Prefs>(s.prefs);
  const [invite, setInvite] = useState<{ link: string } | 'failed' | null>(null);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Settings['team'][number] | null>(null);
  const [copied, setCopied] = useState(false);

  // сервис ответил новыми настройками — черновик встаёт на них
  useEffect(() => setDraft(s.prefs), [s.prefs]);

  const dirty = !same(draft, s.prefs);
  const set = (patch: Partial<Prefs>) => setDraft((d) => ({ ...d, ...patch }));
  const fields = change.error instanceof ApiError ? (change.error.body?.fields ?? {}) : {};
  const errorOf = (key: keyof Prefs) => (fields[key] ? (FIELD_ERROR[key] ?? 'Значение не подходит.') : undefined);
  const ro = !s.canEdit;

  const askInvite = async () => {
    setInviting(true);
    try {
      setInvite(await createInvite());
      haptic.done();
    } catch {
      setInvite('failed');
      haptic.fail();
    } finally {
      setInviting(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      haptic.tap();
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // буфер недоступен — ссылка на экране, её можно выделить
    }
  };

  return (
    <>
      {ro && <p className="hint hint--box">Настройки и состав команды меняют владельцы. Вам они видны, но не редактируются.</p>}

      <section aria-label="Команда">
        <h2 className="group">
          Команда
          <span className="group__count">{s.team.length}</span>
        </h2>
        <div className="section">
          {s.team.map((m) => (
            <div className="row row--split" key={m.id}>
              <span className="row__main">
                <span className="row__title">{m.name}</span>
                <span className="row__meta row__meta--plain">
                  {m.role === 'owner' ? 'владелец' : 'в команде'}
                  {m.username ? ` · @${m.username}` : ''}
                  {m.me ? ' · это вы' : ''}
                </span>
              </span>
              {s.canEdit && m.role === 'member' && !m.me && (
                <button type="button" className="btn btn--tinted btn--small" onClick={() => setRemoving(m)}>
                  Убрать
                </button>
              )}
            </div>
          ))}
          {s.canInvite && (
            <button type="button" className="row row--action" disabled={inviting} onClick={askInvite}>
              <span className="row__icon">
                <Icon name="plus" />
              </span>
              <span className="row__main">Пригласить по ссылке</span>
            </button>
          )}
        </div>
        <p className="hint">
          {s.group ? `Рабочая группа — «${s.group.title ?? 'без названия'}»${s.group.topic ? ', заявки идут в выбранную тему' : ''}. ` : 'Рабочая группа не привязана. '}
          Сменить: команда /bind в нужной теме группы.
        </p>
      </section>

      <section aria-label="Рабочее время">
        <h2 className="group">Рабочее время</h2>
        <div className="section section--pad form__fields">
          <fieldset className="days" disabled={ro}>
            <legend className="field__label">Рабочие дни</legend>
            <div className="days__list">
              {WEEK.map((d) => {
                const on = draft.workDays.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={d.full}
                    className="day"
                    onClick={() => {
                      haptic.tap();
                      set({ workDays: on ? draft.workDays.filter((x) => x !== d.id) : [...draft.workDays, d.id] });
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {errorOf('workDays') && (
              <p className="field__error" role="alert">
                {errorOf('workDays')}
              </p>
            )}
          </fieldset>
          <div className="pair">
            <Field id="work-start" label="Начало дня" error={errorOf('workStart')}>
              <input id="work-start" type="time" disabled={ro} value={clock(draft.workStart)} onChange={(e) => set({ workStart: minutesOf(e.target.value) ?? draft.workStart })} />
            </Field>
            <Field id="work-end" label="Конец дня" error={errorOf('workEnd')}>
              <input id="work-end" type="time" disabled={ro} value={clock(draft.workEnd === 1440 ? 1439 : draft.workEnd)} onChange={(e) => set({ workEnd: minutesOf(e.target.value) ?? draft.workEnd })} />
            </Field>
          </div>
          <p className="field__hint">Время московское. Ночью и в выходные бот не напоминает и не тревожит.</p>
        </div>
      </section>

      <section aria-label="Сроки">
        <h2 className="group">Сроки</h2>
        <div className="section section--pad form__fields">
          <Field id="take" label="«Никто не взял»" hint="Через сколько рабочего времени без «Беру» бот зовёт всех в группе.">
            <select id="take" disabled={ro} value={draft.takeMin} onChange={(e) => set({ takeMin: Number(e.target.value) })}>
              {[...new Set([...TAKE, draft.takeMin])].sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>
                  через {span(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="alarm"
            label="Вечерняя проверка"
            error={errorOf('alarmBeforeEndMin')}
            hint={`Сейчас — в ${clock(Math.max(0, draft.workEnd - draft.alarmBeforeEndMin))}: кому из клиентов так и не ответили.`}
          >
            <select id="alarm" disabled={ro} value={draft.alarmBeforeEndMin} onChange={(e) => set({ alarmBeforeEndMin: Number(e.target.value) })}>
              {[...new Set([...ALARM, draft.alarmBeforeEndMin])].sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>
                  за {span(m)} до конца дня
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section aria-label="Сводки">
        <h2 className="group">Сводки</h2>
        <div className="section">
          <label className="check">
            <span>
              Утренняя сводка
              <span className="check__note">Кто ждёт ответа, что стоит без движения, чьи сроки сегодня.</span>
            </span>
            <input type="checkbox" disabled={ro} checked={draft.morningDigest} onChange={(e) => set({ morningDigest: e.target.checked })} />
          </label>
          <label className="check">
            <span>
              Итоги недели
              <span className="check__note">В первый рабочий день: заявки, воронка, первый ответ.</span>
            </span>
            <input type="checkbox" disabled={ro} checked={draft.weeklyDigest} onChange={(e) => set({ weeklyDigest: e.target.checked })} />
          </label>
        </div>
      </section>

      {change.isError && !Object.keys(fields).length && (
        <p className="alert" role="alert">
          Не сохранилось — нет связи с сервисом. Попробуйте ещё раз.
        </p>
      )}

      {s.canEdit && dirty && (
        <div className="savebar">
          <button type="button" className="btn btn--tinted" disabled={change.isPending} onClick={() => setDraft(s.prefs)}>
            Отменить
          </button>
          <button type="button" className="btn btn--primary" disabled={change.isPending} onClick={() => change.mutate({ prefs: draft })}>
            Сохранить
          </button>
        </div>
      )}

      {invite && (
        <Sheet title="Приглашение" onClose={() => setInvite(null)}>
          {invite === 'failed' ? (
            <div className="sheet__form">
              <p className="sheet__text">Ссылку создать не удалось: бот сейчас не на связи с Telegram. Попробуйте позже или отправьте боту /invite.</p>
            </div>
          ) : (
            <div className="sheet__form">
              <p className="sheet__text">Ссылка для входа в команду. Действует двое суток и один раз.</p>
              <p className="sheet__text sheet__text--break mono">{invite.link}</p>
              <button type="button" className="btn btn--primary btn--wide" onClick={() => openTg(`https://t.me/share/url?url=${encodeURIComponent(invite.link)}&text=${encodeURIComponent('Вход в команду CoreThree')}`)}>
                Отправить в Telegram
              </button>
              <button type="button" className="btn btn--tinted btn--wide" onClick={() => void copy(invite.link)}>
                {copied ? 'Скопировано' : 'Скопировать ссылку'}
              </button>
            </div>
          )}
        </Sheet>
      )}

      {removing && (
        <Sheet title="Убрать из команды" onClose={() => setRemoving(null)}>
          <div className="sheet__form">
            <p className="sheet__text">
              {removing.name} перестанет видеть заявки и проекты и не сможет открыть приложение. Его заявки и задачи останутся за ним — переназначьте их, если нужно.
            </p>
            <ConfirmButton
              label="Убрать из команды"
              confirm={`Точно убрать: ${removing.name}?`}
              disabled={change.isPending}
              onConfirm={() => change.mutate({ remove: removing.id }, { onSuccess: () => setRemoving(null) })}
            />
          </div>
        </Sheet>
      )}
    </>
  );
}
