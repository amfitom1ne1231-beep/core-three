import type { Metadata } from 'next';
import { demoBySlug } from './index';

/**
 * Метаданные страницы демо. Общие для всех четырёх, чтобы заголовок
 * и канонический адрес собирались из одного места, а не переписывались
 * в каждом роуте.
 */
export function demoMetadata(slug: string): Metadata {
  const demo = demoBySlug(slug);
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
