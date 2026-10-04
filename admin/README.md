# Мини-приложение студии

Рабочий инструмент команды внутри Telegram: заявки, дальше — проекты.
План и решения — `BOT.md` в корне, запуск и туннель — `bot/README.md`.

```
npm install
npm run dev        # http://localhost:5173/app/ — нужен запущенный сервис бота
npm run dev:demo   # http://localhost:5174/app/ — против демо-сервиса (npm run demo в bot/)
npm run build      # dist/ — отдаёт сервис бота по /app/
npm run typecheck
```

- `src/tg.ts` — всё, что берётся у Telegram: подпись для входа, тема,
  кнопка «Назад», вибрация. В браузере без Telegram приложение работает
  на запасной теме
- `src/api.ts` — запросы к сервису и типы его ответов
- `src/router.ts` — маршруты: пути под `/app/`
- `src/styles.css` — цвета только из темы Telegram (`--tg-theme-*`)
- `src/screens` — заявки (список, заявка, новая) и проекты (список
  с «моими задачами», проект, новый)
