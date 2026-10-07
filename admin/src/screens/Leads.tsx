import { useEffect, useState } from 'react';
import { useLeads, type LeadRow, type Stage } from '../api';
import { age, shortDay } from '../format';
import { navigate } from '../router';
import { haptic } from '../tg';
import { Brand, Icon, Notice, RowsPlaceholder, useMeData } from '../ui';

/**
 * Список заявок. Открытые сгруппированы по этапам воронки — видно, где
 * что стоит; внутри этапа первой идёт та, что ждёт дольше. «Мои» и «Ничьи» —
 * те же открытые, отфильтрованные на месте, без отдельного запроса.
 */

type Tab = 'open' | 'mine' | 'none' | 'closed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'open', label: 'В работе' },
  { id: 'mine', label: 'Мои' },
  { id: 'none', label: 'Ничьи' },
  { id: 'closed', label: 'Закрытые' }
];

const EMPTY: Record<Tab, { title: string; text?: string }> = {
  open: { title: 'Открытых заявок нет', text: 'Новые приходят с сайта — и сюда, и карточкой в группу.' },
  mine: { title: 'У вас нет заявок в работе' },
  none: { title: 'Ничьих заявок нет', text: 'Всё разобрано.' },
  closed: { title: 'Закрытых заявок пока нет' }
};

// экран пересоздаётся при возврате с заявки — вкладку и поиск помним снаружи
const kept = { tab: 'open' as Tab, q: '' };

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Leads() {
  const { me, dict } = useMeData();
  const [tab, setTab] = useState<Tab>(kept.tab);
  const [q, setQ] = useState(kept.q);
  kept.tab = tab;
  kept.q = q;
  const query = useDebounced(q.trim(), 300);
  const searching = query.length > 0;

  const open = useLeads('open');
  const closed = useLeads('closed', { enabled: tab === 'closed' && !searching });
  const found = useLeads('all', { q: query, enabled: searching });

  const openRows = open.data ?? [];
  const counts: Partial<Record<Tab, number>> = {
    open: open.data?.length,
    mine: open.data?.filter((l) => l.ownerId === me.id).length,
    none: open.data?.filter((l) => l.ownerId === null).length
  };

  const source = searching ? found : tab === 'closed' ? closed : open;
  const rows = searching
    ? (found.data ?? [])
    : tab === 'closed'
      ? (closed.data ?? [])
      : tab === 'mine'
        ? openRows.filter((l) => l.ownerId === me.id)
        : tab === 'none'
          ? openRows.filter((l) => l.ownerId === null)
          : openRows;

  const stageLabel = (id: Stage) => dict.stages.find((s) => s.id === id)?.label ?? id;
  const grouped = !searching && tab !== 'closed';
  const groups = grouped ? dict.funnel.map((stage) => ({ stage, items: rows.filter((l) => l.stage === stage) })).filter((g) => g.items.length > 0) : [];

  return (
    <main className="screen screen--tabbed">
      <Brand />
      <header className="top">
        <h1 className="top__title">Заявки</h1>
        <button type="button" className="btn btn--tinted btn--small" onClick={() => navigate({ name: 'new' })}>
          <Icon name="plus" size={18} />
          Новая
        </button>
      </header>

      <label className="search">
        <Icon name="search" size={18} />
        <span className="sr">Поиск по заявкам</span>
        <input type="search" inputMode="search" enterKeyHint="search" placeholder="Имя, контакт, текст или номер" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {!searching && (
        <div className="tabs" role="tablist" aria-label="Какие заявки показать">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className="tab"
              onClick={() => {
                haptic.tap();
                setTab(t.id);
              }}
            >
              {t.label}
              {counts[t.id] !== undefined && <span className="tab__count">{counts[t.id]}</span>}
            </button>
          ))}
        </div>
      )}

      {source.isPending ? (
        <RowsPlaceholder />
      ) : source.isError ? (
        <Notice title="Не удалось загрузить заявки" text="Нет связи с сервисом бота." action={{ label: 'Повторить', onClick: () => void source.refetch() }} />
      ) : rows.length === 0 ? (
        <Notice {...(searching ? { title: 'Ничего не нашлось', text: `По запросу «${query}» заявок нет.` } : EMPTY[tab])} />
      ) : grouped ? (
        groups.map((g) => (
          <section key={g.stage} aria-label={stageLabel(g.stage)}>
            <h2 className="group">
              {stageLabel(g.stage)}
              <span className="group__count">{g.items.length}</span>
            </h2>
            <div className="section">
              {g.items.map((l) => (
                <Row key={l.id} lead={l} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="section section--list">
          {rows.map((l) => (
            <Row key={l.id} lead={l} showStage />
          ))}
        </div>
      )}
    </main>
  );
}

function Row({ lead, showStage }: { lead: LeadRow; showStage?: boolean }) {
  const { dict, tz } = useMeData();
  const isClosed = dict.closed.includes(lead.stage);
  const stage = dict.stages.find((s) => s.id === lead.stage)?.label ?? lead.stage;
  const kind = dict.kinds.find((k) => k.id === lead.kind)?.label ?? lead.kind;
  const reason = lead.lostReason ? dict.lostReasons.find((r) => r.id === lead.lostReason)?.label : null;
  const when = isClosed && lead.closedAt ? shortDay(lead.closedAt, tz) : age(lead.createdAt);
  return (
    <button type="button" className="row" onClick={() => navigate({ name: 'lead', id: lead.id })}>
      <span className="row__main">
        <span className="row__title">{lead.name}</span>
        <span className="row__meta">
          {showStage && (
            <>
              <span className={isClosed ? undefined : 'row__stage'}>
                {stage}
                {reason ? `: ${reason.toLowerCase()}` : ''}
              </span>
              {' · '}
            </>
          )}
          {kind} · {dict.sources[lead.source]}
          {' · '}
          {lead.ownerName ? `ведёт ${lead.ownerName}` : <span className="row__warn">никто не взял</span>}
          {lead.spam && ' · ловушка'}
        </span>
        <span className="row__task">{firstLine(lead.task)}</span>
      </span>
      <span className="row__side">
        <span className="row__when">{when}</span>
        <Icon name="chevron" size={16} />
      </span>
    </button>
  );
}

/**
 * Бриф с сайта начинается со строк-ответов («Что: …», «Этап: …»,
 * «Подключить: …», «Срок: …», «Ориентир: …» — components/contact/Brief.tsx), а слова
 * клиента идут после них. В списке показываем его слова; если их нет —
 * сами ответы, без подписей.
 */
const BRIEF_LINE = /^(Что|Этап|Подключить|Срок|Ориентир): /;

function firstLine(task: string) {
  const lines = task
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.find((s) => !BRIEF_LINE.test(s)) ?? lines.map((s) => s.replace(BRIEF_LINE, '')).join(' · ');
}
