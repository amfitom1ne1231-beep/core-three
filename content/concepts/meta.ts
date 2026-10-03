import type { Metadata } from 'next';
import { demoBySlug } from './index';
import { pageMeta } from '@/lib/meta';

/**
 * Метаданные страницы демо. Общие для всех четырёх, чтобы заголовок
 * и канонический адрес собирались из одного места, а не переписывались
 * в каждом роуте.
 */
export function demoMetadata(slug: string): Metadata {
  const demo = demoBySlug(slug);
  if (!demo) return {};
  return pageMeta({ title: demo.title, description: demo.description, path: `/concepts/${demo.slug}` });
}
