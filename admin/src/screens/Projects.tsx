import { useState } from 'react';
import { useMyTasks, useProjectChange, useProjects, type Day, type MyTask, type ProjectRow } from '../api';
import { dueLabel, isOverdue, plural, PROJECT_STATUS } from '../format';
import { navigate } from '../router';
import { haptic } from '../tg';
import { Brand, Check, Icon, Notice, RowsPlaceholder } from '../ui';

/**
 * Проекты. Сверху — мои задачи: то, что ждёт именно этого человека,
 * с отметкой «сделано» прямо в списке. Ниже — проекты: первыми те,
 * где что-то просрочено, потом по ближайшему сроку.
 */

type Tab = 'active' | 'archive';

// экран пересоздаётся при возврате с проекта — вкладку помним снаружи
const kept = { tab: 'active' as Tab };

export function Projects() {
  const [tab, setTab] = useState<Tab>(kept.tab);
  kept.tab = tab;
  const active = useProjects('active');
  const archive = useProjects('archive');
  const mine = useMyTasks();
  const change = useProjectChange();

  const source = tab === 'active' ? active : archive;
  const rows = source.data?.projects ?? [];
  const today = source.data?.today ?? '';
  const tasks = mine.data?.tasks ?? [];

  return (
    <main className="screen screen--tabbed">
      <Brand />
      <header className="top">
        <h1 className="top__title">Проекты</h1>
        <button type="button" className="btn btn--tinted btn--small" onClick={() => navigate({ name: 'project-new' })}>
          <Icon name="plus" size={18} />
          Новый
        </button>
      </header>

      <div className="tabs tabs--first" role="tablist" aria-label="Какие проекты показать">
        {(['active', 'archive'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="tab"
            onClick={() => {
              haptic.tap();
              setTab(id);
            }}
          >
            {id === 'active' ? 'В работе' : 'Архив'}
            {id === 'active' && active.data && <span className="tab__count">{active.data.projects.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'active' && tasks.length > 0 && (
        <section aria-label="Мои задачи">
          <h2 className="group">
            Мои задачи
            <span className="group__count">{tasks.length}</span>
          </h2>
          <div className="section">
            {tasks.map((t) => (
              <MyTaskRow key={t.id} task={t} today={mine.data!.today} busy={change.isPending} onDone={() => change.mutate({ path: `/tasks/${t.id}`, body: { done: true } })} />
            ))}
          </div>
        </section>
      )}

      {source.isPending ? (
        <RowsPlaceholder rows={3} />
      ) : source.isError ? (
        <Notice title="Не удалось загрузить проекты" text="Нет связи с сервисом бота." action={{ label: 'Повторить', onClick: () => void source.refetch() }} />
      ) : rows.length === 0 ? (
        <Notice
          {...(tab === 'active'
            ? { title: 'Проектов в работе нет', text: 'Проект появляется сам, когда заявка доходит до «Договора». Или заведите его кнопкой «Новый».' }
            : { title: 'Архив пуст', text: 'Сюда уходят завершённые и отменённые проекты.' })}
        />
      ) : (
        <section aria-label={tab === 'active' ? 'Проекты в работе' : 'Архив'}>
          {tab === 'active' && tasks.length > 0 && <h2 className="group">Все проекты</h2>}
          <div className={`section${tab === 'active' && tasks.length > 0 ? '' : ' section--list'}`}>
            {rows.map((p) => (
              <ProjectItem key={p.id} project={p} today={today} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function MyTaskRow({ task, today, busy, onDone }: { task: MyTask; today: Day; busy: boolean; onDone: () => void }) {
  const late = isOverdue(task.dueOn, today);
  return (
    <div className="row row--task">
      <Check done={false} label={`Выполнить: ${task.title}`} disabled={busy} onToggle={onDone} />
      <button type="button" className="row__open" onClick={() => navigate({ name: 'project', id: task.projectId })}>
        <span className="row__title row__title--wrap">{task.title}</span>
        <span className="row__meta">
          {task.project}
          {task.dueOn && (
            <>
              {' · '}
              <span className={late ? 'row__warn' : undefined}>{late ? `срок был ${dueLabel(task.dueOn, today)}` : dueLabel(task.dueOn, today)}</span>
            </>
          )}
        </span>
      </button>
    </div>
  );
}

function ProjectItem({ project: p, today }: { project: ProjectRow; today: Day }) {
  const archived = p.status === 'done' || p.status === 'cancelled';
  return (
    <button type="button" className="row" onClick={() => navigate({ name: 'project', id: p.id })}>
      <span className="row__main">
        <span className="row__title">{p.title}</span>
        <span className="row__meta">
          {archived || p.status === 'paused' ? (
            <span className="row__stage">{PROJECT_STATUS[p.status]}</span>
          ) : p.stage ? (
            <>
              <span className="row__stage">{p.stage}</span> · этап {p.stagesDone + 1} из {p.stagesTotal}
            </>
          ) : (
            'все этапы пройдены'
          )}
          {p.ownerName && ` · ведёт ${p.ownerName}`}
        </span>
        {!archived && (
          <>
            <span className="progress" aria-hidden="true">
              {Array.from({ length: p.stagesTotal }, (_, i) => (
                <span key={i} className={`progress__seg${i < p.stagesDone ? ' is-done' : ''}`} />
              ))}
            </span>
            <span className="row__meta">
              {p.openTasks > 0 ? `${p.openTasks} ${plural(p.openTasks, 'задача', 'задачи', 'задач')}` : 'задач нет'}
              {p.overdue > 0 && (
                <>
                  {' · '}
                  <span className="row__warn">просрочено: {p.overdue}</span>
                </>
              )}
            </span>
          </>
        )}
      </span>
      <span className="row__side">
        {!archived && p.nextDue && <span className={`row__when${isOverdue(p.nextDue, today) ? ' row__warn' : ''}`}>{dueLabel(p.nextDue, today)}</span>}
        <Icon name="chevron" size={16} />
      </span>
    </button>
  );
}
