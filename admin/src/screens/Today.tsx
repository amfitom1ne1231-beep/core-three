import { useLeadAction, useProjectChange, useToday, type LeadRow, type Today } from '../api';
import { age, dayTitle, dueLabel, isOverdue } from '../format';
import { navigate } from '../router';
import { Brand, Check, Icon, Notice, RowsPlaceholder, useMeData } from '../ui';

/**
 * «Сегодня» — с этого экрана приложение открывается: что ждёт именно
 * этого человека. Та же выборка, что у пульта в боте, поэтому числа
 * там и здесь всегда сходятся.
 *
 * Порядок — по срочности: клиенты без ответа, потом свои заявки, свои
 * сроки, чужие сроки и то, что стоит без движения. Пустых разделов нет:
 * если ничего не ждёт, экран так и говорит.
 */
export function TodayScreen() {
  const { me } = useMeData();
  const today = useToday();
  const change = useProjectChange();
  const d = today.data;

  return (
    <main className="screen screen--tabbed">
      <Brand>{d ? dayTitle(d.day) : ''}</Brand>
      <header className="top">
        <h1 className="top__title">Сегодня</h1>
      </header>

      {today.isPending ? (
        <RowsPlaceholder />
      ) : today.isError || !d ? (
        <Notice title="Не удалось загрузить" text="Нет связи с сервисом бота." action={{ label: 'Повторить', onClick: () => void today.refetch() }} />
      ) : (
        <Body d={d} me={me.id} busy={change.isPending} done={(id) => change.mutate({ path: `/tasks/${id}`, body: { done: true } })} />
      )}

      <section aria-label="Ещё">
        <h2 className="group group--plain">Ещё</h2>
        <div className="section">
          <button type="button" className="row row--action" onClick={() => navigate({ name: 'help' })}>
            <span className="row__icon">
              <Icon name="book" />
            </span>
            <span className="row__main">Справка</span>
            <Icon name="chevron" size={16} />
          </button>
          <button type="button" className="row row--action" onClick={() => navigate({ name: 'settings' })}>
            <span className="row__icon">
              <Icon name="gear" />
            </span>
            <span className="row__main">Команда и настройки</span>
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </section>
    </main>
  );
}

function Body({ d, me, busy, done }: { d: Today; me: number; busy: boolean; done: (taskId: number) => void }) {
  const myTasks = d.due.tasks.filter((t) => t.assigneeId === me);
  const myStages = d.due.stages.filter((s) => s.owner?.id === me);
  const teamTasks = d.due.tasks.filter((t) => t.assigneeId !== me);
  const teamStages = d.due.stages.filter((s) => s.owner?.id !== me);
  const dueMine = myTasks.length + myStages.length;
  const dueTeam = teamTasks.length + teamStages.length;

  if (!d.waiting.length && !d.mine.length && !dueMine && !dueTeam && !d.stale.length) {
    return <Notice title="Сейчас ничего не ждёт" text="Новых заявок нет, сроков на сегодня нет. Новая заявка появится здесь и карточкой в группе." />;
  }

  const due = (day: string | null) => (day ? <span className={isOverdue(day, d.day) ? 'row__warn' : undefined}>{isOverdue(day, d.day) ? `срок был ${dueLabel(day, d.day)}` : dueLabel(day, d.day)}</span> : null);

  return (
    <>
      {d.waiting.length > 0 && (
        <section aria-label="Ждут ответа">
          <h2 className="group">
            Ждут ответа
            <span className="group__count">{d.waiting.length}</span>
          </h2>
          <div className="section">
            {d.waiting.map((l) => (
              <WaitingRow key={l.id} lead={l} />
            ))}
          </div>
        </section>
      )}

      {d.mine.length > 0 && (
        <section aria-label="Мои заявки">
          <h2 className="group">
            Мои заявки
            <span className="group__count">{d.mine.length}</span>
          </h2>
          <div className="section">
            {d.mine.map((l) => (
              <LeadLine key={l.id} lead={l} />
            ))}
          </div>
        </section>
      )}

      {dueMine > 0 && (
        <section aria-label="Мои сроки">
          <h2 className="group">
            Мои сроки
            <span className="group__count">{dueMine}</span>
          </h2>
          <div className="section">
            {myTasks.map((t) => (
              <div className="row row--task" key={`t${t.id}`}>
                <Check done={false} label={`Выполнить: ${t.title}`} disabled={busy} onToggle={() => done(t.id)} />
                <button type="button" className="row__open" onClick={() => navigate({ name: 'project', id: t.projectId })}>
                  <span className="row__title row__title--wrap">{t.title}</span>
                  <span className="row__meta">
                    {t.project} · {due(t.dueOn)}
                  </span>
                </button>
              </div>
            ))}
            {myStages.map((s) => (
              <button type="button" className="row" key={`s${s.id}`} onClick={() => navigate({ name: 'project', id: s.projectId })}>
                <span className="row__main">
                  <span className="row__title row__title--wrap">Этап «{s.title}»</span>
                  <span className="row__meta">
                    {s.project} · {due(s.dueOn)}
                  </span>
                </span>
                <span className="row__side">
                  <Icon name="chevron" size={16} />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {dueTeam > 0 && (
        <section aria-label="Сроки команды">
          <h2 className="group">
            Сроки команды
            <span className="group__count">{dueTeam}</span>
          </h2>
          <div className="section">
            {teamTasks.map((t) => (
              <button type="button" className="row" key={`t${t.id}`} onClick={() => navigate({ name: 'project', id: t.projectId })}>
                <span className="row__main">
                  <span className="row__title row__title--wrap">{t.title}</span>
                  <span className="row__meta">
                    {t.assignee ? t.assignee.name : 'без исполнителя'} · {t.project} · {due(t.dueOn)}
                  </span>
                </span>
                <span className="row__side">
                  <Icon name="chevron" size={16} />
                </span>
              </button>
            ))}
            {teamStages.map((s) => (
              <button type="button" className="row" key={`s${s.id}`} onClick={() => navigate({ name: 'project', id: s.projectId })}>
                <span className="row__main">
                  <span className="row__title row__title--wrap">Этап «{s.title}»</span>
                  <span className="row__meta">
                    {s.owner ? `ведёт ${s.owner.name}` : 'никто не ведёт'} · {s.project} · {due(s.dueOn)}
                  </span>
                </span>
                <span className="row__side">
                  <Icon name="chevron" size={16} />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {d.stale.length > 0 && (
        <section aria-label="Без движения">
          <h2 className="group">
            Без движения
            <span className="group__count">{d.stale.length}</span>
          </h2>
          <div className="section">
            {d.stale.map((l) => (
              <LeadLine key={l.id} lead={l} note={`${l.idleDays} раб. дн. без движения`} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Заявка без ответа. Ничью можно взять прямо отсюда — это самое частое действие с экрана. */
function WaitingRow({ lead }: { lead: LeadRow }) {
  const { dict } = useMeData();
  const act = useLeadAction(lead.id);
  const kind = dict.kinds.find((k) => k.id === lead.kind)?.label ?? lead.kind;
  return (
    <div className="row row--split">
      <button type="button" className="row__open" onClick={() => navigate({ name: 'lead', id: lead.id })}>
        <span className="row__title">{lead.name}</span>
        <span className="row__meta">
          {kind} · {dict.sources[lead.source]} · {lead.ownerName ? `ведёт ${lead.ownerName}` : <span className="row__warn">никто не взял</span>} · {age(lead.createdAt)}
        </span>
      </button>
      {lead.ownerId === null ? (
        <button type="button" className="btn btn--primary btn--small" disabled={act.isPending} onClick={() => act.mutate({ do: 'take' })}>
          Беру
        </button>
      ) : (
        <span className="row__side">
          <Icon name="chevron" size={16} />
        </span>
      )}
    </div>
  );
}

function LeadLine({ lead, note }: { lead: LeadRow; note?: string }) {
  const { dict } = useMeData();
  const stage = dict.stages.find((s) => s.id === lead.stage)?.label ?? lead.stage;
  const kind = dict.kinds.find((k) => k.id === lead.kind)?.label ?? lead.kind;
  return (
    <button type="button" className="row" onClick={() => navigate({ name: 'lead', id: lead.id })}>
      <span className="row__main">
        <span className="row__title">{lead.name}</span>
        <span className="row__meta">
          <span className="row__stage">{stage}</span> · {kind}
          {lead.ownerName ? ` · ведёт ${lead.ownerName}` : ''}
          {note ? (
            <>
              {' · '}
              <span className="row__warn">{note}</span>
            </>
          ) : null}
        </span>
      </span>
      <span className="row__side">
        <span className="row__when">{age(lead.createdAt)}</span>
        <Icon name="chevron" size={16} />
      </span>
    </button>
  );
}
