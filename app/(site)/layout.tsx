import SiteShell from '@/components/SiteShell';

/** Страницы сайта — всё, кроме демо концептов. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
