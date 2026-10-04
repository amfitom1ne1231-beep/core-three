'use client';

import { useEffect, useId, useState } from 'react';
import Jump from './Jump';
import { findWords, GLOSSARY } from '@/content/glossary';

export type GlossaryLabels = { search: string; placeholder: string; empty: string; ask: string };

/**
 * Словарь: поиск, сетка слов и карточка с объяснением выбранного.
 *
 * Было списком на 33 статьи во всю высоту — 2,7 тысячи пикселей текста.
 * Слова теперь видно разом, объяснение — одно, у выбранного: так словарь
 * читается как прибор, а не как приложение к договору.
 *
 * Поиск не различает регистр и «ё», ищет и по другим написаниям
 * («сео», «Web App») и по объяснению. У каждого слова постоянный якорь
 * `#word-<id>`: по нему ведут ссылки «В словаре» из текстов сайта.
 */
export default function Glossary({ labels }: { labels: GlossaryLabels }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(GLOSSARY[0]!.id);
  const inputId = useId();
  const found = findWords(query);
  const word = found.find((w) => w.id === picked) ?? found[0];

  // пришли по «В словаре» из текста — открыть это слово
  useEffect(() => {
    const read = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (!h.startsWith('word-')) return;
      setQuery('');
      setPicked(h.slice(5));
    };
    read();
    addEventListener('hashchange', read);
    return () => removeEventListener('hashchange', read);
  }, []);

  const pick = (id: string) => {
    setPicked(id);
    history.replaceState(history.state, '', `#word-${id}`);
  };

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

      {word ? (
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-8">
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {found.map((w) => (
              <li key={w.id}>
                <button
                  id={`word-${w.id}`}
                  type="button"
                  aria-pressed={w.id === word.id}
                  onClick={() => pick(w.id)}
                  className="brief-chip scroll-mt-28 !px-3.5 !py-2 !text-[13.5px]"
                >
                  {w.term}
                </button>
              </li>
            ))}
          </ul>
          {/* объяснение выбранного: на широком экране стоит рядом, пока листаешь слова */}
          <div className="relative border border-line-strong bg-bg/50 p-5 lg:sticky lg:top-28" aria-live="polite">
            <span className="rail-label">Слово</span>
            <p key={word.id} className="m-0 mt-2 text-[clamp(22px,2.2vw,30px)] font-medium leading-tight tracking-[-0.01em]" style={{ animation: 'ct-rise .4s cubic-bezier(0.22,1,0.36,1) both' }}>
              {word.term}
            </p>
            <p className="m-0 mt-3 text-[15px] leading-relaxed text-dim">{word.text}</p>
            {word.aka?.length ? (
              <p className="m-0 mt-4 font-mono text-[10px] uppercase leading-relaxed tracking-rail text-faint">
                Ещё говорят: {word.aka.slice(0, 3).join(' · ')}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="m-0 mt-6 max-w-[52ch] border-t border-line pt-5 text-[15px] leading-relaxed text-dim">
          {labels.empty}{' '}
          <Jump to="write" className="text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-accent">
            {labels.ask}
          </Jump>
        </p>
      )}
    </div>
  );
}
