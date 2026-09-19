import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Footer from '@/components/Footer';
import HeroSilk from '@/components/HeroSilk';
import ServicePage from '@/components/ServicePage';
import { SERVICES, bySlug } from '@/content/services';
import { SITE } from '@/content/site';

/**
 * Четыре страницы направлений на одном роуте.
 *
 * Адреса из брифа (`/sites`, `/ecommerce`, `/bots`, `/monitoring`)
 * остаются собственными: сегмент динамический, но список закрыт и
 * разложен на сборке, поэтому страницы статические, а всё лишнее
 * отдаёт 404, а не пустой шаблон.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return SERVICES.map((s) => ({ service: s.slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ service: string }>;
}): Promise<Metadata> {
  const page = bySlug((await params).service);
  if (!page) return {};
  return {
    title: page.meta.title,
    description: page.meta.description,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title: `${page.meta.title} — CoreThree`,
      description: page.meta.description,
      url: `/${page.slug}`
    }
  };
}

export default async function Service({ params }: { params: Promise<{ service: string }> }) {
  const page = bySlug((await params).service);
  if (!page) notFound();

  /**
   * Две схемы: сама услуга и блок вопросов. FAQPage даёт шанс попасть
   * в выдачу развёрнутым блоком — вопросы на странице настоящие и
   * отвечают на них тоже по-настоящему, иначе разметку лучше не ставить.
   */
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: `${page.title} ${page.titleAccent}`.replace(/\s+/g, ' ').trim(),
      serviceType: page.meta.title,
      description: page.meta.description,
      provider: { '@type': 'ProfessionalService', name: SITE.name, email: SITE.email },
      areaServed: 'RU',
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Состав работы',
        itemListElement: page.includes.map((i) => ({
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: i.title, description: i.text }
        }))
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    }
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // данные свои и статичные, экранирование < — от закрытия тега внутри строки
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <HeroSilk />
      <ServicePage page={page} />
      <Footer />
    </>
  );
}
