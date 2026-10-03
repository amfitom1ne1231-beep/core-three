"""
Схема «Путь одного заказа» — сцена для главной (components/Journey.tsx).

Сейчас это проба: кусок плиты, два модуля — «Сайт» и «Каталог», —
канал между ними, заход заказа с края плиты, выход к следующей станции
и полоса обхода мониторинга по краю. Если проба ляжет, сюда добавятся
остальные три станции и вторая раскладка — для телефона.

Запуск (без интерфейса), отдельно на каждую тему:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P brand/blender/scheme.py -- \
      --theme dark --out public/scheme/probe [--width 1800] [--samples 96]

Почему слоями, а не одной картинкой. Ток, жетон заказа, подписи и
подсветку рисует браузер — так схема кликается, читается на любом
экране и не весит мегабайты. Чтобы ток бежал под модулями, а не
поверх них, сцена режется на слои и браузер вкладывает свой ток
между ними:

  plate            плита с пазами и тенью под ней — во весь кадр
  shadow-<id>      тень модуля на плите — во весь кадр, почти пустой
  ── здесь браузер рисует ток ──
  mod-<id>-off     модуль, значок погашен — обрезан по модулю
  mod-<id>-on      модуль, значок горит
  glow-<id>        свечение значка на чёрном — кладётся экраном (screen)
  ── здесь браузер рисует подписи и жетон ──

Камера ортографическая и смотрит строго по изометрии (1, −1, 1): плоскость
плиты проецируется аффинно, поэтому координаты пазов, посчитанные здесь,
совпадают с картинкой до пикселя. Их и пишет map.json.

Оси на экране: +X уходит вправо-вниз, +Y — вправо-вверх под 30°. Цепочка
станций идёт зигзагом +X, +Y, +X… и в целом читается слева направо.
"""

import json
import math
import os
import sys

import addon_utils
import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

# ---------------------------------------------------------------- аргументы

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


THEME = arg('--theme', 'dark')
OUT = os.path.join(arg('--out', 'public/scheme/probe'), THEME)
WIDTH = int(arg('--width', '1800'))
SAMPLES = int(arg('--samples', '96'))
ONLY = arg('--only', None)  # отладка: отрендерить один слой
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- размеры, метры

M = 1.0       # сторона модуля
H = 0.62      # высота корпуса
CAP = 0.07    # серебряная крышка сверху
PL = 0.05     # серебряный цоколь, на котором модуль стоит
PT = 0.30     # толщина плиты
GW = 0.15     # ширина паза
GD = 0.06     # глубина паза
RIM = 0.26    # отступ полосы обхода от края плиты
GLYPH = 0.64  # размер значка на крышке
STROKE = 1.8  # толщина штриха значка, в единицах его сетки 24×24

# станции пробы: центр на плите и значок (те же, что в Journey.tsx)
STATIONS = [
    {'id': 'site', 'n': '01', 'name': 'Сайт', 'at': (0.0, 0.0)},
    {'id': 'catalog', 'n': '02', 'name': 'Каталог', 'at': (3.4, 0.0)},
]
X0, X1 = -2.0, 3.4 + M / 2 + 1.2
Y0, Y1 = -1.35, 2.7

ICONS = {
    # точки «h.01» из иконок сайта заменены кружками: короткий штрих
    # превратился бы в щель, а не в точку
    'site': """
      <rect x="3" y="4.5" width="18" height="13" rx="2"/>
      <path d="M3 8.5h18M9 20h6"/>
      <circle cx="6" cy="6.5" r="0.5"/><circle cx="8.5" cy="6.5" r="0.5"/>""",
    'catalog': """
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/>
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/>
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/>
      <path d="M14 17h6M17 14v6"/>""",
    'bot': """
      <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 20 17H10l-4.5 3.5V17H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5Z"/>
      <circle cx="8" cy="11.3" r="0.6"/><circle cx="12" cy="11.3" r="0.6"/><circle cx="16" cy="11.3" r="0.6"/>""",
    'money': """
      <rect x="2.5" y="5.5" width="19" height="13" rx="2"/>
      <path d="M2.5 9.5h19M6 14.5h4M14.5 14.5l1.5 1.5 3-3"/>""",
    'watch': """
      <path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.1 7.5 9.5 4.4-1.4 7.5-5.1 7.5-9.5V6Z"/>
      <path d="M8 12h2l1.3-2.5 2 5L14.5 12H16"/>"""
}

# ---------------------------------------------------------------- сцена

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable('io_curve_svg', default_set=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
except Exception as e:  # без GPU просто дольше
    print('GPU недоступен:', e)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.render.film_transparent = True


def srgb(hexstr, a=1.0):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], a)


def principled(name, color, rough, metallic=0.0, aniso=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(color)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = rough
    for key in ('Anisotropic', 'Anisotropy'):
        if key in b.inputs:
            b.inputs[key].default_value = aniso
    for key in ('Coat Weight', 'Clearcoat'):
        if key in b.inputs:
            b.inputs[key].default_value = coat
    return m


def stone(name, color, rough, bump=0.12, spec=0.12):
    """Матовая плита: тот же «тёмный камень», что у материала первого экрана.

    Блик срезан: при обычном плита отражала небо студии и выходила сизой,
    как шифер, а не тёмной, как камень на первом экране.
    """
    m = principled(name, color, rough)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    for key in ('Specular IOR Level', 'Specular'):
        if key in b.inputs:
            b.inputs[key].default_value = spec
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 9.0
    noise.inputs['Detail'].default_value = 8.0
    noise.inputs['Roughness'].default_value = 0.62
    bmp = nt.nodes.new('ShaderNodeBump')
    bmp.inputs['Strength'].default_value = bump
    bmp.inputs['Distance'].default_value = 0.02
    nt.links.new(noise.outputs['Fac'], bmp.inputs['Height'])
    nt.links.new(bmp.outputs['Normal'], b.inputs['Normal'])
    # лёгкая неровность цвета — камень, а не пластик
    mix = nt.nodes.new('ShaderNodeMixRGB')
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Fac'].default_value = 0.18
    mix.inputs['Color1'].default_value = srgb(color)
    nt.links.new(noise.outputs['Fac'], mix.inputs['Color2'])
    nt.links.new(mix.outputs['Color'], b.inputs['Base Color'])
    return m


DARK = THEME == 'dark'
# модули одинаковы в обеих темах: синий анодированный и матовое серебро знака
BLUE = principled('blue', '#1b467f', 0.34, metallic=0.75, aniso=0.3, coat=0.35)
SILVER = principled('silver', '#b3bac2', 0.26, metallic=1.0, aniso=0.55)
PLATE = stone('plate', '#0b0e14' if DARK else '#e4e8ee', 0.74 if DARK else 0.6, spec=0.1 if DARK else 0.25)
GROOVE = principled('groove', '#05070a' if DARK else '#c9d0d9', 0.42, metallic=0.4 if DARK else 0.1)
# значок: погашен — тёмная гравировка; горит — свет акцента из глубины паза
GLYPH_MAT = principled('glyph', '#0a0d12', 0.5, metallic=0.3)
# В тёмной теме значок светится почти белым с голубым, в светлой — насыщенным
# синим: светлое свечение на серебряной крышке при дневном свете не видно.
GLOW, GLOW_POWER = ('#8fb8ea', 7.0) if DARK else ('#2f6fd6', 4.0)

# ---------------------------------------------------------------- геометрия


def link(obj):
    scene.collection.objects.link(obj)
    return obj


def box(name, lo, hi, mat, bevel=0.02, segments=3):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((v.co.x + 0.5) * (hi[0] - lo[0]) + lo[0],
                       (v.co.y + 0.5) * (hi[1] - lo[1]) + lo[1],
                       (v.co.z + 0.5) * (hi[2] - lo[2]) + lo[2]))
    bm.to_mesh(mesh)
    bm.free()
    obj = link(bpy.data.objects.new(name, mesh))
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        mod.harden_normals = True
    return obj


def cut(target, cutter, mode='TRANSFER'):
    mod = target.modifiers.new(f'cut_{cutter.name}', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    mod.use_self = True
    if hasattr(mod, 'material_mode'):
        mod.material_mode = mode
    # резец не рендерится, но остаётся в сцене: булева операция берёт его
    # форму при каждом пересчёте
    cutter.hide_render = True
    cutter.display_type = 'WIRE'
    return mod


# --- плита

plate = box('plate', (X0, Y0, -PT), (X1, Y1, 0.0), PLATE, bevel=0.035)

# земля под плитой — только ловит тень, чтобы плита стояла, а не висела
ground = box('ground', (X0 - 12, Y0 - 12, -PT - 0.002), (X1 + 12, Y1 + 12, -PT - 0.001), GROOVE, bevel=0)
ground.is_shadow_catcher = True


def face_point(st, side):
    """Середина грани цоколя: откуда выходит и куда приходит паз."""
    cx, cy = st['at']
    r = M / 2 + 0.06
    return {'+x': (cx + r, cy), '-x': (cx - r, cy), '+y': (cx, cy + r), '-y': (cx, cy - r)}[side]


A, B = STATIONS
# Пазы — ломаные по осям. Порядок точек — по ходу заказа: заход с края
# плиты в «Сайт», от «Сайта» к «Каталогу», от «Каталога» к следующей станции.
CHANNELS = {
    'in': [(X0, 0.0), face_point(A, '-x')],
    'ab': [face_point(A, '+x'), face_point(B, '-x')],
    'out': [face_point(B, '+y'), (B['at'][0], Y1)],
}
# полоса обхода мониторинга: замкнутый контур вдоль края плиты
RIM_PATH = [(X0 + RIM, Y0 + RIM), (X1 - RIM, Y0 + RIM), (X1 - RIM, Y1 - RIM), (X0 + RIM, Y1 - RIM), (X0 + RIM, Y0 + RIM)]


def groove_cutters(points, width, name):
    objs = []
    for i, (p, q) in enumerate(zip(points, points[1:])):
        lo = (min(p[0], q[0]) - width / 2, min(p[1], q[1]) - width / 2, -GD)
        hi = (max(p[0], q[0]) + width / 2, max(p[1], q[1]) + width / 2, 0.2)
        objs.append(box(f'{name}_{i}', lo, hi, GROOVE, bevel=0))
    return objs


cutters = []
for key, pts in CHANNELS.items():
    cutters += groove_cutters(pts, GW, key)
cutters += groove_cutters(RIM_PATH, GW * 0.6, 'rim')
# все резцы — одним объектом: один булев проход вместо десятка
bpy.ops.object.select_all(action='DESELECT')
for c in cutters:
    c.select_set(True)
bpy.context.view_layer.objects.active = cutters[0]
bpy.ops.object.join()
cut(plate, cutters[0])

# --- модули


def import_icon(icon_id):
    """Значок из сетки 24×24 — в кривые Blender, по рамке-эталону."""
    path = os.path.join(bpy.app.tempdir, f'{icon_id}.svg')
    with open(path, 'w') as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" '
                'fill="none" stroke="#000"><path id="frame" d="M0 0H24V24H0Z"/>' + ICONS[icon_id] + '</svg>')
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    frame = next(o for o in new if o.name.startswith('frame'))
    fb = [frame.matrix_world @ Vector(c) for c in frame.bound_box]
    fx0, fy0 = min(v.x for v in fb), min(v.y for v in fb)
    unit = (max(v.x for v in fb) - fx0) / 24  # метров на единицу сетки после импорта
    for o in new:
        for coll in list(o.users_collection):
            coll.objects.unlink(o)
    bpy.data.objects.remove(frame)
    return [o for o in new if o is not frame], (fx0, fy0, unit)


def glyph_cutter(icon_id, center, top):
    curves, (fx0, fy0, unit) = import_icon(icon_id)
    s = GLYPH / 24  # метров на единицу сетки на крышке
    parts = []
    for c in curves:
        link(c)
        c.data.bevel_depth = STROKE / 2 * unit
        c.data.bevel_resolution = 3
        c.data.use_fill_caps = True
        c.data.dimensions = '3D'
        bpy.context.view_layer.objects.active = c
        for o in bpy.context.selected_objects:
            o.select_set(False)
        c.select_set(True)
        bpy.ops.object.convert(target='MESH')
        parts.append(bpy.context.view_layer.objects.active)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    g = parts[0]
    # из сетки значка — на крышку: центр к центру, масштаб к GLYPH,
    # ось x значка вдоль +X мира, «верх» значка вдоль +Y
    k = s / unit
    mw = g.matrix_world.copy()
    for v in g.data.vertices:
        w = mw @ v.co
        x = (w.x - fx0) / unit - 12
        y = (w.y - fy0) / unit - 12
        v.co = Vector((center[0] + x * s, center[1] + y * s, top + w.z * k))
    g.matrix_world = g.matrix_world.Identity(4)
    g.data.materials.clear()
    g.data.materials.append(GLYPH_MAT)
    g.name = f'glyph_{icon_id}'
    return g


MODULES = {}
for st in STATIONS:
    cx, cy = st['at']
    r = M / 2
    plinth = box(f'plinth_{st["id"]}', (cx - r - 0.06, cy - r - 0.06, 0.0), (cx + r + 0.06, cy + r + 0.06, PL), SILVER, bevel=0.012)
    body = box(f'body_{st["id"]}', (cx - r, cy - r, PL), (cx + r, cy + r, PL + H), BLUE, bevel=0.03)
    top = PL + H + CAP
    cap = box(f'cap_{st["id"]}', (cx - r + 0.03, cy - r + 0.03, PL + H), (cx + r - 0.03, cy + r - 0.03, top), SILVER, bevel=0.018)
    cut(cap, glyph_cutter(st['id'], (cx, cy), top))
    MODULES[st['id']] = [plinth, body, cap]


def bake(objs):
    """Модификаторы — в сетку. Точная булева операция медленная, а без
    этого Blender пересчитывал её перед каждым слоем."""
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if not o.modifiers:
            continue
        mesh = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.clear()
        o.data = mesh


bake([plate] + [o for objs in MODULES.values() for o in objs])
for o in list(scene.objects):
    if o.type == 'MESH' and o.display_type == 'WIRE':
        bpy.data.objects.remove(o)

# ---------------------------------------------------------------- свет и мир

world = bpy.data.worlds.new('studio')
scene.world = world
world.use_nodes = True
wn, wl = world.node_tree.nodes, world.node_tree.links
bg = wn['Background']
tc, sep = wn.new('ShaderNodeTexCoord'), wn.new('ShaderNodeSeparateXYZ')
ramp, mp = wn.new('ShaderNodeValToRGB'), wn.new('ShaderNodeMapRange')
ramp.color_ramp.elements[0].position = 0.35
ramp.color_ramp.elements[0].color = (0.004, 0.005, 0.009, 1) if DARK else (0.25, 0.27, 0.30, 1)
ramp.color_ramp.elements[1].position = 0.85
ramp.color_ramp.elements[1].color = (0.30, 0.36, 0.46, 1) if DARK else (0.95, 0.96, 0.98, 1)
mp.inputs['From Min'].default_value = -1
mp.inputs['From Max'].default_value = 1
wl.new(tc.outputs['Generated'], sep.inputs[0])
wl.new(sep.outputs['Z'], mp.inputs['Value'])
wl.new(mp.outputs['Result'], ramp.inputs['Fac'])
wl.new(ramp.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 0.9 if DARK else 0.8

VIEW = Vector((1, -1, 1)).normalized()   # откуда смотрит камера
RIGHT = Vector((1, 1, 0)).normalized()    # вправо на экране
UP = RIGHT.cross(-VIEW).normalized()      # вверх на экране
CENTER = Vector(((X0 + X1) / 2, (Y0 + Y1) / 2, 0.2))


def area(name, offset, size, energy, color):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.size, ld.energy, ld.color = size, energy, srgb(color)[:3]
    o = link(bpy.data.objects.new(name, ld))
    o.location = CENTER + offset
    o.rotation_euler = (CENTER - o.location).to_track_quat('-Z', 'Y').to_euler()
    return o


# ключ слева сверху по экрану, заполняющий справа, контровой акцентом сзади
area('key', -RIGHT * 6 + UP * 5 + VIEW * 4, 5.0, 2600 if DARK else 1800, '#f2f5fa')
area('fill', RIGHT * 7 + VIEW * 5, 7.0, 700 if DARK else 900, '#c7d6ea')
area('rim', -VIEW * 6 + UP * 4, 5.0, 2400 if DARK else 900, '#6e9bcc')
area('top', Vector((0, 0, 9)), 6.0, 900 if DARK else 1100, '#ffffff')

# ---------------------------------------------------------------- камера

corners = [Vector((x, y, z)) for x in (X0, X1) for y in (Y0, Y1) for z in (-PT, PL + H + CAP)]
xs = [c.dot(RIGHT) for c in corners]
ys = [c.dot(UP) for c in corners]
MARGIN = 0.35
span_x = max(xs) - min(xs) + 2 * MARGIN
span_y = max(ys) - min(ys) + 2 * MARGIN
mid = RIGHT * ((max(xs) + min(xs)) / 2) + UP * ((max(ys) + min(ys)) / 2)

cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = span_x
cam_data.sensor_fit = 'HORIZONTAL'
cam = link(bpy.data.objects.new('cam', cam_data))
cam.location = mid + VIEW * 30
cam.rotation_euler = (-VIEW).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam
W = WIDTH
HH = int(round(WIDTH * span_y / span_x / 2) * 2)
scene.render.resolution_x, scene.render.resolution_y = W, HH
scene.render.resolution_percentage = 100


def px(p):
    """Точка мира → пиксель кадра (от левого верхнего угла)."""
    v = world_to_camera_view(scene, cam, Vector(p))
    return [round(v.x * W, 1), round((1 - v.y) * HH, 1)]


# ---------------------------------------------------------------- слои

def set_visible(objs_on):
    for o in scene.objects:
        if o.type == 'MESH':
            o.hide_render = o not in objs_on


def evaluated_box(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objs:
        e = o.evaluated_get(dg)
        pts += [e.matrix_world @ Vector(c) for c in e.bound_box]
    vs = [world_to_camera_view(scene, cam, p) for p in pts]
    return min(v.x for v in vs), max(v.x for v in vs), min(v.y for v in vs), max(v.y for v in vs)


def crop_to(objs, pad_px):
    x0, x1, y0, y1 = evaluated_box(objs)
    l = max(0, math.floor(x0 * W - pad_px))
    r = min(W, math.ceil(x1 * W + pad_px))
    b = max(0, math.floor(y0 * HH - pad_px))
    t = min(HH, math.ceil(y1 * HH + pad_px))
    scene.render.use_border = True
    scene.render.use_crop_to_border = True
    scene.render.border_min_x, scene.render.border_max_x = l / W, r / W
    scene.render.border_min_y, scene.render.border_max_y = b / HH, t / HH
    return {'x': l, 'y': HH - t, 'w': r - l, 'h': t - b}


def full_frame():
    scene.render.use_border = False
    scene.render.use_crop_to_border = False
    return {'x': 0, 'y': 0, 'w': W, 'h': HH}


def render(name, rgba=True, quality=88):
    if ONLY and ONLY != name:
        return
    s = scene.render.image_settings
    s.file_format = 'WEBP'
    s.color_mode = 'RGBA' if rgba else 'RGB'
    s.quality = quality
    scene.render.filepath = os.path.join(OUT, f'{name}.webp')
    bpy.ops.render.render(write_still=True)
    print('слой', name)


def glyph_lit(on):
    nt = GLYPH_MAT.node_tree
    b = nt.nodes['Principled BSDF']
    if on:
        b.inputs['Emission Color'].default_value = srgb(GLOW)
        b.inputs['Emission Strength'].default_value = GLOW_POWER
    else:
        b.inputs['Emission Strength'].default_value = 0.0


HOLDOUT = {}


def holdout_all(on):
    """Свечение рендерится на чёрном: всё, кроме света значка, — пустота."""
    for m in (BLUE, SILVER, PLATE, GROOVE):
        nt = m.node_tree
        out = nt.nodes['Material Output']
        if on:
            h = nt.nodes.new('ShaderNodeHoldout')
            HOLDOUT[m.name] = [l.from_socket for l in out.inputs['Surface'].links]
            nt.links.new(h.outputs[0], out.inputs['Surface'])
        else:
            for l in list(out.inputs['Surface'].links):
                nt.links.remove(l)
            for sock in HOLDOUT.get(m.name, []):
                nt.links.new(sock, out.inputs['Surface'])


layers = {}
all_modules = [o for objs in MODULES.values() for o in objs]

# плита: без модулей, с тенью под собой
set_visible([plate, ground])
plate.is_shadow_catcher = False
layers['plate'] = full_frame()
render('plate', quality=90)

# Тени модулей: плита ловит тень, сам модуль камере не виден. Слой — во
# весь кадр: ловец чуть затемняет плиту и вдали от модуля (заслонённое
# небо студии), и у обрезанного слоя проступал прямоугольник. Вес держит
# сжатие: в тени нет мелких деталей.
for sid, objs in MODULES.items():
    set_visible([plate] + objs)
    plate.is_shadow_catcher = True
    for o in objs:
        o.visible_camera = False
    layers[f'shadow-{sid}'] = full_frame()
    render(f'shadow-{sid}', quality=70)
    for o in objs:
        o.visible_camera = True
plate.is_shadow_catcher = False
full_frame()

# модули: плита камере не видна, но отражается в серебре и подсвечивает снизу
plate.visible_camera = False
for sid, objs in MODULES.items():
    set_visible([plate] + objs)
    box_px = crop_to(objs, 10)
    for state in ('off', 'on'):
        glyph_lit(state == 'on')
        layers[f'mod-{sid}-{state}'] = box_px
        render(f'mod-{sid}-{state}')
    # свечение: тот же кадр, всё остальное — чёрное
    scene.render.film_transparent = False
    world_strength = bg.inputs['Strength'].default_value
    bg.inputs['Strength'].default_value = 0.0
    holdout_all(True)
    layers[f'glow-{sid}'] = box_px
    render(f'glow-{sid}', rgba=False, quality=82)
    holdout_all(False)
    bg.inputs['Strength'].default_value = world_strength
    scene.render.film_transparent = True
    glyph_lit(False)
plate.visible_camera = True

# ---------------------------------------------------------------- карта

FLOOR = -GD + 0.005  # ток бежит по дну паза
modules_map = {}
for st in STATIONS:
    cx, cy = st['at']
    r = M / 2
    top = PL + H + CAP
    modules_map[st['id']] = {
        'n': st['n'],
        'name': st['name'],
        # центр крышки — сюда ложится выноска; правый угол — подпись
        'top': px((cx, cy, top)),
        'right': px((cx + r, cy + r, top)),
        'peak': px((cx - r, cy + r, top)),
        'base': px((cx, cy, 0)),
        # контур модуля на экране — область нажатия
        'hit': [px((cx + dx * r, cy + dy * r, z)) for dx, dy, z in
                ((-1, -1, top), (-1, 1, top), (1, 1, top), (1, 1, 0), (1, -1, 0), (-1, -1, 0))]
    }

data = {
    'theme': THEME,
    'size': [W, HH],
    'layers': layers,
    'modules': modules_map,
    'channels': {k: [px((x, y, FLOOR)) for x, y in pts] for k, pts in CHANNELS.items()},
    'rim': [px((x, y, FLOOR)) for x, y in RIM_PATH],
    # единичные оси мира в пикселях — чтобы рисовать в той же изометрии
    'axes': {k: [b - a for a, b in zip(px((0, 0, 0)), px(v))] for k, v in
             (('x', (1, 0, 0)), ('y', (0, 1, 0)), ('z', (0, 0, 1)))}
}
with open(os.path.join(OUT, 'map.json'), 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
print('карта', os.path.join(OUT, 'map.json'))
