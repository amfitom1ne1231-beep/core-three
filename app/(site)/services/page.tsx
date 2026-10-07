import type { Metadata } from 'next';
import Assembly from '@/components/Assembly';
import Footer from '@/components/Footer';
import PhoneServices from '@/components/phone/PhoneServices';
import ScrollScenes from '@/components/ScrollScenes';
import { pageMeta } from '@/lib/meta';

export const metadata: Metadata = pageMeta({
  title: 'Услуги',
  description:
    'Шесть направлений CoreThree: лендинги, сайты и блоги, интернет-магазины, боты, приложения в Telegram, мониторинг и поддержка. Одна команда и один стек.',
  path: '/services'
});

/**
 * «Услуги» — обзор направлений (MOBILE.md).
 *
 * У вкладки телефона должен быть свой адрес: раньше «Услуги» вели сразу
 * на «Сайты», и четыре страницы направлений не с чего было выбрать.
 * На телефоне здесь шестигранник с карточкой направления; шире 640 px —
 * тот же блок направлений, что стоит главой на главной.
 */
export default function ServicesPage() {
  return (
    <>
      <main id="content" className="relative z-10 w-full">
        <PhoneServices />
        <div className="max-sm:hidden">
          <h1 className="sr-only">Услуги: шесть направлений</h1>
          <Assembly />
        </div>
      </main>
      <div className="max-sm:hidden">
        <Footer />
      </div>
      <ScrollScenes />
    </>
  );
}
