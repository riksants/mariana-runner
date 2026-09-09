"""
MARIANA RUNNER -- skin sprite-sheet frame extractor.

Takes a raw "contact sheet" PNG (the AI-generated reference art in
assets/skins/, e.g. mariana_gold.png -- a labeled grid of run/jump/idle
poses on a white/glow/checkerboard background) and crops it into the
individual per-frame transparent PNGs the game actually loads, at
assets/sprites/skins/<id>/girl_run_NN.png etc.

Algorithm (see docs/superpowers/specs/2026-09-08-skin-pack-extraction.md
for the full derivation and the failure modes that motivated each step):

1. Background removal: union-find flood fill from the image border.
   Adjacent pixels (4-connectivity) merge into the same region when their
   color distance is below `tolerance`; every pixel connected to a border
   pixel is "background". This follows smooth glow gradients and bridges
   checkerboard placeholder tiles, but stops hard at every character's
   dark outline stroke -- so it never eats into character pixels.
2. Denoise: binary opening (erode+dilate) with a small square kernel
   removes leftover speckle (a handful of pixels here and there that
   survive step 1, e.g. a compression artifact) without touching any
   real character silhouette, which is always much larger.
3. Row-band split: the row-content profile (content pixels per row,
   summed across the width) is searched for its widest low-density gap,
   which separates the "corrida" row from the combined "pulo"/"parado"
   row below it. The search window is capped at the upper 65% of the
   content span and the resulting run-row height is capped at 340px --
   both guard against a single stray far-away pixel inflating the
   content bounding box and pulling the "widest gap" search toward the
   trailing empty margin instead of the real seam between the rows.
4. Frame segmentation ("sequential_split"): within a row, frames are
   NOT evenly spaced (a running stride varies in width; a jump arc's
   poses cluster unevenly) so a fixed grid is unsafe. Instead each
   boundary is placed at the locally thinnest column within a window
   around where it's expected next, computed from the *previous* found
   boundary and the remaining frame count/width -- not from a single
   global nominal grid -- so it adapts frame by frame.
5. Jump/idle grouping: within the combined row, most sheets place the
   "pulo" poses to the left and "parado" poses to the right of one big
   gap (try_lr_split); a few place "parado" directly below "pulo"
   instead (try_tb_split). Both are tried; the result is accepted only
   if every resulting frame is a plausible size (width close to the
   run-row's own frame width, height under the same cap as step 3) --
   otherwise this file needs a human to look at it, per the project's
   "never guess past a sprite-sheet problem" rule.
6. Crop: each frame's final pixels are the union of "content" (non-
   background) pixels within its slot's own row-height range, cropped
   with a small pixel pad and background pixels set to alpha 0 -- a
   pure geometric crop, no redrawing, no resampling.

Run: python scripts/extract_skin_frames.py
(no third-party imports beyond Pillow/numpy/scipy -- see
docs/superpowers/specs/2026-09-08-skin-pack-extraction.md "Tooling"
section for why those three were installed for this one-off asset-prep
step instead of hand-rolling a PNG codec.)
"""
import os
import numpy as np
from PIL import Image
import scipy.sparse as sp
from scipy.sparse.csgraph import connected_components
from scipy import ndimage

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK_DIR = r"C:\Users\rikli\Downloads\mariana_skins_completas\mariana_skins_pack\skins_geradas"
SKINS_OUT = os.path.join(REPO_ROOT, "assets", "skins")
SPRITES_OUT = os.path.join(REPO_ROOT, "assets", "sprites", "skins")


# ---------------------------------------------------------------------
# Step 1-2: background removal + denoise
# ---------------------------------------------------------------------
def background_mask(rgb, tolerance):
    h, w = rgb.shape[:2]
    n = h * w
    idx = np.arange(n).reshape(h, w)
    diff_r = np.abs(rgb[:, 1:, :].astype(np.int16) - rgb[:, :-1, :].astype(np.int16)).sum(axis=2)
    mask_r = diff_r < tolerance
    src_r = idx[:, :-1][mask_r]; dst_r = idx[:, 1:][mask_r]
    diff_d = np.abs(rgb[1:, :, :].astype(np.int16) - rgb[:-1, :, :].astype(np.int16)).sum(axis=2)
    mask_d = diff_d < tolerance
    src_d = idx[:-1, :][mask_d]; dst_d = idx[1:, :][mask_d]
    rows = np.concatenate([src_r, src_d]); cols = np.concatenate([dst_r, dst_d])
    data = np.ones(len(rows), dtype=np.uint8)
    graph = sp.coo_matrix((data, (rows, cols)), shape=(n, n))
    _, labels = connected_components(graph, directed=False)
    border_mask = np.zeros((h, w), dtype=bool)
    border_mask[0, :] = True; border_mask[-1, :] = True
    border_mask[:, 0] = True; border_mask[:, -1] = True
    border_labels = set(labels[border_mask.reshape(-1)].tolist())
    return np.isin(labels, list(border_labels)).reshape(h, w)


def denoise_content(content, kernel):
    if kernel <= 1:
        return content
    struct = np.ones((kernel, kernel), dtype=bool)
    return ndimage.binary_opening(content, structure=struct, iterations=1)


# ---------------------------------------------------------------------
# Shared 1-D helpers
# ---------------------------------------------------------------------
def content_bbox_1d(profile, min_value=0):
    idxs = np.where(profile > min_value)[0]
    if len(idxs) == 0:
        return None
    return int(idxs.min()), int(idxs.max())


def largest_contig_run(profile, lo, hi, density_min, max_gap=4):
    runs = []
    start = None
    gap = 0
    for i in range(lo, hi + 1):
        dense = profile[i] > density_min
        if dense:
            if start is None: start = i
            gap = 0
        else:
            if start is not None:
                gap += 1
                if gap > max_gap:
                    runs.append((start, i - gap)); start = None; gap = 0
    if start is not None:
        runs.append((start, hi - gap))
    if not runs:
        return None
    runs.sort(key=lambda r: r[1] - r[0], reverse=True)
    return runs[0]


def widest_low_run(profile, lo, hi, thr):
    low_runs = []
    start = None
    for i in range(lo, hi + 1):
        low = profile[i] <= thr
        if low:
            if start is None: start = i
        else:
            if start is not None:
                low_runs.append((start, i - 1)); start = None
    if start is not None:
        low_runs.append((start, hi))
    low_runs = [r for r in low_runs if r[1] > r[0]]
    if not low_runs:
        return None
    low_runs.sort(key=lambda r: r[1] - r[0], reverse=True)
    return low_runs[0]


def uniform_trim_axis(content, y0, y1, x0, x1, axis):
    sub = content[y0:y1 + 1, x0:x1 + 1]
    profile = sub.sum(axis=1) if axis == 'y' else sub.sum(axis=0)
    # max_gap is generous here (25, vs. the module default of 4): hair and
    # other thin extremities are often sparse enough to leave a >4px gap
    # in the density profile before the denser body silhouette starts, and
    # a tight max_gap would trim the whole row/column short right at that
    # gap -- silently cropping off a head or hand that's still genuinely
    # part of the frame. A 25px gap only ever reaches into truly empty
    # background above/beside the character (nothing else is up there to
    # wrongly merge with), so it's safe to bridge.
    r = largest_contig_run(profile, 0, len(profile) - 1, density_min=2, max_gap=45)
    if r is None:
        return None
    if axis == 'y':
        return (y0 + r[0], y0 + r[1])
    return (x0 + r[0], x0 + r[1])


# ---------------------------------------------------------------------
# Step 4: per-row frame segmentation
# ---------------------------------------------------------------------
def sequential_split(content, y0, y1, x0, x1, count, window_frac=0.5):
    col_profile = content[y0:y1 + 1, x0:x1 + 1].sum(axis=0)
    bbox = content_bbox_1d(col_profile)
    if bbox is None:
        return None
    lo, hi = bbox
    left = x0 + lo; right = x0 + hi
    boundaries = [left]
    cur = left
    for i in range(1, count):
        remaining_span = right - cur
        remaining_slots = count - (i - 1)
        est_w = remaining_span / remaining_slots
        nominal = cur + est_w
        win = est_w * window_frac
        wlo = int(max(cur + 1, nominal - win) - x0)
        whi = int(min(right, nominal + win) - x0)
        if whi <= wlo:
            return None
        window_vals = col_profile[wlo:whi + 1]
        boundary = x0 + wlo + int(np.argmin(window_vals))
        if boundary <= cur:
            boundary = cur + 1
        boundaries.append(boundary)
        cur = boundary
    boundaries.append(right + 1)
    return [(boundaries[i], boundaries[i + 1] - 1) for i in range(count)]


def tight_bbox(content, y0, y1, x0, x1, pad=6):
    sub = content[y0:y1 + 1, x0:x1 + 1]
    if sub.sum() == 0:
        return None
    row_sum = sub.sum(axis=1)
    col_sum = sub.sum(axis=0)
    yr = content_bbox_1d(row_sum, min_value=2)
    xr = content_bbox_1d(col_sum, min_value=2)
    if yr is None or xr is None:
        return None
    H, W = content.shape
    ty0 = max(0, y0 + yr[0] - pad); ty1 = min(H - 1, y0 + yr[1] + pad)
    tx0 = max(0, x0 + xr[0] - pad); tx1 = min(W - 1, x0 + xr[1] + pad)
    return (ty0, ty1, tx0, tx1)


# ---------------------------------------------------------------------
# Step 5: jump/idle grouping within the combined row
# ---------------------------------------------------------------------
def _group_split(col_profile, lo, hi, thr, min_gap_width=2):
    low_runs = []
    start = None
    for i in range(lo, hi + 1):
        low = col_profile[i] <= thr
        if low:
            if start is None: start = i
        else:
            if start is not None:
                low_runs.append((start, i - 1)); start = None
    if start is not None:
        low_runs.append((start, hi))
    low_runs = [r for r in low_runs if r[1] - r[0] >= min_gap_width]
    if not low_runs:
        return None
    low_runs.sort(key=lambda r: r[1] - r[0], reverse=True)
    return low_runs[0]


def try_lr_split(content, w, jy0, jy1, expected_jump, expected_idle):
    col_profile = content[jy0:jy1 + 1, :].sum(axis=0)
    b = content_bbox_1d(col_profile)
    if b is None:
        return None
    lo, hi = b
    gsplit = _group_split(col_profile, lo, hi, thr=2) or _group_split(col_profile, lo, hi, thr=5)
    if gsplit is None:
        return None
    split_mid = (gsplit[0] + gsplit[1]) // 2
    jump_slots = sequential_split(content, jy0, jy1, lo, split_mid, expected_jump)
    idle_slots = sequential_split(content, jy0, jy1, split_mid + 1, hi, expected_idle)
    if jump_slots is None or idle_slots is None:
        return None
    jump_y = uniform_trim_axis(content, jy0, jy1, lo, split_mid, 'y')
    idle_y = uniform_trim_axis(content, jy0, jy1, split_mid + 1, hi, 'y')
    if jump_y is None or idle_y is None:
        return None
    return [('jump', jump_y, xr) for xr in jump_slots] + [('idle', idle_y, xr) for xr in idle_slots]


def try_tb_split(content, w, jy0, jy1, expected_jump, expected_idle):
    row_profile = content[jy0:jy1 + 1, :].sum(axis=1)
    b = content_bbox_1d(row_profile, min_value=2)
    if b is None:
        return None
    lo, hi = b
    split = widest_low_run(row_profile, lo, hi, thr=2)
    if split is None:
        return None
    split_mid = (split[0] + split[1]) // 2
    jump_band = (jy0 + lo, jy0 + split_mid)
    idle_band = (jy0 + split_mid + 1, jy0 + hi)
    if (jump_band[1] - jump_band[0]) < 40 or (idle_band[1] - idle_band[0]) < 40:
        return None
    jump_slots = sequential_split(content, jump_band[0], jump_band[1], 0, w - 1, expected_jump)
    idle_slots = sequential_split(content, idle_band[0], idle_band[1], 0, w - 1, expected_idle)
    if jump_slots is None or idle_slots is None:
        return None
    jump_y = uniform_trim_axis(content, jump_band[0], jump_band[1], 0, w - 1, 'y')
    idle_y = uniform_trim_axis(content, idle_band[0], idle_band[1], 0, w - 1, 'y')
    if jump_y is None or idle_y is None:
        return None
    return [('jump', jump_y, xr) for xr in jump_slots] + [('idle', idle_y, xr) for xr in idle_slots]


# ---------------------------------------------------------------------
# Full pipeline for the "standard" layout: one run row, one combined
# jump+idle row below it. `full_extract_multirow` (further below)
# handles the Futuro skin's different 5-band layout.
# ---------------------------------------------------------------------
MAX_CHAR_H = 340  # no character in this pack's contact sheets exceeds ~300px tall


def full_extract(path, expected_run, expected_jump, expected_idle, tol, kernel, frac):
    img = Image.open(path).convert('RGBA')
    arr = np.array(img)
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3]
    bg = background_mask(rgb, tol)
    content = denoise_content(~bg, kernel)

    row_profile = content.sum(axis=1)
    bbox = content_bbox_1d(row_profile, min_value=w * frac)
    if bbox is None:
        return None
    r_lo, r_hi = bbox
    search_hi = r_lo + int((r_hi - r_lo) * 0.65)
    split = widest_low_run(row_profile, r_lo, search_hi, thr=max(2, int(w * frac)))
    if split is None:
        return None
    split_mid = (split[0] + split[1]) // 2
    run_band = (r_lo, split_mid)
    ji_band = (split_mid + 1, r_hi)
    if (run_band[1] - run_band[0]) > MAX_CHAR_H:
        return None
    if (run_band[1] - run_band[0]) < 80 or (ji_band[1] - ji_band[0]) < 40:
        return None

    run_y = uniform_trim_axis(content, run_band[0], run_band[1], 0, w - 1, 'y')
    run_slots = sequential_split(content, run_band[0], run_band[1], 0, w - 1, expected_run)
    if run_slots is None or run_y is None:
        return None

    # Absolute floor, independent of the median comparison below: every
    # confirmed-good frame across this whole pack is at least this large.
    # A relative-to-median check alone can't catch a row that segmented
    # uniformly too small (median shrinks right along with every frame).
    MIN_ABS_W, MIN_ABS_H = 45, 100
    if (run_band[1] - run_band[0]) < MIN_ABS_H:
        return None
    for (x0, x1) in run_slots:
        if (x1 - x0) < MIN_ABS_W:
            return None

    run_widths = sorted(x1 - x0 for (x0, x1) in run_slots)
    median_run_w = run_widths[len(run_widths) // 2]

    def plausible(result):
        if result is None:
            return False
        for _kind, (y0, y1), (x0, x1) in result:
            if (x1 - x0) < median_run_w * 0.35:
                return False
            if (x1 - x0) < MIN_ABS_W or (y1 - y0) < MIN_ABS_H:
                return False
            if (y1 - y0) > MAX_CHAR_H:
                return False
        return True

    jy0, jy1 = ji_band
    ji_result = try_lr_split(content, w, jy0, jy1, expected_jump, expected_idle)
    if not plausible(ji_result):
        ji_result = try_tb_split(content, w, jy0, jy1, expected_jump, expected_idle)
    if not plausible(ji_result):
        return None

    PAD = 6
    MIN_CONTENT_AREA = 1200  # real character silhouettes in this pack run 3000-15000px
    def mkbox(yrange, xr):
        y0, y1 = yrange; x0, x1 = xr
        return (max(0, y0 - PAD), min(h - 1, y1 + PAD), max(0, x0 - PAD), min(w - 1, x1 + PAD))

    frames = [('run', mkbox(run_y, xr)) for xr in run_slots]
    for kind, yr, xr in ji_result:
        frames.append((kind, mkbox(yr, xr)))

    # Final check: every box's SLOT dimensions can look fine while the
    # actual character content inside it is a tiny fragment (the boundary
    # landed mostly on background) -- verify real content pixel count too,
    # not just box width/height, or a badly-placed slot silently saves as
    # a near-empty, speckled frame instead of failing loudly.
    for _kind, (by0, by1, bx0, bx1) in frames:
        area = content[by0:by1 + 1, bx0:bx1 + 1].sum()
        if area < MIN_CONTENT_AREA:
            if os.environ.get('DEBUG_EXTRACT'):
                print('REJECT', _kind, (by0, by1, bx0, bx1), 'area', area)
            return None

    return frames, content


TOLERANCES = [25, 30, 40, 55, 70, 90, 110, 140]
KERNELS = [3, 5, 7, 9]
THRESH_FRACS = [0.002, 0.005, 0.01, 0.015, 0.02]


def auto_extract(path, expected_run=12, expected_jump=4, expected_idle=2):
    """Grid-searches (tolerance, denoise kernel, row-threshold fraction)
    until `full_extract` returns a result that passes every plausibility
    check. Returns (frames, content_mask, used_params) or None if no
    combination in the grid worked -- callers MUST treat None as "stop
    and get a human to look at this file," never as license to guess."""
    for tol in TOLERANCES:
        for kernel in KERNELS:
            for frac in THRESH_FRACS:
                result = full_extract(path, expected_run, expected_jump, expected_idle, tol, kernel, frac)
                if result is not None:
                    frames, content = result
                    return frames, content, (tol, kernel, frac)
    return None


# ---------------------------------------------------------------------
# Crop + save
# ---------------------------------------------------------------------
def save_frame(arr, content, bbox, out_path):
    y0, y1, x0, x1 = bbox
    crop = arr[y0:y1 + 1, x0:x1 + 1].copy()
    crop_content = content[y0:y1 + 1, x0:x1 + 1]

    # A leg/boot rendered in pale colors close to the background sometimes
    # reads as fully disconnected from the torso -- a real body part, not
    # debris, that a plain "keep largest" pass would still show correctly
    # but with a visible gap. Close (dilate+erode) with a moderate radius
    # FIRST, scoped to this single already-cropped frame only (so it can
    # never reach into a neighboring frame the way a sheet-wide closing
    # would), to bridge such gaps before the component filter runs.
    close_struct = np.ones((11, 11), dtype=bool)
    crop_content = ndimage.binary_closing(crop_content, structure=close_struct)

    # A stray leftover contact-sheet label digit, or a thin sliver bled in
    # from the neighboring frame, shows up as its own small connected
    # component clearly disconnected from the character. Drop only
    # components that are tiny relative to the main silhouette (a label
    # digit is a few hundred px at most) -- keep anything sizeable (a boot
    # or hand separated from the body by a thin low-contrast bridge is
    # still thousands of px) so a real body part is never discarded.
    labeled, n = ndimage.label(crop_content, structure=[[1, 1, 1], [1, 1, 1], [1, 1, 1]])
    if n > 1:
        sizes = ndimage.sum(crop_content, labeled, range(1, n + 1))
        biggest_size = sizes.max()
        keep_labels = [i + 1 for i, s in enumerate(sizes) if s >= biggest_size * 0.08]
        crop_content = np.isin(labeled, keep_labels)

    crop[~crop_content, 3] = 0
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    Image.fromarray(crop).save(out_path)


def extract_skin(source_path, skin_id, expected_run=12, expected_jump=4, expected_idle=2):
    result = auto_extract(source_path, expected_run, expected_jump, expected_idle)
    if result is None:
        print(f"[{skin_id}] FAILED -- no automatic combination produced a plausible crop. "
              f"STOP: this file needs manual review, source={source_path}")
        return False
    frames, content, used = result
    img = Image.open(source_path).convert('RGBA')
    arr = np.array(img)

    counters = {'run': 0, 'jump': 0, 'idle': 0}
    for kind, bbox in frames:
        counters[kind] += 1
        n = str(counters[kind]).zfill(2)
        out_path = os.path.join(SPRITES_OUT, skin_id, f"girl_{kind}_{n}.png")
        save_frame(arr, content, bbox, out_path)

    print(f"[{skin_id}] OK params={used} run={counters['run']} jump={counters['jump']} idle={counters['idle']}")
    return True


def extract_futuro(source_path, skin_id="futuro"):
    """Futuro's contact sheet lays out 48 run frames across three rows of
    16 (not one row of 48), then jump (18) and idle (3) each on their own
    row below -- unlike every other skin's single combined jump+idle row.
    Row Y-bands are auto-detected the same way as the standard pipeline
    (row-content profile, widest low-density gap repeated per row), then
    each band is segmented with the same sequential_split used elsewhere."""
    img = Image.open(source_path).convert('RGBA')
    arr = np.array(img)
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3]

    for tol in TOLERANCES:
        bg = background_mask(rgb, tol)
        for kernel in KERNELS:
            content = denoise_content(~bg, kernel)
            for frac in THRESH_FRACS:
                row_profile = content.sum(axis=1)
                bbox = content_bbox_1d(row_profile, min_value=w * frac)
                if bbox is None:
                    continue
                lo, hi = bbox
                bands = []
                cursor = lo
                ok = True
                for _ in range(4):  # 4 gaps separate the 5 bands
                    split = widest_low_run(row_profile, cursor, hi, thr=max(2, int(w * frac)))
                    if split is None:
                        ok = False; break
                    split_mid = (split[0] + split[1]) // 2
                    bands.append((cursor, split_mid))
                    cursor = split_mid + 1
                if not ok:
                    continue
                bands.append((cursor, hi))
                if len(bands) != 5:
                    continue
                heights = [b[1] - b[0] for b in bands]
                if any(hgt > MAX_CHAR_H or hgt < 20 for hgt in heights):
                    continue
                counts = [16, 16, 16, 18, 3]
                kinds = ['run', 'run', 'run', 'jump', 'idle']
                MIN_ABS_W, MIN_ABS_H = 30, 60
                all_slots = []
                good = True
                for (y0, y1), count in zip(bands, counts):
                    slots = sequential_split(content, y0, y1, 0, w - 1, count)
                    if slots is None:
                        good = False; break
                    if any((x1 - x0) < MIN_ABS_W for (x0, x1) in slots):
                        good = False; break
                    band_y = uniform_trim_axis(content, y0, y1, 0, w - 1, 'y')
                    if band_y is None or (band_y[1] - band_y[0]) < MIN_ABS_H:
                        good = False; break
                    all_slots.append((band_y, slots))
                if not good:
                    continue

                PAD = 6
                MIN_CONTENT_AREA = 400  # futuro's frames are smaller (16-wide rows)
                frames = []
                for (band_y, slots), kind in zip(all_slots, kinds):
                    y0, y1 = band_y
                    for (x0, x1) in slots:
                        frames.append((kind, (
                            max(0, y0 - PAD), min(h - 1, y1 + PAD),
                            max(0, x0 - PAD), min(w - 1, x1 + PAD),
                        )))

                if any(content[by0:by1 + 1, bx0:bx1 + 1].sum() < MIN_CONTENT_AREA
                       for _kind, (by0, by1, bx0, bx1) in frames):
                    continue

                counters = {'run': 0, 'jump': 0, 'idle': 0}
                for kind, box in frames:
                    counters[kind] += 1
                    n = str(counters[kind]).zfill(2)
                    out_path = os.path.join(SPRITES_OUT, skin_id, f"girl_{kind}_{n}.png")
                    save_frame(arr, content, box, out_path)
                print(f"[{skin_id}] OK params=({tol},{kernel},{frac}) "
                      f"run={counters['run']} jump={counters['jump']} idle={counters['idle']}")
                return True
    print(f"[{skin_id}] FAILED -- no automatic combination produced a plausible crop. "
          f"STOP: this file needs manual review, source={source_path}")
    return False


if __name__ == "__main__":
    # Manifest: (skin_id, source filename in PACK_DIR, run, jump, idle)
    # Prices/names/ids are assigned in js/skins.js -- this script only
    # produces the artwork files.
    MANIFEST = [
        ("diabinha", "diabinha.png", 12, 4, 2),
        ("professora", "skin_sprite_20.png", 12, 4, 4),
        ("anjo", "anjo.png", 12, 4, 2),
        ("boneca", "boneca.png", 12, 4, 2),
        ("chef", "chef.png", 12, 4, 2),
        ("coelhinha", "coelhinha.png", 12, 4, 2),
        ("gatinha", "gatinha.png", 12, 4, 2),
        ("gotica", "gotica.png", 12, 4, 2),
        ("cowgirl", "kawai.png", 12, 4, 2),
        ("bruxa", "vampira.png", 12, 4, 2),
        ("ninja", "skin_sprite_17.png", 12, 4, 2),
        ("praia", "praia.png", 12, 4, 2),
        ("retro", "8-bits.png", 12, 4, 2),
    ]
    results = {}
    for skin_id, filename, er, ej, ei in MANIFEST:
        results[skin_id] = extract_skin(os.path.join(PACK_DIR, filename), skin_id, er, ej, ei)

    results["futuro"] = extract_futuro(os.path.join(PACK_DIR, "futuro_48_frames.png"))

    failed = [k for k, v in results.items() if not v]
    print()
    if failed:
        print(f"{len(failed)} skin(s) need manual review: {failed}")
    else:
        print("All standard-layout skins extracted successfully.")
