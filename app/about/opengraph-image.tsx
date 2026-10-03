import { OG_SIZE, pageOg } from '@/lib/og';
import { ABOUT } from '@/content/about';

export const alt = `${ABOUT.title} ${ABOUT.titleAccent} — CoreThree`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return pageOg({ kicker: ABOUT.label, title: ABOUT.title, accent: ABOUT.titleAccent });
}
