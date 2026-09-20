'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { COPY, GROUPS, MENU, type Dish } from '@/content/concepts/cafe';
import { TG, money, plural } from './shared';
import type { Receipt } from './BotChat';

/**
 * Мини-приложение внутри Telegram: меню, модификаторы, корзина, оплата.
 *
 * Это и есть продукт кафе — сайт вокруг только приводит сюда. Всё
 * состояние настоящее: позиция собирается с модификаторами, цена
 * пересчитывается на месте, корзина переживает переход в чат и обратно.
 *
 * Нижняя кнопка ведёт себя как MainButton в настоящем Telegram: она
 * одна, всегда внизу, и подписана тем, что произойдёт, вместе с суммой.
 * Гость не ищет, куда нажать дальше, — кнопка всегда одна и та же.
 */

export type Line = {
  key: string;
  dishId: string;
  name: string;
  picks: string[];
  unit: number;
  qty: number;
};

type Screen = 'menu' | 'cart' | 'checkout' | 'done';

const sum = (cart: Line[]) => cart.reduce((s, l) => s + l.unit * l.qty, 0);
const count = (cart: Line[]) => cart.reduce((s, l) => s + l.qty, 0);

/** Номер заказа — от времени: два гостя подряд не получат одинаковый. */
const orderNo = () => 100 + (Math.floor(Date.now() / 1000) % 800);

export default function MiniApp({
  cart,
  setCart,
  onClose
}: {
  cart: Line[];
  setCart: (next: Line[]) => void;
  /** Чек уходит обратно в чат: оплатили — придёт, закрыли на полпути — нет. */
  onClose: (receipt: Receipt | null) => void;
}) {
  const [screen, setScreen] = useState<Screen>('menu');
  const [open, setOpen] = useState<Dish | null>(null);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [away, setAway] = useState(true);
  const [when, setWhen] = useState('soon');
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const scroll = useRef<HTMLDivElement>(null);

  // каждый экран открывается сверху, а не там, где остановился прошлый
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [screen]);

  /** Открывая позицию, подставляем первый вариант каждой обязательной группы. */
  const openDish = (d: Dish) => {
    const start: Record<string, string[]> = {};
    (d.groups ?? []).forEach((g) => {
      const group = GROUPS[g];
      if (group?.required) start[g] = [group.choices[0].id];
      else start[g] = [];
    });
    setPicks(start);
    setOpen(d);
  };

  const dishTotal = useMemo(() => {
    if (!open) return 0;
    let v = open.price;
    (open.groups ?? []).forEach((g) => {
      const group = GROUPS[g];
      (picks[g] ?? []).forEach((id) => {
        v += group?.choices.find((c) => c.id === id)?.add ?? 0;
      });
    });
    return v;
  }, [open, picks]);

  const pickLabels = (d: Dish) =>
    (d.groups ?? [])
      .flatMap((g) =>
        (picks[g] ?? []).map((id) => GROUPS[g]?.choices.find((c) => c.id === id)?.label ?? '')
      )
      .filter(Boolean);

  const addToCart = () => {
    if (!open) return;
    const labels = pickLabels(open);
    const key = open.id + '|' + labels.join('|');
    const found = cart.find((l) => l.key === key);
    setCart(
      found
        ? cart.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l))
        : [...cart, { key, dishId: open.id, name: open.name, picks: labels, unit: dishTotal, qty: 1 }]
    );
    setOpen(null);
  };

  const bump = (key: string, by: number) =>
    setCart(
      cart
        .map((l) => (l.key === key ? { ...l, qty: l.qty + by } : l))
        .filter((l) => l.qty > 0)
    );

  /**
   * Чек собирается в момент оплаты, а не при закрытии: корзина после
   * оплаты пустеет, и собирать чек было бы уже не из чего.
   */
  const pay = () => {
    setReceipt({ no: orderNo(), lines: cart, total: sum(cart), away });
    setScreen('done');
  };

  /* ------- нижняя кнопка: одна на все экраны ------- */
  const main: { label: string; onClick: () => void; tone?: 'green' } | null = open
    ? { label: `${COPY.app.add} · ${money(dishTotal)}`, onClick: addToCart }
    : screen === 'menu'
      ? cart.length
        ? { label: `${COPY.app.toCart} · ${money(sum(cart))}`, onClick: () => setScreen('cart') }
        : null
      : screen === 'cart'
        ? cart.length
          ? { label: COPY.app.checkout, onClick: () => setScreen('checkout') }
          : null
        : screen === 'checkout'
          ? { label: `${COPY.app.pay} · ${money(sum(cart))}`, onClick: pay, tone: 'green' }
          : { label: COPY.app.back, onClick: () => onClose(receipt) };

  const back =
    screen === 'cart' ? () => setScreen('menu') : screen === 'checkout' ? () => setScreen('cart') : null;

  return (
    <div className="flex h-full flex-col" style={{ background: TG.bg, color: TG.fg }}>
      {/* ---------- шапка мини-приложения ---------- */}
      <header
        className="flex shrink-0 items-center gap-3 border-b px-3 py-2.5"
        style={{ borderColor: TG.line, background: TG.head }}
      >
        {back ? (
          <button
            type="button"
            onClick={back}
            aria-label="Назад"
            className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-[17px]"
            style={{ color: TG.blue }}
          >
            ‹
          </button>
        ) : (
          <span className="h-8 w-8" />
        )}
        <span className="min-w-0 flex-1 truncate text-center text-[14px] font-medium">
          {screen === 'cart' ? COPY.app.cart : screen === 'checkout' ? COPY.app.checkout : COPY.app.title}
        </span>
        <button
          type="button"
          onClick={() => onClose(receipt)}
          aria-label="Закрыть"
          className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-[13px]"
          style={{ color: TG.dim }}
        >
          ✕
        </button>
      </header>

      {/* ---------- содержимое ---------- */}
      <div ref={scroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {screen === 'menu' && (
          <div className="pb-4">
            {MENU.map((sec) => (
              <section key={sec.id}>
                <h3
                  className="sticky top-0 z-10 m-0 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em]"
                  style={{ background: TG.bg, color: TG.faint }}
                >
                  {sec.label}
                  {sec.note && <span className="ml-2 normal-case tracking-normal">· {sec.note}</span>}
                </h3>
                <ul className="m-0 list-none p-0">
                  {sec.dishes.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => openDish(d)}
                        className="flex w-full items-baseline gap-3 border-0 border-b bg-transparent px-4 py-3 text-left"
                        style={{ borderColor: TG.line, color: TG.fg }}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-[14.5px]">{d.name}</span>
                            {d.tag && (
                              <span
                                className="rounded-full px-1.5 py-px text-[9.5px] uppercase tracking-[0.08em]"
                                style={{ background: 'rgba(76,156,226,0.16)', color: TG.blue }}
                              >
                                {d.tag}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-[11.5px]" style={{ color: TG.faint }}>
                            {d.note}
                          </span>
                        </span>
                        <span className="shrink-0 text-[13.5px] tabular-nums" style={{ color: TG.dim }}>
                          {money(d.price)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {screen === 'cart' && (
          <div className="px-4 py-3">
            {cart.length === 0 ? (
              <p className="m-0 py-10 text-center text-[13px]" style={{ color: TG.faint }}>
                {COPY.app.empty}
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {cart.map((l) => (
                  <li key={l.key} className="flex gap-3 border-b py-3" style={{ borderColor: TG.line }}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px]">{l.name}</span>
                      {l.picks.length > 0 && (
                        <span className="mt-0.5 block text-[11.5px]" style={{ color: TG.faint }}>
                          {l.picks.join(' · ')}
                        </span>
                      )}
                      <span className="mt-1.5 block text-[12.5px] tabular-nums" style={{ color: TG.dim }}>
                        {money(l.unit)} × {l.qty} = {money(l.unit * l.qty)}
                      </span>
                    </span>
                    {/* шаг количества: 30px — минимум, на который попадают пальцем */}
                    <span
                      className="flex h-[30px] shrink-0 items-center gap-1 self-start rounded-full px-1"
                      style={{ background: TG.raise }}
                    >
                      <button
                        type="button"
                        onClick={() => bump(l.key, -1)}
                        aria-label={`Убрать одну позицию: ${l.name}`}
                        className="h-[30px] w-[30px] border-0 bg-transparent text-[15px]"
                        style={{ color: TG.dim }}
                      >
                        −
                      </button>
                      <span className="min-w-[14px] text-center text-[13px] tabular-nums">{l.qty}</span>
                      <button
                        type="button"
                        onClick={() => bump(l.key, 1)}
                        aria-label={`Добавить ещё: ${l.name}`}
                        className="h-[30px] w-[30px] border-0 bg-transparent text-[15px]"
                        style={{ color: TG.blue }}
                      >
                        +
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {screen === 'checkout' && (
          <div className="px-4 py-4">
            <p className="m-0 text-[11px] uppercase tracking-[0.14em]" style={{ color: TG.faint }}>
              {COPY.app.where}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { on: true, label: COPY.app.awayLabel, note: COPY.app.awayNote },
                { on: false, label: COPY.app.hereLabel, note: COPY.app.hereNote }
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setAway(o.on)}
                  aria-pressed={away === o.on}
                  className="rounded-[10px] border p-3 text-left"
                  style={{
                    borderColor: away === o.on ? TG.blue : TG.line,
                    background: away === o.on ? 'rgba(76,156,226,0.12)' : TG.sheet,
                    color: TG.fg
                  }}
                >
                  <span className="block text-[13.5px]">{o.label}</span>
                  <span className="mt-0.5 block text-[11px]" style={{ color: TG.faint }}>
                    {o.note}
                  </span>
                </button>
              ))}
            </div>

            <p className="m-0 mt-5 text-[11px] uppercase tracking-[0.14em]" style={{ color: TG.faint }}>
              {COPY.app.when}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { id: 'soon', label: COPY.app.soon },
                { id: '15', label: 'через 15 мин' },
                { id: '30', label: 'через 30 мин' },
                { id: '60', label: 'через час' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setWhen(t.id)}
                  aria-pressed={when === t.id}
                  className="rounded-full border px-3 py-1.5 text-[12.5px]"
                  style={{
                    borderColor: when === t.id ? TG.blue : TG.line,
                    background: when === t.id ? 'rgba(76,156,226,0.12)' : 'transparent',
                    color: when === t.id ? TG.fg : TG.dim
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="mt-5 block text-[11px] uppercase tracking-[0.14em]" style={{ color: TG.faint }}>
              {COPY.app.comment}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={COPY.app.commentHint}
                className="mt-2 block w-full resize-none rounded-[10px] border px-3 py-2.5 text-[13px] normal-case tracking-normal outline-none"
                style={{ borderColor: TG.line, background: TG.sheet, color: TG.fg }}
              />
            </label>

            <dl className="m-0 mt-5 border-t pt-3" style={{ borderColor: TG.line }}>
              {cart.map((l) => (
                <div key={l.key} className="flex gap-3 py-1 text-[12.5px]">
                  <dt className="min-w-0 flex-1 truncate" style={{ color: TG.dim }}>
                    {l.name}
                    {l.qty > 1 && ` × ${l.qty}`}
                  </dt>
                  <dd className="m-0 shrink-0 tabular-nums">{money(l.unit * l.qty)}</dd>
                </div>
              ))}
              <div className="mt-2 flex gap-3 border-t pt-2.5 text-[14px]" style={{ borderColor: TG.line }}>
                <dt className="flex-1">{COPY.app.total}</dt>
                <dd className="m-0 font-medium tabular-nums">{money(sum(cart))}</dd>
              </div>
            </dl>
          </div>
        )}

        {screen === 'done' && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full text-[26px]"
              style={{ background: 'rgba(79,174,108,0.16)', color: TG.green }}
            >
              ✓
            </span>
            <p className="m-0 mt-4 text-[19px] font-medium">{COPY.app.doneTitle}</p>
            <p className="m-0 mt-1.5 text-[13px]" style={{ color: TG.dim }}>
              {COPY.app.doneText} <b className="font-medium tabular-nums">№{receipt?.no}</b>
            </p>
            <p className="m-0 mt-4 text-[13px]" style={{ color: TG.dim }}>
              {COPY.app.doneWhen}{' '}
              <b className="font-medium" style={{ color: TG.fg }}>
                {when === 'soon' ? '7 минут' : when === '60' ? 'час' : `${when} минут`}
              </b>
            </p>
            <p className="m-0 mt-1 text-[12px]" style={{ color: TG.faint }}>
              {away ? COPY.app.awayNote : COPY.app.hereNote}
              {note.trim() && ` · «${note.trim()}»`}
            </p>
          </div>
        )}
      </div>

      {/* ---------- карточка позиции: лист снизу ---------- */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Закрыть позицию"
            onClick={() => setOpen(null)}
            className="absolute inset-0 z-20 border-0 bg-black/45"
          />
          <div
            className="absolute inset-x-0 bottom-0 z-30 max-h-[82%] overflow-y-auto rounded-t-[14px] border-t motion-safe:animate-[sheet_0.28s_cubic-bezier(0.22,1,0.36,1)]"
            style={{ borderColor: TG.line, background: TG.sheet }}
          >
            <div className="sticky top-0 flex justify-center pb-1 pt-2" style={{ background: TG.sheet }}>
              <span className="block h-1 w-9 rounded-full" style={{ background: TG.line }} />
            </div>
            <div className="px-4 pb-4">
              <h4 className="m-0 text-[17px] font-medium">{open.name}</h4>
              <p className="m-0 mt-1 text-[12.5px]" style={{ color: TG.faint }}>
                {open.note}
              </p>

              {(open.groups ?? []).map((gid) => {
                const g = GROUPS[gid];
                if (!g) return null;
                return (
                  <fieldset key={gid} className="m-0 mt-4 border-0 p-0">
                    <legend className="p-0 text-[11px] uppercase tracking-[0.14em]" style={{ color: TG.faint }}>
                      {g.label}
                      {g.multi && <span className="ml-2 normal-case tracking-normal">можно несколько</span>}
                    </legend>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {g.choices.map((c) => {
                        const on = (picks[gid] ?? []).includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setPicks((p) => ({
                                ...p,
                                [gid]: g.multi
                                  ? on
                                    ? (p[gid] ?? []).filter((x) => x !== c.id)
                                    : [...(p[gid] ?? []), c.id]
                                  : [c.id]
                              }))
                            }
                            className="flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left text-[13.5px]"
                            style={{
                              borderColor: on ? TG.blue : TG.line,
                              background: on ? 'rgba(76,156,226,0.12)' : 'transparent',
                              color: TG.fg
                            }}
                          >
                            <span
                              className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border text-[10px]"
                              style={{
                                borderColor: on ? TG.blue : TG.line,
                                background: on ? TG.blue : 'transparent',
                                color: TG.blueInk
                              }}
                            >
                              {on ? '✓' : ''}
                            </span>
                            <span className="min-w-0 flex-1">{c.label}</span>
                            {c.add ? (
                              <span className="shrink-0 tabular-nums" style={{ color: TG.dim }}>
                                +{money(c.add)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ---------- MainButton ---------- */}
      {main && (
        <div className="relative z-40 shrink-0 p-2 lg:pb-4" style={{ background: TG.bg }}>
          <button
            type="button"
            onClick={main.onClick}
            className="w-full rounded-[10px] border-0 px-4 py-3 text-[14.5px] font-medium"
            style={{ background: main.tone === 'green' ? TG.greenFill : TG.blueFill, color: '#fff' }}
          >
            {main.label}
          </button>
        </div>
      )}

      {/* счётчик корзины в меню: видно, что уже набрано, не открывая корзину */}
      {screen === 'menu' && !open && cart.length > 0 && (
        <span className="sr-only">
          В корзине {count(cart)} {plural(count(cart), 'позиция', 'позиции', 'позиций')}
        </span>
      )}
    </div>
  );
}
