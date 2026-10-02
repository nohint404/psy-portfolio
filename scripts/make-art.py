"""Authored identity/cursor/social artwork. Preserve imported vanilla station icons.
Run import-minecraft.py to refresh Minecraft assets; this script does not own them.
"""
from PIL import Image, ImageDraw
from pathlib import Path
import json
out = Path(__file__).resolve().parent.parent / 'public/art'
out.mkdir(parents=True, exist_ok=True)

def save(name, image):
    if name in {'chest', 'craft', 'furnace', 'terminal', 'book', 'campfire'} and (out.parent / 'minecraft/provenance.json').exists():
        return  # The user-approved vanilla assets supersede the early authored prototypes.
    image.save(out / (name + '.png'))
    (out / (name + '.png.provenance.json')).write_text(json.dumps({'origin':'Original geometric pixel artwork authored for Psymariux', 'source':'scripts/make-art.py', 'license':'Project-owned original artwork'}, indent=2))

def canvas():
    im=Image.new('RGBA',(64,64)); return im,ImageDraw.Draw(im)

def cube(d, top='#78d7ee', face='#35b5db', side='#1b749e'):
    d.polygon([(7,16),(35,3),(58,15),(31,29)],fill=top)
    d.polygon([(7,16),(31,29),(31,59),(7,45)],fill=side)
    d.polygon([(31,29),(58,15),(58,44),(31,59)],fill=face)

im,d=canvas(); cube(d)
d.polygon([(35,32),(42,29),(42,38),(35,41)],fill='#e8f1e9')
d.polygon([(48,26),(55,23),(55,32),(48,35)],fill='#e8f1e9')
d.polygon([(39,33),(42,32),(42,37),(39,38)],fill='#224757')
d.polygon([(52,27),(55,26),(55,31),(52,32)],fill='#224757')
d.polygon([(40,46),(49,42),(49,44),(40,48)],fill='#165a83')
d.polygon([(9,19),(15,22),(15,28),(9,25)],fill='#2b8aac')
d.polygon([(31,29),(36,26),(36,31),(31,34)],fill='#61d4ec')
save('mascot',im)

# Personal identity: composite the verified local skin's front and outer layer.
skin_path = out / 'psymariux-skin.png'
if skin_path.exists():
    skin = Image.open(skin_path).convert('RGBA')
    if skin.size != (64, 64):
        raise ValueError('Expected a modern 64x64 Minecraft skin')
    head = Image.alpha_composite(skin.crop((8, 8, 16, 16)), skin.crop((40, 8, 48, 16)))
    head.resize((64, 64), Image.Resampling.NEAREST).save(out / 'psymariux-head.png')
    (out / 'psymariux-head.png.provenance.json').write_text(json.dumps({'origin': "Front face and hat layer composited from the user's verified current skin", 'source': 'public/art/psymariux-skin.png', 'method': '8x8 front (8,8), outer front (40,8), nearest-neighbor resize to 64x64', 'usage': 'User-requested personal Minecraft identity'}, indent=2))

im,d=canvas(); cube(d,'#cb9d59','#a4783f','#78542f')
for pts in [[(36,27),(41,24),(41,54),(36,57)],[(51,19),(55,17),(55,47),(51,49)]]: d.polygon(pts,fill='#d6b66d')
d.line([(31,36),(58,22)],fill='#5b3e26',width=3)
d.polygon([(42,31),(48,28),(48,38),(42,41)],fill='#ead081')
save('chest',im)
im,d=canvas(); cube(d,'#c4a16a','#896240','#60472e')
for x in range(3):
 for y in range(3):
  cx=16+x*8+y*6;cy=16-x*4+y*3
  d.polygon([(cx,cy),(cx+5,cy-2),(cx+9,cy),(cx+4,cy+3)],fill='#6f5031')
d.polygon([(38,35),(51,28),(51,45),(38,52)],fill='#c39a60')
d.line([(42,37),(48,44)],fill='#584531',width=3)
save('craft',im)
im,d=canvas(); cube(d,'#8c9283','#6b7169','#4c5350')
d.polygon([(35,38),(54,29),(54,42),(35,51)],fill='#252d2a')
for x,y,h in [(38,46,7),(43,44,12),(48,41,7),(51,39,10)]: d.rectangle((x,y-h,x+2,y),fill='#edab55')
d.polygon([(36,30),(53,22),(53,27),(36,35)],fill='#333d37')
save('furnace',im)
im,d=canvas();d.polygon([(4,37),(32,23),(60,37),(32,53)],fill='#37505a');d.polygon([(4,37),(32,53),(32,60),(4,45)],fill='#273c47');d.polygon([(32,53),(60,37),(60,45),(32,60)],fill='#466c75')
d.polygon([(8,22),(30,12),(31,20),(53,9),(57,30),(34,42),(11,33)],fill='#568ea3')
d.polygon([(12,20),(29,14),(32,24),(52,13),(53,28),(33,38),(14,30)],fill='#e7dcb2')
d.line([(29,14),(33,38)],fill='#9b8f68',width=2)
for i in range(3): d.line([(17,22+i*4),(25,19+i*4)],fill='#9b8f68',width=1); d.line([(37,25+i*4),(48,19+i*4)],fill='#9b8f68',width=1)
save('book',im)
im,d=canvas();d.rectangle((9,10,55,45),fill='#334447');d.rectangle((13,14,51,39),fill='#327986');d.rectangle((28,45,35,51),fill='#6d8382');d.rectangle((21,51,43,55),fill='#4c6263')
for i in range(4): d.rectangle((17,19+i*5,20,20+i*5),fill='#a0dcbe');d.rectangle((24,19+i*5,41+(i%2)*5,20+i*5),fill='#85c5c0')
save('terminal',im)
im,d=canvas();d.line([(14,52),(50,39)],fill='#9b6e43',width=8);d.line([(14,39),(50,53)],fill='#604831',width=8)
for x,y,w,h,c in [(20,28,23,17,'#c36a36'),(24,17,15,26,'#eaa951'),(28,7,7,26,'#f2c96e'),(30,26,8,18,'#ffe3a3')]: d.rectangle((x,y,x+w,y+h),fill=c)
save('campfire',im)
# Native desktop cursor with a clear conventional arrow silhouette.
im=Image.new('RGBA',(24,24));d=ImageDraw.Draw(im);d.polygon([(2,1),(2,19),(6,15),(10,22),(14,20),(10,13),(16,13)],fill='#182b38');d.polygon([(4,5),(4,15),(7,12),(11,18),(11,17),(8,10),(12,10)],fill='#8bd5ed');save('cursor',im)
# Social image using the original identity, no invented factual claims.
im=Image.new('RGB',(1200,630),'#202326');d=ImageDraw.Draw(im)
for y in range(0,630,48):
 for x in range(0,1200,80): d.rectangle((x+2,y+2,x+76,y+44),fill=['#25292b','#282c2e','#24282a'][(x//80+y//48)%3])
mascot=Image.open(out/('psymariux-head.png' if skin_path.exists() else 'mascot.png')).resize((320,320),Image.Resampling.NEAREST);im.paste(mascot,(90,140),mascot)
from PIL import ImageFont
font='/usr/share/fonts/TTF/DejaVuSans.ttf'
try: f=ImageFont.truetype(font,60); small=ImageFont.truetype(font,25)
except OSError:
 f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',60);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',25)
d.text((470,237),'Psymariux',font=f,fill='#9dd8e9');d.text((473,324),'The developer workshop',font=small,fill='#d3c9b8');save('social',im)
if skin_path.exists():
    (out / 'social.png.provenance.json').write_text(json.dumps({'origin': 'Original workshop social background with user-requested personal skin portrait', 'source': ['scripts/make-art.py', 'public/art/psymariux-skin.png'], 'usage': 'Original composition; personal skin provenance is recorded separately'}, indent=2))
