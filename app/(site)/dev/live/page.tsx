import { notFound } from 'next/navigation';
import LiveGallery from './LiveGallery';

/**
 * Служебная витрина живых вставок: все шесть рядом, в натуральную
 * величину и играющими. Нужна, чтобы править вставку, не листая
 * карусель до неё. В собранной версии её нет.
 */
export default function DevLivePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <LiveGallery />;
}
