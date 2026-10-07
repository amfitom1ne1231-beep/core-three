import { useState, type FormEvent } from 'react';
import { ApiError, useLead, useLeadAction, type Action, type Detail, type Stage } from '../api';
import { Contact } from '../Contact';
import { eventText, shortTime } from '../format';
import { back, navigate } from '../router';
import { hasNativeBack } from '../tg';
import { Icon, Notice, RowsPlaceholder, Sheet, SheetOption, useMeData } from '../ui';

/**
 * Заявка целиком: контакт, этап, кто ведёт, бриф, заметки, история.
 * Действия — те же, что кнопки под карточкой в группе, и карточка
 * обновляется следом за каждым.
 */

export function LeadScreen({ id }: { id: number }) {
  const lead = useLead(id);
  const act = useLeadAction(id);

  return (
    <main className="screen">
      {!hasNativeBack() && (
        <button type="button" className="backlink" onClick={back}>
          <Icon name="back" size={18} />
          Заявки
        </button>
      )}
      {lead.isPending ? (
        <RowsPlaceholder rows={3} />
      ) : lead.isError ? (
        lead.error instanceof ApiError && lead.error.status === 404 ? (
          <Notice title={`Заявки #${id} нет`} action={{ label: 'К списку', onClick: back }} />
        ) : (
          <Notice title="Не удалось загрузить заявку" text="Нет связи с сервисом бота." action={{ label: 'Повторить', onClick: () => void lead.refetch() }} />
        )
      ) : (
        <Body detail={lead.data} busy={act.isPending} failed={act.isError} run={(a, done) => act.mutate(a, { onSuccess: done })} />
      )}
    </main>
  );
}

function Body({ detail, busy, failed, run }: { detail: Detail; busy: boolean; failed: boolean; run: (a: Action, done?: () => void) => void }) {
  const { me, dict, tz } = useMeData();
  const { lead, owner, events } = detail;
  const [sheet, setSheet] = useState<'stages' | 'lost' | null>(null);
  const [wide, setWide] = useState(false);

  const closed = dict.closed.includes(lead.stage);
  const label = (id: Stage) => dict.stages.find((s) => s.id === id)?.label ?? id;
  const kind = dict.kinds.find((k) => k.id === lead.kind)?.label ?? lead.kind;
  const step = dict.funnel.indexOf(lead.stage);
  const next = step >= 0 && step < dict.funnel.length - 1 ? dict.funnel[step + 1] : undefined;
  const reason = lead.lostReason ? dict.lostReasons.find((r) => r.id === lead.lostReason)?.label : null;
  const long = lead.task.length > 420 || lead.task.split('\n').length > 9;

  return (
    <>
      <header className="lead-head">
        <p className="lead-head__meta">
          #{lead.id} · {kind} · {dict.sources[lead.source]} · {shortTime(lead.createdAt, tz)}
        </p>
        <h1 className="lead-head__name">{lead.name}</h1>
      </header>

      {failed && (
        <p className="alert" role="alert">
          Действие не записалось — нет связи с сервисом. Попробуйте ещё раз.
        </p>
      )}

      {lead.spam && <p className="alert alert--soft">Сработала ловушка для ботов. Проверьте: она ошибается на тех, кто вставил текст из буфера.</p>}

      <div className="section">
        <Contact value={lead.contact} />
        {detail.project && (
          <button type="button" className="row" onClick={() => navigate({ name: 'project', id: detail.project!.id })}>
            <span className="row__main">
              <span className="row__title">{detail.project.title}</span>
              <span className="row__meta">Проект по этой заявке</span>
            </span>
            <span className="row__side">
              <Icon name="chevron" size={16} />
            </span>
          </button>
        )}
      </div>

      <h2 className="group">Этап</h2>
      <div className="section section--pad">
        <div className="stage">
          <div className="stage__bar" role="img" aria-label={`Этап ${Math.max(step, 0) + 1} из ${dict.funnel.length}`}>
            {dict.funnel.map((s, i) => (
              <span key={s} className={`stage__seg${lead.stage === 'lost' ? ' is-lost' : i <= step ? ' is-done' : ''}`} />
            ))}
          </div>
          <p className="stage__now">
            {label(lead.stage)}
            {reason && <span className="stage__reason">: {reason.toLowerCase()}</span>}
          </p>
        </div>

        <p className="owner">
          {owner ? (owner.id === me.id ? 'Ведёте вы' : `Ведёт ${owner.name}`) : <span className="row__warn">Никто не взял</span>}
        </p>

        <div className="actions">
          {closed ? (
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => run({ do: 'reopen' })}>
              Вернуть в работу
            </button>
          ) : (
            <>
              {!owner && (
                <button type="button" className="btn btn--primary" disabled={busy} onClick={() => run({ do: 'take' })}>
                  Беру
                </button>
              )}
              {next && (
                <button type="button" className={`btn ${owner ? 'btn--primary' : 'btn--tinted'}`} disabled={busy} onClick={() => run({ do: 'stage', stage: next })}>
                  → {label(next)}
                </button>
              )}
              <button type="button" className="btn btn--tinted" disabled={busy} onClick={() => setSheet('stages')}>
                Другой этап
              </button>
              {owner && owner.id !== me.id && (
                <button type="button" className="btn btn--tinted" disabled={busy} onClick={() => run({ do: 'take' })}>
                  Забрать себе
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <h2 className="group">Бриф</h2>
      <div className="section section--pad">
        <p className={`brief${long && !wide ? ' brief--clamp' : ''}`}>{lead.task}</p>
        {long && (
          <button type="button" className="linkbtn" onClick={() => setWide((v) => !v)} aria-expanded={wide}>
            {wide ? 'Свернуть' : 'Показать целиком'}
          </button>
        )}
        {(lead.page || lead.meta) && (
          <dl className="facts">
            {lead.page && (
              <div>
                <dt>Страница</dt>
                <dd>{lead.page}</dd>
              </div>
            )}
            {Object.entries(lead.meta ?? {}).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <h2 className="group">Заметка</h2>
      <NoteForm busy={busy} onAdd={(text, done) => run({ do: 'note', text }, done)} />

      <h2 className="group">История</h2>
      <ol className="section history">
        {events.map((e) => {
          const t = eventText(e, dict);
          return (
            <li key={e.id} className="history__item">
              <time className="history__time" dateTime={e.at}>
                {shortTime(e.at, tz)}
              </time>
              <span className="history__text">
                {t.text}
                {t.note && <span className="history__note">{t.note}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {!closed && (
        <button type="button" className="btn btn--danger btn--wide" disabled={busy} onClick={() => setSheet('lost')}>
          Отказ…
        </button>
      )}

      {sheet === 'stages' && (
        <Sheet title="Этап заявки" onClose={() => setSheet(null)}>
          {dict.funnel.map((s) => (
            <SheetOption
              key={s}
              label={label(s)}
              current={s === lead.stage}
              onPick={() => {
                setSheet(null);
                run({ do: 'stage', stage: s });
              }}
            />
          ))}
        </Sheet>
      )}
      {sheet === 'lost' && (
        <Sheet title="Причина отказа" onClose={() => setSheet(null)}>
          {dict.lostReasons.map((r) => (
            <SheetOption
              key={r.id}
              label={r.label}
              onPick={() => {
                setSheet(null);
                run({ do: 'lost', reason: r.id });
              }}
            />
          ))}
        </Sheet>
      )}
    </>
  );
}

function NoteForm({ busy, onAdd }: { busy: boolean; onAdd: (text: string, done: () => void) => void }) {
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (value) onAdd(value, () => setText(''));
  };
  return (
    <form className="section section--pad note" onSubmit={submit}>
      <label className="sr" htmlFor="note">
        Текст заметки
      </label>
      <textarea id="note" rows={2} maxLength={2000} placeholder="О чём договорились, что важно помнить" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="btn btn--tinted" disabled={busy || !text.trim()}>
        Добавить заметку
      </button>
    </form>
  );
}
