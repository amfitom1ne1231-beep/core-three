import type { ComponentType } from 'react';
import type { LiveProps } from './kit';
import LiveBlog from './LiveBlog';
import LiveBot from './LiveBot';
import LiveLanding from './LiveLanding';
import LiveOps from './LiveOps';
import LiveShop from './LiveShop';
import LiveWebApp from './LiveWebApp';

/**
 * Вставка по ключу направления. Раньше этот список лежал копиями
 * в `ServicePage` и в пульте; третья копия появилась бы в списке
 * соседей — а такие списки расходятся молча.
 *
 * Отдельный файл, а не `kit.tsx`: сами вставки импортируют kit, и он,
 * сославшись на них в ответ, замкнул бы круг.
 */
export const LIVE_BY_KEY: Record<string, ComponentType<LiveProps>> = {
  landing: LiveLanding,
  blog: LiveBlog,
  shop: LiveShop,
  bot: LiveBot,
  webapp: LiveWebApp,
  ops: LiveOps
};
