import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  ApiError,
  revealSecret,
  sendMaterial,
  useProject,
  useProjectChange,
  type Day,
  type Material,
  type ProjectStage,
  type ProjectStatus,
  type ProjectView,
  type SecretRef,
  type Task
} from '../api';
import { Contact } from '../Contact';
import { dueLabel, fileSize, isOverdue, plural, PROJECT_STATUS, projectEventText, shortTime, todayIn } from '../format';
import { back, navigate } from '../router';
import { hasNativeBack, haptic } from '../tg';
import { Check, ConfirmButton, Field, Icon, Notice, RowsPlaceholder, Sheet, useMeData } from '../ui';

/**
 * Проект: этапы по шаблону направления, задачи со сроками и исполнителями,
 * материалы (ссылки и файлы, лежащие в Telegram) и доступы под шифром.
 * Правки — в шторках снизу; после каждой сервис отдаёт проект целиком.
 */

type Open =
  | { kind: 'edit' }
  | { kind: 'stage'; stage: ProjectStage | null }
  | { kind: 'task'; task: Task | null }
  | { kind: 'link' }
  | { kind: 'material'; material: Material }
  | { kind: 'secret'; secret: SecretRef | null }
  | null;

/** Действие над проектом: адрес, данные и что сделать после успеха. */
type Run = (path: string, body?: unknown, done?: () => void) => void;

export function ProjectScreen({ id }: { id: number }) {
  const project = useProject(id);
  const change = useProjectChange();
  const [open, setOpenRaw] = useState<Open>(null);
  const setOpen = (o: Open) => {
    change.reset();
    setOpenRaw(o);
  };
  const run: Run = (path, body, done) =>
    change.mutate(
      { path, body },
      {
        onSuccess: () => {
          setOpenRaw(null);
          done?.();
        }
      }
    );

  return (
    <main className="screen">
      {!hasNativeBack() && (
        <button type="button" className="backlink" onClick={back}>
          <Icon name="back" size={18} />
          Проекты
        </button>
      )}
      {project.isPending ? (
        <RowsPlaceholder rows={3} />
      ) : project.isError ? (
        project.error instanceof ApiError && project.error.status === 404 ? (
          <Notice title={`Проекта #${id} нет`} action={{ label: 'К списку', onClick: back }} />
        ) : (
          <Notice title="Не удалось загрузить проект" text="Нет связи с сервисом бота." action={{ label: 'Повторить', onClick: () => void project.refetch() }} />
        )
      ) : (
        <Body view={project.data} busy={change.isPending} failed={change.isError} open={open} setOpen={setOpen} run={run} />
      )}
    </main>
  );
}

function Body({ view, busy, failed, open, setOpen, run }: { view: ProjectView; busy: boolean; failed: boolean; open: Open; setOpen: (o: Open) => void; run: Run }) {
  const { dict, team, tz, features } = useMeData();
  const { project, stages, tasks, materials, secrets, events } = view;
  const today = todayIn(tz);
  const [showDone, setShowDone] = useState(false);
  const [allHistory, setAllHistory] = useState(false);

  const kind = dict.kinds.find((k) => k.id === project.kind)?.label ?? project.kind;
  const current = stages.find((s) => !s.doneAt);
  const openTasks = tasks.filter((t) => !t.doneAt);
  const doneTasks = tasks.filter((t) => t.doneAt);
  const name = (memberId: number | null) => team.find((m) => m.id === memberId)?.name ?? null;
  const stageTitle = (stageId: number | null) => stages.find((s) => s.id === stageId)?.title ?? null;
  const shown = allHistory ? events : events.slice(0, 6);

  return (
    <>
      <header className="lead-head">
        <p className="lead-head__meta">
          {kind} · {PROJECT_STATUS[project.status]}
          {view.ownerName && ` · ведёт ${view.ownerName}`}
        </p>
        <h1 className="lead-head__name">{project.title}</h1>
      </header>

      {failed && !open && (
        <p className="alert" role="alert">
          Изменение не записалось — нет связи с сервисом. Попробуйте ещё раз.
        </p>
      )}

      <div className="section">
        {project.contact && <Contact value={project.contact} />}
        {project.leadId && (
          <button type="button" className="row" onClick={() => navigate({ name: 'lead', id: project.leadId! })}>
            <span className="row__main">
              <span className="row__title">Заявка #{project.leadId}</span>
              <span className="row__meta">С неё начался проект: бриф и переписка</span>
            </span>
            <span className="row__side">
              <Icon name="chevron" size={16} />
            </span>
          </button>
        )}
        <button type="button" className="row row--action" onClick={() => setOpen({ kind: 'edit' })}>
          Название, клиент, состояние…
        </button>
      </div>

      {/* ---------- этапы ---------- */}
      <h2 className="group">
        Этапы
        <span className="group__count">
          {stages.filter((s) => s.doneAt).length} из {stages.length}
        </span>
      </h2>
      <div className="section">
        {stages.map((s) => {
          const late = !s.doneAt && isOverdue(s.dueOn, today);
          return (
            <div key={s.id} className={`row row--task${s.doneAt ? ' is-done' : ''}`}>
              <Check done={!!s.doneAt} label={`Этап «${s.title}» ${s.doneAt ? 'выполнен' : 'не выполнен'}`} disabled={busy} onToggle={() => run(`/stages/${s.id}`, { done: !s.doneAt })} />
              <button type="button" className="row__open row__open--line" onClick={() => setOpen({ kind: 'stage', stage: s })}>
                <span className={`row__title${s.id === current?.id ? '' : ' row__title--plain'}`}>
                  {s.title}
                  {s.id === current?.id && <span className="row__now"> · сейчас</span>}
                </span>
                <span className={`row__when${late ? ' row__warn' : ''}`}>{s.dueOn ? dueLabel(s.dueOn, today) : 'без срока'}</span>
              </button>
            </div>
          );
        })}
        <button type="button" className="row row--action" onClick={() => setOpen({ kind: 'stage', stage: null })}>
          <Icon name="plus" size={18} />
          Этап
        </button>
      </div>

      {/* ---------- задачи ---------- */}
      <h2 className="group">
        Задачи
        {openTasks.length > 0 && <span className="group__count">{openTasks.length}</span>}
      </h2>
      <div className="section">
        {openTasks.map((t) => (
          <TaskRow key={t.id} task={t} today={today} who={name(t.assigneeId)} stage={stageTitle(t.stageId)} busy={busy} onToggle={() => run(`/tasks/${t.id}`, { done: true })} onOpen={() => setOpen({ kind: 'task', task: t })} />
        ))}
        {showDone &&
          doneTasks.map((t) => (
            <TaskRow key={t.id} task={t} today={today} who={name(t.assigneeId)} stage={stageTitle(t.stageId)} busy={busy} onToggle={() => run(`/tasks/${t.id}`, { done: false })} onOpen={() => setOpen({ kind: 'task', task: t })} />
          ))}
        <button type="button" className="row row--action" onClick={() => setOpen({ kind: 'task', task: null })}>
          <Icon name="plus" size={18} />
          Задача
        </button>
      </div>
      {doneTasks.length > 0 && (
        <button type="button" className="linkbtn linkbtn--under" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
          {showDone ? 'Скрыть выполненные' : `Выполненные: ${doneTasks.length}`}
        </button>
      )}

      {/* ---------- материалы ---------- */}
      <h2 className="group">Материалы</h2>
      <div className="section">
        {materials.map((m) => (
          <button key={m.id} type="button" className="row" onClick={() => setOpen({ kind: 'material', material: m })}>
            <span className="row__icon">
              <Icon name={m.kind === 'link' ? 'link' : 'file'} />
            </span>
            <span className="row__main">
              <span className="row__title row__title--plain">{m.title}</span>
              <span className="row__meta">{m.kind === 'link' ? hostOf(m.url) : ['файл в Telegram', fileSize(m.fileSize)].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="row__side">
              <Icon name="chevron" size={16} />
            </span>
          </button>
        ))}
        <button type="button" className="row row--action" onClick={() => setOpen({ kind: 'link' })}>
          <Icon name="plus" size={18} />
          Ссылка
        </button>
      </div>
      <p className="hint">Файл — перешлите боту в личку: он спросит, к какому проекту прикрепить.</p>

      {/* ---------- доступы ---------- */}
      <h2 className="group">Доступы</h2>
      {features.secrets ? (
        <>
          <div className="section">
            {secrets.map((s) => (
              <button key={s.id} type="button" className="row" onClick={() => setOpen({ kind: 'secret', secret: s })}>
                <span className="row__icon">
                  <Icon name="lock" />
                </span>
                <span className="row__main">
                  <span className="row__title row__title--plain">{s.title}</span>
                  <span className="row__meta">изменён {shortTime(s.updatedAt, tz)}</span>
                </span>
                <span className="row__side">
                  <Icon name="chevron" size={16} />
                </span>
              </button>
            ))}
            <button type="button" className="row row--action" onClick={() => setOpen({ kind: 'secret', secret: null })}>
              <Icon name="plus" size={18} />
              Доступ
            </button>
          </div>
          <p className="hint">Хранятся зашифрованными. Кто и когда смотрел — видно в истории.</p>
        </>
      ) : (
        <p className="hint hint--box">Раздел выключен: у сервиса не задан ключ шифрования (SECRETS_KEY).</p>
      )}

      {/* ---------- история ---------- */}
      <h2 className="group">История</h2>
      <ol className="section history">
        {shown.map((e) => (
          <li key={e.id} className="history__item">
            <time className="history__time" dateTime={e.at}>
              {shortTime(e.at, tz)}
            </time>
            <span className="history__text">{projectEventText(e)}</span>
          </li>
        ))}
      </ol>
      {events.length > 6 && (
        <button type="button" className="linkbtn linkbtn--under" onClick={() => setAllHistory((v) => !v)} aria-expanded={allHistory}>
          {allHistory ? 'Свернуть' : `Вся история: ${events.length} ${plural(events.length, 'запись', 'записи', 'записей')}`}
        </button>
      )}

      {/* ---------- шторки ---------- */}
      {open?.kind === 'edit' && <EditSheet view={view} busy={busy} failed={failed} run={run} onClose={() => setOpen(null)} />}
      {open?.kind === 'stage' && <StageSheet projectId={project.id} stage={open.stage} busy={busy} failed={failed} run={run} onClose={() => setOpen(null)} />}
      {open?.kind === 'task' && <TaskSheet projectId={project.id} task={open.task} stages={stages} current={current?.id ?? null} busy={busy} failed={failed} run={run} onClose={() => setOpen(null)} />}
      {open?.kind === 'link' && <LinkSheet projectId={project.id} busy={busy} failed={failed} run={run} onClose={() => setOpen(null)} />}
      {open?.kind === 'material' && <MaterialSheet material={open.material} busy={busy} run={run} onClose={() => setOpen(null)} />}
      {open?.kind === 'secret' && <SecretSheet projectId={project.id} secret={open.secret} busy={busy} failed={failed} run={run} onClose={() => setOpen(null)} />}
    </>
  );
}

function hostOf(url: string | null) {
  try {
    return new URL(url ?? '').hostname.replace(/^www\./, '');
  } catch {
    return url ?? '';
  }
}

function TaskRow({ task, today, who, stage, busy, onToggle, onOpen }: { task: Task; today: Day; who: string | null; stage: string | null; busy: boolean; onToggle: () => void; onOpen: () => void }) {
  const done = !!task.doneAt;
  const late = !done && isOverdue(task.dueOn, today);
  return (
    <div className={`row row--task${done ? ' is-done' : ''}`}>
      <Check done={done} label={done ? `Вернуть в работу: ${task.title}` : `Выполнить: ${task.title}`} disabled={busy} onToggle={onToggle} />
      <button type="button" className="row__open" onClick={onOpen}>
        <span className="row__title row__title--plain row__title--wrap">{task.title}</span>
        <span className="row__meta">
          {[who ?? 'без исполнителя', stage].filter(Boolean).join(' · ')}
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

/* ---------- шторки с формами ---------- */

/** `after` — то, что стоит под главной кнопкой: удаление. */
function FormSheet({ title, busy, failed, submit, onSubmit, onClose, after, children }: { title: string; busy: boolean; failed?: boolean; submit: string; onSubmit: () => void; onClose: () => void; after?: ReactNode; children: ReactNode }) {
  const send = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <Sheet title={title} onClose={onClose}>
      <form className="sheet__form" onSubmit={send} noValidate>
        {children}
        {failed && (
          <p className="field__error" role="alert">
            Не сохранилось — нет связи с сервисом. Попробуйте ещё раз.
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--wide" disabled={busy}>
          {busy ? 'Сохраняю…' : submit}
        </button>
        {after}
      </form>
    </Sheet>
  );
}

/** Срок: родной выбор даты. Пустое поле — срока нет. */
function DueField({ value, onChange }: { value: Day | null; onChange: (v: Day | null) => void }) {
  return (
    <Field id="due" label="Срок" hint="Пусто — без срока">
      <input id="due" type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-describedby="due-hint" />
    </Field>
  );
}

function EditSheet({ view, busy, failed, run, onClose }: { failed: boolean; view: ProjectView; busy: boolean; run: Run; onClose: () => void }) {
  const { team } = useMeData();
  const p = view.project;
  const [form, setForm] = useState({ title: p.title, client: p.client, contact: p.contact ?? '', ownerId: p.ownerId, status: p.status });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <FormSheet title="Проект" busy={busy} failed={failed} submit="Сохранить" onClose={onClose} onSubmit={() => run(`/projects/${p.id}`, { ...form, title: form.title.trim() || p.title, client: form.client.trim() || p.client, contact: form.contact.trim() || null })}>
      <Field id="p-title" label="Название">
        <input id="p-title" type="text" maxLength={160} value={form.title} onChange={(e) => set('title', e.target.value)} />
      </Field>
      <Field id="p-client" label="Клиент">
        <input id="p-client" type="text" maxLength={120} value={form.client} onChange={(e) => set('client', e.target.value)} />
      </Field>
      <Field id="p-contact" label="Контакт" hint="Телефон, Telegram или почта">
        <input id="p-contact" type="text" autoCapitalize="none" maxLength={160} value={form.contact} onChange={(e) => set('contact', e.target.value)} aria-describedby="p-contact-hint" />
      </Field>
      <Field id="p-owner" label="Ведёт">
        <select id="p-owner" value={form.ownerId ?? ''} onChange={(e) => set('ownerId', e.target.value ? Number(e.target.value) : null)}>
          <option value="">Никто</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="p-status" label="Состояние" hint="Завершённые и отменённые уходят в архив">
        <select id="p-status" value={form.status} onChange={(e) => set('status', e.target.value as ProjectStatus)} aria-describedby="p-status-hint">
          {(Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS[s]}
            </option>
          ))}
        </select>
      </Field>
    </FormSheet>
  );
}

function StageSheet({ projectId, stage, busy, failed, run, onClose }: { failed: boolean; projectId: number; stage: ProjectStage | null; busy: boolean; run: Run; onClose: () => void }) {
  const [title, setTitle] = useState(stage?.title ?? '');
  const [dueOn, setDueOn] = useState<Day | null>(stage?.dueOn ?? null);
  const save = () => {
    if (!title.trim()) return;
    run(stage ? `/stages/${stage.id}` : `/projects/${projectId}/stages`, { title: title.trim(), dueOn });
  };
  return (
    <FormSheet
      title={stage ? 'Этап' : 'Новый этап'}
      busy={busy}
      failed={failed}
      submit={stage ? 'Сохранить' : 'Добавить этап'}
      onClose={onClose}
      onSubmit={save}
      after={stage && <ConfirmButton label="Удалить этап" confirm="Точно удалить? Задачи этапа останутся в проекте" disabled={busy} onConfirm={() => run(`/stages/${stage.id}/remove`)} />}
    >
      <Field id="s-title" label="Название">
        <input id="s-title" type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} data-autofocus={stage ? undefined : ''} />
      </Field>
      <DueField value={dueOn} onChange={setDueOn} />
    </FormSheet>
  );
}

function TaskSheet({ projectId, task, stages, current, busy, failed, run, onClose }: { failed: boolean; projectId: number; task: Task | null; stages: ProjectStage[]; current: number | null; busy: boolean; run: Run; onClose: () => void }) {
  const { me, team } = useMeData();
  // новая задача по умолчанию — себе и в текущий этап: так бывает чаще всего
  const [form, setForm] = useState({ title: task?.title ?? '', assigneeId: task ? task.assigneeId : me.id, stageId: task ? task.stageId : current, dueOn: task?.dueOn ?? null });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => {
    if (!form.title.trim()) return;
    run(task ? `/tasks/${task.id}` : `/projects/${projectId}/tasks`, { ...form, title: form.title.trim() });
  };
  return (
    <FormSheet
      title={task ? 'Задача' : 'Новая задача'}
      busy={busy}
      failed={failed}
      submit={task ? 'Сохранить' : 'Добавить задачу'}
      onClose={onClose}
      onSubmit={save}
      after={task && <ConfirmButton label="Удалить задачу" confirm="Точно удалить?" disabled={busy} onConfirm={() => run(`/tasks/${task.id}/remove`)} />}
    >
      <Field id="t-title" label="Что сделать">
        <textarea id="t-title" rows={2} maxLength={300} value={form.title} onChange={(e) => set('title', e.target.value)} data-autofocus={task ? undefined : ''} />
      </Field>
      <Field id="t-who" label="Исполнитель">
        <select id="t-who" value={form.assigneeId ?? ''} onChange={(e) => set('assigneeId', e.target.value ? Number(e.target.value) : null)}>
          <option value="">Без исполнителя</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <DueField value={form.dueOn} onChange={(v) => set('dueOn', v)} />
      <Field id="t-stage" label="Этап">
        <select id="t-stage" value={form.stageId ?? ''} onChange={(e) => set('stageId', e.target.value ? Number(e.target.value) : null)}>
          <option value="">Без этапа</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </Field>
    </FormSheet>
  );
}

function LinkSheet({ projectId, busy, failed, run, onClose }: { projectId: number; busy: boolean; failed: boolean; run: Run; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [tried, setTried] = useState(false);
  const save = () => {
    setTried(true);
    // адрес без «https://» — частая вставка из адресной строки: дописываем сами
    const full = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    if (url.trim()) run(`/projects/${projectId}/links`, { url: full, title: title.trim() || undefined });
  };
  const error = tried && (!url.trim() || failed) ? 'Нужен адрес страницы: figma.com/file/… или https://…' : undefined;
  return (
    <FormSheet title="Ссылка" busy={busy} submit="Добавить ссылку" onClose={onClose} onSubmit={save}>
      <Field id="l-url" label="Адрес" error={error}>
        <input id="l-url" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" maxLength={2000} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} data-autofocus="" aria-invalid={!!error} aria-describedby={error ? 'l-url-err' : undefined} />
      </Field>
      <Field id="l-title" label="Название" hint="Пусто — подставится имя сайта">
        <input id="l-title" type="text" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} aria-describedby="l-title-hint" />
      </Field>
    </FormSheet>
  );
}

function MaterialSheet({ material: m, busy, run, onClose }: { material: Material; busy: boolean; run: Run; onClose: () => void }) {
  const { features } = useMeData();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed' | 'copied'>('idle');

  const send = async () => {
    setState('sending');
    try {
      await sendMaterial(m.id);
      haptic.done();
      setState('sent');
    } catch {
      haptic.fail();
      setState('failed');
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.url ?? '');
      haptic.tap();
      setState('copied');
    } catch {
      // буфер недоступен — ссылку можно открыть и скопировать из адресной строки
    }
  };

  return (
    <Sheet title={m.title} onClose={onClose}>
      <div className="sheet__form">
        {m.kind === 'link' ? (
          <>
            <p className="sheet__text sheet__text--break">{m.url}</p>
            <a className="btn btn--primary btn--wide" href={m.url ?? '#'} target="_blank" rel="noopener noreferrer">
              Открыть
            </a>
            <button type="button" className="btn btn--tinted btn--wide" onClick={copy}>
              {state === 'copied' ? 'Скопировано' : 'Скопировать ссылку'}
            </button>
          </>
        ) : (
          <>
            <p className="sheet__text">{[m.fileName, fileSize(m.fileSize)].filter(Boolean).join(' · ')}</p>
            {features.files ? (
              <button type="button" className="btn btn--primary btn--wide" disabled={state === 'sending' || state === 'sent'} onClick={send}>
                {state === 'sending' ? 'Отправляю…' : state === 'sent' ? 'Отправлено — в чате с ботом' : 'Прислать мне в личку'}
              </button>
            ) : (
              <p className="hint hint--box">Файл лежит в Telegram и приходит через бота, а бот в этой установке выключен.</p>
            )}
            {state === 'failed' && (
              <p className="field__error" role="alert">
                Не получилось. Откройте чат с ботом и нажмите «Запустить», потом повторите.
              </p>
            )}
          </>
        )}
        <span className="sr" role="status">
          {state === 'sent' ? 'Файл отправлен в чат с ботом' : state === 'copied' ? 'Ссылка скопирована' : ''}
        </span>
        <ConfirmButton label="Удалить из проекта" confirm="Точно удалить?" disabled={busy} onConfirm={() => run(`/materials/${m.id}/remove`)} />
      </div>
    </Sheet>
  );
}

function SecretSheet({ projectId, secret, busy, failed, run, onClose }: { failed: boolean; projectId: number; secret: SecretRef | null; busy: boolean; run: Run; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(secret?.title ?? '');
  // значение существующего доступа приходит только по нажатию «Показать»
  const [value, setValue] = useState<string | null>(secret ? null : '');
  const [state, setState] = useState<'idle' | 'loading' | 'failed' | 'copied'>('idle');
  const [changed, setChanged] = useState(false);

  const reveal = async () => {
    if (!secret) return;
    setState('loading');
    try {
      setValue((await revealSecret(secret.id)).value);
      setState('idle');
      // просмотр записан в историю проекта — она на экране под шторкой
      void qc.invalidateQueries({ queryKey: ['project', projectId] });
    } catch {
      haptic.fail();
      setState('failed');
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value ?? '');
      haptic.tap();
      setState('copied');
    } catch {
      // буфер недоступен — значение на экране, его можно выделить
    }
  };
  const save = () => {
    if (!title.trim()) return;
    if (!secret) return value?.trim() ? run(`/projects/${projectId}/secrets`, { title: title.trim(), value }) : undefined;
    run(`/secrets/${secret.id}`, { title: title.trim(), ...(changed && value ? { value } : {}) });
  };

  return (
    <FormSheet
      title={secret ? 'Доступ' : 'Новый доступ'}
      busy={busy}
      failed={failed}
      submit={secret ? 'Сохранить' : 'Добавить доступ'}
      onClose={onClose}
      onSubmit={save}
      after={secret && <ConfirmButton label="Удалить доступ" confirm="Точно удалить? Вернуть будет нельзя" disabled={busy} onConfirm={() => run(`/secrets/${secret.id}/remove`)} />}
    >
      <Field id="k-title" label="Что это" hint={secret ? undefined : 'Например: хостинг, панель домена, почта'}>
        <input id="k-title" type="text" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} data-autofocus={secret ? undefined : ''} aria-describedby={secret ? undefined : 'k-title-hint'} />
      </Field>
      {value === null ? (
        <>
          <button type="button" className="btn btn--tinted btn--wide" disabled={state === 'loading'} onClick={reveal}>
            {state === 'loading' ? 'Расшифровываю…' : 'Показать значение'}
          </button>
          {state === 'failed' ? (
            <p className="field__error" role="alert">
              Не удалось показать: нет связи или запись не расшифровалась.
            </p>
          ) : (
            <p className="field__hint">Просмотр записывается в историю проекта.</p>
          )}
        </>
      ) : (
        <>
          <Field id="k-value" label="Адрес, логин, пароль" hint="Шифруется на сервисе; в базе открытого текста нет">
            <textarea
              id="k-value"
              className="mono"
              rows={4}
              maxLength={8000}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setChanged(true);
              }}
              aria-describedby="k-value-hint"
            />
          </Field>
          {secret && (
            <button type="button" className="btn btn--tinted btn--wide" onClick={copy}>
              {state === 'copied' ? 'Скопировано' : 'Скопировать'}
            </button>
          )}
        </>
      )}
      <span className="sr" role="status">
        {state === 'copied' ? 'Значение скопировано' : ''}
      </span>
    </FormSheet>
  );
}
