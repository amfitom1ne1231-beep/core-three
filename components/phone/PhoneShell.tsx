'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Bar from './Bar';
import Dock from './Dock';
import MoreSheet from './MoreSheet';
import { navSettled } from '@/lib/phone';

/**
 * Оболочка телефона (MOBILE.md): строка сверху, остров внизу, карточка
 * «Ещё». Заменяет шапку с меню-гамбургером на экранах уже 640 px; шире
 * её не видно. В демо концептов её нет — это сайты клиентов.
 */
export default function PhoneShell() {
  const pathname = usePathname() ?? '';
  const [more, setMore] = useState(false);
  const close = useCallback(() => setMore(false), []);

  // Новый экран нарисован — отпускаем переход (lib/phone). Два кадра:
  // первый — раскладка нового экрана, второй — его картинка.
  useEffect(() => {
    setMore(false);
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(navSettled);
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [pathname]);

  return (
    <>
      <Bar />
      <Dock onMore={() => setMore((v) => !v)} moreOpen={more} />
      <MoreSheet open={more} onClose={close} />
    </>
  );
}
