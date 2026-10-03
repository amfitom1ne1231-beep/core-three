import { OG_SIZE, pageOg } from '@/lib/og';
import { PRIVACY } from '@/content/legal';

export const alt = `${PRIVACY.title} — CoreThree`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return pageOg({ kicker: PRIVACY.label, title: PRIVACY.title });
}
