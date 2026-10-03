import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Footer from '@/components/Footer';
import HeroSilk from '@/components/HeroSilk';
import ServicePage from '@/components/ServicePage';
import TelegramDemo from '@/components/TelegramDemo';
import { SERVICES, bySlug } from '@/content/services';
import { SITE } from '@/content/site';
import { TG_DEMO } from '@/content/tg-demo';
import { pageMeta } from '@/lib/meta';

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
  return pageMeta({ title: page.meta.title, description: page.meta.description, path: `/${page.slug}` });
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
      <ServicePage page={page}>
        {/* живая проба сценария — только у ботов: показывать её на
            мониторинге не за чем, а шаблон остаётся общим */}
        {page.slug === 'bots' ? (
          <section data-chapter="atlas" className="relative border-t border-line" aria-label={TG_DEMO.label}>
            <div className="grid gap-[clamp(28px,5vh,56px)] px-4 section-y sm:px-8 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.2fr)] lg:items-center lg:gap-[clamp(40px,5vw,96px)] lg:px-[72px]">
              <div>
                <span className="rail-label">{TG_DEMO.label}</span>
                <h2 className="display m-0 mt-4 text-[clamp(26px,3.6vw,52px)]">
                  {TG_DEMO.title} <span className="title-accent">{TG_DEMO.titleAccent}</span>
                </h2>
                <p className="m-0 mt-6 max-w-[42ch] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-dim">
                  {TG_DEMO.lead}
                </p>
              </div>
              <TelegramDemo />
            </div>
          </section>
        ) : null}
      </ServicePage>
      <Footer />
    </>
  );
}
