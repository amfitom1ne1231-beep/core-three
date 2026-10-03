import { OG_SIZE, pageOg } from '@/lib/og';
import { CONSENT } from '@/content/legal';

export const alt = `${CONSENT.title} — CoreThree`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return pageOg({ kicker: CONSENT.label, title: CONSENT.title });
}
