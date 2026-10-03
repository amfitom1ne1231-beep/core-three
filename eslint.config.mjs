import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

/**
 * Линтер — правила Next: хуки React, доступность, производительность
 * страниц. Код и раньше ссылался на них комментариями `eslint-disable`,
 * но самого линтера в проекте не было, и сборка его молча пропускала.
 */
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ['.next/**', '.next-check/**', '.test-out/**', 'node_modules/**', 'proto/**', 'brand/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // `_` в начале имени — «выбрасываю нарочно»: так из объекта вынимается
      // поле, которое надо убрать (`({ [field]: _gone, ...rest }) => rest`)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }]
    }
  }
];

export default config;
