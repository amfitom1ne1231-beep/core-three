'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { revealReady } from '@/lib/boot';
import {
  CONSENT_RESET,
  hit,
  loadMetrika,
  readConsent,
  resetConsent,
  writeConsent,
  YM_ID,
  type Consent
} from '@/lib/consent';

/**
 * Плашка cookie. Появляется после прелоадера, не перекрывает первый
 * экран целиком и не мешает читать: сайт работает и без ответа.
 * Метрика грузится только после «Принять».
 */
export default function CookieConsent() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const allowed = useRef(false);

  useEffect(() => {
    if (!YM_ID) return;

    const apply = (c: Consent | null) => {
      if (c === 'all') {
        allowed.current = true;
        loadMetrika();
        hit(location.href);
      }
      if (c === null) {
        // не выскакиваем поверх прелоадера и проявления заголовка
        revealReady.then(() => setTimeout(() => setOpen(true), 1200));
      }
    };
    apply(readConsent());

    const onReset = () => setOpen(true);
    addEventListener(CONSENT_RESET, onReset);
    return () => removeEventListener(CONSENT_RESET, onReset);
  }, []);

  // клиентская навигация: каждый переход — отдельный просмотр
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (allowed.current) hit(location.href);
  }, [pathname]);

  const choose = (c: Consent) => {
    writeConsent(c);
    setOpen(false);
    // Отказ после согласия: выгрузить уже работающую Метрику нельзя,
    // поэтому начинаем страницу заново — уже без неё.
    if (c === 'essential' && allowed.current) {
      location.reload();
      return;
    }
    if (c === 'all' && !allowed.current) {
      allowed.current = true;
      loadMetrika();
      hit(location.href);
    }
  };

  if (!YM_ID || !open) return null;

  return (
    <div
      role="region"
      aria-label="Cookie"
      className="fixed bottom-4 left-4 right-4 z-[150] max-w-[420px] animate-[ct-rise_0.7s_cubic-bezier(0.2,0.7,0.2,1)_both] border border-line bg-bg/85 p-5 backdrop-blur-md sm:bottom-6 sm:left-8 sm:right-auto lg:left-[72px]"
    >
      <p className="m-0 text-[13px] leading-relaxed text-dim">
        Хотим понимать, какие страницы полезны. Для этого нужна Яндекс.Метрика и её cookie — только с вашего
        согласия.{' '}
        <Link href="/privacy#cookies" className="text-fg underline decoration-line-strong underline-offset-4">
          Подробнее
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => choose('all')}
          className="border border-fg bg-fg px-4 py-2.5 font-mono text-[10px] uppercase tracking-rail text-bg transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-white"
        >
          Принять
        </button>
        <button
          type="button"
          onClick={() => choose('essential')}
          className="border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-rail text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
        >
          Без аналитики
        </button>
      </div>
    </div>
  );
}

/** Кнопка на странице политики: вернуть плашку и выбрать заново. */
export function CookieChoice() {
  if (!YM_ID) return null;
  return (
    <>
      <p className="m-0 mt-4 text-[15px] leading-[1.75] text-dim">Изменить его можно в любой момент:</p>
      <button
        type="button"
        onClick={resetConsent}
        className="mt-4 border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-rail text-fg transition-colors duration-300 hover:border-accent hover:text-accent"
      >
        Изменить выбор
      </button>
    </>
  );
}
