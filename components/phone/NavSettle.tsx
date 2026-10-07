'use client';

import { useEffect } from 'react';
import { settleSoon } from '@/lib/phone';

/**
 * Отпускает переход между экранами (lib/phone) там, где нет оболочки
 * телефона, — в демо концептов. Без этого демо, вырастающее из карточки,
 * ждало бы отведённые 0,7 с: сообщить, что экран нарисован, было некому.
 */
export default function NavSettle() {
  useEffect(() => settleSoon(), []);
  return null;
}
