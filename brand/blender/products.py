"""
Предметная съёмка для живых вставок — без фотостока.

Вставки в карусели показывали товары плоскими иконками и серыми кругами:
рядом с настоящим интерфейсом это читалось макетом. Здесь те же товары
сняты «в студии»: керамика, воск, вязка, кофе, сырники — материалы
процедурные, свет трёхточечный, фон — продолжение карточки, в которую
кадр встанет.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P brand/blender/products.py -- \
      --out public/live --only mug,candle [--samples 96]

Кадры (имя → назначение):
  mug, candle, throw     — карточки магазина «Лавка» (графит и бронза)
  cappuccino, flatwhite, syrniki — меню кофейни в мини-приложении (сверху, светлый стол)
  desk                   — обложка заметки в блоге психолога (утренний стол)
"""

import math
import sys

import bpy
import bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


OUT = arg('--out', 'public/live')
ONLY = set(filter(None, arg('--only', '').split(',')))
SAMPLES = int(arg('--samples', '96'))


def srgb(h, a=1.0):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], a)


# ------------------------------------------------------------------ сцена


def reset(w, h):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception:
        pass
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.image_settings.file_format = 'WEBP'
    sc.render.image_settings.quality = 86
    sc.render.image_settings.color_mode = 'RGB'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    world = bpy.data.worlds.new('w')
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = srgb('#1a1a1e')
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.25
    return sc


def mat(name, color, rough=0.5, metal=0.0, sss=0.0, coat=0.0, trans=0.0, ior=1.45, bump=None, vary=None):
    """`vary` = (второй цвет, масштаб шума): крап глазури, румянец корочки."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(color) if isinstance(color, str) else color
    if vary:
        other, vscale = vary[:2]
        lo, hi = vary[2] if len(vary) > 2 else (0.42, 0.62)
        tcv = nt.nodes.new('ShaderNodeTexCoord')
        nz = nt.nodes.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = vscale
        nz.inputs['Detail'].default_value = 6
        nt.links.new(tcv.outputs['Object'], nz.inputs['Vector'])
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = lo
        ramp.color_ramp.elements[0].color = srgb(color)
        ramp.color_ramp.elements[1].position = hi
        ramp.color_ramp.elements[1].color = srgb(other)
        nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if sss:
        b.inputs['Subsurface Weight'].default_value = sss
        b.inputs['Subsurface Radius'].default_value = (0.9, 0.55, 0.3)
        b.inputs['Subsurface Scale'].default_value = 0.01
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.08
    if trans:
        b.inputs['Transmission Weight'].default_value = trans
        b.inputs['IOR'].default_value = ior
    if bump:
        kind, scale, strength = bump
        tc = nt.nodes.new('ShaderNodeTexCoord')
        if kind == 'noise':
            tx = nt.nodes.new('ShaderNodeTexNoise')
            tx.inputs['Scale'].default_value = scale
            tx.inputs['Detail'].default_value = 8
        else:  # вязка: рубчик по одной оси
            tx = nt.nodes.new('ShaderNodeTexWave')
            tx.inputs['Scale'].default_value = scale
            tx.inputs['Distortion'].default_value = 2.5
            tx.inputs['Detail'].default_value = 4
        nt.links.new(tc.outputs['Object'], tx.inputs['Vector'])
        bp = nt.nodes.new('ShaderNodeBump')
        bp.inputs['Strength'].default_value = strength
        nt.links.new(tx.outputs['Fac'] if 'Fac' in tx.outputs else tx.outputs[0], bp.inputs['Height'])
        nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m


def emit(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = srgb(color)
    e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes['Material Output'].inputs[0])
    return m


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def smooth(obj, sub=2, bevel=None):
    if bevel:
        b = obj.modifiers.new('bv', 'BEVEL')
        b.width = bevel
        b.segments = 3
    if sub:
        s = obj.modifiers.new('sub', 'SUBSURF')
        s.levels = sub
        s.render_levels = sub
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def cyl(name, r, h, loc=(0, 0, 0), verts=64, m=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=(loc[0], loc[1], loc[2] + h / 2))
    o = bpy.context.active_object
    o.name = name
    if m:
        o.data.materials.append(m)
    return o


def area(name, loc, size, energy, color='#ffffff', target=(0, 0, 0.05), shape='SQUARE'):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.size = size
    ld.energy = energy
    ld.color = srgb(color)[:3]
    ld.shape = shape
    o = link(bpy.data.objects.new(name, ld))
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


def camera(loc, target, lens=70, ortho=None):
    cd = bpy.data.cameras.new('cam')
    cd.lens = lens
    if ortho:
        cd.type = 'ORTHO'
        cd.ortho_scale = ortho
    c = link(bpy.data.objects.new('cam', cd))
    c.location = loc
    c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = c
    return c


def sweep(color, rough=0.8):
    """Фон-циклорама: пол плавно переходит в стену, горизонта нет."""
    mesh = bpy.data.meshes.new('sweep')
    bm = bmesh.new()
    # профиль: пол от y=-1.2 до 0.3, затем подъём по дуге радиуса 0.4 и стена
    rows = []
    for i in range(24):
        t = i / 23
        if t < 0.5:
            rows.append((-1.2 + t * 3.0, 0.0))
        else:
            u = (t - 0.5) / 0.5 * (math.pi / 2)
            rows.append((0.3 + math.sin(u) * 0.4, 0.4 - math.cos(u) * 0.4))
    rows.append((0.7, 1.4))
    verts = []
    for yy, zz in rows:
        verts.append((bm.verts.new((-1.5, yy, zz)), bm.verts.new((1.5, yy, zz))))
    for (a0, a1), (b0, b1) in zip(verts, verts[1:]):
        bm.faces.new((a0, a1, b1, b0))
    bm.to_mesh(mesh)
    bm.free()
    o = link(bpy.data.objects.new('sweep', mesh))
    o.data.materials.append(mat('sweep', color, rough))
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def floor(color, rough=0.6, bump=None, size=2):
    bpy.ops.mesh.primitive_plane_add(size=size)
    o = bpy.context.active_object
    o.data.materials.append(mat('floor', color, rough, bump=bump))
    return o


def render(name):
    sc = bpy.context.scene
    sc.render.filepath = f'{OUT}/{name}.webp'
    bpy.ops.render.render(write_still=True)
    print('saved', sc.render.filepath)


# ------------------------------------------------------------------ предметы


def mug_obj(glaze='#d6c3a6', inner='#eee4d4', loc=(0, 0, 0), scale=1.0, handle=True):
    r, h = 0.042 * scale, 0.09 * scale
    body = cyl('mug', r, h, loc)
    # стенки: вынимаем середину и даём толщину
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(body.data)
    top = [f for f in bm.faces if f.normal.z > 0.9]
    bmesh.ops.delete(bm, geom=top, context='FACES')
    bmesh.update_edit_mesh(body.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    sol = body.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = 0.004 * scale
    smooth(body, sub=2, bevel=0.002 * scale)
    glaze_m = mat('glaze', glaze, 0.22, coat=0.6, bump=('noise', 180, 0.04), vary=('#4b3a2c', 900, (0.7, 0.74)))
    body.data.materials.append(glaze_m)
    if handle:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.024 * scale, minor_radius=0.0055 * scale,
                                         location=(loc[0] + r + 0.006 * scale, loc[1], loc[2] + h * 0.52))
        hd = bpy.context.active_object
        hd.rotation_euler = (math.pi / 2, 0, 0)
        hd.scale = (0.8, 1, 1)
        hd.data.materials.append(glaze_m)
        smooth(hd, sub=1)
    # донышко изнутри светлое — глазурь внутри другого цвета, как у ручной керамики
    base = cyl('inner', r - 0.004 * scale, 0.002, (loc[0], loc[1], loc[2] + 0.006 * scale), m=mat('in', inner, 0.2, coat=0.5))
    return body


def shot_mug():
    reset(640, 544)
    sweep('#232327')
    mug_obj()
    area('key', (-0.35, -0.3, 0.45), 0.35, 14, '#fff1e2')
    area('rim', (0.35, 0.35, 0.3), 0.3, 12, '#c9a27e')
    area('fill', (0.4, -0.4, 0.15), 0.6, 2.5, '#dfe6ee')
    camera((0.0, -0.42, 0.2), (0.0, 0.0, 0.043), lens=85)
    render('mug')


def shot_candle():
    reset(640, 544)
    sweep('#232327')
    glass = cyl('jar', 0.04, 0.085, m=mat('glass', '#e8e2da', 0.03, trans=1.0, ior=1.47))
    smooth(glass, sub=2, bevel=0.003)
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(glass.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context='FACES')
    bmesh.update_edit_mesh(glass.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    glass.modifiers.new('sol', 'SOLIDIFY').thickness = 0.003
    wax = cyl('wax', 0.036, 0.062, (0, 0, 0.003), m=mat('wax', '#efe4d2', 0.45, sss=0.9))
    smooth(wax, sub=1, bevel=0.002)
    cyl('wick', 0.0012, 0.012, (0, 0, 0.065), m=mat('wick', '#1b1510', 0.8))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.006, location=(0, 0, 0.083))
    flame = bpy.context.active_object
    flame.scale = (0.75, 0.75, 2.1)
    flame.data.materials.append(emit('flame', '#ffb057', 28))
    smooth(flame, sub=1)
    pl = bpy.data.lights.new('fl', 'POINT')
    pl.energy = 1.6
    pl.color = srgb('#ffae5a')[:3]
    pl.shadow_soft_size = 0.004
    link(bpy.data.objects.new('fl', pl)).location = (0, 0, 0.085)
    # этикетка — бумажная лента, как у лавочных свечей
    lab = cyl('label', 0.0408, 0.024, (0, 0, 0.028), m=mat('lab', '#b89a74', 0.75, vary=('#a8896a', 300, (0.45, 0.6))))
    area('key', (-0.35, -0.3, 0.4), 0.3, 6, '#fff1e2')
    area('rim', (0.3, 0.35, 0.3), 0.3, 9, '#c9a27e')
    camera((0.0, -0.42, 0.19), (0.0, 0.0, 0.05), lens=85)
    render('candle')


def shot_throw():
    reset(640, 544)
    sweep('#232327')
    knit = mat('knit', '#8b6a4c', 0.92, bump=('wave', 140, 0.35), vary=('#81624a', 60, (0.4, 0.7)))
    for i, (w, d, z) in enumerate([(0.2, 0.12, 0.0), (0.19, 0.115, 0.024), (0.18, 0.11, 0.048)]):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.004 * i, 0, z + 0.012))
        o = bpy.context.active_object
        o.scale = (w, d, 0.024)
        bpy.ops.object.transform_apply(scale=True)
        o.data.materials.append(knit)
        smooth(o, sub=2, bevel=0.009)
        o.rotation_euler = (0, 0, math.radians(-2 + i * 1.5))
    area('key', (-0.4, -0.3, 0.45), 0.4, 13, '#fff1e2')
    area('rim', (0.35, 0.4, 0.3), 0.35, 10, '#c9a27e')
    camera((0.0, -0.46, 0.24), (0.0, 0.0, 0.03), lens=70)
    render('throw')


def latte_art(nt, bsdf, dark, foam):
    """Сердце на пенке: неявная кривая (x²+y²−1)³ − x²y³ ≤ 0 прямо в шейдере.

    Идеальное сердце читается клипартом, поэтому координаты сперва плывут
    по шуму — как молоко, которое тянут из питчера, — край мягкий, а крема
    неровная: тёмная у кромки пенки, светлее к центру.
    """
    tc = nt.nodes.new('ShaderNodeTexCoord')
    warp = nt.nodes.new('ShaderNodeTexNoise')
    warp.inputs['Scale'].default_value = 90
    warp.inputs['Detail'].default_value = 3
    nt.links.new(tc.outputs['Object'], warp.inputs['Vector'])
    # сдвиг вокруг нуля и в масштабе чашки: (шум − 0.5) × 3 мм
    cen = nt.nodes.new('ShaderNodeVectorMath')
    cen.operation = 'SUBTRACT'
    cen.inputs[1].default_value = (0.5, 0.5, 0.5)
    nt.links.new(warp.outputs['Color'], cen.inputs[0])
    amp = nt.nodes.new('ShaderNodeVectorMath')
    amp.operation = 'SCALE'
    amp.inputs['Scale'].default_value = 0.006
    nt.links.new(cen.outputs['Vector'], amp.inputs[0])
    add = nt.nodes.new('ShaderNodeVectorMath')
    add.operation = 'ADD'
    nt.links.new(tc.outputs['Object'], add.inputs[0])
    nt.links.new(amp.outputs['Vector'], add.inputs[1])
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(add.outputs['Vector'], sep.inputs[0])

    def op(kind, a, b=None):
        n = nt.nodes.new('ShaderNodeMath')
        n.operation = kind
        for k, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, float):
                n.inputs[k].default_value = v
            else:
                nt.links.new(v, n.inputs[k])
        return n.outputs[0]

    x = op('MULTIPLY', sep.outputs['X'], 58.0)
    y = op('ADD', op('MULTIPLY', sep.outputs['Y'], 58.0), -0.15)
    x2 = op('MULTIPLY', x, x)
    y2 = op('MULTIPLY', y, y)
    s = op('ADD', op('ADD', x2, y2), -1.0)
    f = op('SUBTRACT', op('MULTIPLY', op('MULTIPLY', s, s), s), op('MULTIPLY', x2, op('MULTIPLY', y2, y)))
    # мягкий край вместо ножа: плавный переход в узкой полосе значений
    heart = nt.nodes.new('ShaderNodeMapRange')
    heart.interpolation_type = 'SMOOTHSTEP'
    heart.inputs['From Min'].default_value = 0.02
    heart.inputs['From Max'].default_value = -0.06
    nt.links.new(f, heart.inputs['Value'])
    # кольцо пенки у стенки чашки
    r = op('SQRT', op('ADD', x2, y2))
    ring = nt.nodes.new('ShaderNodeMapRange')
    ring.interpolation_type = 'SMOOTHSTEP'
    ring.inputs['From Min'].default_value = 1.7
    ring.inputs['From Max'].default_value = 2.05
    nt.links.new(r, ring.inputs['Value'])
    m = op('MAXIMUM', heart.outputs['Result'], ring.outputs['Result'])
    # крема: темнее у кромки пенки
    crema = nt.nodes.new('ShaderNodeMix')
    crema.data_type = 'RGBA'
    crema.inputs['A'].default_value = srgb(dark)
    crema.inputs['B'].default_value = srgb('#4a2614')
    nt.links.new(op('MULTIPLY', op('SUBTRACT', r, 0.6), 0.6), crema.inputs['Factor'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs['B'].default_value = srgb(foam)
    nt.links.new(crema.outputs['Result'], mix.inputs['A'])
    nt.links.new(m, mix.inputs['Factor'])
    nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])


def cup_topdown(loc, coffee='#7a4a2c', foam='#efe2cc', art=True, cup='#f4f1ec'):
    x, y = loc
    saucer = cyl('saucer', 0.075, 0.008, (x, y, 0), m=mat('sau', cup, 0.15, coat=0.6))
    smooth(saucer, sub=2, bevel=0.004)
    body = cyl('cup', 0.042, 0.05, (x, y, 0.008), m=mat('cup', cup, 0.15, coat=0.6))
    smooth(body, sub=2, bevel=0.004)
    top = cyl('coffee', 0.036, 0.002, (x, y, 0.057))
    m = bpy.data.materials.new('coffee')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.35
    if art:
        latte_art(m.node_tree, b, coffee, foam)
    else:
        b.inputs['Base Color'].default_value = srgb(coffee)
    top.data.materials.append(m)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.052, minor_radius=0.004, location=(x + 0.046, y - 0.02, 0.035))
    hd = bpy.context.active_object
    hd.scale = (0.35, 0.35, 1)
    hd.rotation_euler = (math.pi / 2, 0, math.radians(-25))
    hd.data.materials.append(mat('hd', cup, 0.15, coat=0.6))
    return body


def shot_coffee(name, coffee, foam, art=True):
    reset(320, 320)
    floor('#e9e2d8', 0.55, bump=('noise', 40, 0.08))
    cup_topdown((0, 0), coffee, foam, art)
    area('key', (-0.35, 0.3, 0.6), 0.5, 20, '#fff4e6', target=(0, 0, 0))
    area('fill', (0.4, -0.3, 0.4), 0.6, 5, '#e6eef8', target=(0, 0, 0))
    camera((0, 0, 0.6), (0, 0, 0), lens=50, ortho=0.19)
    render(name)


def shot_syrniki():
    reset(320, 320)
    floor('#e9e2d8', 0.55, bump=('noise', 40, 0.08))
    plate = cyl('plate', 0.085, 0.01, m=mat('plate', '#f6f3ee', 0.12, coat=0.7))
    smooth(plate, sub=2, bevel=0.006)
    crust = mat('crust', '#b8712c', 0.5, sss=0.15, bump=('noise', 120, 0.4), vary=('#8a4a18', 70))
    for i, (px, py) in enumerate([(-0.025, 0.018), (0.028, 0.02), (0.0, -0.026)]):
        s = cyl(f's{i}', 0.028, 0.016, (px, py, 0.01), m=crust)
        smooth(s, sub=2, bevel=0.006)
        s.rotation_euler = (math.radians(3 * (i - 1)), math.radians(2), 0)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.016, location=(0.036, -0.036, 0.018))
    cream = bpy.context.active_object
    cream.scale = (1, 1, 0.55)
    cream.data.materials.append(mat('cream', '#f7f1e6', 0.25, sss=0.5))
    smooth(cream, sub=1)
    berry = mat('berry', '#7d1224', 0.18, coat=0.9)
    for k, (bx, by) in enumerate([(-0.004, 0.004), (0.01, -0.004), (-0.012, -0.008), (0.05, 0.03)]):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0075, location=(bx, by, 0.031 if k < 3 else 0.014))
        bb = bpy.context.active_object
        bb.data.materials.append(berry)
        smooth(bb, sub=1)
    area('key', (-0.35, 0.3, 0.6), 0.5, 20, '#fff4e6', target=(0, 0, 0))
    area('fill', (0.4, -0.3, 0.4), 0.6, 5, '#e6eef8', target=(0, 0, 0))
    camera((0, 0, 0.6), (0, 0, 0), lens=50, ortho=0.2)
    render('syrniki')


def shot_desk():
    """Обложка заметки: утренний стол сверху — кружка, тетрадь, карандаш, тень окна."""
    reset(760, 300)
    floor('#b9ad9c', 0.7, bump=('noise', 25, 0.1), size=3)
    mug_obj(glaze='#e9e3d9', inner='#f3eee6', loc=(0.12, 0.01, 0), scale=0.95)
    tea = cyl('tea', 0.035, 0.001, (0.12, 0.01, 0.078), m=mat('tea', '#8a5a2b', 0.05, coat=1.0))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.06, 0.0, 0.004))
    nb = bpy.context.active_object
    nb.scale = (0.2, 0.14, 0.008)
    bpy.ops.object.transform_apply(scale=True)
    nb.rotation_euler = (0, 0, math.radians(-8))
    nb.data.materials.append(mat('paper', '#f5f1ea', 0.85))
    smooth(nb, sub=1, bevel=0.002)
    # строки в тетради — едва заметные линии
    for k in range(7):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.06, -0.05 + k * 0.016, 0.0085))
        ln = bpy.context.active_object
        ln.scale = (0.16, 0.0006, 0.0002)
        ln.rotation_euler = (0, 0, math.radians(-8))
        ln.data.materials.append(mat('line', '#c9d3de', 0.9))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0035, depth=0.17, vertices=6, location=(0.02, -0.075, 0.004))
    pen = bpy.context.active_object
    pen.rotation_euler = (0, math.pi / 2, math.radians(24))
    pen.data.materials.append(mat('pencil', '#2f5b44', 0.4))
    # тень оконной рамы: мягкий свет сквозь решётку
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 1.6
    sun.angle = math.radians(2.5)
    sun.color = srgb('#ffe9cc')[:3]
    so = link(bpy.data.objects.new('sun', sun))
    so.rotation_euler = (math.radians(38), math.radians(-24), math.radians(30))
    for k in range(3):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.35 + k * 0.22, 0.2, 0.5))
        bar = bpy.context.active_object
        bar.scale = (0.02, 1.2, 0.02)
        bar.visible_camera = False
    area('fill', (0, -0.4, 0.8), 1.2, 6, '#dbe5f0', target=(0, 0, 0))
    camera((0, 0, 0.9), (0, 0, 0), lens=50, ortho=0.52)
    render('desk')


SHOTS = {
    'mug': shot_mug,
    'candle': shot_candle,
    'throw': shot_throw,
    'cappuccino': lambda: shot_coffee('cappuccino', '#6b3d22', '#f0e3cc', True),
    'flatwhite': lambda: shot_coffee('flatwhite', '#8a5733', '#e9d6b8', True),
    'syrniki': shot_syrniki,
    'desk': shot_desk,
}

for key, fn in SHOTS.items():
    if ONLY and key not in ONLY:
        continue
    fn()
