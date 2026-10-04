"""
«Одна сборка» — блок направлений для главной.

Шесть направлений — шесть граней одного предмета: те же модули, что
стоят станциями на схеме «Путь одного заказа» (синий корпус, матовое
стекло, под стеклом светится значок), только собранные в один
шестигранный блок. Его крутят: передняя грань горит, остальные ждут.
Буквально «шесть направлений, одна сборка».

Съёмка та же, что у схемы: полированное стекло под блоком, студийный
свет. Камера стоит, вращается сам блок.

Запуск (без интерфейса, нужен ffmpeg), на каждую тему:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P brand/blender/assembly.py -- \
      --theme dark --out public/assembly --frames /tmp/assembly \
      [--stills] [--turns] [--only shop] [--still путь.png]

Что получается. На каждую грань — кадр, где она впереди и горит
(face-<грань>.webp). На каждый поворот к соседней грани — ролик
(turn-<откуда>-<куда>.mp4) и обратный из тех же кадров: начинается
с кадра одной грани, кончается кадром другой, поэтому в браузере встаёт
между ними без шва — как пролёты камеры на схеме.
"""

import math
import os
import shutil
import subprocess
import sys

import addon_utils
import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


THEME = arg('--theme', 'dark')
OUT = os.path.join(arg('--out', 'public/assembly'), THEME)
FRAMES = arg('--frames', '/tmp/assembly')
ONLY = arg('--only', None)
STILL = arg('--still', None)
# по умолчанию снимается всё; ключи оставляют что-то одно
DO_STILLS = '--turns' not in argv
DO_TURNS = '--stills' not in argv
SIZE = int(arg('--size', '1000'))
TURN_SIZE = int(arg('--turn-size', '720'))
FPS = 60
TURN_S = 0.9
DARK = THEME == 'dark'
os.makedirs(OUT, exist_ok=True)

# грани по порядку направлений на сайте (content/site.ts → services[].live)
FACES = ['landing', 'blog', 'shop', 'bot', 'webapp', 'ops']
ICONS = {
    'landing': '<rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="M3 8.5h18M9 20h6"/>'
               '<circle cx="6" cy="6.5" r="0.5"/><circle cx="8.5" cy="6.5" r="0.5"/>',
    'blog': '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
    'shop': '<path d="M5 8h14l-1 12.5H6L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    'bot': '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 20 17H10l-4.5 3.5V17H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5Z"/>'
           '<circle cx="8" cy="11.3" r="0.6"/><circle cx="12" cy="11.3" r="0.6"/><circle cx="16" cy="11.3" r="0.6"/>',
    'webapp': '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10.5 18.6h3"/>'
              '<rect x="9.4" y="6" width="2.2" height="2.2" rx="0.5"/><rect x="12.4" y="6" width="2.2" height="2.2" rx="0.5"/>'
              '<rect x="9.4" y="9" width="2.2" height="2.2" rx="0.5"/>',
    'ops': '<path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.1 7.5 9.5 4.4-1.4 7.5-5.1 7.5-9.5V6Z"/><path d="M8 12h2l1.3-2.5 2 5L14.5 12H16"/>',
}

# ---------------------------------------------------------------- размеры, метры

A = 1.0                          # от оси блока до грани
RV = A / math.cos(math.radians(30))
HB = 1.16                        # высота корпуса
PL = 0.05                        # серебряный цоколь
PW, PZ0, PZ1 = 0.44, 0.2, 1.0    # стеклянная панель на грани: полуширина и низ/верх
GLYPH, STROKE = 0.56, 1.6

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
scene.cycles.use_denoising = True
scene.cycles.seed = 7
scene.cycles.max_bounces = 8
scene.cycles.transmission_bounces = 8
scene.cycles.sample_clamp_indirect = 4.0
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.render.use_persistent_data = True
scene.render.fps = FPS


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


def strength(mat):
    return mat.node_tree.nodes['Emission'].inputs['Strength']


# свет тока — как на схеме: в тёмной теме холодный голубой, в светлой насыщенный синий
ACCENT = '#8fc0ff' if DARK else '#2f6fd6'
GLYPH_IDLE, GLYPH_HOT = (1.4, 26.0) if DARK else (1.1, 15.0)
RAY_IDLE, RAY_HOT = (0.5, 12.0) if DARK else (0.8, 7.0)

PLATE = bsdf('plate', '#06080c' if DARK else '#e7ebf0', 0.16 if DARK else 0.12, spec=0.7 if DARK else 0.5)
BLUE = bsdf('blue', '#163d73', 0.28, metallic=0.85, coat=0.6)
SILVER = bsdf('silver', '#c4cad1', 0.18, metallic=1.0, aniso=0.6)
# Стекло граней в светлой теме дымчатое: матовое прозрачное собирало свет
# яркой сцены со всех сторон и засвечивало экран под собой до серого —
# тёмная плата под ним выходила серой, и значок с ней сливался.
FROST = bsdf('frost', '#e9f1fb' if DARK else arg('--glass', '#4f5a6a'), 0.32, transmission=1.0, ior=1.45, spec=0.5)
BOARD = bsdf('board', '#0b0f15' if DARK else '#dfe5ec', 0.5, metallic=0.2)
# Плата под значком грани. В светлой теме была та же светлая, что крышка, —
# светящийся значок сливался с ней. Теперь грань — тёмный экран в светлом
# корпусе, значок читается так же, как в тёмной. Крышка осталась светлой.
PANEL = BOARD if DARK else bsdf('panel', arg('--panel', '#0b0f15'), 0.45, metallic=0.2)
GLYPHS = {f: emission(f'glyph_{f}', ACCENT, GLYPH_IDLE) for f in FACES}
FRAMES_MAT = {f: emission(f'frame_{f}', ACCENT, 0.0) for f in FACES}
RAYS = {f: emission(f'ray_{f}', ACCENT, RAY_IDLE) for f in FACES}
CORE = emission('core', ACCENT, 3.0 if DARK else 2.0)

# ---------------------------------------------------------------- геометрия


def link(o):
    scene.collection.objects.link(o)
    return o


rotor = link(bpy.data.objects.new('rotor', None))


def add(o, turn=0.0, bevel=0.0, seg=4):
    """Деталь блока: повёрнута к своей грани и едет вместе с ротором."""
    if turn:
        o.data.transform(Matrix.Rotation(turn, 4, 'Z'))
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL')
        b.width, b.segments, b.limit_method, b.harden_normals = bevel, seg, 'ANGLE', True
    o.parent = rotor
    return o


def box(name, lo, hi, mat):
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
    return o


def prism(name, radius, z0, z1, mat, segments=6):
    """Шестигранник (или диск) на оси блока; у шестигранника грань смотрит на камеру."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=z1 - z0)
    for v in bm.verts:
        v.co.z += (z0 + z1) / 2
    bm.to_mesh(mesh)
    bm.free()
    # конус рождается ребром к −Y; шестигранник доворачиваем гранью
    if segments == 6:
        mesh.transform(Matrix.Rotation(math.radians(30), 4, 'Z'))
    o = link(bpy.data.objects.new(name, mesh))
    o.data.materials.append(mat)
    return o


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


def glyph(icon_id, mat):
    """Значок светящейся жилой — плоский, в плоскости XY вокруг нуля."""
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
        v.co = Vector((((w.x - fx0) / unit - 12) * s, ((w.y - fy0) / unit - 12) * s, w.z * k * 0.4))
    g.matrix_world = Matrix.Identity(4)
    g.data.materials.clear()
    g.data.materials.append(mat)
    return g


box('plate', (-16, -16, -0.4), (16, 16, 0.0), PLATE)
add(prism('plinth', RV + 0.09, 0.0, PL, SILVER), bevel=0.012)
add(prism('body', RV, PL, PL + HB, BLUE), bevel=0.05, seg=6)
# крышка: серебро, тёмное стекло и кольцо ядра — «одна сборка»
add(prism('cap', RV * 0.94, PL + HB, PL + HB + 0.03, SILVER), bevel=0.01)
add(prism('cap_glass', RV * 0.8, PL + HB + 0.03, PL + HB + 0.05, BOARD))
add(prism('core', 0.3, PL + HB + 0.05, PL + HB + 0.058, CORE, segments=64))
add(prism('core_in', 0.24, PL + HB + 0.05, PL + HB + 0.06, BOARD, segments=64))

for i, f in enumerate(FACES):
    # грань i встаёт лицом к камере, когда ротор повёрнут на −60°·i
    turn = math.radians(60 * i)
    y = -A
    add(box(f'board_{f}', (-PW, y - 0.012, PZ0), (PW, y + 0.01, PZ1), PANEL), turn)
    g = glyph(f, GLYPHS[f])
    # плоский значок встаёт вертикально: его «верх» — вверх, лицо — наружу
    g.data.transform(Matrix.Translation((0, y - 0.016, (PZ0 + PZ1) / 2)) @ Matrix.Rotation(math.radians(90), 4, 'X'))
    add(g, turn)
    # стекло накрывает плату и значок целиком: встык с платой грани мерцали бы
    add(box(f'glass_{f}', (-PW - 0.02, y - 0.085, PZ0 - 0.02), (PW + 0.02, y + 0.004, PZ1 + 0.02), FROST), turn, bevel=0.02)
    # рамка света по контуру панели: плита чуть шире платы и лежит за ней —
    # наружу выходит только кромка. Горит у грани, которая впереди
    add(box(f'frame_{f}', (-PW - 0.03, y - 0.006, PZ0 - 0.03), (PW + 0.03, y + 0.004, PZ1 + 0.03), FRAMES_MAT[f]), turn)
    # луч от грани по стеклу плиты — та же световая вставка, что пазы на схеме
    add(box(f'ray_{f}', (-0.02, y - 3.4, -0.004), (0.02, y - 0.16, 0.004), RAYS[f]), turn)

# ---------------------------------------------------------------- свет и камера

world = bpy.data.worlds.new('w')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = srgb('#0a0c10' if DARK else '#f2f4f7')
bg.inputs['Strength'].default_value = 0.25 if DARK else 0.9
if not DARK:
    # Светлая сцена освещается небом в 0.9, а под AgX такое небо в кадре
    # выходит серым (#c8c8c8). Серой выходила и плита вдали: под скользящим
    # углом стекло зеркалит то же небо — на светлой странице за блоком
    # висело бы пятно. Поэтому неба три: рассеянный свет остаётся прежним,
    # зеркальные лучи видят яркое (плита вдали светлеет), а камера — такое,
    # чтобы небо в кадре сошлось по тону с дальней плитой и горизонт пропал.
    nt = world.node_tree
    path = nt.nodes.new('ShaderNodeLightPath')
    shader = bg.outputs['Background']
    for ray, power in (('Is Glossy Ray', float(arg('--sky', '5.5'))), ('Is Camera Ray', float(arg('--back', '3.2')))):
        sky = nt.nodes.new('ShaderNodeBackground')
        sky.inputs['Color'].default_value = srgb('#f4f5f7')
        sky.inputs['Strength'].default_value = power
        pick = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(path.outputs[ray], pick.inputs['Fac'])
        nt.links.new(shader, pick.inputs[1])
        nt.links.new(sky.outputs['Background'], pick.inputs[2])
        shader = pick.outputs['Shader']
    nt.links.new(shader, nt.nodes['World Output'].inputs['Surface'])

TARGET = Vector((0.0, 0.0, 0.34))


def aim(o, target=TARGET):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()


def area(name, loc, size, energy, color, size_y=None):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size, ld.size_y = size, size_y or size
    ld.energy, ld.color = energy, srgb(color)[:3]
    o = link(bpy.data.objects.new(name, ld))
    o.location = loc
    aim(o)
    return o


# мягкий верхний свет, полосы по бокам — грани корпуса, слабое заполнение
# спереди. Плита темнеет к краям кадра: блок стоит в пятне света, и в
# браузере края кадра растворяются в странице
area('top', (0.0, -1.5, 7.5), 6, 2600 if DARK else 1500, '#f4f8ff', size_y=3.0)
area('strip_l', (-6.5, -2.0, 2.4), 0.6, 900 if DARK else 800, '#dfe9ff', size_y=7)
area('strip_r', (6.5, -1.0, 2.4), 0.6, 1500 if DARK else 900, '#cfe0ff', size_y=7)
area('fill', (0.0, -9.0, 3.5), 7, 380 if DARK else 800, '#c8d6ea')
cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 70
cam_data.sensor_width = 36
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 1.4
cam = link(bpy.data.objects.new('cam', cam_data))
EL = math.radians(15)
cam.location = TARGET + Vector((0.0, -math.cos(EL), math.sin(EL))) * 8.6
aim(cam)
focus = link(bpy.data.objects.new('focus', None))
focus.location = (0.0, -A, 0.6)
cam_data.dof.focus_object = focus
scene.camera = cam


def angle(i):
    return -math.radians(60 * i)


def lit(face, on):
    strength(GLYPHS[face]).default_value = GLYPH_HOT if on else GLYPH_IDLE
    strength(FRAMES_MAT[face]).default_value = GLYPH_HOT * 0.4 if on else 0.0
    strength(RAYS[face]).default_value = RAY_HOT if on else RAY_IDLE


def fade(mat, a, b, f0, f1):
    sock = strength(mat)
    sock.default_value = a
    sock.keyframe_insert('default_value', frame=f0)
    sock.default_value = b
    sock.keyframe_insert('default_value', frame=f1)


def shoot(path, size, samples, fmt='WEBP'):
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.cycles.samples = samples
    s = scene.render.image_settings
    s.file_format, s.color_mode = fmt, 'RGB'
    if fmt == 'WEBP':
        s.quality = 86
    else:
        s.compression = 15
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


if STILL:
    i = FACES.index(ONLY) if ONLY else 2
    rotor.rotation_euler.z = angle(i)
    lit(FACES[i], True)
    shoot(STILL, int(arg('--size', '700')), 64, 'PNG')
    sys.exit(0)

# ---------------------------------------------------------------- кадры граней

if DO_STILLS:
    scene.render.use_motion_blur = False
    for i, f in enumerate(FACES):
        if ONLY and f != ONLY:
            continue
        rotor.rotation_euler.z = angle(i)
        lit(f, True)
        shoot(os.path.join(OUT, f'face-{f}.webp'), SIZE, 220)
        lit(f, False)
        print('грань', f)

# ---------------------------------------------------------------- повороты

if DO_TURNS:
    assert shutil.which('ffmpeg'), 'ролики собирает ffmpeg — его нет в PATH'
    scene.render.use_motion_blur = True
    scene.render.motion_blur_shutter = 0.5
    if hasattr(scene.cycles, 'denoising_use_gpu'):
        scene.cycles.denoising_use_gpu = True
    n = round(TURN_S * FPS)
    for i, f in enumerate(FACES):
        if ONLY and f != ONLY:
            continue
        j = (i + 1) % len(FACES)
        g = FACES[j]
        rotor.animation_data_clear()
        for m in list(GLYPHS.values()) + list(FRAMES_MAT.values()) + list(RAYS.values()):
            m.node_tree.animation_data_clear()
        for other in FACES:
            lit(other, False)
        # поворот на одну грань: плавный разгон и остановка
        rotor.rotation_euler.z = angle(i)
        rotor.keyframe_insert('rotation_euler', frame=1)
        rotor.rotation_euler.z = angle(i) - math.radians(60)
        rotor.keyframe_insert('rotation_euler', frame=n)
        # свет: уходящая грань гаснет в первой половине, приходящая загорается во второй
        half = round(n * 0.5)
        fade(GLYPHS[f], GLYPH_HOT, GLYPH_IDLE, 1, half)
        fade(FRAMES_MAT[f], GLYPH_HOT * 0.4, 0.0, 1, half)
        fade(RAYS[f], RAY_HOT, RAY_IDLE, 1, half)
        fade(GLYPHS[g], GLYPH_IDLE, GLYPH_HOT, half, n)
        fade(FRAMES_MAT[g], 0.0, GLYPH_HOT * 0.4, half, n)
        fade(RAYS[g], RAY_IDLE, RAY_HOT, half, n)

        frames = os.path.join(FRAMES, THEME, f'{f}-{g}')
        shutil.rmtree(frames, ignore_errors=True)
        os.makedirs(frames)
        for k in range(1, n + 1):
            scene.frame_set(k)
            shoot(os.path.join(frames, f'{k:04d}.png'), TURN_SIZE, 24, 'PNG')
        # цвет помечен как sRGB — ролик сходится по тону с кадрами граней
        for clip, order in ((f'turn-{f}-{g}', ''), (f'turn-{g}-{f}', 'reverse,')):
            subprocess.run([
                'ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(frames, '%04d.png'),
                '-vf', order + 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-x264-params', 'aq-mode=3',
                '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709', '-color_range', 'tv',
                '-movflags', '+faststart', '-an', os.path.join(OUT, f'{clip}.mp4'),
            ], check=True)
        print('поворот', f, '→', g, n, 'кадров')
