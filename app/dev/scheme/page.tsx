import { notFound } from 'next/navigation';
import SchemeProbe from '@/components/scheme/SchemeProbe';

/**
 * Проба схемы из Blender: кусок плиты с двумя станциями. Нужна, чтобы
 * посмотреть материал, форму модулей и ток до того, как собирать всю
 * схему и ставить её на главную. В собранной версии её нет.
 */
export default function DevSchemePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main id="content" className="relative z-10 min-h-screen bg-bg px-4 pb-24 pt-28 sm:px-8 lg:px-[72px]">
      <span className="rail-label">Проба · схема из Blender</span>
      <h1 className="display m-0 mt-4 text-[clamp(28px,4vw,56px)]">
        Путь одного заказа <span className="title-accent">— проба</span>
      </h1>
      <p className="m-0 mt-4 max-w-[60ch] text-[15px] leading-relaxed text-dim">
        Плита, «Сайт» и «Каталог», канал между ними. Заказ заходит с края, едет по пазу, станция загорается.
        Наведите курсор — показ встанет; нажмите на модуль — он станет активным. Тема — в шапке.
      </p>
      <div className="mx-auto mt-10 max-w-[1100px]">
        <SchemeProbe />
      </div>
    </main>
  );
}
