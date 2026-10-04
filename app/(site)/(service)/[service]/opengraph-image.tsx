import { OG_SIZE, pageOg } from '@/lib/og';
import { SERVICES, bySlug } from '@/content/services';

export const alt = 'Направление CoreThree';
export const size = OG_SIZE;
export const contentType = 'image/png';

export function generateStaticParams() {
  return SERVICES.map((s) => ({ service: s.slug }));
}

export default async function Image({ params }: { params: Promise<{ service: string }> }) {
  const page = bySlug((await params).service) ?? SERVICES[0];
  return pageOg({ kicker: `${page.n} / ${page.group}`, title: page.title, accent: page.titleAccent });
}
