'use client';

import { useEffect, useId, useState } from 'react';
import Jump from './Jump';
import { findWords, GLOSSARY } from '@/content/glossary';

export type GlossaryLabels = { search: string; placeholder: string; empty: string; ask: string };

/**
 * Словарь списком с поиском.
 *
 * Без запроса — все слова по алфавиту: так их видит и тот, у кого не
 * загрузился скрипт. Поиск не различает регистр и «ё», ищет и по другим
 * написаниям («Web App», «сео») и по самому объяснению — человек может
 * помнить не слово, а то, о чём оно.
 *
 * У каждого слова постоянный якорь `#word-<id>`: на этапе «словарь
 * на месте» сюда поведут ссылки из текстов сайта.
 */
export default function Glossary({ labels }: { labels: GlossaryLabels }) {
  const [query, setQuery] = useState('');
  const found = findWords(query);
  const inputId = useId();
  /**
   * Слово, к которому пришли по «В словаре» из текста. `:target` тут не
   * помогает: Next меняет адрес без настоящего перехода по якорю.
   */
  const [target, setTarget] = useState('');
  useEffect(() => {
    const read = () => setTarget(decodeURIComponent(location.hash.slice(1)));
    read();
    addEventListener('hashchange', read);
    return () => removeEventListener('hashchange', read);
  }, []);

  return (
    <div>
      <div className="max-w-[420px]">
        <label htmlFor={inputId} className="rail-label !text-dim">
          {labels.search}
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.placeholder}
          autoComplete="off"
          spellCheck={false}
          className="brief-input"
        />
        <p className="m-0 mt-3 font-mono text-[10px] uppercase tracking-rail text-faint" aria-live="polite">
          {query.trim() ? `Найдено: ${found.length}` : `Слов в словаре: ${GLOSSARY.length}`}
        </p>
      </div>

      {found.length ? (
        // по алфавиту сверху вниз, колонками, как в настоящем словаре:
        // сеткой алфавит читался бы через строку
        <dl className="m-0 mt-8 [column-gap:clamp(40px,5vw,96px)] lg:columns-2">
          {found.map((w) => (
            <div key={w.id} id={`word-${w.id}`} className="scroll-mt-28 break-inside-avoid border-t border-line py-[clamp(16px,2.4vh,24px)]">
              <dt
                className={`text-[clamp(16px,1.4vw,19px)] font-medium leading-snug transition-colors duration-500 ${
                  target === `word-${w.id}` ? 'text-accent' : ''
                }`}
              >
                {w.term}
              </dt>
              <dd className="m-0 mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-dim">{w.text}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="m-0 mt-8 max-w-[52ch] border-t border-line pt-6 text-[15px] leading-relaxed text-dim">
          {labels.empty}{' '}
          <Jump to="write" className="text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-accent">
            {labels.ask}
          </Jump>
        </p>
      )}
    </div>
  );
}
