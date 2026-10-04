'use client';

import { useState } from 'react';
import Link from 'next/link';
import Words from '../Words';

export type FaqGroup = {
  id: string;
  title: string;
  /** Страница направления — у вопросов о нём. */
  href?: string;
  items: readonly { q: string; a: string; more?: { href: string; label: string } }[];
  /** Слова с пунктиром здесь не нужны: они объяснены на страницах направлений. */
  plain?: boolean;
};

/**
 * Вопросы с фильтром: общие и по каждому направлению. Было девятнадцать
 * раскрывашек подряд — теперь видна одна группа, три-шесть вопросов.
 */
export default function FaqPanel({ groups }: { groups: FaqGroup[] }) {
  const [open, setOpen] = useState(groups[0]!.id);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Чьи вопросы">
        {groups.map((g) => (
          <button key={g.id} type="button" aria-pressed={g.id === open} onClick={() => setOpen(g.id)} className="brief-chip !py-2 !text-[13.5px]">
            {g.title}
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.id} hidden={g.id !== open} className="help-panel mt-5">
          {g.items.map((f) => (
            <details key={f.q} className="group border-t border-line last:border-b">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-[clamp(14px,2vh,20px)] text-[clamp(15px,1.25vw,17px)] font-medium leading-snug transition-colors duration-300 marker:content-none hover:text-accent">
                {f.q}
                <span className="mt-1 shrink-0 font-mono text-[15px] leading-none text-accent transition-transform duration-300 group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="m-0 max-w-[60ch] pb-[clamp(14px,2vh,20px)] text-[14.5px] leading-relaxed text-dim">
                <Words text={f.a} plain={g.plain} />
                {f.more && (
                  <>
                    {' '}
                    <Link href={f.more.href} className="text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-accent">
                      {f.more.label}
                    </Link>
                  </>
                )}
              </p>
            </details>
          ))}
          {g.href && (
            <Link
              href={g.href}
              className="mt-4 inline-flex items-center gap-2 py-2 font-mono text-[10px] uppercase tracking-rail text-dim transition-colors duration-300 hover:text-accent"
            >
              Подробнее о направлении →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
