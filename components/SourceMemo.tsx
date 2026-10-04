'use client';

import { useEffect } from 'react';
import { rememberSource } from '@/lib/source';

/** Запоминает, откуда человек пришёл, — на первой же странице, а не на странице заявки. */
export default function SourceMemo() {
  useEffect(rememberSource, []);
  return null;
}
