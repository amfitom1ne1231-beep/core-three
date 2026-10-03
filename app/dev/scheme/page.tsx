import { notFound } from 'next/navigation';
import SchemePreview from './SchemePreview';

/**
 * Схема из Blender целиком — до того, как она встанет на главную вместо
 * карточек «Пути одного заказа». В собранной версии страницы нет.
 */
export default function DevSchemePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main id="content" className="relative z-10 min-h-screen bg-bg pb-24 pt-28">
      <div className="px-4 sm:px-8 lg:px-[72px]">
        <span className="rail-label">Проба · схема из Blender</span>
        <h1 className="display m-0 mt-4 text-[clamp(28px,4vw,56px)]">
          Путь одного заказа <span className="title-accent">— от поиска до денег.</span>
        </h1>
      </div>
      <SchemePreview />
    </main>
  );
}
