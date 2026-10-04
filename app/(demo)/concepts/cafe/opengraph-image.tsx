import { OG_SIZE, pageOg } from '@/lib/og';
import { demoBySlug } from '@/content/concepts';

const demo = demoBySlug('cafe')!;

export const alt = `${demo.title} — демо CoreThree`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return pageOg({ kicker: `Демо · ${demo.niche}`, title: demo.title });
}
