import { useState } from 'react';
import { useMetrics, type Metrics, type MetricsPeriod } from '../api';
import { BarList, Columns, type Column } from '../charts';
import { plural } from '../format';
import { navigate } from '../router';
import { haptic } from '../tg';
import { Brand, Notice, RowsPlaceholder, useMeData } from '../ui';

/**
 * Метрики. Всё считается по заявкам, пришедшим за выбранный период:
 * сколько их, откуда, докуда дошли, как быстро на них ответили.
 * Проекты внизу — как есть сейчас.
 *
 * Период выбирается один раз, сверху, и действует на всё ниже него.
 */

const PERIODS: { id: MetricsPeriod; label: string; prev: string }[] = [
  { id: '7', label: '7 дней', prev: 'к прошлым 7 дням' },
  { id: '30', label: '30 дней', prev: 'к прошлым 30 дням' },
  { id: '90', label: '90 дней', prev: 'к прошлым 90 дням' },
  { id: 'all', label: 'Всё время', prev: '' }
];

// экран пересоздаётся при смене вкладки — период помним снаружи
const kept = { period: '30' as MetricsPeriod };

const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTH = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

const minutes = (min: number) => (min < 60 ? `${min} мин` : `${Math.floor(min / 60)} ч${min % 60 ? ` ${min % 60} мин` : ''}`);
const leadsWord = (n: number) => plural(n, 'заявка', 'заявки', 'заявок');
const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

export function MetricsScreen() {
  const [period, setPeriod] = useState<MetricsPeriod>(kept.period);
  kept.period = period;
  const q = useMetrics(period);

  return (
    <main className="screen screen--tabbed">
      <Brand />
      <header className="top">
        <h1 className="top__title">Метрики</h1>
      </header>

      <div className="tabs tabs--first" role="tablist" aria-label="Период">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period === p.id}
            className="tab"
            onClick={() => {
              haptic.tap();
              setPeriod(p.id);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {q.isPending ? (
        <RowsPlaceholder rows={4} />
      ) : q.isError ? (
        <Notice title="Не удалось посчитать метрики" text="Нет связи с сервисом бота." action={{ label: 'Повторить', onClick: () => void q.refetch() }} />
      ) : (
        // пока грузится другой период, прежние цифры остаются на месте, приглушёнными
        <div className={q.isPlaceholderData ? 'is-stale' : undefined}>
          <Body m={q.data} period={PERIODS.find((p) => p.id === period)!} />
        </div>
      )}
    </main>
  );
}

function Body({ m, period }: { m: Metrics; period: (typeof PERIODS)[number] }) {
  const { dict } = useMeData();
  const { leads, firstReply, projects } = m;

  if (!leads.total && !projects.active && !projects.done) {
    return <Notice title="Пока считать нечего" text="За этот период заявок не было. Метрики появятся с первой заявкой — с сайта, из почты или заведённой вручную." />;
  }

  const delta = m.previous ? leads.total - m.previous.total : null;
  const late = projects.overdueTasks + projects.overdueStages;
  const stageLabel = (id: string) => dict.stages.find((s) => s.id === id)?.label ?? id;
  const kindLabel = (id: string) => dict.kinds.find((k) => k.id === id)?.label ?? id;

  const columns: Column[] = m.timeline.map((b) => {
    const [, mo, d] = b.start.split('-').map(Number);
    return { key: b.start, value: b.count, label: m.bucket === 'month' ? MON[mo! - 1]! : `${d} ${MON[mo! - 1]}` };
  });
  const per = { day: 'день', week: 'неделю', month: 'месяц' }[m.bucket];
  const describe = (c: Column) => {
    const [, mo, d] = c.key.split('-').map(Number);
    const when = m.bucket === 'day' ? `${d} ${MON[mo! - 1]}` : m.bucket === 'week' ? `неделя с ${d} ${MON[mo! - 1]}` : MONTH[mo! - 1]!;
    return `${when} — ${c.value} ${leadsWord(c.value)}`;
  };
  const peak = columns.reduce<Column | null>((best, c) => (c.value > (best?.value ?? 0) ? c : best), null);
  const summary = peak ? `Больше всего — ${describe(peak)}` : 'Заявок не было';

  return (
    <>
      <div className="tiles">
        <Tile label="Заявок" value={String(leads.total)} note={delta === null ? (leads.spam ? `и ещё ${leads.spam} — ловушка` : 'за всё время') : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta)} ${period.prev}`} />
        <Tile label="Договоров" value={String(leads.won)} note={leads.total ? `${percent(leads.won, leads.total)} заявок` : ''} />
        <Tile
          label="Первый ответ"
          value={firstReply.medianMin === null ? '—' : minutes(firstReply.medianMin)}
          note={firstReply.answered ? `в срок — ${firstReply.withinSla} из ${firstReply.answered}` : 'ответов пока нет'}
          hint="Обычное время до первого ответа, в рабочих минутах"
        />
        <Tile label="Ждут ответа" value={String(firstReply.waiting)} note={firstReply.waiting ? 'на этапе «Новая»' : 'всем ответили'} warn={firstReply.waiting > 0} onOpen={() => navigate({ name: 'leads' }, { replace: true })} />
      </div>

      {leads.total > 0 && (
        <>
          <h2 className="group">Заявки за {per}</h2>
          <div className="section section--pad">
            <Columns data={columns} title={`Заявки за ${per}`} summary={summary} describe={describe} />
          </div>

          <h2 className="group">Воронка</h2>
          <div className="section section--pad">
            <BarList
              max={leads.total}
              rows={m.funnel.map((f, i) => ({
                key: f.stage,
                label: stageLabel(f.stage),
                value: f.reached,
                note: i === 0 ? undefined : `${percent(f.reached, m.funnel[i - 1]!.reached)} от предыдущего`
              }))}
            />
            <p className="chart__foot">Сколько из пришедших заявок дошли до каждого этапа — включая те, что потом получили отказ.</p>
          </div>

          <h2 className="group">Откуда заявки</h2>
          <div className="section section--pad">
            <BarList rows={m.bySource.map((s) => ({ key: s.id, label: s.label, value: s.count, note: s.won ? `${s.won} ${plural(s.won, 'договор', 'договора', 'договоров')}` : undefined }))} />
          </div>

          <h2 className="group">Направления</h2>
          <div className="section section--pad">
            <BarList rows={m.byKind.map((k) => ({ key: k.id, label: kindLabel(k.id), value: k.count, note: k.won ? `${k.won} ${plural(k.won, 'договор', 'договора', 'договоров')}` : undefined }))} />
          </div>

          {m.lostReasons.length > 0 && (
            <>
              <h2 className="group">
                Причины отказов
                <span className="group__count">{leads.lost}</span>
              </h2>
              <div className="section section--pad">
                <BarList rows={m.lostReasons.map((r) => ({ key: r.id, label: r.label, value: r.count }))} />
              </div>
            </>
          )}
        </>
      )}

      <h2 className="group">Проекты сейчас</h2>
      <div className="tiles tiles--three">
        <Tile label="В работе" value={String(projects.active)} note={projects.paused ? `на паузе — ${projects.paused}` : projects.done ? `сдано за период — ${projects.done}` : ''} onOpen={() => navigate({ name: 'projects' }, { replace: true })} />
        <Tile label="Задач открыто" value={String(projects.openTasks)} note="" />
        <Tile label="Просрочено" value={String(late)} note={late ? 'задач и этапов' : 'всё в срок'} warn={late > 0} />
      </div>
    </>
  );
}

/**
 * Плитка с числом. `warn` — число требует внимания: кроме цвета об этом
 * говорит подпись под ним. С `onOpen` плитка ведёт туда, где это число живёт.
 */
function Tile({ label, value, note, hint, warn, onOpen }: { label: string; value: string; note: string; hint?: string; warn?: boolean; onOpen?: () => void }) {
  const body = (
    <>
      <span className="tile__label">{label}</span>
      <span className={`tile__value${warn ? ' tile__value--warn' : ''}`}>{value}</span>
      {note && <span className="tile__note">{note}</span>}
    </>
  );
  return onOpen ? (
    <button type="button" className="tile tile--link" onClick={onOpen} title={hint}>
      {body}
    </button>
  ) : (
    <div className="tile" title={hint}>
      {body}
    </div>
  );
}
