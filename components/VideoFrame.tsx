import VideoBackdrop from './VideoBackdrop';

export type Clip = { src: string; poster: string; source: string; caption: string };

/**
 * Ролик из генератора в рамке — живая вставка, как карточки у Kling.
 * Фоном работает материал, а видео живёт в окне: раскрывается из рамки
 * при входе (data-reveal) и едет внутри с параллаксом (data-parallax-media),
 * оба эффекта ведёт ScrollScenes. Загрузка, пауза вне экрана, бесшовный
 * цикл и срезанный водяной знак — в VideoBackdrop.
 */
export default function VideoFrame({
  clip,
  aspect = '16 / 10',
  className = ''
}: {
  clip: Clip;
  aspect?: string;
  className?: string;
}) {
  return (
    <figure className={`m-0 ${className}`}>
      <div
        data-reveal="clip"
        className="relative overflow-hidden rounded-[10px] border border-line bg-elev"
        style={{ aspectRatio: aspect }}
      >
        <div data-parallax-media className="absolute -inset-y-[8%] inset-x-0">
          <VideoBackdrop src={clip.src} poster={clip.poster} opacity={1} />
        </div>
        {/* виньетка: кадр садится на тёмную страницу без резкой кромки */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(120% 100% at 50% 40%, rgb(var(--bg-rgb) / 0) 55%, rgb(var(--bg-rgb) / 0.55) 100%)' }}
          aria-hidden
        />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-bg/60 px-2.5 py-1 font-mono text-[9px] uppercase tracking-rail text-dim backdrop-blur-sm">
          <i className="block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
          ИИ-ролик
        </span>
      </div>
      <figcaption className="mt-3 flex gap-3 font-mono text-[10px] leading-relaxed text-faint">
        <span className="shrink-0 uppercase tracking-rail text-dim">{clip.source}</span>
        <span>{clip.caption}</span>
      </figcaption>
    </figure>
  );
}
