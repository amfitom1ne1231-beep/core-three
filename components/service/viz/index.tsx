import type { ComponentType } from 'react';
import { Label, Panel, Scene, Txt, at, move, turn, type VizProps } from './kit';

/**
 * Мини-схемы для состава работы.
 *
 * В кадре справа от перечня стояла фактура материала и гигантская
 * цифра: нажимаешь «Быстрая загрузка» — видишь текстуру и «02».
 * Потом появились схемы, но серые и неподвижные: каркас проявлялся
 * и замирал, и о пункте говорила одна подпись.
 *
 * Теперь схема живёт, пока пункт открыт: устройство рисуется один раз,
 * а главное событие пункта идёт по кругу — заявка летит из формы
 * в таблицу, посылка едет то к двери, то в пункт выдачи, глаз проходит
 * страницу в порядке чтения. Акцентом отмечено только то, про что пункт.
 *
 * Схем двенадцать на двадцать четыре пункта четырёх направлений:
 * «оплата в переписке» и «сценарий разговора» — один и тот же разговор,
 * «выгрузка к вам» и «формы заявок» — одна и та же таблица строк.
 * Пункт называет схему полем `viz` в `content/services.ts`; не назвал —
 * остаётся прежний кадр, и ничего не ломается. Своя подпись у пункта
 * (`vizNote`) говорит, про что именно эта схема; без неё — общая.
 *
 * Ни одной цифры, которую нельзя подтвердить: выдуманные «0,9 с»
 * и «+40% конверсии» на сайте про честность были бы ровно тем, чем
 * являются.
 */

/* ---------------- 01. структура страницы ---------------- */
/** Четыре блока страницы сверху вниз: [y, высота] полосы на рельсе чтения. */
const READ: [number, number][] = [
  [46, 32],
  [84, 30],
  [120, 30],
  [158, 36]
];

const Blocks = ({ note }: VizProps) => (
  <Scene note={note ?? 'порядок чтения'}>
    <Panel x={76} y={6} width={258} height={198} className="vz-fade" />
    <g className="vz-in" style={at(80)}>
      <Txt x={92} y={19} w={38} h={5} tone="hi" />
      {[272, 290, 308].map((x) => (
        <Txt key={x} x={x} y={20} w={12} h={3} />
      ))}
      <path d="M76 34H334" className="vz-rule" />
    </g>
    <g className="vz-in" style={at(180)}>
      <Txt x={92} y={50} w={176} h={9} tone="hi" />
      <Txt x={92} y={64} w={124} h={9} tone="hi" />
    </g>
    <g className="vz-in" style={at(260)}>
      <Txt x={92} y={90} w={206} />
      <Txt x={92} y={99} w={188} />
      <Txt x={92} y={108} w={150} />
    </g>
    <g className="vz-in" style={at(340)}>
      <rect x={92} y={124} width={80} height={22} className="vz-edge" />
      <rect x={180} y={124} width={66} height={22} className="vz-rule" />
    </g>
    <g className="vz-in" style={at(420)}>
      {[92, 170, 248].map((x) => (
        <rect key={x} x={x} y={162} width={70} height={28} className="vz-tint" />
      ))}
    </g>

    {/* рельс чтения: слева от страницы, номера блоков по порядку */}
    <g className="vz-fade" style={at(300)}>
      <path d="M56 46V194" className="vz-rule" />
      {READ.map(([y, h], i) => (
        <Label key={i} x={46} y={y + h / 2 + 3} anchor="end">
          {i + 1}
        </Label>
      ))}
    </g>

    {/* глаз идёт по блокам: заголовок, довод, кнопка, подтверждение */}
    {READ.map(([y, h], i) => (
      <g key={i} className="vz-turn" style={turn(i)}>
        <rect x={55} y={y} width={2} height={h} className="vz-hot" />
        <Label x={46} y={y + h / 2 + 3} anchor="end" hot>
          {i + 1}
        </Label>
        {i === 0 && (
          <>
            <Txt x={92} y={50} w={176} h={9} tone="on" />
            <Txt x={92} y={64} w={124} h={9} tone="on" />
          </>
        )}
        {i === 1 && (
          <>
            <Txt x={92} y={90} w={206} tone="hi" />
            <Txt x={92} y={99} w={188} tone="hi" />
            <Txt x={92} y={108} w={150} tone="hi" />
          </>
        )}
        {i === 2 && (
          <>
            <rect x={92} y={124} width={80} height={22} className="vz-hot" />
            <Txt x={108} y={133} w={48} tone="ink" />
          </>
        )}
        {i === 3 && [92, 170, 248].map((x) => <rect key={x} x={x} y={162} width={70} height={28} className="vz-pick" />)}
      </g>
    ))}
  </Scene>
);

/* ---------------- 02. скорость загрузки ---------------- */
const Speed = ({ note }: VizProps) => (
  <Scene note={note ?? 'остальное догружается'}>
    <Panel x={76} y={6} width={258} height={198} className="vz-fade" />
    <Txt x={92} y={15} w={86} className="vz-fade" style={at(100)} />

    {/* полоса загрузки: первый экран — рывком, остальное — следом */}
    <rect x={76} y={28} width={258} height={2} className="vz-bar" />
    <rect x={76} y={28} width={119} height={2} className="vz-hot vz-fill-a" />
    <rect x={195} y={28} width={139} height={2} className="vz-bar-hi vz-fill-b" />

    {/* первый экран: его уже читают */}
    <g className="vz-s1">
      <Txt x={92} y={46} w={156} h={9} tone="on" />
      <Txt x={92} y={60} w={108} h={9} tone="on" />
      <Txt x={92} y={80} w={176} tone="hi" />
      <rect x={92} y={93} width={66} height={16} className="vz-hot" />
    </g>

    {/* сгиб: всё, что выше, пришло первым */}
    <g className="vz-fade" style={at(300)}>
      <path d="M64 122H346" className="vz-fold" />
      <Label x={322} y={114} anchor="end" hot>
        первый экран
      </Label>
    </g>

    {/* ниже сгиба: догружается по одному */}
    {[92, 170, 248].map((x, i) => (
      <g key={x}>
        <rect x={x} y={136} width={70} height={56} className="vz-rule vz-fade" style={at(200 + i * 80)} />
        <g className={`vz-s${i + 2}`}>
          <rect x={x + 6} y={142} width={58} height={26} className="vz-tint" />
          <Txt x={x + 6} y={175} w={44} />
          <Txt x={x + 6} y={183} w={30} />
        </g>
      </g>
    ))}
  </Scene>
);

/* ---------------- 03. ссылка в поиске и мессенджере ---------------- */
const LinkCard = ({ note }: VizProps) => (
  <Scene note={note ?? 'заголовок · описание · адрес'}>
    {/* в поиске */}
    <g className="vz-in" style={at(60)}>
      <Label x={20} y={38}>в поиске</Label>
      <Panel x={20} y={46} width={204} height={96} />
      <rect x={34} y={59} width={10} height={10} rx={5} className="vz-tint" />
      <Txt x={50} y={62} w={82} />
      <Txt x={34} y={81} w={158} h={8} tone="hi" />
      <Txt x={34} y={102} w={174} />
      <Txt x={34} y={111} w={160} />
      <Txt x={34} y={120} w={112} />
    </g>

    {/* в мессенджере */}
    <g className="vz-in" style={at(200)}>
      <Label x={252} y={16}>в мессенджере</Label>
      <Panel x={252} y={24} width={128} height={166} />
      <rect x={252.5} y={24.5} width={127} height={68} className="vz-tint" />
      <Txt x={264} y={106} w={92} h={7} tone="hi" />
      <Txt x={264} y={124} w={104} />
      <Txt x={264} y={133} w={84} />
      <Txt x={264} y={168} w={58} />
    </g>

    {/* одна разметка — оба вида */}
    <path d="M224 94H252" className="vz-rule vz-fade" style={at(320)} />

    {/* три поля по очереди: где они оказываются там и там */}
    <g className="vz-turn" data-of="3" style={turn(0)}>
      <Txt x={34} y={81} w={158} h={8} tone="hot" />
      <Txt x={264} y={106} w={92} h={7} tone="hot" />
      <Label x={20} y={164} hot>
        заголовок
      </Label>
    </g>
    <g className="vz-turn" data-of="3" style={turn(1)}>
      <Txt x={34} y={102} w={174} tone="hot" />
      <Txt x={34} y={111} w={160} tone="hot" />
      <Txt x={34} y={120} w={112} tone="hot" />
      <Txt x={264} y={124} w={104} tone="hot" />
      <Txt x={264} y={133} w={84} tone="hot" />
      <Label x={20} y={164} hot>
        описание
      </Label>
    </g>
    <g className="vz-turn" data-of="3" style={turn(2)}>
      <Txt x={50} y={62} w={82} tone="hot" />
      <Txt x={264} y={168} w={58} tone="hot" />
      <Label x={20} y={164} hot>
        адрес
      </Label>
    </g>
  </Scene>
);

/* ---------------- 04. заявка ложится строкой ---------------- */
const Rows = ({ note }: VizProps) => (
  <Scene note={note ?? 'новая строка'}>
    {/* форма */}
    <g className="vz-in" style={at(60)}>
      <Panel x={20} y={30} width={116} height={124} />
      {[42, 66, 90].map((y) => (
        <rect key={y} x={32} y={y} width={92} height={16} className="vz-rule" />
      ))}
      <rect x={32} y={118} width={56} height={20} className="vz-hot" />
      <Txt x={44} y={126} w={32} tone="ink" />
    </g>
    <g className="vz-s1">
      <Txt x={38} y={48} w={40} tone="hi" />
      <Txt x={38} y={72} w={58} tone="hi" />
      <Txt x={38} y={96} w={48} tone="hi" />
    </g>

    {/* таблица */}
    <g className="vz-in" style={at(200)}>
      <Panel x={196} y={20} width={184} height={128} />
      <Label x={208} y={36}>имя</Label>
      <Label x={258} y={36}>контакт</Label>
      <Label x={328} y={36}>задача</Label>
      {[44, 76, 108].map((y) => (
        <path key={y} d={`M196 ${y}H380`} className="vz-rule" />
      ))}
      {[60, 92].map((y) => (
        <g key={y}>
          <circle cx={211} cy={y} r={2} className="vz-bar" />
          <Txt x={220} y={y - 2} w={28} />
          <Txt x={258} y={y - 2} w={50} />
          <Txt x={328} y={y - 2} w={38} />
        </g>
      ))}
    </g>

    {/* заявка уходит из формы… */}
    <path d="M136 128H196" className="vz-dash vz-fade" style={at(320)} />
    <rect x={134} y={125} width={12} height={6} rx={1} className="vz-hot vz-go" style={move(56)} />

    {/* …ложится строкой… */}
    <g className="vz-s3">
      <rect x={196.5} y={108.5} width={183} height={39} className="vz-tint" />
      <circle cx={211} cy={128} r={2.5} className="vz-hot" />
      <Txt x={220} y={126} w={28} tone="on" />
      <Txt x={258} y={126} w={50} tone="on" />
      <Txt x={328} y={126} w={38} tone="on" />
    </g>

    {/* …и сообщением туда, где её ждут */}
    <g className="vz-s4">
      <path d="M336 148V166" className="vz-hot-s" />
      <rect x={290} y={166} width={90} height={30} rx={9} className="vz-pick" />
      <circle cx={304} cy={181} r={3} className="vz-hot" />
      <Txt x={314} y={175} w={52} tone="on" />
      <Txt x={314} y={184} w={34} />
    </g>
  </Scene>
);

/* ---------------- 05. цифры и воронка ---------------- */
const BARS = [48, 74, 60, 100, 84, 132];
const TOPS = BARS.map((h, i) => `${i ? 'L' : 'M'}${66 + i * 54} ${184 - h}`).join('');

const Chart = ({ note }: VizProps) => (
  <Scene note={note ?? 'цель · заявка отправлена'}>
    <path d="M36 184.5H364" className="vz-rule vz-fade" />
    {BARS.map((h, i) => (
      <rect
        key={i}
        x={48 + i * 54}
        y={184 - h}
        width={36}
        height={h}
        className={`${i === 5 ? 'vz-edge' : 'vz-tint'} vz-gy`}
        style={at(80 + i * 70)}
      />
    ))}

    {/* то, ради чего считают: линия доходит до последнего столбца, и он наливается */}
    <rect x={318} y={52} width={36} height={132} className="vz-hot vz-up" />
    <path pathLength={1} d={TOPS} className="vz-hot-s vz-trace" />
    <circle cx={336} cy={52} r={4.5} className="vz-dot vz-s3" />
  </Scene>
);

/* ---------------- 06. разговор ---------------- */
const REPLIES: [number, number][] = [
  [40, 86],
  [134, 70],
  [212, 96]
];

const Chat = ({ note }: VizProps) => (
  <Scene note={note ?? 'сценарий с кнопками'}>
    <g className="vz-in" style={at(60)}>
      <Panel x={40} y={10} width={196} height={40} rx={10} />
      <Txt x={54} y={23} w={150} />
      <Txt x={54} y={33} w={104} />
    </g>
    <g className="vz-s1">
      <rect x={246} y={60} width={114} height={28} rx={10} className="vz-hot" />
      <Txt x={262} y={72} w={72} tone="ink" />
    </g>
    <g className="vz-s2">
      <Panel x={40} y={98} width={170} height={40} rx={10} />
      <Txt x={54} y={111} w={126} />
      <Txt x={54} y={121} w={84} />
    </g>
    <g className="vz-s3">
      {REPLIES.map(([x, w]) => (
        <g key={x}>
          <rect x={x} y={152} width={w} height={26} rx={13} className="vz-rule" />
          <Txt x={x + 16} y={163} w={w - 32} />
        </g>
      ))}
    </g>
    {/* кнопка вместо набора текста: её и нажимают */}
    <g className="vz-s4">
      <rect x={134} y={152} width={70} height={26} rx={13} className="vz-hot" />
      <Txt x={150} y={163} w={38} tone="ink" />
    </g>
  </Scene>
);

/* ---------------- 07. каталог ---------------- */
const CHIPS: [number, number][] = [
  [40, 58],
  [106, 50],
  [164, 66]
];
const CARDS = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 40 + (i % 3) * 110, y: 44 + Math.floor(i / 3) * 80 }));
/** Какие карточки отвечают на какой фильтр. */
const PICKS = [
  [0, 4],
  [1, 3, 5],
  [2, 3]
];

const Grid = ({ note }: VizProps) => (
  <Scene note={note ?? 'фильтр · карточка'}>
    <g className="vz-in" style={at(60)}>
      {CHIPS.map(([x, w]) => (
        <g key={x}>
          <rect x={x} y={10} width={w} height={20} rx={10} className="vz-rule" />
          <Txt x={x + 14} y={18} w={w - 28} />
        </g>
      ))}
    </g>
    {CARDS.map((c, i) => (
      <g key={i} className="vz-in" style={at(140 + i * 60)}>
        <Panel x={c.x} y={c.y} width={100} height={70} />
        <rect x={c.x + 8} y={c.y + 8} width={84} height={30} className="vz-tint" />
        <Txt x={c.x + 8} y={c.y + 46} w={56} />
        <Txt x={c.x + 8} y={c.y + 56} w={28} tone="hi" />
      </g>
    ))}

    {/* фильтр переключается — отвечают свои карточки */}
    {CHIPS.map(([x, w], k) => (
      <g key={x} className="vz-turn" data-of="3" style={turn(k)}>
        <rect x={x} y={10} width={w} height={20} rx={10} className="vz-hot" />
        <Txt x={x + 14} y={18} w={w - 28} tone="ink" />
        {PICKS[k].map((i) => (
          <rect key={i} x={CARDS[i].x} y={CARDS[i].y} width={100} height={70} className="vz-pick" />
        ))}
      </g>
    ))}
  </Scene>
);

/* ---------------- 08. корзина ---------------- */
const Cart = ({ note }: VizProps) => (
  <Scene note={note ?? 'путь до оформленного заказа'}>
    <Panel x={96} y={6} width={208} height={198} className="vz-fade" />
    {[20, 62].map((y, i) => (
      <g key={y} className={`vz-s${i + 1}`}>
        <rect x={110} y={y} width={30} height={30} className="vz-tint" />
        <Txt x={150} y={y + 7} w={84} tone="hi" />
        <Txt x={150} y={y + 18} w={50} />
        <Txt x={258} y={y + 12} w={32} h={5} tone="hi" />
      </g>
    ))}
    <g className="vz-fade" style={at(200)}>
      <path d="M110 106.5H290" className="vz-rule" />
      <Label x={110} y={130}>итого</Label>
      <rect x={110} y={150} width={180} height={34} className="vz-edge" />
      <Txt x={172} y={165} w={56} tone="hi" />
    </g>
    <Txt x={232} y={120} w={58} h={10} tone="on" className="vz-s3" />
    {/* последний шаг — один: кнопка */}
    <g className="vz-s4">
      <rect x={110} y={150} width={180} height={34} className="vz-hot" />
      <Txt x={172} y={165} w={56} tone="ink" />
    </g>
  </Scene>
);

/* ---------------- 09. оплата ---------------- */
const Pay = ({ note }: VizProps) => (
  <Scene note={note ?? 'чек'}>
    {/* карта */}
    <g className="vz-in" style={at(60)}>
      <Panel x={24} y={54} width={150} height={96} rx={8} />
      <rect x={24.5} y={70} width={149} height={16} className="vz-tint" />
      {[38, 70, 102, 134].map((x) => (
        <Txt key={x} x={x} y={114} w={22} h={5} tone={x === 134 ? 'hi' : 'bar'} />
      ))}
      <Txt x={38} y={130} w={48} />
    </g>

    {/* платёж уходит */}
    <path d="M174 102H242" className="vz-dash vz-fade" style={at(300)} />
    <rect x={172} y={99} width={12} height={6} rx={1} className="vz-hot vz-go" style={move(64)} />

    {/* подтверждение: круг замыкается, галочка рисуется */}
    <circle cx={280} cy={102} r={36} className="vz-rule vz-fade" style={at(300)} />
    <path pathLength={1} d="M280 66a36 36 0 1 1 0 72a36 36 0 1 1 0-72" className="vz-hot-s vz-trace-b" />
    <path pathLength={1} d="M264 103l11 11 21-24" className="vz-hot-s vz-check vz-trace-c" />

    {/* чек уходит покупателю */}
    <g className="vz-s5">
      <path d="M336 74h40v58l-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4z" className="vz-pick" />
      <Txt x={343} y={85} w={26} tone="on" />
      <Txt x={343} y={95} w={20} />
      <Txt x={343} y={104} w={24} />
      <Txt x={343} y={113} w={14} tone="hot" />
    </g>
  </Scene>
);

/* ---------------- 10. доставка и самовывоз ---------------- */
const TO_DOOR = 'M74 105H180L236 58H316';
const TO_POINT = 'M74 105H180L236 156H316';

const Route = ({ note }: VizProps) => (
  <Scene note={note ?? 'курьер или пункт'}>
    {/* склад */}
    <g className="vz-in" style={at(60)}>
      <Panel x={28} y={82} width={46} height={46} />
      <path d="M28 97.5H74M51 82V97" className="vz-rule" />
      <Label x={28} y={146}>склад</Label>
    </g>

    {/* две дороги */}
    <g className="vz-fade" style={at(200)}>
      <path d={TO_DOOR} className="vz-rule" />
      <path d={TO_POINT} className="vz-rule" />
    </g>

    {/* до двери */}
    <g className="vz-in" style={at(300)}>
      <path d="M322 54l22-18 22 18v28h-44z" className="vz-panel" />
      <rect x={338} y={62} width={12} height={20} className="vz-rule" />
      <Label x={322} y={98}>курьер</Label>
    </g>

    {/* в пункт выдачи */}
    <g className="vz-in" style={at(380)}>
      <Panel x={322} y={134} width={44} height={42} />
      <path d="M322 148.5H366M322 162.5H366M344 134V176" className="vz-rule" />
      <Label x={322} y={192}>пункт выдачи</Label>
    </g>

    {/* заказ едет то одной дорогой, то другой */}
    <path pathLength={1} d={TO_DOOR} className="vz-hot-s vz-route" style={turn(0)} />
    <path d="M322 54l22-18 22 18v28h-44z" className="vz-pick vz-arrive" style={turn(0)} />
    <path pathLength={1} d={TO_POINT} className="vz-hot-s vz-route" style={turn(1)} />
    <rect x={322} y={134} width={44} height={42} className="vz-pick vz-arrive" style={turn(1)} />
  </Scene>
);

/* ---------------- 11. проверки доступности ---------------- */
const CHECKS = 18;
/** Какая по счёту проверка не прошла. */
const MISS = 12;

const Pulse = ({ note }: VizProps) => (
  <Scene note={note ?? 'здесь заметили'}>
    <path d="M24 156.5H376" className="vz-rule vz-fade" />
    {Array.from({ length: CHECKS }, (_, i) => {
      const h = i === MISS ? 104 : 36 + ((i * 37) % 24);
      return (
        <rect
          key={i}
          x={30 + i * 19}
          y={156 - h}
          width={11}
          height={h}
          className={`${i === MISS ? 'vz-edge' : 'vz-tint'} vz-gy`}
          style={at(60 + i * 30)}
        />
      );
    })}
    <Label x={30} y={176} className="vz-fade" style={at(500)}>
      проверка каждые пять минут
    </Label>

    {/* проверка идёт по ряду и на сбое останавливает взгляд */}
    <path d="M35.5 40V164" className="vz-hot-s vz-sweep" style={move((CHECKS - 1) * 19)} />
    <g className="vz-s4">
      <rect x={30 + MISS * 19} y={52} width={11} height={104} className="vz-hot" />
      <path d={`M${35.5 + MISS * 19} 46V28h20`} className="vz-hot-s" />
      <circle cx={35.5 + MISS * 19} cy={28} r={2.5} className="vz-hot" />
    </g>
  </Scene>
);

/* ---------------- 12. сроки и запись ---------------- */
const CELL = 34;
const PITCH = 40;
/** Отмеченный день: пятая клетка среднего ряда. */
const DAY = 11;

const Calendar = ({ note }: VizProps) => (
  <Scene note={note ?? 'занятый слот'}>
    {Array.from({ length: 21 }, (_, i) => (
      <rect
        key={i}
        x={63 + (i % 7) * PITCH}
        y={48 + Math.floor(i / 7) * PITCH}
        width={CELL}
        height={CELL}
        className={`${i === DAY ? 'vz-edge' : 'vz-cell'} vz-fade`}
        style={at(40 + i * 22)}
      />
    ))}

    {/* дни идут по ряду: каждый прошедший отмечен, отмеченный заранее — приближается */}
    <rect x={63} y={48 + PITCH} width={CELL} height={CELL} className="vz-hot-s vz-days" style={move(4 * PITCH)} />
    {[0, 1, 2, 3].map((i) => (
      <circle key={i} cx={80 + i * PITCH} cy={65 + PITCH} r={3} className={`vz-hot vz-s${i + 2}`} />
    ))}
    <g className="vz-s5">
      <rect x={63 + 4 * PITCH} y={48 + PITCH} width={CELL} height={CELL} className="vz-hot" />
      <path d={`M${72 + 4 * PITCH} ${66 + PITCH}l6 6 11-13`} className="vz-check vz-ink-s" />
    </g>
  </Scene>
);

export const VIZ: Record<string, ComponentType<VizProps>> = {
  blocks: Blocks,
  speed: Speed,
  link: LinkCard,
  rows: Rows,
  chart: Chart,
  chat: Chat,
  grid: Grid,
  cart: Cart,
  pay: Pay,
  route: Route,
  pulse: Pulse,
  calendar: Calendar
};
