'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import { lockScroll } from '@/lib/scroll';
import { SITE } from '@/content/site';

/**
 * Меню для узких экранов.
 *
 * До этого навигация пряталась на `md` и ничем не заменялась: с телефона
 * «Услуги», «Концепты» и «О нас» из шапки были недостижимы вовсе —
 * оставался только футер. Разделы здесь те же, что в футере, чтобы не
 * заводить третий список ссылок.
 *
 * Панель — настоящий диалог: Escape закрывает, фокус уходит внутрь и
 * возвращается на кнопку, Tab по кругу внутри панели, страница под
 * перекрытием заморожена вместе с Lenis.
 */
export default function MobileMenu({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const panelId = useId();

  useEffect(() => setMounted(true), []);

  // переход по ссылке закрывает меню
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    // шапка прячется при скролле вниз: открывать меню из спрятанной шапки
    // нельзя, иначе панель откроется, а кнопка закрытия уедет за экран
    onOpenChange?.(open);
    lockScroll(open);
    if (!open) return;

    const first = panel.current?.querySelector<HTMLElement>('a, button');
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      // фокус по кругу: за пределы открытой панели уходить некуда
      const items = panel.current.querySelectorAll<HTMLElement>('a, button');
      if (!items.length) return;
      const edge = e.shiftKey ? items[0] : items[items.length - 1];
      if (document.activeElement !== edge) return;
      e.preventDefault();
      (e.shiftKey ? items[items.length - 1] : items[0]).focus();
    };

    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // страховка: если компонент снимут с открытой панелью, скролл не должен остаться заблокированным
  useEffect(() => () => lockScroll(false), []);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  // те же разделы, что в футере: третьему списку ссылок неоткуда взяться
  const links: { label: string; href: string }[] = SITE.footer.columns.flatMap((col) => [...col.links]);

  /**
   * Панель уходит порталом в body, а не остаётся внутри шапки.
   *
   * Шапка прячется по скроллу через GSAP, то есть на ней всегда висит
   * transform, а трансформированный предок отменяет привязку `fixed`
   * к окну: `inset: 0` внутри шапки давал панель 375×136 — ровно рамку
   * самой шапки — вместо полного экрана.
   *
   * z-95: выше контента (10–20) и зерна (90), но ниже шапки (100), поэтому
   * знак и кнопка закрытия остаются поверх панели сами, без подпорок.
   */
  const panelNode = (
    <div
      ref={panel}
      id={panelId}
      aria-hidden={!open}
      /**
       * Класс display решает состояние, а не атрибут `hidden`.
       * `[hidden]` из preflight — селектор по атрибуту, и любой класс
       * с `display` его перебивает: с `flex` в списке панель оставалась
       * на экране всегда, хотя `hidden` был выставлен. Спорить порядком
       * классов тоже нельзя — Tailwind сам решает, что печатать позже.
       */
      className={
        open
          ? 'fixed inset-0 z-[95] flex flex-col justify-between overflow-y-auto bg-bg px-4 pb-10 pt-24 md:hidden'
          : 'hidden'
      }
    >
      <nav>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="block border-b border-line py-4 text-[22px] leading-tight text-fg">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10">
        <Link
          href="/contact"
          className="block border border-fg bg-fg px-[22px] py-[15px] text-center font-mono text-[11px] uppercase tracking-label text-bg"
        >
          {SITE.hero.primary.label}
        </Link>
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-5">
          <span className="rail-label">Тема</span>
          <ThemeToggle />
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <a href={`mailto:${SITE.email}`} className="text-[14px] text-dim">
            {SITE.email}
          </a>
          <a
            href={`https://t.me/${SITE.telegram}`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[14px] text-dim"
          >
            {SITE.telegramLabel}
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Закрыть меню' : 'Меню'}
        className="pointer-events-auto -mr-2 flex h-11 w-11 flex-col items-center justify-center gap-[5px] border-0 bg-transparent md:hidden"
      >
        <span
          className="block h-px w-5 bg-fg transition-transform duration-300"
          style={{ transform: open ? 'translateY(3px) rotate(45deg)' : 'none' }}
        />
        <span
          className="block h-px w-5 bg-fg transition-transform duration-300"
          style={{ transform: open ? 'translateY(-3px) rotate(-45deg)' : 'none' }}
        />
      </button>

      {mounted && createPortal(panelNode, document.body)}
    </>
  );
}
