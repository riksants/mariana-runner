# -*- coding: utf-8 -*-
"""
MARIANA RUNNER -- extractor for the groom + four-kisses + final-pose
sheet (assets/skins/mariana_wedding_kiss_scene.png), the second sprite
sheet for the wedding ending (after mariana_noiva_wedding.png, sliced
by extract_wedding_walk_frames.py).

Layout: four row areas top to bottom -- groom idle alone (4 frames),
kissLeft + kissRight side by side (4+4), kissForehead + kissLips side
by side (4+4), final-together alone (4 frames) -- 24 frames total.
Every character band already has a real transparent gap around every
individual frame (confirmed, same as the walk-cycle sheet), so no
flood-fill or seam carving is needed here either. The one wrinkle this
sheet has that the walk-cycle sheet didn't: on two of the four row
areas the number-label row (1/2/3/4 under each pose) touches the
character row with zero background gap between them, so plain gap
detection would fold the numerals into the top of every frame's crop.
Fixed the same way extract_skin_frames_alpha.py handles title/number
labels sitting hard against character art: strip every connected
component shorter than 45px (a numeral glyph never gets close to that;
a real character silhouette always does) before any band detection
runs at all, globally, so it doesn't matter per row whether that row's
numbers happened to have a gap or not.
"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(REPO_ROOT, "assets", "skins", "mariana_wedding_kiss_scene.png")
OUT_DIR = os.path.join(REPO_ROOT, "assets", "sprites", "skins", "noiva")

ALPHA_THR = 15
PAD = 6
MIN_LABEL_STRIP_HEIGHT = 45  # numeral glyphs are well under this; every real pose is 150px+


def strip_short_components(content, min_height=MIN_LABEL_STRIP_HEIGHT):
    labeled, n = ndimage.label(content, structure=[[1, 1, 1], [1, 1, 1], [1, 1, 1]])
    if n == 0:
        return content
    keep = np.zeros_like(content)
    for i, sl in enumerate(ndimage.find_objects(labeled), start=1):
        if sl is None:
            continue
        if (sl[0].stop - sl[0].start) >= min_height:
            keep |= (labeled == i)
    return keep


def row_bands(profile, min_height=130):
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


def col_bands(mask, y0, y1, density_thr=0):
    """Column bands above density_thr. 0 = a real (possibly 1px)
    background gap is enough, used where poses don't touch (groom idle,
    final). A few pixels of hair/sleeve/bouquet legitimately bridging
    two adjacent poses at very low density is common in the embrace
    rows below, so those call this with a higher threshold -- the
    boundary this finds is only ever used to derive a *cut point*
    (see split_points_from_bands), never as the crop box itself, so a
    boundary landing a little inside real (but sparse) content doesn't
    lose any pixels the way it would if this were the final crop."""
    sub = mask[y0:y1 + 1, :]
    col = sub.sum(axis=0)
    bands = []
    start = None
    w = col.shape[0]
    for x in range(w):
        if col[x] > density_thr:
            if start is None:
                start = x
        else:
            if start is not None:
                bands.append((start, x - 1))
                start = None
    if start is not None:
        bands.append((start, w - 1))
    return bands


def split_points_from_bands(bands):
    """Midpoint of the gap between each pair of consecutive bands --
    used as a frame-to-frame cut line so the crop on either side keeps
    every low-density pixel up to that line (a hand, a strand of hair)
    instead of being bounded by the density-thresholded band itself."""
    return [(bands[i][1] + bands[i + 1][0]) / 2 for i in range(len(bands) - 1)]


def tight_row_y(content, y0, y1, x0, x1):
    """Real (unstripped) content y-range within [y0,y1]x[x0,x1] -- used so
    the saved crop's shared row-height is measured from the true pixels,
    not the label-stripped detection mask (which is only a detection
    aid, never what gets saved)."""
    sub = content[y0:y1 + 1, x0:x1 + 1]
    rows = np.where(sub.sum(axis=1) > 0)[0]
    return (y0 + rows.min(), y0 + rows.max())


def save_frame(arr, clean, y0, y1, x0, x1, out_path):
    """clean (the label-stripped global mask) gates alpha on the padded
    crop, not just `content` — on this sheet a number label can sit
    close enough to overlap a pose's own y-range (confirmed on the
    forehead row: labels at y=576-589 vs character content starting
    y=579, an 11px overlap), so excluding labels purely by which row
    band they fell into isn't enough; this masks out anything
    strip_short_components already identified as too short to be a
    character (a numeral) directly from the saved pixels, while a real
    character component (always 150px+ tall) is untouched since
    `clean` keeps it in full, thin extremities included."""
    h, w = arr.shape[:2]
    ty0, ty1 = max(0, y0 - PAD), min(h - 1, y1 + PAD)
    tx0, tx1 = max(0, x0 - PAD), min(w - 1, x1 + PAD)
    crop = arr[ty0:ty1 + 1, tx0:tx1 + 1].copy()
    crop_clean = clean[ty0:ty1 + 1, tx0:tx1 + 1].copy()

    # The embrace rows' poses genuinely overlap in x (an elbow/sleeve
    # reaching toward the neighboring pose), so a cut line placed at the
    # lowest-density point between two frames (frame_ranges, above) can
    # still slice through a sliver of the NEXT pose — it shows up as a
    # small piece touching this crop's own left/right border, physically
    # disconnected from the couple actually being cropped here. Drop any
    # such component (keep only the main couple silhouette, plus any
    # genuinely secondary piece — e.g. a stray flower petal — that's NOT
    # touching an edge); same rule save_frame_clean uses in
    # extract_skin_frames_alpha.py for the same class of bleed.
    labeled, n = ndimage.label(crop_clean, structure=[[1, 1, 1], [1, 1, 1], [1, 1, 1]])
    if n > 1:
        sizes = ndimage.sum(crop_clean, labeled, range(1, n + 1))
        biggest_label = int(np.argmax(sizes)) + 1
        objs = ndimage.find_objects(labeled)
        crop_w = crop_clean.shape[1]
        keep_labels = [biggest_label]
        for i, sl in enumerate(objs, start=1):
            if i == biggest_label or sl is None:
                continue
            touches_edge = sl[1].start == 0 or sl[1].stop == crop_w
            if touches_edge:
                continue
            keep_labels.append(i)
        crop_clean = np.isin(labeled, keep_labels)

    crop[~crop_clean, 3] = 0
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    Image.fromarray(crop).save(out_path)
    return crop.shape


def main():
    img = Image.open(SOURCE).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    content = arr[:, :, 3] > ALPHA_THR
    clean = strip_short_components(content)

    row_profile = clean.sum(axis=1)
    bands = row_bands(row_profile, min_height=130)
    print(f"row areas found: {len(bands)}")
    for b in bands:
        print("  ", b, "height", b[1] - b[0] + 1)
    if len(bands) != 4:
        raise SystemExit(f"expected 4 row areas (groom, left+right, forehead+lips, final), got {len(bands)}")

    groom_band, lr_band, fh_lips_band, final_band = bands

    def frame_ranges(band, expected_total, density_thr):
        """expected_total column ranges spanning the row's true content
        extent, cut at the midpoints between expected_total density-thr
        bands (see split_points_from_bands) -- works whether frames have
        a real background gap (density_thr=0 suffices) or touch/overlap
        at low density (a higher threshold finds the same deep troughs
        without a neighbor's sparse pixels merging two poses together)."""
        cbands = col_bands(clean, band[0], band[1], density_thr)
        if len(cbands) != expected_total:
            raise SystemExit(f"expected {expected_total} bands at thr={density_thr}, found {len(cbands)}: {cbands}")
        true_left = min(x0 for x0, _ in cbands)
        true_right = max(x1 for _, x1 in cbands)
        cuts = split_points_from_bands(cbands)
        edges = [true_left] + cuts + [true_right]
        return [(int(np.floor(edges[i])), int(np.ceil(edges[i + 1]))) for i in range(expected_total)]

    def extract_single(band, count, prefix, density_thr=0):
        y0, y1 = tight_row_y(content, *band, 0, w - 1)
        ranges = frame_ranges(band, count, density_thr)
        for i, (x0, x1) in enumerate(ranges, start=1):
            out_path = os.path.join(OUT_DIR, f"{prefix}_{str(i).zfill(2)}.png")
            shape = save_frame(arr, clean, y0, y1, x0, x1, out_path)
            print(f"  saved {out_path} {shape}")

    def extract_pair(band, prefix_a, prefix_b, density_thr=30):
        y0, y1 = tight_row_y(content, *band, 0, w - 1)
        ranges = frame_ranges(band, 8, density_thr)
        widths = [x1 - x0 for x0, x1 in ranges]
        print(f"  {prefix_a}/{prefix_b} frame widths: {widths}")
        for i, (x0, x1) in enumerate(ranges[:4], start=1):
            out_path = os.path.join(OUT_DIR, f"{prefix_a}_{str(i).zfill(2)}.png")
            shape = save_frame(arr, clean, y0, y1, x0, x1, out_path)
            print(f"  saved {out_path} {shape}")
        for i, (x0, x1) in enumerate(ranges[4:], start=1):
            out_path = os.path.join(OUT_DIR, f"{prefix_b}_{str(i).zfill(2)}.png")
            shape = save_frame(arr, clean, y0, y1, x0, x1, out_path)
            print(f"  saved {out_path} {shape}")

    extract_single(groom_band, 4, "wedding_groom_idle")
    extract_pair(lr_band, "wedding_kiss_left", "wedding_kiss_right")
    extract_pair(fh_lips_band, "wedding_kiss_forehead", "wedding_kiss_lips")
    extract_single(final_band, 4, "wedding_final", density_thr=30)

    print("DONE")


if __name__ == "__main__":
    main()
