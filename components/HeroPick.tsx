'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { revealReady } from '@/lib/boot';
import { SITE } from '@/content/site';

/**
 * Строка под кнопками первого экрана: «Не знаете, что вам нужно? Подберём
 * за четыре вопроса».
 *
 * Появилась на телефоне, когда разбирали, можно ли зайти на сайт и не
 * понять, что делать (BRIEF.md, раздел 55), — и стоит на ноутбуке тоже:
 * вход в подбор с первого экрана нужен не только с телефона. Проявляется
 * вместе с остальным текстом, после прелоадера.
 */
export default function HeroPick({ className = '' }: { className?: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    revealReady.then(() => setShown(true));
  }, []);

  return (
    <p
      className={`m-0 text-[14px] leading-[1.5] text-dim transition-[opacity,transform] duration-700 ${className}`}
      style={{ opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(10px)', transitionDelay: '0.75s' }}
    >
      {SITE.hero.pick.ask}{' '}
      <Link href={SITE.hero.pick.href} className="text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:text-accent">
        {SITE.hero.pick.label}
      </Link>
    </p>
  );
}
