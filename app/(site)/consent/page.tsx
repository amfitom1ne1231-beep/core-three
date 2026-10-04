import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { CONSENT } from '@/content/legal';
import { pageMeta } from '@/lib/meta';

export const metadata: Metadata = pageMeta({ title: CONSENT.title, description: CONSENT.lead, path: '/consent' });

export default function ConsentPage() {
  return <LegalPage doc={CONSENT} />;
}
