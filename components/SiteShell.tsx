import CookieConsent from './CookieConsent';
import SiteChrome from './SiteChrome';
import { onest, SITE_FONT } from './siteFont';

/**
 * Оболочка страниц сайта: шрифт, хрома, плашка согласия.
 *
 * Демо концептов в неё не входят — они в своей группе роутов со своими
 * шрифтами, и шрифт сайта туда больше не грузится. Страница 404 лежит
 * в корне, вне групп, поэтому оборачивается сама.
 *
 * `display: contents` — у обёртки нет своей коробки: фиксированная
 * хрома и материал раскладываются как раньше, а переменная шрифта
 * и сам шрифт наследуются по дереву как обычно.
 */
export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${onest.variable} contents`} style={{ fontFamily: SITE_FONT }}>
      <a className="skip-link" href="#content">
        К содержанию
      </a>
      <SiteChrome />
      {children}
      <CookieConsent />
    </div>
  );
}
