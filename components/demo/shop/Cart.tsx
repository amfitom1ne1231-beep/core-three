'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Skein from './Skein';
import { C, DISPLAY, money, plural } from './shared';
import { PRODUCTS, SHOP } from '@/content/concepts/shop';

export type Line = { pid: string; vid: string; qty: number };

type Way = 'pickup' | 'courier';
type Pay = 'online' | 'later';
type Step = 'cart' | 'checkout' | 'paying' | 'done';

const SLOTS = ['10:00–14:00', '14:00–18:00', '18:00–22:00'];

export function lineOf(l: Line) {
  const product = PRODUCTS.find((p) => p.id === l.pid);
  const variant = product?.variants.find((v) => v.id === l.vid);
  return product && variant ? { product, variant } : null;
}

/**
 * Корзина и оформление.
 *
 * Один лист на весь путь: корзина → получение и оплата → подтверждение.
 * Разносить это по страницам в маленькой рознице незачем — каждый
 * переход стоит части заказов, а шагов здесь ровно три.
 *
 * Порог бесплатной доставки показан не надписью, а расстоянием до него:
 * «не хватает 700 ₽» человек понимает мгновенно, «бесплатно от 3000 ₽»
 * заставляет считать. Это единственная механика, ради которой
 * в корзину возвращаются, и прятать её в подвал глупо.
 */
export default function Cart({
  lines,
  onQty,
  onClose,
  onDone
}: {
  lines: Line[];
  onQty: (pid: string, vid: string, qty: number) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>('cart');
  const [way, setWay] = useState<Way>('pickup');
  const [pay, setPay] = useState<Pay>('online');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [slot, setSlot] = useState(SLOTS[1]);
  const [touched, setTouched] = useState(false);
  const [order, setOrder] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'paying') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose, step]);

  /**
   * Переход к оформлению подводит лист к форме. Без этого шаг второй
   * выглядит как шаг первый: список товаров на месте, а поля — ниже
   * сгиба, и человек решает, что кнопка не сработала.
   */
  useEffect(() => {
    if (step !== 'checkout') return;
    const b = body.current;
    const f = form.current;
    if (b && f) b.scrollTo({ top: f.offsetTop - 12, behavior: 'smooth' });
  }, [step]);

  const items = useMemo(
    () => lines.map((l) => ({ line: l, ...(lineOf(l) ?? {}) })).filter((x) => x.product),
    [lines]
  );
  const goods = items.reduce((s, x) => s + (x.product?.price ?? 0) * x.line.qty, 0);
  const count = items.reduce((s, x) => s + x.line.qty, 0);
  const shipping = way === 'courier' && goods < SHOP.freeFrom ? SHOP.cityDelivery : 0;
  const total = goods + shipping;
  const toFree = Math.max(0, SHOP.freeFrom - goods);

  const badName = name.trim().length < 2;
  const badPhone = phone.replace(/\D/g, '').length < 10;
  const badAddress = way === 'courier' && address.trim().length < 5;
  const invalid = badName || badPhone || badAddress;

  const submit = () => {
    setTouched(true);
    if (invalid) return;
    const n = `М-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    setOrder(n);
    if (pay === 'online') {
      setStep('paying');
      // «оплата» держится ровно столько, сколько держится настоящая:
      // мгновенный успех не читается как платёж
      setTimeout(() => setStep('done'), 1500);
    } else {
      setStep('done');
    }
  };

  const field = (bad: boolean) => ({
    borderColor: touched && bad ? '#b4472f' : C.line,
    background: C.card,
    color: C.ink
  });

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Корзина">
      <button
        type="button"
        aria-label="Закрыть корзину"
        onClick={() => step !== 'paying' && onClose()}
        className="absolute inset-0 cursor-default border-0 p-0"
        style={{ background: 'rgba(22,24,29,0.42)', backdropFilter: 'blur(2px)' }}
      />

      <div
        ref={panel}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[480px] flex-col outline-none"
        style={{ background: C.paper, animation: 'sheet .32s cubic-bezier(0.22,1,0.36,1) both' }}
      >
        {/* ---------- шапка ---------- */}
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-7" style={{ borderColor: C.line }}>
          <h2 className="m-0 text-[17px] font-semibold" style={{ fontFamily: DISPLAY }}>
            {step === 'cart' && 'Корзина'}
            {step === 'checkout' && 'Оформление'}
            {step === 'paying' && 'Оплата'}
            {step === 'done' && 'Заказ принят'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={step === 'paying'}
            className="rounded-full border px-3 py-1.5 text-[12px] disabled:opacity-40"
            style={{ borderColor: C.line, color: C.muted }}
          >
            Закрыть
          </button>
        </div>

        <div ref={body} className="relative flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {/* ---------- список ---------- */}
          {(step === 'cart' || step === 'checkout') && (
            <>
              {items.length === 0 ? (
                <p className="m-0 py-12 text-center text-[14px]" style={{ color: C.muted }}>
                  Пока пусто. Каталог — за спиной.
                </p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {items.map(({ line, product, variant }) => {
                    if (!product || !variant) return null;
                    return (
                      <li
                        key={`${line.pid}-${line.vid}`}
                        className="flex gap-4 border-b py-4 first:pt-0"
                        style={{ borderColor: C.lineSoft }}
                      >
                        <div className="h-16 w-16 shrink-0 rounded-[10px] p-1.5" style={{ background: C.paperDeep }}>
                          <Skein hex={variant.hex} shape={product.shape} className="h-full w-full" title="" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 text-[14.5px] font-medium leading-snug">{product.name}</p>
                          <p className="m-0 mt-1 text-[12.5px]" style={{ color: C.muted }}>
                            {variant.name} · {money(product.price)}
                          </p>

                          <div className="mt-3 flex items-center gap-3">
                            <div className="flex items-center rounded-full border" style={{ borderColor: C.line }}>
                              <button
                                type="button"
                                onClick={() => onQty(line.pid, line.vid, line.qty - 1)}
                                aria-label="Меньше"
                                className="px-3 py-1.5 text-[15px] leading-none"
                              >
                                −
                              </button>
                              <span className="min-w-[2ch] text-center text-[13.5px] tabular-nums">{line.qty}</span>
                              <button
                                type="button"
                                onClick={() => onQty(line.pid, line.vid, Math.min(variant.left, line.qty + 1))}
                                disabled={line.qty >= variant.left}
                                aria-label="Больше"
                                className="px-3 py-1.5 text-[15px] leading-none disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => onQty(line.pid, line.vid, 0)}
                              className="text-[12.5px] underline underline-offset-4"
                              style={{ color: C.faint }}
                            >
                              Убрать
                            </button>
                          </div>
                        </div>
                        <span className="shrink-0 text-[14.5px] tabular-nums">{money(product.price * line.qty)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* до бесплатной доставки */}
              {items.length > 0 && (
                <div className="mt-5 rounded-[12px] p-4" style={{ background: C.paperDeep }}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span style={{ color: C.muted }}>
                      {toFree > 0 ? `До бесплатной доставки — ${money(toFree)}` : 'Доставка по городу бесплатно'}
                    </span>
                    <span className="tabular-nums" style={{ color: C.faint }}>
                      {money(goods)} / {money(SHOP.freeFrom)}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full" style={{ background: C.line }}>
                    <span
                      className="block h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${Math.min(100, (goods / SHOP.freeFrom) * 100)}%`, background: C.accent }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ---------- получение и оплата ---------- */}
          {step === 'checkout' && (
            <div ref={form} className="mt-7">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: C.faint }}>
                Как получить
              </p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {([
                  { id: 'pickup', title: 'Самовывоз', text: `${SHOP.address} · сегодня`, cost: 'бесплатно' },
                  { id: 'courier', title: 'Курьером', text: 'Завтра, по городу', cost: goods >= SHOP.freeFrom ? 'бесплатно' : money(SHOP.cityDelivery) }
                ] as const).map((o) => {
                  const on = way === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setWay(o.id)}
                      aria-pressed={on}
                      className="rounded-[12px] border p-3.5 text-left transition-colors duration-200"
                      style={{ borderColor: on ? C.accent : C.line, background: on ? C.card : 'transparent' }}
                    >
                      <span className="block text-[14px] font-medium">{o.title}</span>
                      <span className="mt-1 block text-[12.5px]" style={{ color: C.muted }}>
                        {o.text}
                      </span>
                      <span className="mt-2 block text-[12.5px]" style={{ color: C.accent }}>
                        {o.cost}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px]" style={{ color: C.muted }}>
                    Имя
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-[10px] border px-3.5 py-3 text-[14px] outline-none"
                    style={field(badName)}
                    placeholder="Как к вам обращаться"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px]" style={{ color: C.muted }}>
                    Телефон
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    className="w-full rounded-[10px] border px-3.5 py-3 text-[14px] outline-none"
                    style={field(badPhone)}
                    placeholder="+7 900 000-00-00"
                  />
                </label>

                {way === 'courier' && (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-[12.5px]" style={{ color: C.muted }}>
                        Адрес
                      </span>
                      <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full rounded-[10px] border px-3.5 py-3 text-[14px] outline-none"
                        style={field(badAddress)}
                        placeholder="Улица, дом, квартира"
                      />
                    </label>
                    <div>
                      <span className="mb-1.5 block text-[12.5px]" style={{ color: C.muted }}>
                        Когда привезти
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {SLOTS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSlot(s)}
                            aria-pressed={slot === s}
                            className="rounded-full border px-3.5 py-2 text-[12.5px] transition-colors duration-200"
                            style={{
                              borderColor: slot === s ? C.ink : C.line,
                              background: slot === s ? C.ink : 'transparent',
                              color: slot === s ? C.card : C.ink
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <p className="m-0 mt-6 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: C.faint }}>
                Оплата
              </p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {([
                  { id: 'online', title: 'Картой сейчас', text: 'Заказ соберём сразу' },
                  { id: 'later', title: way === 'pickup' ? 'В лавке' : 'Курьеру', text: 'Картой или наличными' }
                ] as const).map((o) => {
                  const on = pay === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setPay(o.id)}
                      aria-pressed={on}
                      className="rounded-[12px] border p-3.5 text-left transition-colors duration-200"
                      style={{ borderColor: on ? C.accent : C.line, background: on ? C.card : 'transparent' }}
                    >
                      <span className="block text-[14px] font-medium">{o.title}</span>
                      <span className="mt-1 block text-[12.5px]" style={{ color: C.muted }}>
                        {o.text}
                      </span>
                    </button>
                  );
                })}
              </div>

              {touched && invalid && (
                <p className="m-0 mt-4 text-[13px]" style={{ color: '#b4472f' }}>
                  {badName ? 'Как вас зовут? ' : ''}
                  {badPhone ? 'Нужен телефон для связи. ' : ''}
                  {badAddress ? 'Куда везти?' : ''}
                </p>
              )}
            </div>
          )}

          {/* ---------- оплата ---------- */}
          {step === 'paying' && (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              {/* animate-spin, а не своя анимация: ключевые кадры `spin`
                  Tailwind кладёт в сборку только вместе с этим классом */}
              <span
                className="block h-9 w-9 animate-spin rounded-full border-2 border-transparent"
                style={{ borderTopColor: C.accent, borderRightColor: C.accent }}
                aria-hidden
              />
              <p className="m-0 mt-5 text-[15px]">Проводим платёж на {money(total)}</p>
              <p className="m-0 mt-2 text-[13px]" style={{ color: C.muted }}>
                Не закрывайте страницу
              </p>
            </div>
          )}

          {/* ---------- готово ---------- */}
          {step === 'done' && (
            <div className="py-6">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-[22px]"
                style={{ background: C.ok, color: '#fff' }}
                aria-hidden
              >
                ✓
              </span>
              <h3 className="m-0 mt-5 text-[22px] font-semibold leading-tight" style={{ fontFamily: DISPLAY }}>
                Заказ {order} принят
              </h3>
              <p className="m-0 mt-3 text-[14px] leading-relaxed" style={{ color: C.muted }}>
                {way === 'pickup'
                  ? `Соберём за два часа и придержим три дня. Заберёте на ${SHOP.address}.`
                  : `Привезём завтра, ${slot.toLowerCase()}. Курьер позвонит за полчаса.`}
              </p>
              <p className="m-0 mt-2 text-[14px] leading-relaxed" style={{ color: C.muted }}>
                {pay === 'online'
                  ? `Оплачено ${money(total)}. Чек ушёл в СМС.`
                  : `К оплате при получении — ${money(total)}.`}
              </p>

              <ul className="m-0 mt-6 list-none border-t p-0 pt-4" style={{ borderColor: C.lineSoft }}>
                {items.map(({ line, product, variant }) =>
                  product && variant ? (
                    <li key={`${line.pid}-${line.vid}`} className="flex justify-between py-1.5 text-[13.5px]">
                      <span style={{ color: C.muted }}>
                        {product.name} · {variant.name} × {line.qty}
                      </span>
                      <span className="tabular-nums">{money(product.price * line.qty)}</span>
                    </li>
                  ) : null
                )}
              </ul>

              <button
                type="button"
                onClick={onDone}
                className="mt-7 w-full rounded-full px-6 py-3.5 text-[14.5px] font-medium"
                style={{ background: C.ink, color: C.card }}
              >
                Хорошо
              </button>
            </div>
          )}
        </div>

        {/* ---------- итог и кнопка ---------- */}
        {(step === 'cart' || step === 'checkout') && items.length > 0 && (
          <div className="border-t px-5 py-4 sm:px-7" style={{ borderColor: C.line, background: C.card }}>
            <div className="flex items-baseline justify-between text-[13.5px]" style={{ color: C.muted }}>
              <span>
                {count} {plural(count, 'товар', 'товара', 'товаров')}
              </span>
              <span className="tabular-nums">{money(goods)}</span>
            </div>
            {step === 'checkout' && (
              <div className="mt-1.5 flex items-baseline justify-between text-[13.5px]" style={{ color: C.muted }}>
                <span>Доставка</span>
                <span className="tabular-nums">{shipping ? money(shipping) : 'бесплатно'}</span>
              </div>
            )}
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-[15px] font-medium">Итого</span>
              <span className="text-[19px] font-semibold tabular-nums" style={{ fontFamily: DISPLAY }}>
                {money(step === 'checkout' ? total : goods)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => (step === 'cart' ? setStep('checkout') : submit())}
              className="mt-4 w-full rounded-full px-6 py-3.5 text-[14.5px] font-medium transition-opacity duration-200 hover:opacity-90"
              style={{ background: C.accent, color: '#fff' }}
            >
              {step === 'cart' ? 'Оформить' : pay === 'online' ? `Оплатить ${money(total)}` : 'Подтвердить заказ'}
            </button>
            {step === 'checkout' && (
              <button
                type="button"
                onClick={() => setStep('cart')}
                className="mt-2 w-full py-2 text-[13px] underline underline-offset-4"
                style={{ color: C.faint }}
              >
                Назад к корзине
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
