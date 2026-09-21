'use client';

import { useEffect, useRef, useState } from 'react';
import Skein from './Skein';
import { C, DISPLAY, money, plural, stockOf } from './shared';
import type { Product } from '@/content/concepts/shop';

/**
 * Карточка товара.
 *
 * Открывается листом поверх каталога, а не отдельной страницей: в
 * маленькой рознице человек перебирает цвета, и каждый возврат к списку
 * через историю браузера стоит ему места в каталоге.
 *
 * Остаток показывается по каждому цвету отдельно и честно: «мало» — это
 * три мотка и меньше, то есть на свитер уже не хватит. Цвет, которого
 * нет, остаётся видимым, но не кладётся в корзину — в жизни он тоже
 * никуда не исчезает, он просто кончился.
 */
export default function ProductSheet({
  product,
  onClose,
  onAdd
}: {
  product: Product;
  onClose: () => void;
  onAdd: (pid: string, vid: string, qty: number) => void;
}) {
  const first = product.variants.find((v) => v.left > 0) ?? product.variants[0];
  const [vid, setVid] = useState(first.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const v = product.variants.find((x) => x.id === vid) ?? first;
  const max = Math.max(1, v.left);
  const out = v.left <= 0;

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  // смена цвета не должна оставлять количество больше остатка
  useEffect(() => {
    setQty((q) => Math.min(q, Math.max(1, v.left)));
    setAdded(false);
  }, [vid, v.left]);

  const step = (d: number) => setQty((q) => Math.max(1, Math.min(max, q + d)));

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={product.name}>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 cursor-default border-0 p-0"
        style={{ background: 'rgba(22,24,29,0.42)', backdropFilter: 'blur(2px)' }}
      />

      <div
        ref={panel}
        tabIndex={-1}
        className="relative max-h-[92vh] w-full max-w-[880px] overflow-y-auto outline-none sm:rounded-[18px]"
        style={{ background: C.card, animation: 'sheet .32s cubic-bezier(0.22,1,0.36,1) both' }}
      >
        <div className="grid gap-0 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* ---------- товар ---------- */}
          <div className="flex items-center justify-center p-8 sm:p-10" style={{ background: C.paperDeep }}>
            <Skein hex={v.hex} shape={product.shape} title={`${product.name}, ${v.name}`} className="w-full max-w-[240px]" />
          </div>

          {/* ---------- выбор ---------- */}
          <div className="p-6 sm:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-[clamp(22px,3vw,30px)] font-semibold leading-tight" style={{ fontFamily: DISPLAY }}>
                  {product.name}
                </h2>
                <p className="m-0 mt-2 text-[13.5px]" style={{ color: C.muted }}>
                  {product.spec}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors duration-200"
                style={{ borderColor: C.line, color: C.muted }}
              >
                Закрыть
              </button>
            </div>

            {/* цвета с остатком: по ним и выбирают */}
            <p className="m-0 mt-7 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: C.faint }}>
              {product.group === 'tools' ? 'Размер' : 'Цвет'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.variants.map((x) => {
                const on = x.id === vid;
                const s = stockOf(x.left);
                return (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setVid(x.id)}
                    aria-pressed={on}
                    className="flex items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-3.5 text-[13px] transition-all duration-200"
                    style={{
                      borderColor: on ? C.ink : C.line,
                      background: on ? C.ink : 'transparent',
                      color: on ? C.card : s === 'out' ? C.faint : C.ink,
                      opacity: s === 'out' ? 0.65 : 1
                    }}
                  >
                    <span
                      className="block h-5 w-5 rounded-full"
                      style={{ background: x.hex, boxShadow: `inset 0 0 0 1px ${C.line}` }}
                    />
                    {x.name}
                    {s === 'out' && <span className="text-[11px]">нет</span>}
                    {s === 'low' && (
                      <span className="text-[11px]" style={{ color: on ? '#e9c9a2' : C.warn }}>
                        {x.left}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* характеристики, по которым считают расход */}
            <dl className="m-0 mt-7 grid grid-cols-2 gap-x-6 gap-y-3 text-[13.5px]">
              {product.meters && (
                <div className="flex justify-between border-b pb-2.5" style={{ borderColor: C.lineSoft }}>
                  <dt style={{ color: C.muted }}>Метраж</dt>
                  <dd className="m-0">{product.meters} м</dd>
                </div>
              )}
              {product.grams && (
                <div className="flex justify-between border-b pb-2.5" style={{ borderColor: C.lineSoft }}>
                  <dt style={{ color: C.muted }}>Моток</dt>
                  <dd className="m-0">{product.grams} г</dd>
                </div>
              )}
              {product.needles && (
                <div className="flex justify-between border-b pb-2.5" style={{ borderColor: C.lineSoft }}>
                  <dt style={{ color: C.muted }}>Спицы</dt>
                  <dd className="m-0">{product.needles}</dd>
                </div>
              )}
              <div className="flex justify-between border-b pb-2.5" style={{ borderColor: C.lineSoft }}>
                <dt style={{ color: C.muted }}>В наличии</dt>
                <dd className="m-0" style={{ color: out ? C.warn : C.ink }}>
                  {out ? 'нет' : `${v.left} ${plural(v.left, 'шт', 'шт', 'шт')}`}
                </dd>
              </div>
            </dl>

            {/* Вопрос, который задают всегда. Ответ одной кнопкой —
                это и есть разница между каталогом и продавцом. */}
            {product.perSweater ? (
              <div
                className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[12px] p-4"
                style={{ background: C.paperDeep }}
              >
                <p className="m-0 text-[13px]" style={{ color: C.muted }}>
                  На свитер 46-го размера — {product.perSweater} {plural(product.perSweater, 'моток', 'мотка', 'мотков')}
                </p>
                <button
                  type="button"
                  onClick={() => setQty(Math.min(max, product.perSweater!))}
                  disabled={out}
                  className="rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors duration-200 disabled:opacity-40"
                  style={{ borderColor: C.line, color: C.accent }}
                >
                  Взять {Math.min(max, product.perSweater)}
                </button>
              </div>
            ) : null}

            {product.note && (
              <p className="m-0 mt-5 text-[13px] leading-relaxed" style={{ color: C.faint }}>
                {product.note}
              </p>
            )}

            {/* ---------- количество и корзина ---------- */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="flex items-center rounded-full border" style={{ borderColor: C.line }}>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={qty <= 1 || out}
                  aria-label="Меньше"
                  className="px-4 py-2.5 text-[16px] leading-none disabled:opacity-30"
                >
                  −
                </button>
                <span className="min-w-[2.5ch] text-center text-[15px] tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={qty >= max || out}
                  aria-label="Больше"
                  className="px-4 py-2.5 text-[16px] leading-none disabled:opacity-30"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={out}
                onClick={() => {
                  onAdd(product.id, v.id, qty);
                  setAdded(true);
                }}
                className="flex-1 rounded-full px-6 py-3.5 text-[14.5px] font-medium transition-opacity duration-200 disabled:opacity-40"
                style={{ background: out ? C.faint : C.accent, color: '#fff' }}
              >
                {out ? 'Этого цвета нет' : added ? 'Добавлено ✓' : `В корзину · ${money(product.price * qty)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
