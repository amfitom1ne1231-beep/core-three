'use client';

import { useMemo, useState } from 'react';
import DemoFrame from '../DemoFrame';
import Reveal from '../reveal';
import Cart, { type Line } from './Cart';
import ProductSheet from './ProductSheet';
import Skein from './Skein';
import { display, text } from './fonts';
import { C, DISPLAY, money, plural, stockOf } from './shared';
import { COPY, GROUPS, PRODUCTS, SHOP, type Product } from '@/content/concepts/shop';
import { demoBySlug } from '@/content/concepts';

const META = demoBySlug('shop')!;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: C.accent }}>
      {children}
    </span>
  );
}

/**
 * Демо «Моток» — локальный магазин.
 *
 * Показывается ровно то, что обещает витрина: каталог, карточка
 * с вариантами, корзина, оформление, доставка и самовывоз. Всё
 * работает по-настоящему — остатки уменьшают доступное количество,
 * порог бесплатной доставки считается от суммы, оплата занимает
 * столько же времени, сколько настоящая.
 *
 * Состояние корзины живёт здесь, а не в каждом листе: карточку
 * открывают и закрывают десятки раз, и корзина обязана это пережить.
 */
export default function ShopDemo() {
  const [group, setGroup] = useState<string>('all');
  const [open, setOpen] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  const shown = useMemo(
    () => (group === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.group === group)),
    [group]
  );
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const add = (pid: string, vid: string, qty: number) =>
    setLines((prev) => {
      const at = prev.findIndex((l) => l.pid === pid && l.vid === vid);
      if (at < 0) return [...prev, { pid, vid, qty }];
      const next = [...prev];
      // остаток по цвету — потолок: в корзине не может быть больше, чем в лавке
      const left = PRODUCTS.find((p) => p.id === pid)?.variants.find((v) => v.id === vid)?.left ?? qty;
      next[at] = { ...next[at], qty: Math.min(left, next[at].qty + qty) };
      return next;
    });

  const setQty = (pid: string, vid: string, qty: number) =>
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => !(l.pid === pid && l.vid === vid))
        : prev.map((l) => (l.pid === pid && l.vid === vid ? { ...l, qty } : l))
    );

  return (
    <DemoFrame meta={META}>
      <div
        className={`${display.variable} ${text.variable} min-h-screen`}
        style={{ background: C.paper, color: C.ink, fontFamily: 'var(--shop-text), system-ui, sans-serif' }}
      >
        <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: C.paper }} />

        {/* ---------- шапка ---------- */}
        <header
          className="sticky z-40 border-b backdrop-blur-sm"
          style={{ top: 'var(--demo-bar)', borderColor: C.lineSoft, background: 'rgba(247,248,250,0.9)' }}
        >
          <div className="mx-auto flex max-w-[1180px] items-center gap-6 px-5 py-3.5 sm:px-8">
            <a href="#content" className="flex items-baseline gap-2.5">
              <span className="text-[19px] font-semibold leading-none" style={{ fontFamily: DISPLAY }}>
                {SHOP.name}
              </span>
              <span className="hidden text-[11px] uppercase tracking-[0.16em] sm:inline" style={{ color: C.faint }}>
                {SHOP.city}
              </span>
            </a>

            <nav className="ml-auto hidden items-center gap-7 md:flex">
              {COPY.nav.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="text-[13.5px] transition-colors duration-300"
                  style={{ color: C.muted }}
                >
                  {n.label}
                </a>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="ml-auto flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium transition-opacity duration-300 hover:opacity-90 md:ml-0"
              style={{ background: count ? C.accent : C.ink, color: '#fff' }}
            >
              Корзина
              {count > 0 && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] tabular-nums"
                  style={{ background: 'rgba(255,255,255,0.22)' }}
                >
                  {count}
                </span>
              )}
            </button>
          </div>
        </header>

        <main id="content">
          {/* ---------- первый экран ---------- */}
          <section className="mx-auto max-w-[1180px] px-5 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-20">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:gap-16">
              <Reveal>
                <Label>{COPY.hero.label}</Label>
                <h1
                  className="m-0 mt-5 text-[clamp(34px,5.6vw,68px)] font-semibold leading-[1.02] tracking-[-0.02em]"
                  style={{ fontFamily: DISPLAY }}
                >
                  {COPY.hero.title}{' '}
                  <span style={{ color: C.accent }}>{COPY.hero.titleAccent}</span>
                </h1>
                <p className="m-0 mt-7 max-w-[46ch] text-[clamp(15px,1.25vw,17px)] leading-relaxed" style={{ color: C.muted }}>
                  {COPY.hero.lead}
                </p>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <a
                    href="#catalog"
                    className="rounded-full px-6 py-3.5 text-[14px] font-medium transition-opacity duration-300 hover:opacity-90"
                    style={{ background: C.accent, color: '#fff' }}
                  >
                    {COPY.hero.primary}
                  </a>
                  <a
                    href="#delivery"
                    className="rounded-full border px-6 py-3.5 text-[14px] transition-colors duration-300"
                    style={{ borderColor: C.line, color: C.ink }}
                  >
                    {COPY.hero.secondary}
                  </a>
                </div>

                <ul className="m-0 mt-8 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0 text-[12.5px]" style={{ color: C.faint }}>
                  {COPY.hero.facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </Reveal>

              {/* витрина цветов: то, ради чего в такую лавку и заходят */}
              <Reveal delay={90} className="grid grid-cols-3 gap-3 sm:gap-4">
                {PRODUCTS.filter((p) => p.group !== 'tools')
                  .slice(0, 6)
                  .map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setOpen(p)}
                      className="aspect-square rounded-[14px] p-3 transition-transform duration-300 hover:-translate-y-1"
                      style={{ background: i % 2 ? C.card : C.paperDeep }}
                      aria-label={`${p.name}, ${money(p.price)}`}
                    >
                      <Skein hex={p.variants[0].hex} shape={p.shape} className="h-full w-full" title="" />
                    </button>
                  ))}
              </Reveal>
            </div>
          </section>

          {/* ---------- каталог ---------- */}
          <section id="catalog" className="scroll-mt-24 border-t" style={{ borderColor: C.lineSoft, background: C.paperDeep }}>
            <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 sm:py-20">
              <Reveal>
                <Label>{COPY.catalog.label}</Label>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
                  <h2
                    className="m-0 text-[clamp(26px,3.4vw,42px)] font-semibold leading-[1.06] tracking-[-0.015em]"
                    style={{ fontFamily: DISPLAY }}
                  >
                    {COPY.catalog.title}
                  </h2>
                  <p className="m-0 max-w-[40ch] text-[13.5px]" style={{ color: C.muted }}>
                    {COPY.catalog.lead}
                  </p>
                </div>
              </Reveal>

              {/* фильтр по составу: первое, чем сужают выбор в пряже */}
              <div className="mt-8 flex flex-wrap gap-2">
                {GROUPS.map((g) => {
                  const on = group === g.id;
                  const n = g.id === 'all' ? PRODUCTS.length : PRODUCTS.filter((p) => p.group === g.id).length;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGroup(g.id)}
                      aria-pressed={on}
                      className="flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] transition-colors duration-200"
                      style={{
                        borderColor: on ? C.ink : C.line,
                        background: on ? C.ink : 'transparent',
                        color: on ? C.card : C.ink
                      }}
                    >
                      {g.label}
                      <span className="text-[11px] tabular-nums" style={{ opacity: 0.6 }}>
                        {n}
                      </span>
                    </button>
                  );
                })}
              </div>

              <ul className="m-0 mt-7 grid list-none gap-3 p-0 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                {shown.map((p, i) => {
                  const left = p.variants.reduce((s, v) => s + v.left, 0);
                  const state = stockOf(left);
                  return (
                    <Reveal as="li" key={p.id} delay={(i % 4) * 60}>
                      <button
                        type="button"
                        onClick={() => setOpen(p)}
                        className="group flex h-full w-full flex-col overflow-hidden rounded-[14px] border text-left transition-all duration-300 hover:-translate-y-1"
                        style={{ borderColor: C.line, background: C.card }}
                      >
                        <span className="block p-5" style={{ background: C.paper }}>
                          <Skein hex={p.variants[0].hex} shape={p.shape} className="mx-auto w-full max-w-[150px]" title="" />
                        </span>
                        <span className="flex flex-1 flex-col p-4">
                          <span className="text-[15px] font-medium leading-snug">{p.name}</span>
                          <span className="mt-1 text-[12.5px]" style={{ color: C.muted }}>
                            {p.spec}
                          </span>

                          {/* цвета прямо на карточке: по ним выбирают до открытия */}
                          <span className="mt-3 flex flex-wrap gap-1.5">
                            {p.variants.map((v) => (
                              <span
                                key={v.id}
                                className="block h-4 w-4 rounded-full"
                                style={{
                                  background: v.hex,
                                  boxShadow: `inset 0 0 0 1px ${C.line}`,
                                  opacity: v.left > 0 ? 1 : 0.35
                                }}
                              />
                            ))}
                          </span>

                          <span className="mt-4 flex items-baseline justify-between gap-3">
                            <span className="text-[16px] font-semibold tabular-nums" style={{ fontFamily: DISPLAY }}>
                              {money(p.price)}
                            </span>
                            <span
                              className="text-[12px]"
                              style={{ color: state === 'ok' ? C.faint : state === 'low' ? C.warn : C.muted }}
                            >
                              {state === 'out'
                                ? 'закончилась'
                                : state === 'low'
                                  ? `осталось ${left}`
                                  : `${left} ${plural(left, 'шт', 'шт', 'шт')}`}
                            </span>
                          </span>
                        </span>
                      </button>
                    </Reveal>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* ---------- доставка ---------- */}
          <section id="delivery" className="scroll-mt-24 border-t" style={{ borderColor: C.lineSoft }}>
            <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 sm:py-20">
              <Reveal>
                <Label>{COPY.delivery.label}</Label>
                <h2
                  className="m-0 mt-4 text-[clamp(26px,3.4vw,42px)] font-semibold leading-[1.06] tracking-[-0.015em]"
                  style={{ fontFamily: DISPLAY }}
                >
                  {COPY.delivery.title}
                </h2>
              </Reveal>

              <ul className="m-0 mt-8 grid list-none gap-3 p-0 sm:gap-4 lg:grid-cols-3">
                {COPY.delivery.items.map((d, i) => (
                  <Reveal as="li" key={d.title} delay={i * 70}>
                    <div className="flex h-full flex-col rounded-[14px] border p-5" style={{ borderColor: C.line, background: C.card }}>
                      <span className="text-[15px] font-medium">{d.title}</span>
                      <p className="m-0 mt-2.5 flex-1 text-[13.5px] leading-relaxed" style={{ color: C.muted }}>
                        {d.text}
                      </p>
                      <span className="mt-4 text-[13px] font-medium" style={{ color: C.accent }}>
                        {d.price}
                      </span>
                    </div>
                  </Reveal>
                ))}
              </ul>
            </div>
          </section>

          {/* ---------- о лавке ---------- */}
          <section id="about" className="scroll-mt-24 border-t" style={{ borderColor: C.lineSoft, background: C.paperDeep }}>
            <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_minmax(0,0.9fr)] lg:gap-16">
              <Reveal>
                <Label>{COPY.about.label}</Label>
                <h2
                  className="m-0 mt-4 text-[clamp(26px,3.4vw,42px)] font-semibold leading-[1.06] tracking-[-0.015em]"
                  style={{ fontFamily: DISPLAY }}
                >
                  {COPY.about.title}
                </h2>
                <p className="m-0 mt-5 max-w-[52ch] text-[15px] leading-relaxed" style={{ color: C.muted }}>
                  {COPY.about.text}
                </p>
              </Reveal>

              <Reveal delay={80} className="grid content-start gap-px" style={{ background: C.line }}>
                {COPY.about.stats.map((s) => (
                  <div key={s.text} className="flex items-baseline gap-4 p-5" style={{ background: C.paperDeep }}>
                    <span className="text-[26px] font-semibold leading-none tabular-nums" style={{ fontFamily: DISPLAY }}>
                      {s.value}
                    </span>
                    <span className="text-[13.5px]" style={{ color: C.muted }}>
                      {s.text}
                    </span>
                  </div>
                ))}
              </Reveal>
            </div>
          </section>
        </main>

        {/* ---------- подвал ---------- */}
        <footer className="border-t" style={{ borderColor: C.lineSoft }}>
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] sm:px-8" style={{ color: C.faint }}>
            <span style={{ fontFamily: DISPLAY, color: C.ink }}>{SHOP.name}</span>
            <span>
              {SHOP.city}, {SHOP.address} · {SHOP.hours}
            </span>
            <span>{SHOP.phone}</span>
          </div>
        </footer>

        {/* Листы живут внутри обёртки, а не рядом с ней: снаружи они
            не наследуют ни цвет чернил, ни шрифты магазина — и текст
            уходит белым по белому, а гарнитура подменяется нашей. */}
        {open && <ProductSheet product={open} onClose={() => setOpen(null)} onAdd={add} />}
        {cartOpen && (
          <Cart
            lines={lines}
            onQty={setQty}
            onClose={() => setCartOpen(false)}
            onDone={() => {
              setLines([]);
              setCartOpen(false);
            }}
          />
        )}
      </div>
    </DemoFrame>
  );
}
