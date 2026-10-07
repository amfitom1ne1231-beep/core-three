'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Bar from './Bar';
import Dock from './Dock';
import HelpSheet from './HelpSheet';
import MoreSheet from './MoreSheet';
import { navSettled, noteScreen } from '@/lib/phone';

/**
 * Оболочка телефона (MOBILE.md): строка сверху, остров внизу, карточки
 * «Ещё» и помощи. Заменяет шапку с меню-гамбургером на экранах уже 640 px; шире
 * её не видно. В демо концептов её нет — это сайты клиентов. На заявке
 * нет острова: экран занят брифом целиком, закрывает его крестик сверху.
 */
export default function PhoneShell() {
  const pathname = usePathname() ?? '';
  // открыта может быть одна карточка: «Ещё» или помощь
  const [sheet, setSheet] = useState<'more' | 'help' | null>(null);
  const close = useCallback(() => setSheet(null), []);

  // Новый экран нарисован — отпускаем переход (lib/phone). Два кадра:
  // первый — раскладка нового экрана, второй — его картинка.
  useEffect(() => {
    setSheet(null);
    noteScreen(pathname);
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
      <Bar onHelp={() => setSheet((v) => (v === 'help' ? null : 'help'))} helpOpen={sheet === 'help'} />
      {!pathname.startsWith('/contact') && <Dock onMore={() => setSheet((v) => (v === 'more' ? null : 'more'))} moreOpen={sheet === 'more'} />}
      <MoreSheet open={sheet === 'more'} onClose={close} />
      <HelpSheet open={sheet === 'help'} onClose={close} />
    </>
  );
}
