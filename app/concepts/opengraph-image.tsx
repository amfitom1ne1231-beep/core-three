import { OG_SIZE, pageOg } from '@/lib/og';
import { SITE } from '@/content/site';

const PAGE = SITE.concepts.page;

export const alt = `${PAGE.title} ${PAGE.titleAccent} — CoreThree`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return pageOg({ kicker: PAGE.label, title: PAGE.title, accent: PAGE.titleAccent });
}
