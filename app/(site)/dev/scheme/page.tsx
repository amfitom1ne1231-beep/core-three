import { notFound } from 'next/navigation';
import Journey from '@/components/Journey';

/**
 * Схема «Путь одного заказа» отдельно от главной: проверять кадры
 * и ширины, не листая до неё всю страницу. В собранной версии страницы нет.
 */
export default function DevSchemePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main id="content" className="relative z-10 min-h-screen bg-bg pt-12">
      <Journey />
    </main>
  );
}
