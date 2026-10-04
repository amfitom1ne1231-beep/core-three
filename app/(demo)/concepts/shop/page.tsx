import type { Metadata } from 'next';
import ShopDemo from '@/components/demo/shop/ShopDemo';
import { demoMetadata } from '@/content/concepts/meta';

/** Свой роут у каждого демо — см. причину в `app/(demo)/concepts/status/page.tsx`. */
export const metadata: Metadata = demoMetadata('shop');

export default function Page() {
  return <ShopDemo />;
}
