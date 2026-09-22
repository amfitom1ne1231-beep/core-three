'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Cta from './Cta';
import ThemeToggle from './ThemeToggle';
import { contactHref } from '@/lib/lead';
import { lockScroll } from '@/lib/scroll';
import { DEMOS } from '@/content/concepts';
import { SITE } from '@/content/site';

/**
 * Меню для узких экранов.
 *
 * До этого навигация пряталась на `md` и ничем не заменялась: с телефона
 * «Услуги», «Концепты» и «О нас» из шапки были недостижимы вовсе.
 * Первый заход закрыл дыру плоским списком из семи ссылок, где
 * «Политика» стояла ровно с тем же весом, что «Магазины».
 *
 * Здесь меню стало навигацией: разделы сгруппированы как в футере,
 * текущий подсвечен и объявлен читалке, а собранные демо вынесены
 * отдельной сеткой — на телефоне это самый короткий путь к тому,
 * ради чего на сайт и приходят.
 *
 * Панель — настоящий диалог: `role="dialog"`, Escape закрывает, фокус
 * уходит внутрь и возвращается на кнопку, Tab ходит по кругу, страница
 * под перекрытием заморожена вместе с Lenis.
 */
export default function MobileMenu({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname() ?? '';
  const panelId = useId();

  useEffect(() => setMounted(true), []);

  /**
   * Закрытие мгновенное и без анимации ухода.
   *
   * Уход стоил бы второго состояния и таймера, а любой таймер между
   * «закрыл» и «снял замок» — это шанс остаться с замороженной
   * страницей. Меню, исчезающее сразу, читается нормально; меню,
   * которое не отпустило страницу, — нет.
   */
  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  }, []);

  // переход по ссылке закрывает меню; фокус при этом уводить некуда —
  // страница уже другая
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    onOpenChange?.(open);
    lockScroll(open);
    if (!open) return;

    const first = panel.current?.querySelector<HTMLElement>('a, button');
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
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

    /**
     * Поворот телефона в ландшафт переваливал ширину за 768, панель
     * пряталась по `md:hidden` — а замок на скролле оставался висеть,
     * и страница застывала навсегда без единого способа её отпустить.
     */
    const wide = matchMedia('(min-width: 768px)');
    const onWide = () => wide.matches && close(false);

    addEventListener('keydown', onKey);
    wide.addEventListener('change', onWide);
    return () => {
      removeEventListener('keydown', onKey);
      wide.removeEventListener('change', onWide);
    };
  }, [open, onOpenChange, close]);

  // страховка: если компонент снимут с открытой панелью, скролл не должен остаться заблокированным
  useEffect(() => () => lockScroll(false), []);

  const here = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  /** Те же группы, что в футере: третьему списку ссылок неоткуда взяться. */
  const groups = SITE.footer.columns;

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
      role="dialog"
      aria-modal="true"
      aria-label="Меню"
      /**
       * Класс display решает состояние, а не атрибут `hidden`.
       * `[hidden]` из preflight — селектор по атрибуту, и любой класс
       * с `display` его перебивает: с `flex` в списке панель оставалась
       * на экране всегда, хотя `hidden` был выставлен. Спорить порядком
       * классов тоже нельзя — Tailwind сам решает, что печатать позже.
       */
      className={
        open
          ? 'fixed inset-0 z-[95] flex flex-col overflow-y-auto bg-bg px-4 pb-10 pt-24 md:hidden'
          : 'hidden'
      }
      style={{ animation: 'ct-veil .2s ease both' }}
    >
      {/* Полоса под шапкой. Панель прокручивается целиком, и без неё
          ссылки проезжали прямо под знаком и крестиком — буквы читались
          сквозь шапку. `fixed` внутри панели цепляется за окно: панель
          лежит порталом в body, трансформированных предков над ней нет.
          z-1 держит полосу над содержимым панели и под шапкой (100). */}
      <span
        className="pointer-events-none fixed inset-x-0 top-0 z-[1] h-24"
        style={{
          background:
            'linear-gradient(180deg, var(--bg) 0%, var(--bg) 72%, rgb(var(--bg-rgb) / 0) 100%)'
        }}
        aria-hidden
      />

      <nav className="relative flex-1">
        {groups.map((col, gi) => (
          <div key={col.label} className={gi ? 'mt-9' : undefined}>
            <span className="rail-label">{col.label}</span>
            <ul className="m-0 mt-3 flex list-none flex-col p-0">
              {col.links.map((l, i) => {
                const on = here(l.href);
                return (
                  <li
                    key={l.href}
                    style={{ animation: `ct-rise .35s cubic-bezier(0.22,1,0.36,1) ${60 + (gi * 4 + i) * 35}ms both` }}
                  >
                    <Link
                      href={l.href}
                      onClick={() => close(false)}
                      aria-current={on ? 'page' : undefined}
                      className={`flex items-center gap-3 border-b border-line py-4 text-[21px] leading-tight transition-colors duration-200 ${
                        on ? 'text-accent' : 'text-fg'
                      }`}
                    >
                      {/* штрих у текущего раздела: состояние видно без цвета */}
                      <span
                        className="h-px w-4 shrink-0 bg-accent transition-all duration-200"
                        style={{ opacity: on ? 1 : 0, width: on ? 16 : 0 }}
                        aria-hidden
                      />
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Собранные демо — самый короткий путь к тому, ради чего сюда
            приходят. На телефоне до них было три касания: меню, концепты,
            карточка. Стало одно. */}
        <div className="mt-9">
          <span className="rail-label">Живые демо</span>
          <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-2 p-0">
            {DEMOS.map((d, i) => (
              <li
                key={d.slug}
                style={{ animation: `ct-rise .35s cubic-bezier(0.22,1,0.36,1) ${300 + i * 35}ms both` }}
              >
                <Link
                  href={`/concepts/${d.slug}`}
                  onClick={() => close(false)}
                  className="flex h-full flex-col justify-between gap-2 border border-line bg-elev p-3 text-fg"
                >
                  <span className="rail-label">{d.niche}</span>
                  <span className="text-[14.5px] leading-snug">{d.client}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div
        className="mt-10"
        style={{ animation: 'ct-veil .3s ease 440ms both' }}
      >
        {/* тип проекта подставляется разделом, из которого открыли меню */}
        <Cta href={contactHref(pathname)} onClick={() => close(false)} className="w-full justify-between">
          {SITE.hero.primary.label}
        </Cta>

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
