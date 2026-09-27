from PIL import Image, ImageDraw, ImageFont
import os

def make_icon(size, path):
    img = Image.new("RGB", (size, size), "#0A84FF")
    draw = ImageDraw.Draw(img)
    # simple diagonal gradient by blending
    top = (10, 132, 255)
    bottom = (94, 60, 216)
    for y in range(size):
        t = y / size
        r = int(top[0] + (bottom[0]-top[0])*t)
        g = int(top[1] + (bottom[1]-top[1])*t)
        b = int(top[2] + (bottom[2]-top[2])*t)
        draw.line([(0,y),(size,y)], fill=(r,g,b))

    # rounded mask
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    radius = int(size * 0.22)
    mdraw.rounded_rectangle([0,0,size,size], radius=radius, fill=255)
    out = Image.new("RGBA", (size, size), (0,0,0,0))
    out.paste(img, (0,0), mask)

    draw2 = ImageDraw.Draw(out)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(size*0.5))
    except Exception:
        font = ImageFont.load_default()
    text = "N"
    bbox = draw2.textbbox((0,0), text, font=font)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    draw2.text(((size-tw)/2 - bbox[0], (size-th)/2 - bbox[1] - size*0.02), text, fill="white", font=font)
    out.save(path)

os.makedirs("public", exist_ok=True)
make_icon(192, "public/icon-192.png")
make_icon(512, "public/icon-512.png")
print("done")
