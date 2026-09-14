# -*- coding: utf-8 -*-
"""
MARIANA RUNNER -- extractor for the wedding-scene walk-cycle sheet
(assets/skins/mariana_noiva_wedding.png), added for the "Mariana walks
to the altar" step of the wedding ending.

Unlike the run/jump/idle sheets in extract_skin_frames.py (one row of
running poses + one combined jump+idle row, sometimes touching/
overlapping and needing sequential_split's boundary search), this sheet
has four independent single-pose rows -- decelerating (8), walking (8),
and a combined bottom row holding "stopping" (6) and "idle" (3) side by
side -- and every pose in every row already has a real transparent gap
around it (confirmed: alpha-thresholded column bands per row come back
with exactly the expected frame count, no touching/overlap anywhere).
So this only needs plain gap-based band detection, no flood-fill, no
label-vs-character disambiguation via component height, and no seam
carving -- each row's own title+number label band is simply a separate,
shorter content band above the character band and is never included.

Alignment: every frame in one row shares that row's own (y0, y1) --
never a per-frame tight y-crop -- so the ground line each pose was
drawn on lands at the same pixel row in every output PNG of that row.
drawSpriteRB (js/sprites.js) always scales a frame to a fixed target
height and anchors its bottom-right corner, so a shared row height is
what keeps the character's feet from jittering frame to frame; a looser
per-frame y-crop would let a pose with slightly less vertical extent
sit at a different scale and appear to hop.
"""
import os

import numpy as np
from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(REPO_ROOT, "assets", "skins", "mariana_noiva_wedding.png")
OUT_DIR = os.path.join(REPO_ROOT, "assets", "sprites", "skins", "noiva")

ALPHA_THR = 15
PAD = 6


def row_bands(profile, min_height):
    """Contiguous runs of profile > 0 (no gap bridging -- every real gap
    in this sheet, between a label and its character row or between two
    character rows, is large and clean), kept only if tall enough to be
    a character row rather than a title/number label line."""
    bands = []
    start = None
    n = len(profile)
    for y in range(n):
        if profile[y] > 0:
            if start is None:
                start = y
        else:
            if start is not None:
                bands.append((start, y - 1))
                start = None
    if start is not None:
        bands.append((start, n - 1))
    return [(a, b) for a, b in bands if (b - a + 1) >= min_height]


def col_bands(content, y0, y1):
    sub = content[y0:y1 + 1, :]
    col = sub.sum(axis=0)
    bands = []
    start = None
    w = col.shape[0]
    for x in range(w):
        if col[x] > 0:
            if start is None:
                start = x
        else:
            if start is not None:
                bands.append((start, x - 1))
                start = None
    if start is not None:
        bands.append((start, w - 1))
    return bands


def save_frame(arr, y0, y1, x0, x1, out_path):
    h, w = arr.shape[:2]
    ty0, ty1 = max(0, y0 - PAD), min(h - 1, y1 + PAD)
    tx0, tx1 = max(0, x0 - PAD), min(w - 1, x1 + PAD)
    crop = arr[ty0:ty1 + 1, tx0:tx1 + 1].copy()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    Image.fromarray(crop).save(out_path)
    return crop.shape


def main():
    img = Image.open(SOURCE).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    content = arr[:, :, 3] > ALPHA_THR

    row_profile = content.sum(axis=1)
    bands = row_bands(row_profile, min_height=130)
    print(f"character-height row bands found: {len(bands)}")
    for b in bands:
        print("  ", b, "height", b[1] - b[0] + 1)
    if len(bands) != 3:
        raise SystemExit(f"expected 3 character rows (decel, walk, stop+idle combined), got {len(bands)}")

    decel_band, walk_band, bottom_band = bands

    def extract_row(band, count, prefix):
        y0, y1 = band
        bands_x = col_bands(content, y0, y1)
        if len(bands_x) != count:
            raise SystemExit(f"{prefix}: expected {count} frames, found {len(bands_x)} column bands: {bands_x}")
        for i, (x0, x1) in enumerate(bands_x, start=1):
            out_path = os.path.join(OUT_DIR, f"{prefix}_{str(i).zfill(2)}.png")
            shape = save_frame(arr, y0, y1, x0, x1, out_path)
            print(f"  saved {out_path} {shape}")

    extract_row(decel_band, 8, "wedding_decelerate")
    extract_row(walk_band, 8, "wedding_walk")

    # Bottom band holds "parando" (6) then "idle" (3) side by side --
    # split on the one wide gap between them (every within-group gap is
    # a normal inter-frame gap; the between-group gap is far bigger).
    y0, y1 = bottom_band
    bands_x = col_bands(content, y0, y1)
    print("bottom row column bands:", len(bands_x))
    if len(bands_x) != 9:
        raise SystemExit(f"expected 6+3=9 frames in bottom row, found {len(bands_x)}: {bands_x}")
    gaps = [bands_x[i + 1][0] - bands_x[i][1] for i in range(len(bands_x) - 1)]
    split_i = int(np.argmax(gaps))  # index of the biggest gap -> boundary between groups
    print("inter-frame gaps:", gaps, "-> split after band index", split_i)
    stop_bands = bands_x[:split_i + 1]
    idle_bands = bands_x[split_i + 1:]
    if len(stop_bands) != 6 or len(idle_bands) != 3:
        raise SystemExit(f"split mismatch: stop={len(stop_bands)} idle={len(idle_bands)}")

    for i, (x0, x1) in enumerate(stop_bands, start=1):
        out_path = os.path.join(OUT_DIR, f"wedding_stop_{str(i).zfill(2)}.png")
        shape = save_frame(arr, y0, y1, x0, x1, out_path)
        print(f"  saved {out_path} {shape}")
    for i, (x0, x1) in enumerate(idle_bands, start=1):
        out_path = os.path.join(OUT_DIR, f"wedding_idle_{str(i).zfill(2)}.png")
        shape = save_frame(arr, y0, y1, x0, x1, out_path)
        print(f"  saved {out_path} {shape}")

    print("DONE")


if __name__ == "__main__":
    main()
