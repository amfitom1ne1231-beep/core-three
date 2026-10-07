import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarkProbe from './MarkProbe';

export const metadata: Metadata = { title: 'Проба знака', robots: { index: false, follow: false } };

/**
 * Проба живого знака для телефона (MOBILE.md, показ 1): модель под пальцем
 * рядом со снятым в Blender. По ней заказчик решает, каким знак будет
 * на первом экране. Есть при разработке и на превью (там сборку помечает
 * SITE_NOINDEX), на боевом сайте страницы нет.
 */
export default function DevMarkPage() {
  if (process.env.NODE_ENV === 'production' && process.env.SITE_NOINDEX !== '1') notFound();
  return <MarkProbe />;
}
