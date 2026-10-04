import type { Metadata } from 'next';
import CourseDemo from '@/components/demo/course/CourseDemo';
import { demoMetadata } from '@/content/concepts/meta';

/** Свой роут у каждого демо — см. причину в `app/(demo)/concepts/status/page.tsx`. */
export const metadata: Metadata = demoMetadata('course');

export default function Page() {
  return <CourseDemo />;
}
