import { InlineKeyboard } from 'grammy';
import type { HelpSection } from '../domain/help';
import type { LeadRow, Member } from '../domain/leads';
import { STAGE_LABEL } from '../domain/stages';
import { dueFor, type Today } from '../domain/today';
import { shortTime } from '../domain/worktime';
import { esc } from './card';

/**
 * Пульт — то, чем бот встречает своего в личке: что ждёт именно его,
 * и кнопки под этим. Одно сообщение, которое перелистывается на месте:
 * «Заявки», «Мои», «Сегодня», «Справка» правят его же, лента лички
 * не превращается в простыню ответов.
 *
 * Здесь только слова и кнопки — без базы и без Telegram: что показать,
 * приходит готовым (`domain/today.ts`), а проверить это можно на любых
 * данных.
 */

export type Screen = { text: string; keyboard: InlineKeyboard };

/** Что нужно пульту от бота: адрес приложения и ссылка на карточку заявки в группе. */
export type PultEnv = {
  appBase: string | null;
  tz: string;
  /** `#12` ссылкой на карточку, если она есть. */
  ref: (l: Pick<LeadRow, 'id' | 'cardChatId' | 'cardMessageId'>) => string;
};

/** Данные кнопки пульта: `p:<экран>`. */
export const pb = (view: string) => `p:${view}`;

const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAY = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** «пн, 5 окт» из `2026-10-05`. */
export function dayTitle(day: string) {
  const [, m, d] = day.split('-').map(Number);
  return `${WEEKDAY[new Date(`${day}T00:00:00Z`).getUTCDay()]}, ${d} ${MON[m! - 1]}`;
}

/** «сегодня», «с 3 окт» (срок прошёл), «до 12 окт» или «без срока». */
export function dueLabel(dueOn: string | null, today: string) {
  if (!dueOn) return 'без срока';
  if (dueOn === today) return 'сегодня';
  const [, m, d] = dueOn.split('-').map(Number);
  return `${dueOn < today ? 'с' : 'до'} ${d} ${MON[m! - 1]}`;
}

/** 1 задача, 2 задачи, 5 задач. */
export function count(n: number, forms: [string, string, string]) {
  const a = n % 10;
  const b = n % 100;
  const form = a === 1 && b !== 11 ? forms[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? forms[1] : forms[2];
  return `${n} ${form}`;
}

const TASKS: [string, string, string] = ['задача', 'задачи', 'задач'];
const STAGES: [string, string, string] = ['этап', 'этапа', 'этапов'];

const MORE = 12;
const cut = <T>(list: T[]) => ({ shown: list.slice(0, MORE), rest: Math.max(0, list.length - MORE) });
const tail = (rest: number) => (rest ? [`…и ещё ${rest}`] : []);

function back(env: PultEnv) {
  const kb = new InlineKeyboard().text('‹ Пульт', pb('home'));
  if (env.appBase) kb.webApp('Открыть «Студию»', env.appBase);
  return kb;
}

const leadLine = (l: LeadRow, env: PultEnv, now: Date, own = true) =>
  `${env.ref(l)} · ${esc(l.name)} · ${STAGE_LABEL[l.stage]}${own ? ` · ${l.ownerName ? esc(l.ownerName) : 'никто не взял'}` : ''} · ${shortTime(l.createdAt, now, env.tz)}`;

/** Главный экран пульта: три строки о том, что ждёт, и кнопки. */
export function pultHome(t: Today, me: Member, env: PultEnv): Screen {
  const unowned = t.waiting.filter((l) => !l.ownerId).length;
  const mine = t.mine.length + t.waiting.filter((l) => l.ownerId === me.id).length;
  const due = dueFor(t, me.id);

  const lines = ['<b>CoreThree · рабочий бот</b>', ''];
  lines.push(t.waiting.length ? `Ждут ответа — ${t.waiting.length}${unowned ? `, из них ничьих ${unowned}` : ''}` : 'Ждут ответа — никого');
  lines.push(`Мои заявки — ${mine || 'нет'}`);
  const parts = [due.tasks.length ? count(due.tasks.length, TASKS) : '', due.stages.length ? count(due.stages.length, STAGES) : ''].filter(Boolean);
  lines.push(`Мои сроки на сегодня — ${parts.length ? parts.join(' и ') : 'ничего'}`);

  const kb = new InlineKeyboard().text('Заявки', pb('leads')).text('Мои', pb('mine')).text('Сегодня', pb('today')).row().text('Справка', pb('help'));
  if (env.appBase) kb.webApp('Открыть «Студию»', env.appBase);
  return { text: lines.join('\n'), keyboard: kb };
}

/** Все открытые заявки: сначала те, кому ещё не ответили. */
export function pultLeads(t: Today, open: LeadRow[], env: PultEnv, now: Date): Screen {
  if (!open.length) return { text: '<b>Открытые заявки</b>\n\nОткрытых заявок нет.', keyboard: back(env) };
  // без ответа — наверх: это то, ради чего список открывают; внутри — кто ждёт дольше
  const sorted = [...open].sort((a, b) => Number(b.stage === 'new') - Number(a.stage === 'new'));
  const { shown, rest } = cut(sorted);
  return {
    text: [`<b>Открытые заявки — ${open.length}</b>`, '', ...shown.map((l) => leadLine(l, env, now)), ...tail(rest)].join('\n'),
    keyboard: back(env)
  };
}

/** Моё: заявки, которые веду, и мои задачи. */
export function pultMine(t: Today, me: Member, env: PultEnv, now: Date): Screen {
  const leads = [...t.waiting.filter((l) => l.ownerId === me.id), ...t.mine];
  const lines: string[] = [];
  lines.push(`<b>Мои заявки — ${leads.length || 'нет'}</b>`);
  const l = cut(leads);
  lines.push(...l.shown.map((x) => leadLine(x, env, now, false)), ...tail(l.rest));

  lines.push('', `<b>Мои задачи — ${t.tasks.length || 'нет'}</b>`);
  const k = cut(t.tasks);
  lines.push(...k.shown.map((x) => `— ${esc(x.title)} · ${esc(x.project)} · ${dueLabel(x.dueOn, t.day)}`), ...tail(k.rest));
  return { text: lines.join('\n'), keyboard: back(env) };
}

/** Сегодня: что горит у меня, что у команды, что стоит без движения. */
export function pultToday(t: Today, me: Member, env: PultEnv): Screen {
  const mine = dueFor(t, me.id);
  const others = {
    tasks: t.due.tasks.filter((x) => x.assigneeId !== me.id),
    stages: t.due.stages.filter((x) => x.owner?.id !== me.id)
  };
  const lines = [`<b>Сегодня · ${dayTitle(t.day)}</b>`];

  lines.push('', '<b>Мои сроки</b>');
  if (!mine.tasks.length && !mine.stages.length) lines.push('На сегодня ничего не горит.');
  for (const x of mine.tasks) lines.push(`— ${esc(x.title)} · ${esc(x.project)} · ${dueLabel(x.dueOn, t.day)}`);
  for (const x of mine.stages) lines.push(`— этап «${esc(x.title)}» · ${esc(x.project)} · ${dueLabel(x.dueOn, t.day)}`);

  if (others.tasks.length || others.stages.length) {
    lines.push('', '<b>У команды</b>');
    for (const x of others.tasks.slice(0, MORE)) {
      lines.push(`— ${x.assignee ? `${esc(x.assignee.name)}: ` : ''}${esc(x.title)} · ${esc(x.project)} · ${dueLabel(x.dueOn, t.day)}`);
    }
    for (const x of others.stages.slice(0, MORE)) {
      lines.push(`— этап «${esc(x.title)}» · ${esc(x.project)} · ${dueLabel(x.dueOn, t.day)}${x.owner ? ` · ${esc(x.owner.name)}` : ''}`);
    }
  }

  if (t.stale.length) {
    lines.push('', `<b>Без движения — ${t.stale.length}</b>`);
    const s = cut(t.stale);
    lines.push(
      ...s.shown.map((l) => `${env.ref(l)} · ${esc(l.name)} · ${STAGE_LABEL[l.stage]} · ${l.idleDays} раб. дн.${l.ownerName ? ` · ${esc(l.ownerName)}` : ''}`),
      ...tail(s.rest)
    );
  }
  return { text: lines.join('\n'), keyboard: back(env) };
}

/** Новичку по приглашению: не общая справка, а три шага, с которых начать. */
export function welcome(me: Member, groupTitle: string | null, env: PultEnv): Screen {
  const group = groupTitle ? `рабочую группу «${esc(groupTitle)}»` : 'рабочую группу';
  const lines = [
    `<b>Вы в команде CoreThree, ${esc(me.name)}</b>`,
    '',
    'Три шага, чтобы начать:',
    '',
    `<b>1.</b> Загляните в ${group}: заявки приходят туда карточками. Нажали «Беру» — заявка ваша.`,
    env.appBase
      ? '<b>2.</b> Откройте «Студию» — кнопка слева от поля ввода: заявки, проекты и сроки в одном месте.'
      : '<b>2.</b> Отправьте /start — здесь будет видно, что ждёт именно вас.',
    '<b>3.</b> Пролистайте справку: что делает каждая кнопка и когда бот напоминает.'
  ];
  const kb = new InlineKeyboard().text('Справка', pb('help')).text('Пульт', pb('home'));
  if (env.appBase) kb.row().webApp('Открыть «Студию»', env.appBase);
  return { text: lines.join('\n'), keyboard: kb };
}

/** Кнопки разделов справки: по две в ряд, текущий раздел отмечен. */
function helpKeyboard(sections: HelpSection[], current: string | null, withPult: boolean) {
  const kb = new InlineKeyboard();
  sections.forEach((s, i) => {
    kb.text(s.id === current ? `· ${s.title} ·` : s.title, pb(`h_${s.id}`));
    if (i % 2 === 1) kb.row();
  });
  if (sections.length % 2) kb.row();
  if (withPult) kb.text('‹ Пульт', pb('home'));
  return kb;
}

/** Оглавление справки. */
export function helpIndex(sections: HelpSection[], withPult = true): Screen {
  return {
    text: ['<b>Справка</b>', '', 'Как устроена работа с заявками и проектами. Выберите раздел:'].join('\n'),
    keyboard: helpKeyboard(sections, null, withPult)
  };
}

/** Один раздел справки; `null` — такого раздела нет. */
export function helpSection(sections: HelpSection[], id: string, withPult = true): Screen | null {
  const s = sections.find((x) => x.id === id);
  if (!s) return null;
  return {
    text: [`<b>Справка · ${esc(s.title)}</b>`, '', esc(s.intro), '', ...s.items.map((i) => `<b>${esc(i.term)}</b> — ${esc(i.text)}`)].join('\n'),
    keyboard: helpKeyboard(sections, id, withPult)
  };
}
