"""
Кнопка света — сфера с переливами. Одна круглая кнопка меняет тему сайта.

Сфера всегда показывает другую тему: на тёмной странице это жемчужина
света, на светлой — капля тёмного стекла. Нажал — её содержимое
расходится по странице волной, а сама она становится тем, чем была
страница. Поэтому сфер две: `light` (молочный перламутр) и `dark`
(обсидиан с синим отливом) — палитры те же, что у материала сайта.

Переливы — не нарисованный градиент: два слоя шума вращаются внутри шара
навстречу друг другу, один искажает другой, а толщина тонкой плёнки
на поверхности меняется вместе с ними. За петлю оба слоя делают целое
число оборотов, так что последний кадр встык переходит в первый.

Запуск (без интерфейса, нужен ffmpeg):
  /Applications/Blender.app/Contents/MacOS/Blender -b -P brand/blender/orb.py -- \
      --out public/theme --frames /tmp/orb [--only light] [--size 200] \
      [--samples 64] [--seconds 5] [--still путь.png]

Получается orb-<вид>.mp4 (петля) и orb-<вид>.webp (первый кадр — пока
ролик не заиграл и там, где он не играет вовсе).
"""

import math
import os
import shutil
import subprocess
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


OUT = arg('--out', 'public/theme')
FRAMES = arg('--frames', '/tmp/orb')
ONLY = arg('--only', None)
SIZE = int(arg('--size', '200'))
SAMPLES = int(arg('--samples', '64'))
SECONDS = float(arg('--seconds', '5'))
STILL = arg('--still', None)
FPS = 30
N = round(SECONDS * FPS)
os.makedirs(OUT, exist_ok=True)

# Палитры: [позиция, цвет] по ходу шума. Свет — молочный перламутр
# с холодной синевой акцента; тьма — обсидиан от почти чёрного к фирменному синему.
LOOKS = {
    'light': {
        'ramp': [(0.0, '#6f9bd8'), (0.3, '#c4d7f2'), (0.52, '#ffffff'), (0.74, '#e6dcf5'), (1.0, '#9fc0ea')],
        'metallic': 0.5, 'rough': 0.2, 'glow': 0.28, 'film': (280.0, 720.0),
        'world': '#0a0d13', 'key': 520, 'rim': 380,
    },
    'dark': {
        'ramp': [(0.0, '#020409'), (0.33, '#0b2c56'), (0.55, '#1d4e86'), (0.75, '#060b14'), (1.0, '#6e9bcc')],
        'metallic': 0.9, 'rough': 0.16, 'glow': 0.0, 'film': (240.0, 640.0),
        'world': '#aeb9c8', 'key': 1500, 'rim': 1300,
    },
}

# ---------------------------------------------------------------- сцена

bpy.ops.wm.read_factory_settings(use_empty=True)
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
scene.cycles.seed = 3
scene.render.use_persistent_data = True
scene.render.resolution_x = scene.render.resolution_y = SIZE
scene.render.fps = FPS
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
# ключи вращения — с постоянной скоростью: с разгоном петля бы дышала
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'


def srgb(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], 1.0)


def link(o):
    scene.collection.objects.link(o)
    return o


bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=1.0)
orb = bpy.context.active_object
bpy.ops.object.shade_smooth()

# два невидимых «мешалки»: к ним привязаны координаты шума
stir_a = link(bpy.data.objects.new('stir_a', None))
stir_b = link(bpy.data.objects.new('stir_b', None))
stir_a.rotation_euler = (math.radians(24), 0.0, 0.0)
stir_b.rotation_euler = (0.0, math.radians(-31), 0.0)
for o, axis, turns in ((stir_a, 2, 1), (stir_b, 0, -1)):
    o.keyframe_insert('rotation_euler', frame=1)
    o.rotation_euler[axis] += math.radians(360 * turns)
    o.keyframe_insert('rotation_euler', frame=N + 1)

mat = bpy.data.materials.new('orb')
mat.use_nodes = True
orb.data.materials.append(mat)
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']


def node(kind, **props):
    n = nt.nodes.new(kind)
    for k, v in props.items():
        setattr(n, k, v)
    return n


co_a = node('ShaderNodeTexCoord', object=stir_a)
co_b = node('ShaderNodeTexCoord', object=stir_b)
warp = node('ShaderNodeTexNoise')
warp.inputs['Scale'].default_value = 1.15
warp.inputs['Detail'].default_value = 2.0
nt.links.new(co_b.outputs['Object'], warp.inputs['Vector'])
# второй слой сдвигает координаты первого — так рисунок течёт, а не просто вертится
push = node('ShaderNodeVectorMath', operation='SCALE')
push.inputs['Scale'].default_value = 1.25
nt.links.new(warp.outputs['Color'], push.inputs[0])
shift = node('ShaderNodeVectorMath', operation='ADD')
nt.links.new(co_a.outputs['Object'], shift.inputs[0])
nt.links.new(push.outputs[0], shift.inputs[1])
flow = node('ShaderNodeTexNoise')
flow.inputs['Scale'].default_value = 0.95
flow.inputs['Detail'].default_value = 3.0
flow.inputs['Roughness'].default_value = 0.55
flow.inputs['Distortion'].default_value = 1.1
nt.links.new(shift.outputs[0], flow.inputs['Vector'])
# шум лежит кучно около середины — растягиваем на всю палитру
spread = node('ShaderNodeMapRange')
spread.inputs['From Min'].default_value = 0.3
spread.inputs['From Max'].default_value = 0.72
nt.links.new(flow.outputs['Fac'], spread.inputs['Value'])
ramp = node('ShaderNodeValToRGB')
ramp.color_ramp.interpolation = 'B_SPLINE'
nt.links.new(spread.outputs['Result'], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(ramp.outputs['Color'], bsdf.inputs['Emission Color'])
# тонкая плёнка: её толщина плывёт вместе со вторым слоем — отлив меняет цвет
film = node('ShaderNodeMapRange')
nt.links.new(warp.outputs['Fac'], film.inputs['Value'])
film.inputs['From Min'].default_value = 0.3
film.inputs['From Max'].default_value = 0.7
if 'Thin Film Thickness' in bsdf.inputs:
    nt.links.new(film.outputs['Result'], bsdf.inputs['Thin Film Thickness'])
    bsdf.inputs['Thin Film IOR'].default_value = 1.33
bsdf.inputs['Coat Weight'].default_value = 1.0
bsdf.inputs['Coat Roughness'].default_value = 0.035
bsdf.inputs['IOR'].default_value = 1.5

world = bpy.data.worlds.new('w')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Strength'].default_value = 0.55


def aim(o, target=(0, 0, 0)):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()


def area(name, loc, size, color, size_y=None, mirror=True):
    """Круглый источник — блик на шаре круглый; с size_y — узкая полоса."""
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = 'RECTANGLE' if size_y else 'DISK'
    ld.size, ld.size_y = size, size_y or size
    ld.color = srgb(color)[:3]
    o = link(bpy.data.objects.new(name, ld))
    o.location = loc
    aim(o)
    # заполняющий свет в шаре не отражается: второй блик посреди сферы лишний
    o.visible_glossy = mirror
    return ld


# большой мягкий свет сверху-слева — блик, по которому шар читается шаром;
# узкая полоса сзади-справа — кромка
key = area('key', (-2.6, -3.4, 3.2), 3.2, '#f6f9ff')
rim = area('rim', (3.4, 1.6, -1.2), 0.5, '#bcd4ff', size_y=4.5)
fill = area('fill', (1.2, -4.0, -2.4), 4.0, '#9db6d8', mirror=False)
fill.energy = 120

cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
# шар чуть меньше кадра: круглая обрезка в браузере проходит по самой его кромке
cam_data.ortho_scale = 2.04
cam = link(bpy.data.objects.new('cam', cam_data))
cam.location = (0.0, -6.0, 0.0)
aim(cam)
scene.camera = cam


def dress(kind):
    """Палитра и свет под вид сферы."""
    look = LOOKS[kind]
    stops = ramp.color_ramp.elements
    while len(stops) > 1:
        stops.remove(stops[-1])
    stops[0].position, stops[0].color = look['ramp'][0][0], srgb(look['ramp'][0][1])
    for pos, color in look['ramp'][1:]:
        stops.new(pos).color = srgb(color)
    bsdf.inputs['Metallic'].default_value = look['metallic']
    bsdf.inputs['Roughness'].default_value = look['rough']
    bsdf.inputs['Emission Strength'].default_value = look['glow']
    film.inputs['To Min'].default_value, film.inputs['To Max'].default_value = look['film']
    bg.inputs['Color'].default_value = srgb(look['world'])
    key.energy, rim.energy = look['key'], look['rim']


for kind in LOOKS:
    if ONLY and kind != ONLY:
        continue
    dress(kind)
    s = scene.render.image_settings

    if STILL:
        scene.frame_set(int(arg('--frame', '1')))
        s.file_format = 'PNG'
        scene.render.filepath = STILL.replace('.png', f'-{kind}.png')
        bpy.ops.render.render(write_still=True)
        continue

    frames = os.path.join(FRAMES, kind)
    shutil.rmtree(frames, ignore_errors=True)
    os.makedirs(frames)
    s.file_format, s.color_mode, s.compression = 'PNG', 'RGB', 15
    for f in range(1, N + 1):
        scene.frame_set(f)
        scene.render.filepath = os.path.join(frames, f'{f:04d}.png')
        bpy.ops.render.render(write_still=True)

    # цвет помечен как sRGB — как у пролётов схемы: иначе ролик расходится
    # по тону со своим же первым кадром-картинкой
    subprocess.run([
        'ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(frames, '%04d.png'),
        '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-x264-params', 'aq-mode=3', '-g', str(FPS),
        '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709', '-color_range', 'tv',
        '-movflags', '+faststart', '-an', os.path.join(OUT, f'orb-{kind}.mp4'),
    ], check=True)
    # первый кадр картинкой пишет сам Blender: в ffmpeg кодировщика WebP может не быть
    scene.frame_set(1)
    s.file_format, s.quality = 'WEBP', 88
    scene.render.filepath = os.path.join(OUT, f'orb-{kind}.webp')
    bpy.ops.render.render(write_still=True)
    print('сфера', kind, N, 'кадров')
