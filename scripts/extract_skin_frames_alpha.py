# -*- coding: utf-8 -*-
"""
MARIANA RUNNER -- alpha-channel variant of the skin-sheet extractor, used
for the 2026-09-09 drop's stragglers that the RGB-flood-fill pipeline in
extract_skin_frames.py couldn't crop.

Why a second pipeline: full_extract() in extract_skin_frames.py builds its
content mask by flood-filling from the image border on RGB color
similarity (background_mask), because the pack it was written for had a
non-transparent glow/checkerboard backdrop where alpha wasn't reliable.
This 2026-09-09 batch is different -- every sheet in it is confirmed
alpha=0 on background and alpha>0 on real content (checked directly, all
23 files) -- so the RGB heuristic is solving a harder problem than it
needs to, and on sheets with colorful compression-fringe pixels near
silhouette edges it sometimes mis-splits a row or a frame boundary
(confirmed on Boneca: a REJECT box landed on a near-empty 89x303 sliver
instead of the real ~250px-wide character). Thresholding the alpha
channel directly is exact here, not an approximation, so it replaces
that whole heuristic.

The row-band split is also replaced: full_extract() finds the run-row /
jump+idle-row boundary by searching for the widest low-density gap in
the upper 65% of the content span -- a search that can lock onto the
gap between a sheet's title text and its number-label row instead of the
real gap between the two character rows. This version instead finds
every contiguous content band top-to-bottom and keeps only the ones
taller than MIN_BAND_HEIGHT: title/number text lines are at most ~90px
tall in this pack, while every real character frame is 200-400px, so a
plain height filter separates them cleanly regardless of gap sizes.
Column segmentation within a row (sequential_split), jump/idle grouping
(try_lr_split/try_tb_split) and the final per-frame connected-component
cleanup (save_frame) are unchanged -- reused directly from
extract_skin_frames.py since none of that logic depended on how the
content mask was produced.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_skin_frames import (
    sequential_split, uniform_trim_axis, try_lr_split, try_tb_split,
    SPRITES_OUT,
)

MIN_BAND_HEIGHT = 130   # character frames run 200-400px tall; header text lines don't get near this
MAX_CHAR_H = 420
MIN_ABS_W, MIN_ABS_H = 45, 100
MIN_CONTENT_AREA = 800


def strip_short_components(content, min_height=45):
    """Drop every connected component whose bounding box is shorter than
    min_height. Label glyphs (title text ~31px tall, per-frame numbers
    ~24px in this pack) never come close to that; a real character
    silhouette is always 150px+ tall as one connected blob. Some sheets
    place a label directly against the character art with a sub-pixel
    gap (confirmed on Vaqueira: exactly 1 background row between the
    "PULO/PARADO" title and the frames beneath it), too tight for any
    row-gap threshold to separate reliably -- this removes the label at
    the mask level instead, before band/column detection ever runs."""
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


def content_bands(profile, min_gap=2, min_height=MIN_BAND_HEIGHT):
    """Contiguous runs of profile>0, small internal gaps (anti-aliasing,
    thin connectors) bridged up to min_gap rows, filtered to real
    character-frame height."""
    bands = []
    start = None
    gap = 0
    n = len(profile)
    for i in range(n):
        if profile[i] > 0:
            if start is None:
                start = i
            gap = 0
        else:
            if start is not None:
                gap += 1
                if gap > min_gap:
                    bands.append((start, i - gap))
                    start = None
                    gap = 0
    if start is not None:
        bands.append((start, n - 1 - gap))
    return [(a, b) for a, b in bands if (b - a + 1) >= min_height]


def full_extract_alpha(path, expected_run, expected_jump, expected_idle, alpha_thr=15):
    img = Image.open(path).convert('RGBA')
    arr = np.array(img)
    h, w = arr.shape[:2]
    content = arr[:, :, 3] > alpha_thr
    # Band/column detection runs on the label-stripped mask so a title or
    # number glyph can never be mistaken for character content; the final
    # crop (save_frame, below) still uses the raw `content` mask so no
    # real character pixel is ever discarded just for being part of a
    # thin, short-bbox extremity.
    clean = strip_short_components(content)

    row_profile = clean.sum(axis=1)
    bands = content_bands(row_profile)
    if len(bands) != 2:
        if os.environ.get('DEBUG_EXTRACT'):
            print('BAND COUNT', len(bands), bands)
        return None
    run_band, ji_band = bands
    if (run_band[1] - run_band[0]) > MAX_CHAR_H or (ji_band[1] - ji_band[0]) > MAX_CHAR_H:
        return None

    run_y = uniform_trim_axis(clean, run_band[0], run_band[1], 0, w - 1, 'y')
    run_slots = sequential_split(clean, run_band[0], run_band[1], 0, w - 1, expected_run)
    if run_y is None or run_slots is None:
        return None
    if (run_y[1] - run_y[0]) < MIN_ABS_H:
        return None
    for (x0, x1) in run_slots:
        if (x1 - x0) < MIN_ABS_W:
            return None

    jy0, jy1 = ji_band

    def plausible(result):
        if result is None:
            return False
        for _kind, (y0, y1), (x0, x1) in result:
            if (x1 - x0) < MIN_ABS_W or (y1 - y0) < MIN_ABS_H:
                return False
            if (y1 - y0) > MAX_CHAR_H:
                return False
        return True

    ji_result = try_lr_split(clean, w, jy0, jy1, expected_jump, expected_idle)
    if not plausible(ji_result):
        ji_result = try_tb_split(clean, w, jy0, jy1, expected_jump, expected_idle)
    if not plausible(ji_result):
        return None

    PAD = 6
    def mkbox(yrange, xr):
        y0, y1 = yrange; x0, x1 = xr
        return (max(0, y0 - PAD), min(h - 1, y1 + PAD), max(0, x0 - PAD), min(w - 1, x1 + PAD))

    frames = [('run', mkbox(run_y, xr)) for xr in run_slots]
    for kind, yr, xr in ji_result:
        frames.append((kind, mkbox(yr, xr)))

    for _kind, (by0, by1, bx0, bx1) in frames:
        area = content[by0:by1 + 1, bx0:bx1 + 1].sum()
        if area < MIN_CONTENT_AREA:
            if os.environ.get('DEBUG_EXTRACT'):
                print('REJECT', _kind, (by0, by1, bx0, bx1), 'area', area)
            return None

    return frames, content, clean


def save_frame_clean(arr, content, clean, bbox, out_path):
    """Same crop+cleanup as extract_skin_frames.save_frame (close small
    gaps, drop components under 8% of the biggest one), plus two more
    rules that target label residue a frame's own crop box can still
    catch even though band/column detection never saw it (it was cropped
    out of consideration by strip_short_components, but the raw content
    mask -- what actually gets saved -- was never touched):

    1. A component with NO overlap in `clean` (the label-stripped global
       mask) is entirely shorter than 45px by definition -- exactly what
       a stray digit looks like -- so it's dropped outright regardless of
       size or position (confirmed needed on Chef: a jump-frame crop
       caught a floating number fragment above the hat that was too big
       for the 8% rule and not touching any edge).
    2. A kept secondary component that touches the crop's own left/right
       border is dropped even if it passes the 8% test -- a real
       disconnected part of THIS character (a hand held away from the
       body) sits inboard of the frame boundary; one touching the
       boundary is what a neighboring frame's overlapping hair/head
       looks like when sequential_split had to cut through content
       because two adjacent poses genuinely overlap in x (confirmed on
       Gatinha's run cycle)."""
    y0, y1, x0, x1 = bbox
    crop = arr[y0:y1 + 1, x0:x1 + 1].copy()
    crop_content = content[y0:y1 + 1, x0:x1 + 1]
    crop_clean = clean[y0:y1 + 1, x0:x1 + 1]

    # Component decisions run on the UNCLOSED mask on purpose (confirmed
    # necessary on Chef): closing first, then labeling, let a label digit
    # sitting 1-2px from the character weld onto the main body into a
    # single component -- which then trivially "overlaps clean" and
    # "is the biggest component," passing every filter below with the
    # noise still attached. Deciding keep/drop before any closing keeps
    # the digit as its own tiny component so the clean-overlap check
    # actually sees it.
    labeled, n = ndimage.label(crop_content, structure=[[1, 1, 1], [1, 1, 1], [1, 1, 1]])
    if n > 1:
        sizes = ndimage.sum(crop_content, labeled, range(1, n + 1))
        biggest_label = int(np.argmax(sizes)) + 1
        biggest_size = sizes.max()
        objs = ndimage.find_objects(labeled)
        keep_labels = [biggest_label]
        crop_w = crop_content.shape[1]
        for i, sl in enumerate(objs, start=1):
            if i == biggest_label or sl is None:
                continue
            comp_mask = labeled == i
            if not np.any(crop_clean[comp_mask]):
                continue
            if sizes[i - 1] < biggest_size * 0.08:
                continue
            touches_edge = sl[1].start == 0 or sl[1].stop == crop_w
            if touches_edge:
                continue
            keep_labels.append(i)
        crop_content = np.isin(labeled, keep_labels)

    # Cosmetic-only closing, applied AFTER the keep/drop decision above so
    # it can only smooth the already-selected real silhouette (bridge a
    # sub-pixel anti-aliasing notch) -- it can no longer weld a rejected
    # label fragment back on since those pixels are already excluded.
    close_struct = np.ones((5, 5), dtype=bool)
    crop_content = ndimage.binary_closing(crop_content, structure=close_struct)

    crop[~crop_content, 3] = 0
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    Image.fromarray(crop).save(out_path)


def extract_skin_alpha(source_path, skin_id, expected_run=12, expected_jump=4, expected_idle=2):
    result = full_extract_alpha(source_path, expected_run, expected_jump, expected_idle)
    if result is None:
        print(f"[{skin_id}] ALPHA-PIPELINE FAILED -- source={source_path}")
        return False
    frames, content, clean = result
    img = Image.open(source_path).convert('RGBA')
    arr = np.array(img)
    counters = {'run': 0, 'jump': 0, 'idle': 0}
    for kind, bbox in frames:
        counters[kind] += 1
        n = str(counters[kind]).zfill(2)
        out_path = os.path.join(SPRITES_OUT, skin_id, f"girl_{kind}_{n}.png")
        save_frame_clean(arr, content, clean, bbox, out_path)
    print(f"[{skin_id}] OK (alpha pipeline) run={counters['run']} jump={counters['jump']} idle={counters['idle']}")
    return True
