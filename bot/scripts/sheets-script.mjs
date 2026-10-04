/**
 * Скрипт для Google-таблицы с подставленным секретом.
 *
 *   npm run sheets:script
 *
 * В репозитории лежит заготовка (sheets/Code.gs) без секрета: адрес
 * скрипта открыт всем, и пишет он только тому, кто секрет знает. Готовый
 * файл кладётся в .data/ — в git он не попадает. Его целиком вставляют
 * в редактор Apps Script самой таблицы.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const secret = process.env.SHEETS_SECRET;
if (!secret || secret.length < 16) {
  console.error('В .env.local нет SHEETS_SECRET (любая длинная случайная строка: openssl rand -hex 32)');
  process.exit(1);
}
const template = readFileSync(new URL('../sheets/Code.gs', import.meta.url), 'utf8');
const marker = "const SECRET = '__SECRET__';";
if (!template.includes(marker)) {
  console.error('В sheets/Code.gs не найдена строка с секретом — заготовку меняли?');
  process.exit(1);
}
mkdirSync('.data', { recursive: true });
writeFileSync('.data/sheets-script.gs', template.replace(marker, `const SECRET = '${secret}';`));
console.info('Готово: bot/.data/sheets-script.gs — вставьте его целиком в Apps Script таблицы.');
