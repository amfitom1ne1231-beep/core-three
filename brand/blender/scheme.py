"""
Схема «Путь одного заказа» — сцена для главной.

Образ выбран по пробе (BRIEF.md, раздел 25): чёрное полированное стекло
и студийный свет, как у предметной съёмки Apple; луч с дымкой из
«Kling» рисует браузер поверх, живым. Станции — модули знака: синий корпус,
стеклянная крышка, под стеклом светится значок. Пазы — световые вставки
вровень с плитой. В светлой теме — белое глянцевое стекло без дымки.

Запуск (без интерфейса), на каждую тему:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P brand/blender/scheme.py -- \
      --theme dark --out public/scheme [--width 1800] [--samples 256] [--still путь.png] [--map-only]

Что получается. Сцена рендерится целиком — основа со всеми отражениями
(base). Для каждой станции и каждого паза — та же сцена, где горит
только он, обрезанная по своему участку (lit-<id>). Шум у всех рендеров
одного зерна, поэтому вне изменившегося света пиксели совпадают с
основой, и вставку на ней не видно. Браузер проявляет вариант «паз
горит» маской, бегущей по пазу, — это и есть ток: настоящий свет
с отражением в стекле, а не нарисованная поверх линия.

map.json — те же точки в пикселях кадра: пазы, станции, подписи,
области нажатия и кадры вариантов.
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

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


THEME = arg('--theme', 'dark')
OUT = os.path.join(arg('--out', 'public/scheme'), THEME)
WIDTH = int(arg('--width', '1800'))
SAMPLES = int(arg('--samples', '256'))
STILL = arg('--still', None)  # один кадр «как будет» — для поиска образа
# только map.json, без рендера: когда поменялись подписи, а не свет
MAP_ONLY = '--map-only' in argv
DARK = THEME == 'dark'
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- размеры, метры

M, H = 1.0, 0.72         # модуль: сторона и высота корпуса
PL = 0.05                # серебряный цоколь
GLASS = 0.07             # стеклянная крышка
GW, GD = 0.12, 0.05      # паз: ширина и глубина
INLAY = -0.006           # верх световой вставки — почти вровень с плитой
GLYPH, STROKE = 0.62, 1.6
R = M / 2 + 0.06         # от центра модуля до грани цоколя

# станции по ходу заказа; мониторинг — дозорная колонна над контуром
STATIONS = [
    ('site', (0.0, 0.0), 1.0),
    ('catalog', (3.2, 0.0), 1.0),
    ('bot', (3.2, 2.9), 1.0),
    ('money', (6.4, 2.9), 1.0),
    ('watch', (-0.3, 3.5), 1.5),
]
CHANNELS = {
    'in': [(-4.5, 0.0), (-R, 0.0)],
    'ab': [(R, 0.0), (3.2 - R, 0.0)],
    'bc': [(3.2, R), (3.2, 2.9 - R)],
    'cd': [(3.2 + R, 2.9), (6.4 - R, 2.9)],
    'out': [(6.4, 2.9 + R), (6.4, 9.0)],
    # от дозорной колонны в контур; не «watch» — так зовут саму станцию,
    # и вариант паза затирал вариант колонны
    'guard': [(-0.3, 3.5 - R), (-0.3, 2.35)],
}
LOOP = [(-1.25, -1.2), (7.55, -1.2), (7.55, 2.35), (-1.25, 2.35), (-1.25, -1.2)]

ICONS = {
    'site': '<rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="M3 8.5h18M9 20h6"/>'
            '<circle cx="6" cy="6.5" r="0.5"/><circle cx="8.5" cy="6.5" r="0.5"/>',
    'catalog': '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/>'
               '<rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M14 17h6M17 14v6"/>',
    'bot': '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 20 17H10l-4.5 3.5V17H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5Z"/>'
           '<circle cx="8" cy="11.3" r="0.6"/><circle cx="12" cy="11.3" r="0.6"/><circle cx="16" cy="11.3" r="0.6"/>',
    'money': '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 9.5h19M6 14.5h4M14.5 14.5l1.5 1.5 3-3"/>',
    'watch': '<path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.1 7.5 9.5 4.4-1.4 7.5-5.1 7.5-9.5V6Z"/><path d="M8 12h2l1.3-2.5 2 5L14.5 12H16"/>',
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
except Exception as e:
    print('GPU недоступен:', e)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
# одно зерно на все рендеры: вне изменившегося света шум совпадает
# с основой до пикселя, и вставку варианта на ней не видно
scene.cycles.seed = 7
scene.cycles.use_animated_seed = False
scene.cycles.max_bounces = 8
scene.cycles.transmission_bounces = 8
scene.cycles.volume_bounces = 1
# светлячки и каустики стекла — источник редких ярких пикселей
scene.cycles.sample_clamp_indirect = 4.0
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.render.resolution_x = WIDTH
scene.render.resolution_y = WIDTH // 2
W, HH = WIDTH, WIDTH // 2


def srgb(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], 1.0)


def bsdf(name, color, rough, metallic=0.0, coat=0.0, aniso=0.0, spec=0.5, transmission=0.0, ior=1.45):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metallic
    b.inputs['IOR'].default_value = ior
    for key, val in (('Coat Weight', coat), ('Anisotropic', aniso), ('Specular IOR Level', spec),
                     ('Transmission Weight', transmission)):
        if key in b.inputs:
            b.inputs[key].default_value = val
    return m


def emission(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = srgb(color)
    e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    return m


def set_strength(mat, value):
    mat.node_tree.nodes['Emission'].inputs['Strength'].default_value = value


# свет тока: в тёмной теме — холодный голубой, в светлой — насыщенный синий
# (светлое свечение на белом стекле днём не видно)
ACCENT = '#8fc0ff' if DARK else '#2f6fd6'
IDLE, HOT = (0.9, 60.0) if DARK else (1.4, 14.0)
GLYPH_IDLE, GLYPH_HOT = (1.6, 26.0) if DARK else (1.2, 9.0)

PLATE = bsdf('plate', '#06080c' if DARK else '#e7ebf0', 0.16 if DARK else 0.12, spec=0.7 if DARK else 0.5)
nt = PLATE.node_tree
noise = nt.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 3.5
mr = nt.nodes.new('ShaderNodeMapRange')
mr.inputs['To Min'].default_value = 0.08 if DARK else 0.06
mr.inputs['To Max'].default_value = 0.26 if DARK else 0.2
nt.links.new(noise.outputs['Fac'], mr.inputs['Value'])
nt.links.new(mr.outputs['Result'], nt.nodes['Principled BSDF'].inputs['Roughness'])

GROOVE = bsdf('groove', '#020304' if DARK else '#c3cad3', 0.35, metallic=0.6 if DARK else 0.2)
BLUE = bsdf('blue', '#163d73', 0.28, metallic=0.85, coat=0.6)
SILVER = bsdf('silver', '#c4cad1', 0.18, metallic=1.0, aniso=0.6)
FROST = bsdf('frost', '#e9f1fb', 0.32, transmission=1.0, ior=1.45, spec=0.5)
# плата под стеклом: в светлой теме светлая — тёмная на белом стекле
# делала крышки тяжёлыми серыми плитками
BOARD = bsdf('board', '#0b0f15' if DARK else '#dfe5ec', 0.5, metallic=0.2)

# у каждого источника свой материал: варианты включают их по одному
LINE = {k: emission(f'line_{k}', ACCENT, IDLE) for k in CHANNELS}
LINE['loop'] = emission('line_loop', ACCENT, IDLE * 0.7)
GLYPHS = {sid: emission(f'glyph_{sid}', ACCENT, GLYPH_IDLE) for sid, _, _ in STATIONS}
RINGS = {sid: emission(f'ring_{sid}', ACCENT, 0.0) for sid, _, _ in STATIONS}

# ---------------------------------------------------------------- геометрия


def link(o):
    scene.collection.objects.link(o)
    return o


def box(name, lo, hi, mat, bevel=0.0, seg=4):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((v.co.x + 0.5) * (hi[0] - lo[0]) + lo[0],
                       (v.co.y + 0.5) * (hi[1] - lo[1]) + lo[1],
                       (v.co.z + 0.5) * (hi[2] - lo[2]) + lo[2]))
    bm.to_mesh(mesh)
    bm.free()
    o = link(bpy.data.objects.new(name, mesh))
    o.data.materials.append(mat)
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL')
        b.width, b.segments, b.limit_method, b.harden_normals = bevel, seg, 'ANGLE', True
    return o


def apply_mods(o):
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = mesh


plate = box('plate', (-12, -12, -0.4), (18, 18, 0.0), PLATE)
cut_parts = []


def groove(points, width, light_mat, name):
    """Прорезь в плите и световая вставка в ней — почти вровень с поверхностью:
    жила на дне паза при взгляде под 27° пряталась за стенками."""
    for i, (p, q) in enumerate(zip(points, points[1:])):
        lo = (min(p[0], q[0]) - width / 2, min(p[1], q[1]) - width / 2, -GD)
        hi = (max(p[0], q[0]) + width / 2, max(p[1], q[1]) + width / 2, 0.3)
        cut_parts.append(box(f'cut_{name}_{i}', lo, hi, GROOVE))
        w2 = width * 0.24
        along_x = p[1] == q[1]
        box(f'line_{name}_{i}',
            (lo[0] if along_x else p[0] - w2, p[1] - w2 if along_x else lo[1], INLAY - 0.008),
            (hi[0] if along_x else p[0] + w2, p[1] + w2 if along_x else hi[1], INLAY), light_mat)


for key, pts in CHANNELS.items():
    groove(pts, GW, LINE[key], key)
groove(LOOP, GW * 0.7, LINE['loop'], 'loop')

bpy.ops.object.select_all(action='DESELECT')
for c in cut_parts:
    c.select_set(True)
bpy.context.view_layer.objects.active = cut_parts[0]
bpy.ops.object.join()
cutter = cut_parts[0]
mod = plate.modifiers.new('cut', 'BOOLEAN')
mod.operation, mod.solver, mod.object = 'DIFFERENCE', 'EXACT', cutter
# резцы пересекаются друг с другом; без этого точная булева операция
# молча возвращала пустую плиту
mod.use_self = True
if hasattr(mod, 'material_mode'):
    mod.material_mode = 'TRANSFER'
apply_mods(plate)
assert len(plate.data.polygons) > 0, 'плита пустая после вырезания пазов'
bpy.data.objects.remove(cutter)


def import_icon(icon_id):
    path = os.path.join(bpy.app.tempdir, f'{icon_id}.svg')
    with open(path, 'w') as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#000">'
                '<path id="frame" d="M0 0H24V24H0Z"/>' + ICONS[icon_id] + '</svg>')
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    frame = next(o for o in new if o.name.startswith('frame'))
    fb = [frame.matrix_world @ Vector(c) for c in frame.bound_box]
    fx0, fy0 = min(v.x for v in fb), min(v.y for v in fb)
    unit = (max(v.x for v in fb) - fx0) / 24
    for o in new:
        for coll in list(o.users_collection):
            coll.objects.unlink(o)
    bpy.data.objects.remove(frame)
    return [o for o in new if o is not frame], (fx0, fy0, unit)


def glyph(icon_id, center, z, mat):
    """Значок светящейся жилой на плате под стеклом крышки."""
    curves, (fx0, fy0, unit) = import_icon(icon_id)
    parts = []
    for c in curves:
        link(c)
        c.data.bevel_depth = STROKE / 2 * unit
        c.data.bevel_resolution = 2
        c.data.use_fill_caps = True
        c.data.dimensions = '3D'
        bpy.ops.object.select_all(action='DESELECT')
        c.select_set(True)
        bpy.context.view_layer.objects.active = c
        bpy.ops.object.convert(target='MESH')
        parts.append(bpy.context.view_layer.objects.active)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    g = parts[0]
    s = GLYPH / 24
    k = s / unit
    mw = g.matrix_world.copy()
    for v in g.data.vertices:
        w = mw @ v.co
        v.co = Vector((center[0] + ((w.x - fx0) / unit - 12) * s, center[1] + ((w.y - fy0) / unit - 12) * s, z + w.z * k * 0.4))
    g.matrix_world = g.matrix_world.Identity(4)
    g.data.materials.clear()
    g.data.materials.append(mat)
    return g


TOPS = {}
for sid, (cx, cy), tall in STATIONS:
    r = M / 2
    top = PL + H * tall
    TOPS[sid] = top
    box(f'plinth_{sid}', (cx - R, cy - R, 0.0), (cx + R, cy + R, PL), SILVER, bevel=0.012)
    box(f'body_{sid}', (cx - r, cy - r, PL), (cx + r, cy + r, top), BLUE, bevel=0.06, seg=6)
    box(f'board_{sid}', (cx - r + 0.06, cy - r + 0.06, top), (cx + r - 0.06, cy + r - 0.06, top + 0.01), BOARD)
    glyph(sid, (cx, cy), top + 0.012, GLYPHS[sid])
    box(f'glass_{sid}', (cx - r + 0.03, cy - r + 0.03, top), (cx + r - 0.03, cy + r - 0.03, top + GLASS), FROST, bevel=0.02, seg=4)
    # световое кольцо по шву корпуса и крышки: горит, когда станция активна
    box(f'ring_{sid}', (cx - r - 0.004, cy - r - 0.004, top - 0.018), (cx + r + 0.004, cy + r + 0.004, top - 0.006), RINGS[sid], bevel=0.01)

# ---------------------------------------------------------------- свет

world = bpy.data.worlds.new('w')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = srgb('#0a0c10' if DARK else '#f2f4f7')
bg.inputs['Strength'].default_value = 0.25 if DARK else 0.9

CENTER = Vector((3.0, 1.6, 0.4))


def aim(o, target):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()


def area(name, loc, size, energy, color, size_y=None, target=CENTER):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size, ld.size_y = size, size_y or size
    ld.energy, ld.color = energy, srgb(color)[:3]
    o = link(bpy.data.objects.new(name, ld))
    o.location = loc
    aim(o, target)
    return o


# студия: мягкий верхний свет сзади, полосы по бокам — грани корпусов,
# слабое заполнение спереди. Широкая панель сзади стоит под углом взгляда
# камеры — её отражение и есть длинный блик по стеклу плиты
area('top', (3.0, 5.5, 8.0), 9, 5200 if DARK else 2600, '#f4f8ff', size_y=2.5)
area('strip_l', (-7, 1.5, 3.0), 0.6, 600 if DARK else 700, '#dfe9ff', size_y=8)
area('strip_r', (12, 3.5, 3.0), 0.6, 1600 if DARK else 900, '#cfe0ff', size_y=8)
area('fill', (6, -9, 5), 8, 500 if DARK else 900, '#c8d6ea')
area('mirror', (-7.0, 11.0, 6.5), 16, 1100 if DARK else 600, '#e8f0ff', size_y=3.5)

# Луч и дымка из «Kling» в рендер не входят: запечённые, они либо не
# видны, либо заливают чёрное стекло серым — и в любом случае стоят на
# месте. Их рисует браузер поверх: наклонный столб света, который
# медленно дышит, и пылинки, плывущие в нём (components/scheme).

# ---------------------------------------------------------------- камера

cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 85
cam_data.sensor_width = 36
cam_data.dof.use_dof = True
# Модули — метр в стороне, и при честной диафрагме вся сцена резкая.
# «Макро»-диафрагма даёт глубину предметной съёмки: средняя станция
# резкая, дальний край плиты уходит в мягкость
cam_data.dof.aperture_fstop = 0.3
cam = link(bpy.data.objects.new('cam', cam_data))
target = Vector((3.0, 1.45, 0.3))
el, dist = math.radians(27), 23.0
dirv = Vector((math.cos(el) / math.sqrt(2), -math.cos(el) / math.sqrt(2), math.sin(el)))
cam.location = target + dirv * dist
aim(cam, target)
focus = link(bpy.data.objects.new('focus', None))
focus.location = (2.6, 0.9, 0.5)
cam_data.dof.focus_object = focus
scene.camera = cam
# матрица камеры обновляется при пересчёте сцены; рендер делает это сам,
# а в режиме «только карта» проекция без этого считалась от нуля
bpy.context.view_layer.update()


def px(p):
    v = world_to_camera_view(scene, cam, Vector(p))
    return [round(v.x * W, 1), round((1 - v.y) * HH, 1)]


# ---------------------------------------------------------------- рендер

def render(name, crop=None, quality=86):
    if MAP_ONLY:
        return
    if crop:
        l, t, w, h = crop['x'], crop['y'], crop['w'], crop['h']
        scene.render.use_border = True
        scene.render.use_crop_to_border = True
        scene.render.border_min_x, scene.render.border_max_x = l / W, (l + w) / W
        scene.render.border_min_y, scene.render.border_max_y = (HH - t - h) / HH, (HH - t) / HH
    else:
        scene.render.use_border = False
        scene.render.use_crop_to_border = False
    s = scene.render.image_settings
    s.file_format, s.color_mode, s.quality = 'WEBP', 'RGB', quality
    scene.render.filepath = os.path.join(OUT, f'{name}.webp')
    bpy.ops.render.render(write_still=True)
    print('слой', name)


def box_px(points, pad):
    ps = [px(p) for p in points]
    l = max(0, math.floor(min(p[0] for p in ps) - pad))
    r = min(W, math.ceil(max(p[0] for p in ps) + pad))
    t = max(0, math.floor(min(p[1] for p in ps) - pad))
    b = min(HH, math.ceil(max(p[1] for p in ps) + pad))
    return {'x': l, 'y': t, 'w': r - l, 'h': b - t}


def hull(points):
    """Выпуклая оболочка — область нажатия модуля на экране."""
    pts = sorted(set(map(tuple, points)))
    if len(pts) < 3:
        return [list(p) for p in pts]

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return [list(p) for p in lower[:-1] + upper[:-1]]


if STILL:
    # кадр «как будет»: горит «Сайт», по «Сайт → Каталог» идёт ток
    set_strength(GLYPHS['site'], GLYPH_HOT)
    set_strength(RINGS['site'], GLYPH_HOT * 0.5)
    set_strength(LINE['ab'], HOT * 0.4)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = STILL
    bpy.ops.render.render(write_still=True)
    sys.exit(0)

layers = {'base': {'x': 0, 'y': 0, 'w': W, 'h': HH}}
render('base', quality=88)

modules = {}
for sid, (cx, cy), tall in STATIONS:
    r, top = M / 2, TOPS[sid] + GLASS
    corners = [(cx + dx * r, cy + dy * r, z) for dx in (-1, 1) for dy in (-1, 1) for z in (0.0, top)]
    # отражение горящей крышки уходит в стекло под модулем — вариант
    # захватывает и его
    mirror = [(x, y, -z) for x, y, z in corners]
    crop = box_px(corners + mirror, 40)
    set_strength(GLYPHS[sid], GLYPH_HOT)
    set_strength(RINGS[sid], GLYPH_HOT * 0.5)
    layers[f'lit-{sid}'] = crop
    render(f'lit-{sid}', crop)
    set_strength(GLYPHS[sid], GLYPH_IDLE)
    set_strength(RINGS[sid], 0.0)
    modules[sid] = {
        'top': px((cx, cy, top)),
        # подпись справа от модуля (у правого края кадра — слева), выноска —
        # над дальним углом крышки
        'label': px((cx + r, cy + r, top * 0.55)),
        'labelLeft': px((cx - r, cy - r, top * 0.55)),
        'peak': px((cx - r, cy + r, top)),
        'hit': hull([px(c) for c in corners]),
    }

for key, pts in list(CHANNELS.items()) + [('loop', LOOP)]:
    pts3 = [(x, y, INLAY) for x, y in pts]
    spill = [(x, y, z) for x, y, _ in pts3 for z in (-0.6, 0.6)]
    crop = box_px(pts3 + spill, 30)
    set_strength(LINE[key], HOT if key != 'loop' else HOT * 0.35)
    layers[f'lit-{key}'] = crop
    render(f'lit-{key}', crop)
    set_strength(LINE[key], IDLE if key != 'loop' else IDLE * 0.7)

data = {
    'theme': THEME,
    'size': [W, HH],
    'layers': layers,
    'modules': modules,
    'channels': {k: [px((x, y, INLAY)) for x, y in pts] for k, pts in CHANNELS.items()},
    'loop': [px((x, y, INLAY)) for x, y in LOOP],
}
with open(os.path.join(OUT, 'map.json'), 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
print('карта', os.path.join(OUT, 'map.json'))
