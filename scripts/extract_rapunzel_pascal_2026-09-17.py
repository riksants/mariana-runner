# -*- coding: utf-8 -*-
"""
MARIANA RUNNER -- extraction script for the 2026-09-17 combo drop: Mariana
Rapunzel + Alberto Pascal, downloaded by the user to
C:\\Users\\rikli\\Downloads\\mariana_rapunzel_e_alberto_e_pascal\\. Both
sheets are the same numbered-label contact-sheet convention (12-run/4-jump/
2-idle rows, alpha=0 background) as every other skin drop, so this reuses
the alpha pipeline unchanged -- see extract_skin_frames_alpha.py and
extract_alberto_frames.py for the algorithm itself.

Run: python scripts/extract_rapunzel_pascal_2026-09-17.py
"""
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_skin_frames_alpha import full_extract_alpha, save_frame_clean, extract_skin_alpha
from PIL import Image
import numpy as np

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = r"C:\Users\rikli\Downloads\mariana_rapunzel_e_alberto_e_pascal"
ALBERTO_SPRITES_OUT = os.path.join(REPO_ROOT, "assets", "sprites", "skins", "alberto")

RAPUNZEL_SRC = os.path.join(SOURCE_DIR, "Mariana Rapunzel .PNG")
PASCAL_SRC = os.path.join(SOURCE_DIR, "Alberto Pascal.PNG")


def extract_alberto_pascal(source_path, skin_id, expected_run=12, expected_jump=4, expected_idle=2):
    result = full_extract_alpha(source_path, expected_run, expected_jump, expected_idle)
    if result is None:
        print(f"[{skin_id}] FAILED -- alpha pipeline could not segment this sheet. source={source_path}")
        return False
    frames, content, clean = result
    img = Image.open(source_path).convert('RGBA')
    arr = np.array(img)
    counters = {'run': 0, 'jump': 0, 'idle': 0}
    for kind, bbox in frames:
        counters[kind] += 1
        n = str(counters[kind]).zfill(2)
        out_path = os.path.join(ALBERTO_SPRITES_OUT, skin_id, f"cat_{kind}_{n}.png")
        save_frame_clean(arr, content, clean, bbox, out_path)
    print(f"[{skin_id}] OK run={counters['run']} jump={counters['jump']} idle={counters['idle']}")
    return True


if __name__ == "__main__":
    results = {}
    results['rapunzel'] = extract_skin_alpha(RAPUNZEL_SRC, 'rapunzel')
    results['pascal'] = extract_alberto_pascal(PASCAL_SRC, 'pascal')

    failed = [k for k, v in results.items() if not v]
    print()
    if failed:
        print(f"{len(failed)} skin(s) need manual review: {failed}")
    else:
        print("Both skins extracted successfully.")
