import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { CONSENT } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Согласие на обработку персональных данных',
  description: CONSENT.lead,
  alternates: { canonical: '/consent' }
};

export default function ConsentPage() {
  return <LegalPage doc={CONSENT} />;
}
