# Сервис бота CoreThree

Что это и зачем — `BOT.md` в корне. Здесь — как запустить.

```
cd bot
npm install
cp .env.example .env.local   # вписать BOT_TOKEN, OWNER_TG_ID, INTAKE_SECRET
npm run dev                  # бот (polling), HTTP :8787, расписание
npm test                     # тесты на встроенном Postgres, без Docker
npm run typecheck
npm run build && npm start   # сборка в dist/main.js
```

Сайт отправляет заявки сюда, если у него заданы `BOT_INTAKE_URL`
(`http://localhost:8787/api/intake/lead`) и тот же `INTAKE_SECRET`.

## Первый запуск с настоящим ботом

1. @BotFather → `/newbot` → токен в `BOT_TOKEN`.
2. Свой Telegram id (его покажет @userinfobot) — в `OWNER_TG_ID`.
3. `npm run dev`, написать боту `/start` — вы в команде как владелец.
4. Создать рабочую группу, добавить туда бота администратором
   (чтобы он мог убирать за собой служебные сообщения), отправить
   в группе `/bind`. Если в группе темы — `/bind` внутри нужной темы.
5. Коллегам — ссылку из `/invite` в личке бота.

## Устройство

- `src/domain` — заявки, команда, сроки, рабочее время. Без Telegram
  и HTTP, поэтому проверяется тестами на любых часах
- `src/tg` — бот (grammY): карточки, кнопки, заметки, напоминания
- `src/http` — Hono: приём заявок с сайта, webhook Telegram
- `src/jobs` — расписание: напоминания и вечерняя тревога
- `src/db` — схема Drizzle; миграции в `drizzle/`, генерируются
  `npm run db:generate`, применяются при старте
