'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Sheet from './Sheet';
import { getHomeScene, navigate } from '@/lib/phone';
import { PHONE_HELP_ACTIONS, PHONE_HELP_DOCK, phoneHelp } from '@/content/phone-help';

/**
 * Помощь на телефоне — карточка по знаку «?» в верхней строке.
 *
 * Заказчик: «Как мы сюда помощь приплетём? Можно ли зайти на сайт и не
 * понять, что делать?» Можно было: помощь лежала в двух касаниях, в «Ещё»,
 * а жесты нигде не были названы. Теперь она в одном касании и всегда
 * на одном месте: что на этом экране и как им управлять — и три входа
 * в полную «Помощь»: подбор решения, словарь, «напишите мне».
 *
 * Экскурсию по сайту на телефоне эта карточка заменяет: подсвечивать
 * элементы по очереди на экране в один блок незачем.
 */
export default function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  // сцену главной читаем в момент показа: пока карточка закрыта, она никому не нужна
  const help = phoneHelp(pathname, open ? getHomeScene() : 0);

  const go = (hash?: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onClose();
    // на самой «Помощи» тему открывает смена якоря: переход по тому же адресу её не сообщит
    if (pathname === '/help' && hash) location.hash = hash;
    else navigate(() => router.push(hash ? `/help#${hash}` : '/help'));
  };

  return (
    <Sheet open={open} onClose={onClose} label="Помощь">
      <span className="rail-label">Что на этом экране</span>
      <h2 className="m-0 mt-2 text-[22px] font-medium leading-tight text-fg">{help.title}</h2>
      <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
        {[...help.lines, PHONE_HELP_DOCK].map((line) => (
          <li key={line} className="flex gap-3 text-[15px] leading-[1.5] text-dim">
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            {line}
          </li>
        ))}
      </ul>

      <span className="rail-label mt-7 block">Не разобрались?</span>
      <div className="mt-3 flex flex-col gap-2">
        {PHONE_HELP_ACTIONS.map((a) => (
          <Link
            key={a.hash}
            href={`/help#${a.hash}`}
            onClick={go(a.hash)}
            className="flex items-center justify-between gap-4 rounded-[16px] border border-line-strong bg-bg/40 px-4 py-3 text-fg transition-transform duration-200 active:scale-[0.98]"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-[16px] font-medium leading-tight">{a.title}</span>
              <span className="mt-1 text-[12.5px] leading-snug text-dim">{a.text}</span>
            </span>
            <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m6 3.5 4.5 4.5L6 12.5" />
            </svg>
          </Link>
        ))}
      </div>
      <Link href="/help" onClick={go()} className="mt-4 inline-block py-2 text-[14px] text-fg underline decoration-line-strong underline-offset-4">
        Вся помощь
      </Link>
    </Sheet>
  );
}
