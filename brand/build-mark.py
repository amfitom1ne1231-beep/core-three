#!/usr/bin/env python3
"""Генератор знака CoreThree.

Геометрия выведена из обмера растрового логотипа (brand/Логотип.jpg):
контур обведён численно, углы привязаны к точной изометрии (±30/±60/±90),
центр трёхкратной симметрии найден перебором (совпадение 96%).
Строится один луч, остальные два — поворотом на 120°, поэтому симметрия
точна по построению, а не на глаз.

Объём плоского знака передаётся прозрачностью фасетов, как в исходном
трёхмерном знаке: шапка колонны, тёмная грань, светлая грань.
"""
import math

C = (50.0, 60.0)          # центр трёхкратной симметрии
APEX = (50.0, 2.50)       # вершина колонны
CAP_L = (36.40, 10.35)    # левая вершина ромба шапки
CAP_R = (63.60, 10.35)    # правая
CAP_F = (50.00, 18.20)    # передняя (нижняя) вершина ромба
COL_L = (36.40, 23.80)    # низ вертикальной левой грани
COL_R = (63.60, 23.80)
NOTCH_L = (32.41, 23.80)  # ступенька к клину
NOTCH_R = (67.59, 23.80)
SEAM_L = (21.13, 43.33)   # граница сектора, ровно -150° от центра
SEAM_R = (78.87, 43.33)   # ровно -30°

# Три фасета одного луча: шапка колонны и две её грани.
# Вместе они точно замощают сектор.
#
# Пробовал дробить грани отдельными клиньями, как в исходном знаке, —
# шесть сходящихся в центр клиньев читаются вертушкой и убивают
# колонну. Оставлено три: колонна с шапкой узнаётся сразу.
#
# Прозрачности повторяют светотень исходника: тёмная грань слева,
# светлая справа, шапка между ними.
FACETS = [
    ('cap',   0.82, [CAP_L, APEX, CAP_R, CAP_F]),
    ('left',  0.55, [C, CAP_F, CAP_L, COL_L, NOTCH_L, SEAM_L]),
    ('right', 1.00, [C, SEAM_R, NOTCH_R, COL_R, CAP_R, CAP_F]),
]

ARMS = [('honesty', 'Честность', 0), ('speed', 'Скорость', 120), ('craft', 'Профессионализм', 240)]


def rot(p, deg, c=C):
    a = math.radians(deg)
    dx, dy = p[0] - c[0], p[1] - c[1]
    return (c[0] + dx * math.cos(a) - dy * math.sin(a),
            c[1] + dx * math.sin(a) + dy * math.cos(a))


def shrink(pts, gap):
    """Волосяной зазор: сдвигаем фасет к его центру."""
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    return [(cx + (p[0] - cx) * gap, cy + (p[1] - cy) * gap) for p in pts]


def build(gap):
    out = []
    for arm, label, deg in ARMS:
        for name, op, pts in FACETS:
            rotated = [rot(p, deg) for p in pts]
            out.append((arm, label, name, op, rotated))
    # вписываем в квадрат 0..100 с полем
    xs = [p[0] for *_, pts in out for p in pts]
    ys = [p[1] for *_, pts in out for p in pts]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    k = 94.0 / max(w, h)
    ox = (100 - w * k) / 2 - min(xs) * k
    oy = (100 - h * k) / 2 - min(ys) * k
    fitted = []
    for arm, label, name, op, pts in out:
        p2 = [(x * k + ox, y * k + oy) for x, y in pts]
        fitted.append((arm, label, name, op, shrink(p2, gap) if gap < 1 else p2))
    return fitted


def path(pts):
    return 'M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in pts) + ' Z'


def svg(facets, flat=False, title='CoreThree'):
    lines = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" '
             'fill="currentColor" role="img" aria-label="CoreThree">',
             f'  <title>{title}</title>']
    last_arm = None
    for arm, label, name, op, pts in facets:
        if arm != last_arm:
            if last_arm is not None:
                lines.append('  </g>')
            lines.append(f'  <g data-arm="{arm}" data-core="{label}">')
            last_arm = arm
        opacity = '' if flat else f' fill-opacity="{op}"'
        lines.append(f'    <path data-facet="{name}"{opacity} d="{path(pts)}"/>')
    lines.append('  </g>')
    lines.append('</svg>')
    return '\n'.join(lines) + '\n'


def ts(facets):
    """Геометрия для React: сгруппирована по лучам, чтобы прелоадер
    собирал знак из трёх частей."""
    arms = {}
    for arm, label, name, op, pts in facets:
        arms.setdefault((arm, label), []).append((name, op, pts))
    out = ['// Сгенерировано brand/build-mark.py — правки вносить там.',
           '',
           'export type MarkFacet = { facet: string; opacity: number; d: string };',
           'export type MarkArm = { arm: string; core: string; facets: MarkFacet[] };',
           '',
           'export const MARK_ARMS: MarkArm[] = [']
    for (arm, label), fs in arms.items():
        out.append('  {')
        out.append(f"    arm: '{arm}',")
        out.append(f"    core: '{label}',")
        out.append('    facets: [')
        for name, op, pts in fs:
            out.append(f"      {{ facet: '{name}', opacity: {op}, d: '{path(pts)}' }},")
        out.append('    ]')
        out.append('  },')
    out.append('];')
    out.append('')
    out.append('/** Центр трёхкратной симметрии в системе viewBox — вокруг него вращаются лучи. */')
    out.append('export const MARK_CENTER = { x: 50, y: 59.44 };')
    out.append('')
    return '\n'.join(out)


# Основной знак: три луча по три фасета, объём прозрачностью, зазоры волосяные.
faceted = build(0.985)
open('brand/mark.svg', 'w').write(svg(faceted))
# Плоский монолит без зазоров и полутонов — для favicon и размеров до 20px.
open('brand/mark-solid.svg', 'w').write(svg(build(1.0), flat=True))
open('components/mark-geometry.ts', 'w').write(ts(faceted))
print('собрано: brand/mark.svg, brand/mark-solid.svg, components/mark-geometry.ts')
