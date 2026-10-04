import type { Metadata } from 'next';
import { CookieChoice } from '@/components/CookieConsent';
import LegalPage from '@/components/LegalPage';
import { PRIVACY } from '@/content/legal';
import { pageMeta } from '@/lib/meta';

export const metadata: Metadata = pageMeta({ title: PRIVACY.title, description: PRIVACY.lead, path: '/privacy' });

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} extra={{ cookies: <CookieChoice /> }} />;
}
