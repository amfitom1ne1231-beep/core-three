/**
 * Короткие ролики в памяти страницы.
 *
 * Скачать ролик «в кэш браузера» мало: Chrome потом берёт его из кэша,
 * а Safari за тем же файлом идёт в сеть заново — и ролик стартует через
 * секунду после касания (BRIEF.md, раздел 57). Из памяти он играет сразу
 * в любом браузере и качается один раз.
 *
 * Ролики живут, пока открыта страница: вернувшись на экран, человек
 * не ждёт их снова. Счёт идёт на единицы мегабайт.
 */

export type Clip = { url: string | null; ready: Promise<string | null> };

const clips = new Map<string, Clip>();

/** Ролик по адресу: уже в памяти, качается или начинает качаться. */
export function clip(src: string): Clip {
  let found = clips.get(src);
  if (!found) {
    const made: Clip = {
      url: null,
      ready: fetch(src)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((blob) => (made.url = URL.createObjectURL(blob)))
        .catch(() => {
          // не скачался — в следующий раз попробуем снова
          clips.delete(src);
          return null;
        })
    };
    clips.set(src, made);
    found = made;
  }
  return found;
}
