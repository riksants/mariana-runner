# -*- coding: utf-8 -*-
"""
MARIANA RUNNER -- Alberto (the cat) skin-sheet extractor.

Reuses the exact alpha-channel pipeline already validated on the
2026-09-09 Mariana skin drop (extract_skin_frames_alpha.py) -- same sheet
shape: a title/number-labelled "CORRIDA (12 FRAMES)" row plus a
"PULO (4 FRAMES)" / "PARADO (2 FRAMES)" row below, alpha=0 background.
Only the source folder and output filename prefix differ (cat_* instead
of girl_*, into assets/sprites/skins/alberto/<id>/ instead of
assets/sprites/skins/<id>/, so Alberto's skin ids never collide with a
Mariana skin folder of the same name, e.g. both having a "pirata").

Run: python scripts/extract_alberto_frames.py [--test]
--test only runs the Pirata sheet and leaves the rest alone, for a first
visual check before committing to the full batch.
"""
import glob
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_skin_frames_alpha import full_extract_alpha, save_frame_clean

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = r"C:\Users\rikli\Downloads\Alberto_Skins"
SPRITES_OUT = os.path.join(REPO_ROOT, "assets", "sprites", "skins", "alberto")

# Matched by glob prefix rather than a literal accented filename -- "í" in
# "Príncipe" round-trips unreliably between this file's source encoding and
# the Windows filesystem's own listing, so the exact byte sequence typed
# here doesn't always match what's actually on disk.
MANIFEST = [
    ("anjo", "Alberto Anjo*"),
    ("cowboy", "Alberto Cowboy*"),
    ("diabinho", "Alberto Diabinho*"),
    ("ninja", "Alberto Ninja*"),
    ("pijama", "Alberto Pijama*"),
    ("pirata", "Alberto Pirata*"),
    ("principe", "Alberto Pr*ncipe*"),
    ("vampiro", "Alberto Vampiro*"),
]


def resolve(pattern):
    matches = glob.glob(os.path.join(SOURCE_DIR, pattern))
    if len(matches) != 1:
        raise SystemExit(f"Expected exactly 1 match for {pattern!r}, found {matches}")
    return matches[0]


def extract_alberto(source_path, skin_id, expected_run=12, expected_jump=4, expected_idle=2):
    result = full_extract_alpha(source_path, expected_run, expected_jump, expected_idle)
    if result is None:
        print(f"[{skin_id}] FAILED -- alpha pipeline could not segment this sheet. "
              f"STOP: needs manual review, source={source_path}")
        return False
    frames, content, clean = result
    img = Image.open(source_path).convert('RGBA')
    arr = __import__('numpy').array(img)
    counters = {'run': 0, 'jump': 0, 'idle': 0}
    for kind, bbox in frames:
        counters[kind] += 1
        n = str(counters[kind]).zfill(2)
        out_path = os.path.join(SPRITES_OUT, skin_id, f"cat_{kind}_{n}.png")
        save_frame_clean(arr, content, clean, bbox, out_path)
    print(f"[{skin_id}] OK run={counters['run']} jump={counters['jump']} idle={counters['idle']}")
    return True


if __name__ == "__main__":
    test_only = '--test' in sys.argv
    manifest = MANIFEST[:1] if test_only else MANIFEST
    results = {}
    for skin_id, pattern in manifest:
        results[skin_id] = extract_alberto(resolve(pattern), skin_id)

    failed = [k for k, v in results.items() if not v]
    print()
    if failed:
        print(f"{len(failed)} skin(s) need manual review: {failed}")
    else:
        print("All Alberto skins extracted successfully.")
