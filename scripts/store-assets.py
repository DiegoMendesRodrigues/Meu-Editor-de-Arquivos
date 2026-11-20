# Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
"""
Gera as imagens da Microsoft Store a partir do ícone e das telas do manual do usuário.

  python scripts/store-assets.py

- build/appx/*.png: logotipos do pacote MSIX/AppX (usados pelo electron-builder no alvo "appx").
- docs/store/images/: logotipo 300x300 para a página da loja.
- docs/store/<idioma>/screenshots/: telas nos seis idiomas (mínimo de 1366x768 exigido pela loja).
  Rode `npm run manual` antes, para as telas estarem atualizadas.

Requer Pillow (pip install pillow).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ICON = ROOT / 'icone' / 'png' / 'icone-1024.png'
LOCALES = ['pt-BR', 'pt-PT', 'en', 'es', 'fr', 'de']

# Telas que já mostram a janela inteira (1383x854).
FULL = ['s01-main', 's03-markdown-edit', 's04-json-tree', 's05-json-error', 's06-search']
# Telas parciais: vão centralizadas sobre um fundo, no tamanho exigido pela loja.
PARTIAL = ['s11a-spelling', 's12-snippets', 's14-shortcuts']

STORE_SIZE = (1920, 1080)  # 16:9, acima do mínimo de 1366x768
PURPLE_TOP = (139, 92, 246)
PURPLE_BOTTOM = (91, 43, 234)


def logo(size: int, canvas: tuple[int, int] | None = None, scale: float = 0.8) -> Image.Image:
    """Ícone centralizado num fundo transparente (canvas) com a margem indicada."""
    w, h = canvas or (size, size)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    side = int(min(w, h) * scale)
    icon = Image.open(ICON).convert('RGBA').resize((side, side), Image.LANCZOS)
    out.paste(icon, ((w - side) // 2, (h - side) // 2), icon)
    return out


def appx_assets() -> None:
    target = ROOT / 'build' / 'appx'
    target.mkdir(parents=True, exist_ok=True)
    specs = {
        'StoreLogo.png': ((50, 50), 0.9),
        'Square44x44Logo.png': ((44, 44), 0.9),
        'Square71x71Logo.png': ((71, 71), 0.75),
        'Square150x150Logo.png': ((150, 150), 0.6),
        'Wide310x150Logo.png': ((310, 150), 0.6),
        'LargeTile.png': ((310, 310), 0.55),
    }
    for name, (canvas, scale) in specs.items():
        # Também a versão em dobro (scale-200), para telas de alta densidade.
        logo(0, canvas, scale).save(target / name)
        big = (canvas[0] * 2, canvas[1] * 2)
        logo(0, big, scale).save(target / name.replace('.png', '.scale-200.png'))
    print('build/appx: ok')


def gradient(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new('RGB', size)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        color = tuple(int(a + (b - a) * t) for a, b in zip(PURPLE_TOP, PURPLE_BOTTOM))
        draw.line([(0, y), (w, y)], fill=color)
    return img


def framed(shot: Image.Image) -> Image.Image:
    """Tela sobre fundo roxo com sombra, no tamanho da loja."""
    canvas = gradient(STORE_SIZE)
    max_w, max_h = int(STORE_SIZE[0] * 0.86), int(STORE_SIZE[1] * 0.86)
    ratio = min(max_w / shot.width, max_h / shot.height, 1.6)
    shot = shot.convert('RGB').resize((int(shot.width * ratio), int(shot.height * ratio)), Image.LANCZOS)
    x, y = (STORE_SIZE[0] - shot.width) // 2, (STORE_SIZE[1] - shot.height) // 2
    shadow = Image.new('RGBA', STORE_SIZE, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x + 6, y + 14, x + shot.width + 6, y + shot.height + 14], 14, fill=(20, 10, 60, 120))
    canvas.paste(shadow.filter(ImageFilter.GaussianBlur(18)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(18)))
    canvas.paste(shot, (x, y))
    return canvas


def screenshots() -> None:
    for loc in LOCALES:
        src = ROOT / 'docs' / 'manual' / loc / 'img'
        out = ROOT / 'docs' / 'store' / loc / 'screenshots'
        out.mkdir(parents=True, exist_ok=True)
        n = 0
        for name in FULL + PARTIAL:
            file = src / f'{name}.png'
            if not file.exists():
                print(f'  falta {file}')
                continue
            n += 1
            shot = Image.open(file)
            img = framed(shot) if name in PARTIAL else shot.convert('RGB')
            img.save(out / f'{n:02d}-{name}.png', optimize=True)
        print(f'docs/store/{loc}/screenshots: {n} telas')


if __name__ == '__main__':
    appx_assets()
    images = ROOT / 'docs' / 'store' / 'images'
    images.mkdir(parents=True, exist_ok=True)
    logo(300, None, 0.9).save(images / 'logo-300x300.png')
    Image.open(ICON).convert('RGBA').resize((1080, 1080), Image.LANCZOS).save(images / 'logo-1080x1080.png')
    screenshots()
