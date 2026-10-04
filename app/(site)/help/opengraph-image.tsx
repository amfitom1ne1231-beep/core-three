import { OG_SIZE, pageOg } from '@/lib/og';
import { HELP } from '@/content/help';

export const alt = `${HELP.title} ${HELP.titleAccent} — CoreThree`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return pageOg({ kicker: HELP.label, title: HELP.title, accent: HELP.titleAccent });
}
