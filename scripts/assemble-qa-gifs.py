from pathlib import Path
import sys

from PIL import Image


def build(source: Path, output: Path) -> None:
    paths = sorted(source.glob("*.png"))
    if not paths:
        raise RuntimeError(f"No frames found in {source}")
    frames = [Image.open(path).convert("RGB").resize((720, 450), Image.Resampling.LANCZOS) for path in paths]
    frames[0].save(
        output,
        save_all=True,
        append_images=frames[1:],
        duration=70,
        loop=0,
        optimize=True,
    )


root = Path(sys.argv[1])
build(root / "hero-frames", root / "h2-magnetic-letterfield-demo.gif")
build(root / "work-frames", root / "w1-editorial-transformation-demo.gif")
