import Term from './Term';
import { pieces } from '@/content/glossary';

/**
 * Текст, в котором слова из словаря размечены `[[…]]`: размеченное
 * становится кнопкой с объяснением (`Term`), остальное — как было.
 * `plain` — те же слова без кнопок: там, где на странице они уже
 * объяснены выше, или где кнопка была бы внутри другой кнопки.
 */
export default function Words({ text, plain = false }: { text: string; plain?: boolean }) {
  return (
    <>
      {pieces(text).map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : plain ? (
          p.text
        ) : (
          <Term key={i} word={p.word}>
            {p.text}
          </Term>
        )
      )}
    </>
  );
}
