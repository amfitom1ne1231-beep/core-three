/**
 * Запуск экскурсии из любого места сайта — пульт, мобильное меню,
 * «Помощь», предложение на первом визите — одним событием: сама
 * экскурсия живёт в хроме сайта (`components/tour/Tour.tsx`).
 * Обзор всего сайта — это экскурсия главной: туда ведёт `/?tour`.
 */
export const TOUR_EVENT = 'ct-tour';
export const TOUR_HOME = '/?tour';

export function askTour() {
  dispatchEvent(new Event(TOUR_EVENT));
}

/** Идёт ли экскурсия — чтобы предложение и другие всплывающие не лезли поверх. */
export const tourRunning = () => document.documentElement.dataset.tour === 'on';
