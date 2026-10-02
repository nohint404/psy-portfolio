"""Import a bounded set of vanilla 1.21.4 assets; never fetch assets at runtime.
Minecraft artwork belongs to Mojang/Microsoft, not this project's code license.
"""
from pathlib import Path
import hashlib
import json
import urllib.request
from PIL import Image

root = Path(__file__).resolve().parent.parent
out = root / 'public/minecraft'
out.mkdir(parents=True, exist_ok=True)
base = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.21.4/'

def download(path):
    with urllib.request.urlopen(base + path, timeout=30) as response:
        return response.read()

models_bytes = download('blocks_models.json')
all_models = json.loads(models_bytes)
names = ['oak_planks', 'oak_log', 'cobblestone', 'crafting_table', 'furnace_on', 'bookshelf', 'lever', 'redstone_lamp', 'redstone_lamp_on', 'lectern', 'potted_oak_sapling', 'torch', 'redstone_torch', 'campfire']

def resolve(name):
    current = all_models[name]
    parent = current.get('parent', '').split('/')[-1]
    result = resolve(parent) if parent in all_models else {'textures': {}, 'elements': []}
    result = {'textures': {**result['textures'], **current.get('textures', {})}, 'elements': current.get('elements', result['elements'])}
    return result

models = {}
textures = set()
for name in names:
    resolved = resolve(name)
    def texture(value):
        seen = set()
        while value.startswith('#'):
            if value in seen:
                raise ValueError('Cyclic texture reference: ' + value)
            seen.add(value)
            value = resolved['textures'][value[1:]]
        return value.split('/')[-1]
    elements = json.loads(json.dumps(resolved['elements']))
    for element in elements:
        for face in element['faces'].values():
            face['texture'] = texture(face['texture'])
            textures.add(face['texture'])
            face.pop('cullface', None)
    models[name] = {'elements': elements}
(root / 'lib/minecraft-models.json').write_text(json.dumps(models, separators=(',', ':')) + '\n')

provenance = {'version': 'Minecraft Java 1.21.4', 'origin': 'Vanilla models and textures mirrored by PrismarineJS/minecraft-assets', 'modelsSource': base + 'blocks_models.json', 'modelsSha256': hashlib.sha256(models_bytes).hexdigest(), 'rights': 'Minecraft game artwork belongs to Mojang/Microsoft. Included at the user’s request; not relicensed as project-owned or MIT artwork.', 'assets': {}}
for name in sorted(textures | {'redstone_dust_line0'}):
    data = download('blocks/' + name + '.png')
    (out / (name + '.png')).write_bytes(data)
    provenance['assets'][name + '.png'] = {'source': base + 'blocks/' + name + '.png', 'sha256': hashlib.sha256(data).hexdigest()}
for name, source in [('bed-red', 'entity/bed/red.png'), ('chest', 'entity/chest/normal.png'), ('book', 'items/writable_book.png'), ('campfire', 'items/campfire.png')]:
    source_url = 'https://assets.mcasset.cloud/1.21.4/assets/minecraft/textures/entity/bed/red.png' if name == 'bed-red' else base + source
    with urllib.request.urlopen(source_url, timeout=30) as response:
        data = response.read()
    (out / (name + '.png')).write_bytes(data)
    provenance['assets'][name + '.png'] = {'source': source_url, 'sha256': hashlib.sha256(data).hexdigest()}
(out / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')

# UI icons derive from actual vanilla texture faces, not invented item illustrations.
def icon(name, top, left, front):
    im = Image.new('RGBA', (64, 64))
    def face(tex, p, a, b):
        ax, ay = a; bx, by = b; px, py = p
        det = ax * by - ay * bx
        coeff = (by / det, -bx / det, (bx * py - by * px) / det,
                 -ay / det, ax / det, (ay * px - ax * py) / det)
        tex = tex.convert('RGBA').resize((16, 16), Image.Resampling.NEAREST)
        layer = tex.transform((64, 64), Image.Transform.AFFINE, coeff, Image.Resampling.NEAREST)
        im.alpha_composite(layer)
    face(top, (4, 16), (28/16, -14/16), (28/16, 14/16))
    face(left, (4, 16), (28/16, 14/16), (0, 30/16))
    face(front, (32, 30), (28/16, -14/16), (0, 30/16))
    path = root / ('public/art/' + name + '.png')
    im.save(path)
    Path(str(path) + '.provenance.json').write_text(json.dumps({'origin': 'Isometric thumbnail derived from vanilla Minecraft texture faces', 'source': 'scripts/import-minecraft.py', 'rights': 'Minecraft textures belong to Mojang/Microsoft; see public/minecraft/provenance.json'}, indent=2))

def first(name):
    im = Image.open(out / (name + '.png')).convert('RGBA')
    return im.crop((0, 0, im.width, im.width))
icon('craft', first('crafting_table_top'), first('crafting_table_side'), first('crafting_table_front'))
icon('furnace', first('furnace_top'), first('furnace_side'), first('furnace_front_on'))
icon('terminal', first('redstone_lamp_on'), first('redstone_lamp'), first('redstone_lamp_on'))
atlas = first('chest')
front = Image.new('RGBA', (14, 15))
front.paste(atlas.crop((14, 14, 28, 19)), (0, 0)); front.paste(atlas.crop((14, 33, 28, 43)), (0, 5))
front.paste(atlas.crop((1, 1, 3, 5)), (6, 3))
side = Image.new('RGBA', (14, 15)); side.paste(atlas.crop((0, 14, 14, 19)), (0, 0)); side.paste(atlas.crop((0, 33, 14, 43)), (0, 5))
if not (root / 'public/art/chest-sprites.png').exists():
    icon('chest', atlas.crop((14, 0, 28, 14)), side, front)
# Regenerate chest frames from the room's real entity with make-chest-sprites.mjs.
for name in ['book', 'campfire']:
    sprite = Image.open(out / (name + '.png')).convert('RGBA')
    canvas = Image.new('RGBA', (64, 64))
    canvas.alpha_composite(sprite.resize((52, 52), Image.Resampling.NEAREST), (6, 6))
    path = root / ('public/art/' + name + '.png')
    canvas.save(path)
    Path(str(path) + '.provenance.json').write_text(json.dumps({'origin': 'Vanilla Minecraft item sprite with transparent padding', 'source': provenance['assets'][name + '.png']['source'], 'rights': provenance['rights']}, indent=2))
# Official inventory sprite (Java renders beds from the entity model instead).
bed_source = 'https://raw.githubusercontent.com/Mojang/bedrock-samples/46ba6ea985fb5a92d79a9419198f10dda14c199d/resource_pack/textures/items/bed_red.png'
with urllib.request.urlopen(bed_source, timeout=30) as response:
    bed_bytes = response.read()
(root / 'public/art/bed.png').write_bytes(bed_bytes)
(root / 'public/art/bed.png.provenance.json').write_text(json.dumps({'origin': 'Unmodified official Minecraft Bedrock red-bed inventory sprite', 'source': bed_source, 'sha256': hashlib.sha256(bed_bytes).hexdigest(), 'rights': provenance['rights']}, indent=2) + '\n')
print(f'Imported {len(models)} vanilla models and {len(provenance["assets"])} textures.')
