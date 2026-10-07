import CookieConsent from '@/components/CookieConsent';
import NavSettle from '@/components/phone/NavSettle';

/**
 * Демо концептов: сайт клиента, а не наш раздел. Ни шапки, ни курсора,
 * ни шрифта CoreThree — у каждого демо свои. Остаётся плашка согласия:
 * это юридический элемент нашего домена, а не украшение.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#content">
        К содержанию
      </a>
      {children}
      <CookieConsent />
      <NavSettle />
    </>
  );
}
