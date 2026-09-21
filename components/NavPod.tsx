'use client';

import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import MarkColor from './MarkColor';
import ThemeToggle from './ThemeToggle';
import { LIVE_H, LIVE_W, type LiveProps } from './live/kit';
import LiveBot from './live/LiveBot';
import LiveLanding from './live/LiveLanding';
import LiveOps from './live/LiveOps';
import LiveShop from './live/LiveShop';
import { isHeaderHidden, onHeaderToggle } from '@/lib/chrome';
import { contactHref } from '@/lib/lead';
import { scrollToEl, scrollToY } from '@/lib/scroll';
import { SITE } from '@/content/site';

/**
 * Пульт навигации.
 *
 * Знак из шапки, уехав вверх вместе с ней, возвращается сюда: ниже первого
 * экрана он становится плавающим пультом, а при полном возврате наверх
 * отдаёт себя обратно шапке. Раскрывается в компактный путеводитель.
 *
 * Место у пульта одно — левый нижний угол. Он там и остаётся: прыгающий
 * по экрану элемент сам по себе отвлекает сильнее, чем помогает, а угол
 * у сетки сайта всё равно свободен — боковое поле секций 72px, и пульт
 * в него укладывается. Вместо перелётов — тихое покачивание.
 *
 * Открывается не только наведением: наведение — приятный, но не
 * единственный путь, на тачскрине его нет вовсе, поэтому клик и клавиатура
 * работают наравне. Одним попаданием фокуса панель больше не
 * раскрывается: это мешало и табу мимо пульта, и возврату фокуса на знак
 * после Escape — знак тут же открывал её заново.
 *
 * Пульт живёт от `lg`, а не от `md`. Его посадка держится на боковом поле
 * секций в 72px — а оно появляется ровно на 1024. На планшете поле 16–32,
 * и пульт вставал прямо на строки списка: проверено на 768, он накрывал
 * собой пункт «Аналитика с первого дня». Терять там нечего — с `md`
 * в шапке уже стоит полная навигация, а телефону отвечает меню.
 *
 * Пульт отвечает на три вопроса, а не на один.
 *
 * Долго он умел только «куда уйти»: список разделов и кнопка «наверх».
 * Меню на телефоне к этому моменту научилось больше — показывало, где
 * человек сейчас, и держало рядом быстрые действия с темой. Здесь то же
 * самое, но в языке прибора:
 *
 * - **где я в целом** — кольцо по кромке знака: доля прокрученной
 *   страницы видна, не открывая панель;
 * - **где я на странице** — список мест страницы, текущее отмечено
 *   штрихом; места пульт берёт из самих секций, а не из списка рядом
 *   с собой: список разошёлся бы со страницей на первой же правке;
 * - **что можно сделать прямо сейчас** — заявка с типом того раздела,
 *   откуда её открыли, прямой Telegram, возврат наверх и тема.
 */

/**
 * Размер пульта и отступ от края подобраны под сетку сайта: у секций
 * боковое поле 72px, и 56 + 24 укладываются в него, не наезжая на текст.
 */
const SIZE = 56;
const EDGE = 24;
/** Ниже этой доли экрана знак уходит из шапки в пульт. */
const HANDOFF = 0.75;
/** Ширина живого экрана в панели и его высота по пропорции вставки. */
const SCREEN_W = 252;
const SCREEN_H = Math.round((SCREEN_W / LIVE_W) * LIVE_H);
/**
 * Где проходит линия «вы здесь»: верхняя треть экрана. По центру место
 * переключалось бы, когда предыдущее ещё занимает пол-экрана, а по самой
 * кромке — от каждого мелкого движения.
 */
const HERE = 0.35;

/**
 * Строки путеводителя. У направлений есть живой экран — та же вставка,
 * что играет в карусели на главной; у служебных разделов его нет, и они
 * уходят в компактную строку внизу.
 */
const ROUTES: { href: string; label: string; n: string; live: ComponentType<LiveProps> }[] = [
  { href: '/sites', label: 'Сайты и лендинги', n: '01', live: LiveLanding },
  { href: '/ecommerce', label: 'Интернет-магазины', n: '03', live: LiveShop },
  { href: '/bots', label: 'Боты и Telegram Web App', n: '04', live: LiveBot },
  { href: '/monitoring', label: 'Мониторинг и поддержка', n: '06', live: LiveOps }
];

const EXTRA = [
  { href: '/concepts', label: 'Концепты' },
  { href: '/about', label: 'О нас' },
  { href: '/privacy', label: 'Политика' }
];

/** Имена страниц для строки состояния: те же слова, что в меню и футере. */
const PAGE_NAME: Record<string, string> = {
  '/': 'Главная',
  '/contact': 'Заявка',
  '/consent': 'Cookie',
  ...Object.fromEntries([...ROUTES, ...EXTRA].map((r) => [r.href, r.label]))
};

/** Знак повёрнут на 120° — силуэт тот же: полный оборот незаметно бесшовен. */
const TURN = 120;

export default function NavPod() {
  const pod = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  // свой идентификатор для градиентов знака: на странице он не один
  // (шапка, футер), а в SVG одинаковые id забирают заливки друг у друга
  const markId = useId();
  const pathname = usePathname();

  const [live, setLive] = useState(false);
  const [open, setOpen] = useState(false);
  /** Какое направление показывает живой экран панели. */
  const [active, setActive] = useState(0);
  /** Места текущей страницы и то из них, где человек сейчас. */
  const [places, setPlaces] = useState<string[]>([]);
  const [at, setAt] = useState(0);
  /** Пульт закрывает собой то, что сейчас в фокусе. */
  const [covers, setCovers] = useState(false);
  /** Хватает ли ширины для пульта. */
  const [wide, setWide] = useState(false);

  const liveRef = useRef(false);
  liveRef.current = live;

  const spin = useRef<HTMLSpanElement>(null);
  const float = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const placeEls = useRef<HTMLElement[]>([]);
  const tops = useRef<number[]>([]);
  const atRef = useRef(0);

  // закрываем при переходе — панель не должна пережить страницу
  useEffect(() => setOpen(false), [pathname]);

  /**
   * Ширина слушается, а не спрашивается один раз.
   *
   * Настройка пульта стояла в эффекте без зависимостей и выходила на
   * первой же проверке ширины: окно, растянутое с половины экрана на
   * полный, оставляло пульт мёртвым до перезагрузки. С порогом 768 это
   * почти не встречалось, с 1024 — обычное дело.
   */
  useEffect(() => {
    const mq = matchMedia('(min-width: 1024px)');
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /* ---------------- места страницы ---------------- */

  /**
   * Верхние кромки мест считаются заранее и лежат числами.
   *
   * Иначе прокрутка опрашивала бы геометрию на каждом кадре: шесть
   * `getBoundingClientRect()` в обработчике скролла — это шесть
   * принудительных пересчётов вёрстки там, где и без них тесно.
   */
  const measure = useCallback(() => {
    tops.current = placeEls.current.map((el) => el.getBoundingClientRect().top + scrollY);
  }, []);

  useEffect(() => {
    /**
     * Места — это именованные секции страницы, то есть ровно те области,
     * которые уже объявлены читалке через `aria-label`. Отдельный атрибут
     * под пульт был бы вторым источником правды: те же слова, написанные
     * дважды, однажды разойдутся. Безымянная секция в список не попадает
     * и правильно делает — месту без названия некуда вести.
     */
    const raf = requestAnimationFrame(() => {
      placeEls.current = Array.from(document.querySelectorAll<HTMLElement>('main section[aria-label]'));
      setPlaces(placeEls.current.map((el) => el.getAttribute('aria-label') ?? ''));
      atRef.current = 0;
      setAt(0);
      measure();
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, measure]);

  /**
   * Высота страницы плывёт: раскрытый вопрос в FAQ, подгруженный шрифт,
   * смена ширины окна. Поэтому не событие `resize`, а наблюдатель за
   * самим телом страницы — он ловит любое изменение размера, а не
   * только оконное, и браузер сам склеивает всплески в один вызов.
   */
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [measure]);

  // перед самым показом панели меряем ещё раз: к этому моменту страница
  // уже прожила раскрытия и отложенные кадры
  useEffect(() => {
    if (open) measure();
  }, [open, measure]);

  /**
   * Пульт уходит, если накрыл собой элемент в фокусе.
   *
   * Он висит в углу поверх страницы, и ссылка в нижней левой части
   * экрана, до которой дошли табом, оказывалась под ним: фокус есть,
   * увидеть его нельзя. По WCAG 2.4.11 так нельзя, и починить это
   * отступами невозможно — пульт не в потоке. Поэтому он просто
   * убирается на то время, пока мешает.
   */
  useEffect(() => {
    /**
     * Считаем по тому, где фокус оказался, а не по тому, откуда ушёл, —
     * и на кадр позже события. Пара focusout + focusin приходит двумя
     * событиями, и обработка каждого по отдельности давала вспышку:
     * пульт начинал проявляться между двумя одинаково перекрытыми
     * ссылками. Тот же проход закрывает и уход фокуса в никуда —
     * клик по пустому месту не даёт focusin вовсе.
     */
    let raf = 0;
    const check = () => {
      raf = 0;
      const box = pod.current;
      if (!box) return;
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || box.contains(el)) {
        setCovers(false);
        return;
      }
      const a = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      setCovers(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    addEventListener('focusin', schedule);
    addEventListener('focusout', schedule);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('focusin', schedule);
      removeEventListener('focusout', schedule);
    };
  }, []);

  /* ---------------- появление, вращение, покачивание ---------------- */

  useEffect(() => {
    const el = pod.current;
    const bob = float.current;
    if (!el || !bob) return;
    if (!wide) {
      // ушли на узкий экран: знак возвращается шапке, пульта здесь нет
      liveRef.current = false;
      setLive(false);
      setOpen(false);
      return;
    }

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    /**
     * Знак проворачивается вместе с прокруткой.
     *
     * Шаг — 120°: у знака трёхкратная симметрия, поэтому на каждой трети
     * оборота силуэт совпадает сам с собой и вращение читается бесконечным
     * без единого стыка. Один экран прокрутки — одна треть оборота.
     */
    const spinTo = reduced
      ? null
      : gsap.quickTo(spin.current, 'rotation', { duration: 0.55, ease: 'power2.out' });

    // Парение: медленное всплытие на четыре пикселя и обратно. Отдельный
    // слой — внешний занят появлением, внутренний вращением; наложи их
    // друг на друга, и каждая анимация затирала бы чужой трансформ.
    const idle = reduced
      ? null
      : gsap.to(bob, { y: -4, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    let raf = 0;
    const sync = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        /**
         * Знак на странице один. Пульт берёт его на себя, только когда
         * ушла шапка: ниже первого экрана и при движении вниз. Стоит
         * потянуть страницу вверх — шапка возвращается, пульт убирается,
         * и знак снова там, где его ищут.
         */
        const on = scrollY > innerHeight * HANDOFF && isHeaderHidden();
        if (on !== liveRef.current) {
          liveRef.current = on;
          setLive(on);
          if (!on) setOpen(false);
        }
        if (on) spinTo?.((scrollY / innerHeight) * TURN);

        /**
         * Доля прокрутки пишется прямо в узлы, мимо состояния React.
         * Она меняется каждым кадром движения, и держать её состоянием
         * значило бы перерисовывать всю панель — с живым экраном внутри —
         * ради двух чисел на экране.
         */
        const max = document.documentElement.scrollHeight - innerHeight;
        const part = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
        if (ring.current) ring.current.style.strokeDashoffset = String(1 - part);
        if (pct.current) pct.current.textContent = `${Math.round(part * 100)}%`;

        const line = scrollY + innerHeight * HERE;
        const tp = tops.current;
        if (tp.length) {
          let i = 0;
          while (i + 1 < tp.length && tp[i + 1] <= line) i++;
          if (i !== atRef.current) {
            atRef.current = i;
            setAt(i);
          }
        }
      });
    };

    sync();
    const off = onHeaderToggle(sync);
    addEventListener('scroll', sync, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      idle?.kill();
      off();
      removeEventListener('scroll', sync);
    };
  }, [wide]);

  // знак прилетает из шапки и туда же уходит: масштаб с прозрачностью
  // читаются как передача, а не как появление второго знака
  useEffect(() => {
    const el = pod.current;
    if (!el) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const on = live && !covers;
    gsap.to(el, {
      autoAlpha: on ? 1 : 0,
      scale: on ? 1 : 0.6,
      duration: reduced ? 0 : 0.42,
      ease: 'power3.out'
    });
  }, [live, covers]);

  /* ---------------- поведение ---------------- */

  /**
   * Наверх — всегда наверх.
   *
   * Раньше здесь стояла ссылка на «/», и на главной её перехватывал
   * обработчик: перезагружать страницу, чтобы попасть в её начало,
   * незачем. Став кнопкой, элемент унаследовал только эту проверку —
   * и на всех остальных страницах не делал ровно ничего, хотя подписан
   * «в начало страницы». Домой уводит список разделов рядом.
   */
  const home = () => {
    setOpen(false);
    scrollToY(0);
  };

  /** Переход к месту страницы. Отступ — под плавающую шапку. */
  const goTo = (i: number) => {
    const el = placeEls.current[i];
    if (!el) return;
    setOpen(false);
    scrollToEl(el, -72);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      /**
       * Фокус возвращается на знак, а не падает в `body`.
       *
       * Закрытая панель становится `inert`, и элемент, на котором
       * стоял фокус, перестаёт существовать для клавиатуры: без
       * возврата обход начинался заново со «К содержанию».
       */
      if (shell.current?.contains(document.activeElement)) trigger.current?.focus();
      setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!shell.current?.contains(e.target as Node)) setOpen(false);
    };
    addEventListener('keydown', onKey);
    addEventListener('pointerdown', onDown);
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const page = PAGE_NAME[pathname] ?? 'Страница';

  return (
    <div
      ref={pod}
      // left/top держим в нуле: положение задаётся трансформом, поэтому
      // перелёт между углами идёт на композиторе и не трогает layout
      /**
       * Появление ведёт GSAP, а не CSS-свойство `scale`: трансформ
       * элемента принадлежит GSAP целиком, и инлайновый `scale` от React
       * в его матрицу не попадал — знак оставался в 0.6 и рендерился
       * 33px вместо 56, заодно проваливая область нажатия.
       */
      className="pointer-events-none fixed z-[120] hidden opacity-0 lg:block"
      style={{ left: EDGE, bottom: EDGE }}
      aria-hidden={!live}
    >
      {/* слой парения: медленно всплывает и опускается */}
      <div ref={float}>
      <div
        ref={shell}
        className="pointer-events-auto relative"
        style={{ width: SIZE, height: SIZE }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? 'Скрыть навигацию' : 'Навигация по сайту'}
          onClick={() => setOpen((v) => !v)}
          className="relative grid h-full w-full place-items-center rounded-full border border-line bg-bg/80 text-fg backdrop-blur-md transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        >
          {/**
           * Кольцо прогресса идёт по самой кромке кнопки — это состояние
           * того же предмета, а не значок рядом с ним. `pathLength={1}`
           * избавляет от счёта длины окружности: смещение штриха и есть
           * доля прокрутки. Числом то же самое написано в панели —
           * кольцо читалке ничего не говорит.
           */}
          <svg viewBox="0 0 56 56" className="pointer-events-none absolute inset-0 -rotate-90" aria-hidden>
            <circle
              ref={ring}
              cx="28"
              cy="28"
              r="27.5"
              pathLength={1}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="1 1"
              strokeDashoffset={1}
              className="text-accent"
            />
          </svg>

          {/* знак проворачивается своим слоем: внешние заняты появлением
              и парением */}
          <span ref={spin} className="block h-8 w-8">
            <MarkColor id={markId} className="h-full w-full" />
          </span>
        </button>

        {/* Панель лежит абсолютом и раскрывается вверх от знака: пульт
            стоит в нижнем левом углу, поэтому другого направления у неё
            и быть не может.

            Высота ограничена экраном: на странице с семью местами панель
            иначе уезжала бы верхним краем за верхнюю кромку окна. */}
        <div
          id={panelId}
          /**
           * `inert` вместо `tabIndex={-1}` на каждой ссылке: закрытая
           * панель целиком выпадает и из обхода табом, и из дерева
           * доступности. Раньше это держалось на ручных атрибутах, и
           * любой новый элемент внутри про них не знал — фокус уезжал
           * в невидимую панель.
           */
          inert={!open}
          className={`absolute bottom-[calc(100%+10px)] left-0 max-h-[calc(100svh-112px)] w-[268px] origin-bottom-left overflow-y-auto rounded-[18px] border border-line bg-bg/85 p-2 backdrop-blur-md transition-[opacity,transform] duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-[0.94] opacity-0'
          }`}
          aria-hidden={!open}
        >
          {/* ---------- где я ---------- */}
          <div className="flex items-baseline justify-between gap-3 px-3 pb-2 pt-1">
            <span className="rail-label truncate text-fg">{page}</span>
            {/* то же число, что рисует кольцо: кольцо — глазу, число — читалке */}
            <span ref={pct} className="shrink-0 font-mono text-[10px] tracking-rail text-faint">
              0%
            </span>
          </div>

          {/**
           * Места страницы. Появляются там, где их больше одного: на
           * политике с её собственным оглавлением или на короткой
           * странице список из одной строки — это шум, а не навигация.
           */}
          {places.length > 1 && (
            <ul className="m-0 mb-2 flex list-none flex-col border-b border-line p-0 pb-2">
              {places.map((label, i) => (
                <li key={`${label}-${i}`}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === at ? 'true' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[13px] leading-snug transition-colors duration-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg ${
                      i === at ? 'text-fg' : 'text-dim hover:text-fg'
                    }`}
                  >
                    {/* штрих у текущего места: состояние видно и без цвета */}
                    <span
                      className="h-px shrink-0 bg-accent transition-all duration-200"
                      style={{ opacity: i === at ? 1 : 0, width: i === at ? 14 : 0 }}
                      aria-hidden
                    />
                    <span className="truncate">{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/**
           * Живой экран направления. Играет ровно одна вставка — та, на
           * которой сейчас палец или курсор: шесть одновременных таймлайнов
           * в меню никому не нужны. Закрытая панель не держит ни одной.
           */}
          <div
            className="relative mb-2 overflow-hidden rounded-[12px] border border-line bg-elev"
            style={{ width: SCREEN_W, height: SCREEN_H }}
            aria-hidden
          >
            {open &&
              ROUTES.map((r, i) => {
                const Live = r.live;
                return (
                  <div
                    key={r.href}
                    className="absolute inset-0 transition-opacity duration-300"
                    style={{
                      // вставка нарисована в макетных координатах, рамка её масштабирует
                      ['--live-k' as string]: (SCREEN_W / LIVE_W).toFixed(4),
                      opacity: i === active ? 1 : 0
                    }}
                  >
                    <Live playing={i === active} />
                  </div>
                );
              })}
          </div>

          <ul className="m-0 flex list-none flex-col p-0">
            {ROUTES.map((r, i) => {
              const here = pathname === r.href;
              return (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    aria-current={here ? 'page' : undefined}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className={`flex items-baseline gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] leading-snug transition-colors duration-200 ${
                      i === active ? 'bg-elev text-fg' : 'text-dim hover:text-fg'
                    } ${here ? 'text-accent' : ''}`}
                  >
                    <span className="font-mono text-[10px] tracking-rail text-faint">{r.n}</span>
                    {r.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* служебные разделы: живого экрана у них нет, поэтому строкой */}
          <div className="mt-1 flex flex-wrap gap-x-1 px-3 pb-1 pt-2">
            {EXTRA.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                aria-current={pathname === e.href ? 'page' : undefined}
                className={`rounded-[8px] px-1.5 py-1 font-mono text-[9px] uppercase tracking-rail transition-colors duration-200 hover:text-fg ${
                  pathname === e.href ? 'text-accent' : 'text-faint'
                }`}
              >
                {e.label}
              </Link>
            ))}
          </div>

          {/**
           * Быстрые действия. Заявка несёт с собой тип раздела, из
           * которого её открыли, — ровно как ссылка в шапке и в меню на
           * телефоне; до этого пульт вёл на общую форму и терял то, что
           * о человеке уже известно.
           *
           * Telegram подписан словами, а не самолётиком: на сайте из
           * тонких штрихов и моношрифта чужая иконка читается вставкой
           * из другого набора — тот же довод, что у переключателя темы.
           */}
          <div className="mt-1 flex gap-2 border-t border-line pt-2">
            <Link
              href={contactHref(pathname)}
              className="flex-1 rounded-[10px] border border-fg bg-fg px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-rail text-bg transition-colors duration-200 hover:border-accent hover:bg-accent hover:text-white"
            >
              Обсудить
            </Link>
            <a
              href={`https://t.me/${SITE.telegram}`}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`Написать в Telegram: ${SITE.telegramLabel}`}
              className="grid w-12 place-items-center rounded-[10px] border border-line font-mono text-[10px] uppercase tracking-rail text-dim transition-colors duration-200 hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg"
            >
              TG
            </a>
            <button
              type="button"
              onClick={home}
              aria-label="В начало страницы"
              className="grid w-12 place-items-center rounded-[10px] border border-line text-dim transition-colors duration-200 hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* тема — состояние просмотра, поэтому стоит рядом с действиями,
              а не прячется в шапке, до которой отсюда ещё надо доехать */}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-line px-3 pb-1 pt-2.5">
            <span className="rail-label">Тема</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
