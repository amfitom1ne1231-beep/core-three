"""
Знак CoreThree в объёме — рендер петли для сайта.

Запуск (без интерфейса):
  /Applications/Blender.app/Contents/MacOS/Blender -b -P brand/blender/mark3d.py -- \
      --out /tmp/mark3d/f_ --size 960 --frames 1-240 [--still 0] [--samples 48]

Геометрия выведена из логотипа (brand/Логотип.jpg, components/mark-geometry.ts):
знак — это изометрия трёх синих брусьев, выходящих из общего угла вдоль
осей X, Y и Z, и трёх серых раскосов, которые соединяют их концы. Если
смотреть строго вдоль (1,1,1), оси расходятся на экране под 120°, раскосы
складываются в треугольник — и получается ровно рисунок знака. Каждый луч
знака = синий брус + один раскос: так же сгруппированы грани в mark-geometry.

Размеры в единицах viewBox логотипа, сняты с него же:
  сечение бруса S ≈ 14.6 (крышка столба 15.2, торец нижнего бруса 14.1),
  длина L = 55 (вершина крышки на 55.6 выше центра, торец на 54.9 по X),
  раскос тоньше — T ≈ 8.7 (ребро верхней грани раскоса 8.66).

Петля 240 кадров (8 с на 30 fps): знак собран → лучи расходятся вдоль своих
осей, каждый проворачивается, камера уходит с изометрии и открывает объём →
возвращаются → знак снова собран, кадр в кадр с началом.
"""

import math
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- аргументы

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default):
    if name in argv:
        return argv[argv.index(name) + 1]
    return default


OUT = arg('--out', '/tmp/mark3d/f_')
SIZE = int(arg('--size', '960'))
FRAMES = arg('--frames', '1-240')
STILL = arg('--still', None)
SAMPLES = int(arg('--samples', '48'))
ENGINE = arg('--engine', 'cycles')

S = 14.6
L = 55.0
T = 8.7
K = 0.02  # единицы логотипа → метры сцены

# ---------------------------------------------------------------- сцена

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = 240
scene.render.fps = 30
scene.render.resolution_x = SIZE
scene.render.resolution_y = SIZE
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'

if ENGINE == 'cycles':
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
    scene.cycles.glossy_bounces = 4
    scene.cycles.transparent_max_bounces = 4
else:
    for eid in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = eid
            break
        except TypeError:
            continue
    ee = scene.eevee
    for attr, val in (('use_raytracing', True), ('taa_render_samples', 96),
                      ('use_shadows', True), ('shadow_ray_count', 2), ('shadow_step_count', 8),
                      ('use_gtao', True), ('fast_gi_distance', 0.6)):
        if hasattr(ee, attr):
            setattr(ee, attr, val)
    if hasattr(ee, 'ray_tracing_options'):
        ee.ray_tracing_options.resolution_scale = '1'

# ---------------------------------------------------------------- материалы


def srgb(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, 1.0)


def metal(name, color, rough, aniso=0.0, coat=0.0, metallic=1.0):
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


# синий — анодированный металл логотипа (--brand-core), серебро — матовый алюминий
BLUE = metal('blue', '#1b467f', 0.34, aniso=0.3, coat=0.35, metallic=0.75)
SILVER = metal('silver', '#b3bac2', 0.26, aniso=0.55)

# ---------------------------------------------------------------- геометрия


def cuboid(name, corners, mat, bevel=0.55):
    """Кубоид по восьми углам: нижняя четвёрка, затем верхняя, по кругу."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    v = [bm.verts.new(c) for c in corners]
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    for f in faces:
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    mod = obj.modifiers.new('bevel', 'BEVEL')
    mod.width = bevel
    mod.segments = 3
    mod.limit_method = 'ANGLE'
    mod.harden_normals = True
    return obj


def box(name, lo, hi, mat):
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    return cuboid(name, [
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1),
    ], mat)


def bar(name, p0, p1, up, width, height, mat):
    """Брус по осевой p0→p1: `up` задаёт нормаль верхней грани."""
    p0, p1 = Vector(p0), Vector(p1)
    d = (p1 - p0).normalized()
    n = Vector(up)
    n = (n - d * n.dot(d)).normalized()
    side = d.cross(n).normalized()
    hw, hh = width / 2, height / 2
    ring = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
    corners = [p0 + side * a + n * b for a, b in ring] + [p1 + side * a + n * b for a, b in ring]
    return cuboid(name, corners, mat, bevel=0.45)


# Три луча — одна и та же деталь, повёрнутая циклической перестановкой осей
# (x, y, z) → (z, x, y). Это и есть поворот знака на 120° вокруг оси (1,1,1).
def cyc(p, k):
    x, y, z = p
    for _ in range(k):
        x, y, z = z, x, y
    return (x, y, z)


ROOT = bpy.data.objects.new('mark', None)
scene.collection.objects.link(ROOT)
ROOT.scale = (K, K, K)

ARMS = []
NAMES = ['honesty', 'speed', 'craft']
AXES = [Vector((0, 0, 1)), Vector((1, 0, 0)), Vector((0, 1, 0))]
for k, name in enumerate(NAMES):
    pivot = bpy.data.objects.new(f'arm_{name}', None)
    scene.collection.objects.link(pivot)
    pivot.parent = ROOT

    # синий брус вдоль своей оси; в общем угле брусья перекрываются, но это
    # место закрыто третьим брусом со стороны камеры — стыков не видно
    lo = cyc((0.0, 0.0, 0.0), k)
    hi = cyc((S, S, L), k)
    lo2 = tuple(min(a, b) for a, b in zip(lo, hi))
    hi2 = tuple(max(a, b) for a, b in zip(lo, hi))
    beam = box(f'beam_{name}', lo2, hi2, BLUE)

    # Раскос — серое «колено» у верха своего бруса и диагональ под 45° до
    # торца следующего. Лицевая грань почти заподлицо с лицом бруса (в логотипе
    # серое идёт вплотную к синему), толщина уходит назад по глубине.
    yb, yf = S - 1.0 - T, S - 1.0
    lo_k = (S, yb, L - T * 1.9)
    hi_k = (S + T * 1.25, yf, L - 0.8)
    a_k, b_k = cyc(lo_k, k), cyc(hi_k, k)
    knee = box(f'knee_{name}', tuple(map(min, a_k, b_k)), tuple(map(max, a_k, b_k)), SILVER)
    # осевая диагонали: от колена вниз-наружу, садится на верх торца соседа
    c0 = (S + T * 0.62, (yb + yf) / 2, L - T * 1.3)
    run = (L - T * 0.62) - c0[0]
    c1 = (L - T * 0.62, (yb + yf) / 2, c0[2] - run)
    p0, p1 = cyc(c0, k), cyc(c1, k)
    up = cyc((1, 0, 1), k)
    brace = bar(f'brace_{name}', p0, p1, up, T, T * 1.2, SILVER)

    for o in (beam, knee, brace):
        scene.collection.objects.link(o)
        o.parent = pivot
    ARMS.append((pivot, AXES[k]))

# свет ядра: точка в общем углу, разгорается, когда лучи разошлись, и
# подсвечивает внутренние грани синим — сам источник в кадре не виден
core_light = bpy.data.lights.new('core_light', 'POINT')
core_light.color = srgb('#8fb8ea')[:3]
core_light.energy = 0.0
core_light.shadow_soft_size = 0.2
cl = bpy.data.objects.new('core_light', core_light)
scene.collection.objects.link(cl)
cl.parent = ROOT
cl.location = (S / 2, S / 2, S / 2)

# ---------------------------------------------------------------- свет

world = bpy.data.worlds.new('studio')
scene.world = world
world.use_nodes = True
wn = world.node_tree.nodes
wl = world.node_tree.links
bg = wn['Background']
tc = wn.new('ShaderNodeTexCoord')
sep = wn.new('ShaderNodeSeparateXYZ')
ramp = wn.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.35
ramp.color_ramp.elements[0].color = (0.004, 0.005, 0.009, 1)
ramp.color_ramp.elements[1].position = 0.85
ramp.color_ramp.elements[1].color = (0.30, 0.36, 0.46, 1)
mp = wn.new('ShaderNodeMapRange')
mp.inputs['From Min'].default_value = -1
mp.inputs['From Max'].default_value = 1
wl.new(tc.outputs['Generated'], sep.inputs[0])
wl.new(sep.outputs['Z'], mp.inputs['Value'])
wl.new(mp.outputs['Result'], ramp.inputs['Fac'])
wl.new(ramp.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 0.9


def area(name, loc, size, energy, color='#ffffff', target=(0.4, 0.4, 0.5)):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.size = size
    ld.energy = energy
    ld.color = srgb(color)[:3]
    o = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(o)
    o.location = loc
    direction = Vector(target) - Vector(loc)
    o.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return o


C = Vector((0.36, 0.36, 0.56))  # середина знака на экране (см. ниже про кадр)
area('key', (-1.2, 2.4, 3.4), 2.6, 420, '#f2f5fa', C)
area('fill', (3.0, -0.6, 1.6), 3.5, 120, '#c7d6ea', C)
area('rim', (-2.2, -2.2, 0.6), 1.8, 520, '#6e9bcc', C)
area('top', (0.4, 0.4, 4.2), 2.0, 180, '#ffffff', C)

# ---------------------------------------------------------------- камера

cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 110
cam_data.sensor_width = 36
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

# Кадр: центр — точка на оси (1,1,1), сдвинутая так, чтобы экранная середина
# знака (крышка сверху на 55.6, торцы снизу на 35) пришлась в центр кадра.
TARGET = Vector((18, 18, 28)) * K
target = bpy.data.objects.new('target', None)
scene.collection.objects.link(target)
target.location = TARGET

rig = bpy.data.objects.new('rig', None)
scene.collection.objects.link(rig)
rig.location = TARGET
cam.parent = rig
DIST = 7.2
cam.location = (DIST, 0, 0)
track = cam.constraints.new('TRACK_TO')
track.target = target
track.track_axis = 'TRACK_NEGATIVE_Z'
track.up_axis = 'UP_Y'

ISO_AZ = math.radians(45)
ISO_EL = math.asin(1 / math.sqrt(3))


def key_rig(frame, az, el):
    rig.rotation_euler = (0, -el, az)
    rig.keyframe_insert('rotation_euler', frame=frame)


# ---------------------------------------------------------------- движение

OUT_D = 10.0  # на сколько лучи расходятся, в единицах логотипа
SPIN = math.radians(18)


# проворот делаем через дочерний пустой объект с осью по брусу
for i, (pivot, axis) in enumerate(ARMS):
    center = Vector((S / 2, S / 2, 0))
    center = Vector(cyc(tuple(center), i))
    spinner = bpy.data.objects.new(f'spin_{i}', None)
    scene.collection.objects.link(spinner)
    spinner.parent = pivot
    spinner.location = center
    for child in [c for c in pivot.children if c is not spinner]:
        child.parent = spinner
        # дети остаются там, где были: компенсируем сдвиг опоры вращения
        child.matrix_parent_inverse = Matrix.Translation(-center)
    ARMS[i] = (pivot, axis, spinner)


def key_state(frame, d, spin, glow, az, el):
    for i, (pivot, axis, spinner) in enumerate(ARMS):
        pivot.location = axis * d
        pivot.keyframe_insert('location', frame=frame)
        spinner.rotation_mode = 'AXIS_ANGLE'
        spinner.rotation_axis_angle = (spin * (1 if i != 1 else -1), *axis)
        spinner.keyframe_insert('rotation_axis_angle', frame=frame)
    core_light.energy = glow * 140
    core_light.keyframe_insert('energy', frame=frame)
    # лучи уходят по трём осям — центр масс смещается на треть хода по каждой;
    # камера следит за ним, иначе разобранный знак уезжал из центра кадра
    shift = Vector((d, d, d)) * (K / 3)
    target.location = TARGET + shift
    target.keyframe_insert('location', frame=frame)
    rig.location = TARGET + shift
    rig.keyframe_insert('location', frame=frame)
    key_rig(frame, az, el)


key_state(1, 0, 0, 0, ISO_AZ, ISO_EL)
key_state(24, 0, 0, 0, ISO_AZ, ISO_EL)
key_state(104, OUT_D, SPIN, 1, ISO_AZ + math.radians(34), math.radians(22))
key_state(136, OUT_D * 1.05, SPIN * 1.08, 1, ISO_AZ + math.radians(40), math.radians(20))
key_state(216, 0, 0, 0, ISO_AZ + math.radians(0), ISO_EL)
key_state(240, 0, 0, 0, ISO_AZ, ISO_EL)


def ease_all():
    for obj in bpy.data.objects:
        ad = obj.animation_data
        if not ad or not ad.action:
            continue
        for fc in getattr(ad.action, 'fcurves', []):
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
                kp.easing = 'AUTO'
                kp.handle_left_type = 'AUTO_CLAMPED'
                kp.handle_right_type = 'AUTO_CLAMPED'


ease_all()

# ---------------------------------------------------------------- рендер

scene.render.filepath = OUT
if STILL is not None:
    scene.frame_set(int(STILL))
    scene.render.filepath = f'{OUT}{int(STILL):04d}.png'
    bpy.ops.render.render(write_still=True)
else:
    a, b = (int(x) for x in FRAMES.split('-'))
    scene.frame_start, scene.frame_end = a, b
    bpy.ops.render.render(animation=True)
