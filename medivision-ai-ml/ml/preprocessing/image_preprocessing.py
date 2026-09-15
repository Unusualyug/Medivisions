from pathlib import Path
from PIL import Image, UnidentifiedImageError

def open_valid_image(source):
    try:
        if isinstance(source, (str, Path)):
            image = Image.open(source)
        else: image = Image.open(source)
        image.load(); return image.convert("RGB")
    except (FileNotFoundError, UnidentifiedImageError, OSError) as exc:
        raise ValueError(f"Invalid, missing, or unsupported image: {exc}") from exc
