import type { Metadata } from 'next';
import { CookieChoice } from '@/components/CookieConsent';
import LegalPage from '@/components/LegalPage';
import { PRIVACY } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Политика обработки персональных данных',
  description: PRIVACY.lead,
  alternates: { canonical: '/privacy' }
};

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} extra={{ cookies: <CookieChoice /> }} />;
}
