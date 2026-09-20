import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CafeDemo from '@/components/demo/cafe/CafeDemo';
import StatusDemo from '@/components/demo/status/StatusDemo';
import { DEMOS, demoBySlug } from '@/content/concepts';

/**
 * Демо концептов.
 *
 * Список закрыт и раскладывается на сборке: несобранный слug отдаёт 404,
 * а не пустую рамку. Пустая рамка на месте обещанного демо хуже
 * отсутствующей ссылки — витрина для того и существует, чтобы показывать
 * готовое, а не намерения.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return DEMOS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const demo = demoBySlug((await params).slug);
  if (!demo) return {};
  return {
    title: demo.title,
    description: demo.description,
    alternates: { canonical: `/concepts/${demo.slug}` },
    openGraph: {
      title: `${demo.title} — CoreThree`,
      description: demo.description,
      url: `/concepts/${demo.slug}`
    }
  };
}

export default async function Demo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!demoBySlug(slug)) notFound();

  switch (slug) {
    case 'status':
      return <StatusDemo />;
    case 'cafe':
      return <CafeDemo />;
    default:
      notFound();
  }
}
