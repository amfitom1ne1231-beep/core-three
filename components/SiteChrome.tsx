'use client';

import { usePathname } from 'next/navigation';
import Cursor from './Cursor';
import Header from './Header';
import HeroSilk from './HeroSilk';
import NavPod from './NavPod';
import Preloader from './Preloader';
import { SITE } from '@/content/site';
import Tour from './tour/Tour';
import TourOffer from './tour/TourOffer';

/** Страницы, под которыми лежит материал. У документов и у 404 фон плоский. */
const MATERIAL = new Set(['/', '/contact', '/about', '/concepts', '/help', ...SITE.pages.map((p) => p.href)]);

/**
 * Наша хрома: материал, прелоадер, шапка, пульт, курсор, зерно.
 *
 * Материал живёт здесь, а не на страницах: раньше каждая страница
 * создавала свой, и на каждом переходе шейдер собирался заново —
 * кадр без фона, а в светлой теме ещё и тёмная вспышка, пока новый
 * материал доезжал до своей палитры. Теперь он один и переходы
 * между страницами переживает.
 *
 * Внутри демо её нет: она живёт в оболочке группы (site), а демо
 * концептов — в своей группе. Демо — это сайт клиента, а не наш раздел:
 * своя палитра, свои шрифты, своя шапка. Знак CoreThree поверх чужого
 * сайта разрушил бы единственное, ради чего витрина существует, —
 * «вот так, только под нас».
 *
 * Что остаётся у демо и почему:
 * — плавный скролл: это качество движения, которое мы и поставляем;
 * — плашка согласия: юридический элемент нашего домена, а не украшение.
 *   Прячется она сама, когда выбор уже сделан.
 */
export default function SiteChrome() {
  const pathname = usePathname() ?? '';

  return (
    <>
      {MATERIAL.has(pathname) && <HeroSilk />}
      <Preloader />
      <Header />
      <NavPod />
      <Tour />
      <TourOffer />
      <Cursor />
      <div className="grain" aria-hidden />
    </>
  );
}
