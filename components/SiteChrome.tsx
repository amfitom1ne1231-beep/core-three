'use client';

import { usePathname } from 'next/navigation';
import Cursor from './Cursor';
import Header from './Header';
import NavPod from './NavPod';
import Preloader from './Preloader';

/**
 * Наша хрома: прелоадер, шапка, пульт, курсор, зерно.
 *
 * Внутри демо её нет. Демо концепта — это сайт клиента, а не наш раздел:
 * своя палитра, свои шрифты, своя шапка. Знак CoreThree поверх чужого
 * сайта разрушил бы единственное, ради чего витрина существует, —
 * «вот так, только под нас».
 *
 * Что остаётся глобальным и почему:
 * — плавный скролл: это качество движения, которое мы и поставляем;
 * — плашка согласия: юридический элемент нашего домена, а не украшение.
 *   Прячется она сама, когда выбор уже сделан.
 */
export default function SiteChrome() {
  const pathname = usePathname() ?? '';
  // /concepts — витрина, наша страница. /concepts/<slug> — демо.
  if (/^\/concepts\/[^/]+$/.test(pathname)) return null;

  return (
    <>
      <Preloader />
      <Header />
      <NavPod />
      <Cursor />
      <div className="grain" aria-hidden />
    </>
  );
}
