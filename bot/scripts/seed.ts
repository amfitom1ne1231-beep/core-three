/**
 * Выдуманные данные для демо-режима (`npm run demo`): команда из троих,
 * заявки на всех этапах воронки, два с половиной месяца закрытых заявок
 * для метрик, проекты с задачами, сроками, материалами и доступами. Настоящей базы не касается — пишет в BOT_DATA_DIR из .env.demo.
 */
import { loadConfig } from '../src/config';
import { openDb } from '../src/db/client';
import { members } from '../src/db/schema';
import { addNote, createLead, markLost, markReminded, setStage, takeLead } from '../src/domain/leads';
import { addFile, addLink, addSecret, addTask, createProject, projectView, updateProject, updateStage, updateTask } from '../src/domain/projects';
import { parseKey } from '../src/domain/seal';
import { dayKey, zoned } from '../src/domain/worktime';

const config = loadConfig();
if (!config.BOT_DATA_DIR.includes('demo')) throw new Error('seed пишет только в демо-базу: BOT_DATA_DIR должен содержать «demo»');
const { db, close } = await openDb({ dataDir: config.BOT_DATA_DIR });

const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000);
const H = 60;
const D = 24 * H;
/** День от сегодняшнего в поясе студии: -2 — позавчера, 3 — через три дня. */
const day = (shift: number) => dayKey(new Date(now + shift * D * 60_000), config.work.tz);

const [lev, ilya, marina] = await db
  .insert(members)
  .values([
    { tgId: 1001, name: 'Лев', username: 'lev', role: 'owner' },
    { tgId: 1002, name: 'Илья', username: 'ilya', role: 'owner' },
    { tgId: 1003, name: 'Марина', username: 'marina', role: 'owner' }
  ])
  .returning();
const L = lev!.id;
const I = ilya!.id;
const M = marina!.id;

/* ---------- заявки ---------- */

const anna = await createLead(
  db,
  { source: 'site', name: 'Анна Ковалёва', contact: '@anna_kovaleva', kind: 'sites', page: '/sites', task: 'Что: Сайт или лендинг\nЭтап: Есть идея\nСрок: В течение месяца\nОриентир: 2–5 недель\n\nНужен лендинг под курс акварели: есть тексты и фотографии работ, хочется запись на поток и оплату.', meta: { utm_source: 'telegram', landing: '/sites' } },
  ago(95)
);
await markReminded(db, anna.id, ago(35));

await createLead(
  db,
  { source: 'site', name: 'ООО «Северный ветер» — отдел закупок', contact: '+7 912 345-67-89', kind: 'ecommerce', page: '/ecommerce', task: 'Что: Интернет-магазин\nПодключить: Онлайн-оплата, 1С и склад', spam: true },
  ago(12)
);

const boris = await createLead(db, { source: 'manual', name: 'Борис', contact: '@boris_auto', kind: 'bots', task: 'Бот для записи в автосервис, знакомый Ильи. Хочет напоминания клиентам за день до визита.' }, ago(26 * H));
await takeLead(db, boris.id, I, ago(26 * H));
await setStage(db, boris.id, I, 'contacted', ago(25 * H));
await addNote(db, boris.id, I, 'Созвон в четверг в 15:00.\nПросил прислать примеры ботов до среды.', ago(24 * H));

const vera = await createLead(db, { source: 'mail', name: 'Вера Сергеевна', contact: 'vera@atelier.example', kind: 'sites', task: 'Здравствуйте! Хотим обновить сайт ателье: сейчас он на конструкторе и не открывается с телефона.' }, ago(3 * D));
await setStage(db, vera.id, L, 'contacted', ago(3 * D - 40));
await setStage(db, vera.id, L, 'call', ago(2 * D));

const gleb = await createLead(db, { source: 'site', name: 'Глеб', contact: 'gleb@coffee.example', kind: 'monitoring', page: '/monitoring', task: 'Что: Мониторинг и поддержка\n\nТри сайта сети кофеен, один раз уже лежали сутки — никто не заметил.' }, ago(6 * D));
await setStage(db, gleb.id, M, 'contacted', ago(6 * D - 30));
await setStage(db, gleb.id, M, 'proposal', ago(4 * D));

const egor = await createLead(db, { source: 'site', name: 'Егор', contact: '+7 900 111-22-33', kind: 'ecommerce', page: '/ecommerce', task: 'Что: Интернет-магазин\n\nМагазин автозапчастей, каталог на 4000 позиций.' }, ago(9 * D));
await setStage(db, egor.id, I, 'contacted', ago(9 * D - 60));
await markLost(db, egor.id, I, 'price', ago(7 * D));

// довели до договора — из заявки вырос проект
const darya = await createLead(db, { source: 'site', name: 'Дарья', contact: '@darya_yoga', kind: 'sites', page: '/sites', task: 'Что: Сайт или лендинг\nПодключить: Запись и бронь\n\nСайт студии йоги: расписание, запись на занятия, абонементы.' }, ago(20 * D));
await setStage(db, darya.id, L, 'contacted', ago(20 * D - 50));
await setStage(db, darya.id, L, 'call', ago(19 * D));
await setStage(db, darya.id, L, 'proposal', ago(17 * D));
await setStage(db, darya.id, L, 'contract', ago(14 * D));

/* ---------- история для метрик ---------- */

// Заявки за прошлые два с половиной месяца — все уже закрыты, чтобы не
// засорять список открытых. Разброс задан формулой, а не случаем: демо
// каждый раз одно и то же.
{
  const names = ['Алина', 'Виктор', 'Жанна', 'Захар', 'Инна', 'Кирилл', 'Лариса', 'Матвей', 'Нина', 'Олег', 'Полина', 'Роман', 'Софья', 'Тимур', 'Ульяна', 'Фёдор'];
  const kinds = ['sites', 'sites', 'bots', 'ecommerce', 'sites', 'monitoring', 'bots', 'general'];
  const sources: { source: 'site' | 'mail' | 'manual'; meta?: Record<string, string> }[] = [
    { source: 'site', meta: { utm_source: 'telegram', utm_medium: 'post', landing: '/' } },
    { source: 'site', meta: { utm_source: 'yandex', utm_medium: 'cpc', landing: '/sites' } },
    { source: 'site', meta: { landing: '/' } },
    { source: 'site', meta: { ref: 'vk.com', landing: '/concepts' } },
    { source: 'site', meta: { utm_source: 'telegram', utm_medium: 'post', landing: '/bots' } },
    { source: 'mail' },
    { source: 'site', meta: { landing: '/contact' } },
    { source: 'manual' }
  ];
  const reasons = ['price', 'silent', 'price', 'time', 'competitor', 'profile'] as const;
  const who = [L, I, M];

  for (let i = 0; i < 44; i++) {
    // чем ближе к сегодняшнему дню, тем гуще: студия растёт
    let daysAgo = 11 + Math.floor(((i * 37) % 70) * (0.45 + ((i * 13) % 10) / 18));
    // выходные — на пятницу: в демо заявки приходят в рабочие часы, иначе «ответ за 0 минут»
    const dow = new Date(now - daysAgo * D * 60_000).getUTCDay();
    if (dow === 0) daysAgo += 2;
    if (dow === 6) daysAgo += 1;
    const [y, mo, d] = dayKey(new Date(now - daysAgo * D * 60_000), config.work.tz).split('-').map(Number);
    const created = zoned(y!, mo!, d!, config.work.start + ((i * 53) % 300), config.work.tz);
    const at = Math.round((now - created.getTime()) / 60_000);
    const src = sources[i % sources.length]!;
    const lead = await createLead(
      db,
      { source: src.source, meta: src.meta ?? null, name: `${names[i % names.length]}`, contact: `client${i}@example.com`, kind: kinds[(i * 3) % kinds.length]!, task: 'Заявка из истории — для метрик демо.' },
      ago(at)
    );
    const owner = who[i % 3]!;
    // первый ответ: чаще быстро, иногда через полдня
    const reply = [12, 25, 40, 55, 18, 95, 30, 240][i % 8]!;
    await setStage(db, lead.id, owner, 'contacted', ago(at - reply));
    const fate = (i * 7) % 10;
    if (fate < 3) {
      await markLost(db, lead.id, owner, reasons[i % reasons.length]!, ago(at - reply - 2 * D));
      continue;
    }
    await setStage(db, lead.id, owner, 'call', ago(at - reply - 1 * D));
    if (fate < 5) {
      await markLost(db, lead.id, owner, reasons[(i + 2) % reasons.length]!, ago(at - reply - 4 * D));
      continue;
    }
    await setStage(db, lead.id, owner, 'proposal', ago(at - reply - 3 * D));
    if (fate < 8) {
      await markLost(db, lead.id, owner, reasons[(i + 1) % reasons.length]!, ago(at - reply - 8 * D));
      continue;
    }
    await setStage(db, lead.id, owner, 'contract', ago(at - reply - 6 * D));
    // проекты из давних договоров уже сданы — в архиве
    const p = await db.query.projects.findFirst({ where: (t, { eq }) => eq(t.leadId, lead.id) });
    if (p) await updateProject(db, p.id, owner, { status: 'done' }, ago(Math.max(at - 30 * D, (3 + (i % 9) * 2) * D)));
  }
}

/* ---------- проекты ---------- */

const key = config.SECRETS_KEY ? parseKey(config.SECRETS_KEY) : null;

// 1. Сайт студии йоги — из заявки Дарьи: середина работы, есть просроченное
const yoga = (await db.query.projects.findFirst({ where: (p, { eq }) => eq(p.leadId, darya.id) }))!;
{
  const v = (await projectView(db, yoga.id))!;
  const [brief, proto, design, dev, launch] = v.stages;
  await updateStage(db, brief!.id, L, { dueOn: day(-12), done: true }, ago(12 * D));
  await updateStage(db, proto!.id, L, { dueOn: day(-6), done: true }, ago(5 * D));
  await updateStage(db, design!.id, M, { dueOn: day(-1) }, ago(5 * D));
  await updateStage(db, dev!.id, L, { dueOn: day(9) }, ago(5 * D));
  await updateStage(db, launch!.id, L, { dueOn: day(16) }, ago(5 * D));

  const t1 = await addTask(db, yoga.id, L, { title: 'Согласовать структуру страниц', stageId: proto!.id, assigneeId: L, dueOn: day(-8) }, ago(11 * D));
  await updateTask(db, t1!.id, L, { done: true }, ago(7 * D));
  await addTask(db, yoga.id, L, { title: 'Макет главной и расписания', stageId: design!.id, assigneeId: M, dueOn: day(-1) }, ago(5 * D));
  await addTask(db, yoga.id, L, { title: 'Получить у Дарьи фотографии зала', stageId: design!.id, assigneeId: L, dueOn: day(0) }, ago(4 * D));
  await addTask(db, yoga.id, M, { title: 'Подключить онлайн-запись', stageId: dev!.id, assigneeId: I, dueOn: day(6) }, ago(2 * D));
  await addTask(db, yoga.id, L, { title: 'Тексты для страницы абонементов', assigneeId: L }, ago(1 * D));

  await addLink(db, yoga.id, M, { title: 'Макет в Figma', url: 'https://www.figma.com/file/demo/yoga-studio' }, ago(5 * D));
  await addLink(db, yoga.id, L, { url: 'https://github.com/example/yoga-studio' }, ago(3 * D));
  await addFile(db, yoga.id, L, { fileId: 'demo-file-1', fileKind: 'document', fileName: 'Бриф студии йоги.pdf', fileSize: 284_000 }, ago(13 * D));
  await addFile(db, yoga.id, M, { fileId: 'demo-file-2', fileKind: 'photo', fileName: 'Фото', fileSize: 1_420_000, title: 'Зал, вид от входа' }, ago(2 * D));
  if (key) {
    await addSecret(db, key, yoga.id, L, { title: 'Хостинг', value: 'https://panel.hosting.example\nлогин: yoga-studio\nпароль: demo-Pa55-not-real' }, ago(3 * D));
    await addSecret(db, key, yoga.id, L, { title: 'Домен у регистратора', value: 'логин: darya@yoga.example\nпароль: demo-only' }, ago(3 * D));
  }
}

// 2. Бот для кофейни — заведён вручную, только начали
const coffee = await createProject(db, { client: 'Кофейня «Зерно»', kind: 'bots', contact: '@zerno_coffee', ownerId: I }, I, ago(4 * D));
{
  const v = (await projectView(db, coffee.id))!;
  await updateStage(db, v.stages[0]!.id, I, { dueOn: day(2) }, ago(4 * D));
  await addTask(db, coffee.id, I, { title: 'Сценарий заказа навынос', stageId: v.stages[0]!.id, assigneeId: I, dueOn: day(2) }, ago(4 * D));
  await addTask(db, coffee.id, I, { title: 'Узнать, какая у них касса', stageId: v.stages[0]!.id, assigneeId: L, dueOn: day(1) }, ago(3 * D));
}

// 3. Мониторинг — без сроков и задач: так выглядит свежий проект
await createProject(db, { client: 'Пекарня «Мука»', kind: 'monitoring', ownerId: M }, M, ago(1 * D));

// 4. Архив: сданный магазин
const shop = await createProject(db, { client: 'Мастерская «Нить»', kind: 'ecommerce', ownerId: L }, L, ago(70 * D));
{
  const v = (await projectView(db, shop.id))!;
  for (const [i, s] of v.stages.entries()) await updateStage(db, s.id, L, { done: true }, ago((60 - i * 7) * D));
  await updateProject(db, shop.id, L, { status: 'done' }, ago(12 * D));
}

await close();
console.info(`[seed] демо-база: ${config.BOT_DATA_DIR} — Лев, Илья, Марина; заявки, история для метрик, проекты`);
