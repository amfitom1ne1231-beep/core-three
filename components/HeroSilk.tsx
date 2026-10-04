'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { markSilkReady } from '@/lib/boot';
import { createSilk, SILK_DEFAULTS, type SilkParams } from '@/lib/silk';
import { onThemeChange, readTheme } from '@/lib/theme';

type Num = 'exposure' | 'warp' | 'sheen' | 'glint' | 'fresnel' | 'core1' | 'core2' | 'core3' | 'vignette' | 'edge';
type Chapter = Partial<Pick<SilkParams, Num>> & { veil: number; accent?: string };

const KEYS: Num[] = ['exposure', 'warp', 'sheen', 'glint', 'fresnel', 'core1', 'core2', 'core3', 'vignette', 'edge'];

/**
 * Главы материала. Одна и та же поверхность живёт под всей страницей
 * и меняет настроение: на первом экране она ярче всего, в манифесте
 * успокаивается, под схемой уходит в глубину и холод, за каруселью
 * приглушается, чтобы не спорить с кадрами, в концептах свет смещается
 * к третьему ядру, а в финале возвращается и вспыхивает всеми тремя.
 *
 * veil — плотность затемнителя поверх материала: читаемость держится
 * им, а не непрозрачным фоном секций, поэтому стыков между секциями нет.
 */
const CHAPTERS: Record<string, Chapter> = {
  hero: { veil: 0 },
  manifesto: { exposure: 0.9, sheen: 0.85, glint: 0.4, core1: 0.75, core2: 1, core3: 0.55, veil: 0 },
  /**
   * Схема — единственная глава на плоском фоне.
   *
   * Это прибор, а не кадр: под ним материал спорит с тонкими штрихами,
   * подписями в девять пунктов и бегущими пакетами. Завеса выведена
   * в единицу — материал уходит целиком, остаётся чистый `--bg`, как
   * у DAQ под их схемой. Переход к соседним главам всё равно плавный:
   * завеса смешивается по доле экрана, а не переключается.
   */
  anatomy: {
    exposure: 0.8,
    warp: 0.96,
    sheen: 0.78,
    glint: 0.32,
    core1: 0.5,
    core2: 0.8,
    core3: 0.95,
    vignette: 1.15,
    accent: '#4b6d96',
    veil: 1
  },
  atlas: { exposure: 0.72, warp: 1.14, sheen: 0.7, glint: 0.28, core1: 0.95, core2: 0.45, core3: 0.6, vignette: 1.2, veil: 0.44 },
  concepts: { exposure: 0.82, sheen: 0.85, glint: 0.4, core1: 0.45, core2: 0.6, core3: 1.05, veil: 0.36 },
  finale: {
    exposure: 1.12,
    warp: 1.16,
    sheen: 1.1,
    glint: 0.72,
    fresnel: 1,
    core1: 1.1,
    core2: 1.05,
    core3: 1,
    vignette: 0.95,
    edge: 1,
    veil: 0.12
  },
  contact: { exposure: 1, sheen: 1, glint: 0.6, core1: 1, core2: 0.9, core3: 0.8, veil: 0.3 }
};

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

export default function HeroSilk({ params }: { params?: Partial<SilkParams> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const reblend = useRef<(() => void) | null>(null);
  const pathname = usePathname();

  // Материал один на весь сайт и переходы между страницами переживает:
  // главы на новой странице другие — смесь пересчитывается под них
  useEffect(() => {
    reblend.current?.();
  }, [pathname]);

  useEffect(() => {
    if (!ref.current) return;
    const silk = createSilk(ref.current, {
      params,
      mode: readTheme() === 'light' ? 1 : 0,
      onFirstFrame: markSilkReady,
      ignoreVisibility: new URLSearchParams(location.search).has('silkdebug')
    });

    const base = { ...SILK_DEFAULTS, ...params };
    const full = (c: Chapter) => {
      const out: Record<string, number> = {};
      KEYS.forEach((k) => (out[k] = c[k] ?? base[k]));
      return out;
    };

    // Смесь глав по доле экрана, которую занимает каждая: переход идёт
    // ровно со скроллом, без порогов и рывков.
    let raf = 0;
    const blend = () => {
      raf = 0;
      const vh = innerHeight;
      const acc: Record<string, number> = {};
      KEYS.forEach((k) => (acc[k] = 0));
      const accent = [0, 0, 0];
      let v = 0;
      let total = 0;
      document.querySelectorAll<HTMLElement>('[data-chapter]').forEach((el) => {
        const c = CHAPTERS[el.dataset.chapter ?? ''];
        if (!c) return;
        const r = el.getBoundingClientRect();
        const w = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / vh;
        if (w <= 0) return;
        total += w;
        const f = full(c);
        KEYS.forEach((k) => (acc[k] += f[k] * w));
        rgb(c.accent ?? base.accent).forEach((x, i) => (accent[i] += x * w));
        v += c.veil * w;
      });
      if (total <= 0) return;
      const patch: Partial<SilkParams> = { accent: hex(accent.map((x) => x / total)) };
      KEYS.forEach((k) => ((patch as Record<string, number>)[k] = acc[k] / total));

      // Вспышка на переходе с первого экрана: когда камера проходит сквозь
      // знак, материал на мгновение ловит свет — блик и все три ядра.
      const hero = document.querySelector<HTMLElement>('[data-chapter="hero"]');
      if (hero) {
        const r = hero.getBoundingClientRect();
        const p = -r.top / Math.max(r.height, 1);
        // пик совпадает со вспышкой знака (0.72 хода первого экрана)
        const flash = Math.exp(-(((p - 0.72) / 0.13) ** 2));
        if (flash > 0.01) {
          patch.exposure = (patch.exposure ?? base.exposure) + 0.4 * flash;
          patch.glint = (patch.glint ?? base.glint) + 0.6 * flash;
          patch.sheen = (patch.sheen ?? base.sheen) + 0.35 * flash;
          patch.core2 = (patch.core2 ?? base.core2) + 0.4 * flash;
          patch.core3 = (patch.core3 ?? base.core3) + 0.5 * flash;
        }
      }
      silk.setParams(patch);
      const cover = v / total;
      if (veil.current) veil.current.style.opacity = cover.toFixed(3);
      // Под схемой завеса глухая, а шейдер рисовал полный экран каждый
      // кадр — для никого. Стоит, пока материал не видно совсем.
      silk.setPaused(cover > 0.995);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(blend);
    };
    blend();
    reblend.current = schedule;
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule, { passive: true });

    /**
     * Материал живёт в WebGL, и CSS-токены до него не достают: палитру
     * ему надо передать отдельно. Переход внутри шейдера плавный —
     * `setTheme` двигает `uMode` к цели, а не переключает его. Рождается
     * материал сразу в текущей теме (см. `mode` выше).
     */
    const offTheme = onThemeChange((t, instant) => silk.setTheme(t === 'light' ? 1 : 0, instant));

    return () => {
      reblend.current = null;
      cancelAnimationFrame(raf);
      offTheme();
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
      silk.destroy();
    };
    // params задаются на этапе сборки, менять их в рантайме не планируется
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <canvas
        ref={ref}
        data-silk
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 block h-full w-full bg-bg"
      />
      {/* затемнитель над материалом: плотность задаёт глава, а не секция */}
      <div ref={veil} aria-hidden className="pointer-events-none fixed inset-0 z-[1] bg-bg" style={{ opacity: 0 }} />
    </>
  );
}
