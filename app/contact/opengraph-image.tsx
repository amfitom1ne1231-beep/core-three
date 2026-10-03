import { OG_SIZE, pageOg } from '@/lib/og';
import { SITE } from '@/content/site';

export const alt = `${SITE.contact.title} ${SITE.contact.titleAccent} — CoreThree`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return pageOg({ kicker: SITE.contact.label, title: SITE.contact.title, accent: SITE.contact.titleAccent });
}
