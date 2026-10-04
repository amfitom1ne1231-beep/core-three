import type { Metadata } from 'next';
import BarberDemo from '@/components/demo/barber/BarberDemo';
import { demoMetadata } from '@/content/concepts/meta';

/** Свой роут у каждого демо — см. причину в `app/(demo)/concepts/status/page.tsx`. */
export const metadata: Metadata = demoMetadata('barber');

export default function Page() {
  return <BarberDemo />;
}
