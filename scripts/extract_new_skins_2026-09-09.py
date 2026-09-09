# -*- coding: utf-8 -*-
"""
MARIANA RUNNER -- extraction script for the 2026-09-09 skin drop: 23
labeled contact sheets downloaded by the user to
C:\\Users\\rikli\\Downloads\\(sem assunto)\\, all in the same
12-run/4-jump/2-idle numbered-label format as the existing skins.

Reuses the generic pipeline from extract_skin_frames.py unchanged --
these sheets extract cleanly with the same algorithm because the label
text rows are thin enough to fall under the row-density thresholds the
auto grid-search already tries (background_mask + row-band gap
detection treats sparse text the same way it treats any other
low-density row).

5 of these 23 REPLACE an existing skin's art in place (same id, same
price/name in js/skins.js -- only assets/sprites/skins/<id>/ changes):
retro (was "8-bits.png"), cowgirl (was "kawai.png"), boneca, bruxa,
gatinha. The other 18 are brand-new ids, added as new SKIN_DEFS entries
separately in js/skins.js.

Run: python scripts/extract_new_skins_2026-09-09.py
"""
import os
import sys
import unicodedata

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_skin_frames import extract_skin

PACK_DIR = r"C:\Users\rikli\Downloads\(sem assunto)"


def resolve_filename(name):
    """The downloaded filenames use NFD (decomposed) accents on disk --
    e.g. 'A' + combining U+0301 rather than the precomposed 'Á' this
    file's own source uses -- so a byte-for-byte match against the
    manifest strings below fails even though they render identically.
    Compare NFC-normalized forms instead of guessing the raw bytes."""
    target = unicodedata.normalize('NFC', name)
    for f in os.listdir(PACK_DIR):
        if unicodedata.normalize('NFC', f) == target:
            return f
    raise FileNotFoundError(f"no file matching {name!r} in {PACK_DIR}")

# (skin_id, filename in PACK_DIR, run, jump, idle)
MANIFEST = [
    ("retro",       "Mariana 8-Bits.PNG",      12, 4, 2),
    ("boneca",      "Mariana Boneca.PNG",      12, 4, 2),
    ("bruxa",       "Mariana Bruxa.PNG",       12, 4, 2),
    ("gatinha",     "Mariana Gatinha.PNG",     12, 4, 2),
    ("cowgirl",     "Mariana Vaqueira.PNG",    12, 4, 2),
    ("anjo",        "Mariana Anjo.PNG",        12, 4, 2),
    ("arabe",       "Mariana Árabe .PNG",      12, 4, 2),
    ("chef",        "Mariana Chef.PNG",        12, 4, 2),
    ("coelhinha",   "Mariana Coelhinha .PNG",  12, 4, 2),
    ("cupido",      "Mariana Cupido.PNG",      12, 4, 2),
    ("diabinha",    "Mariana Diabinha.PNG",    12, 4, 2),
    ("fada",        "Mariana Fada.PNG",        12, 4, 2),
    ("fenix",       "Mariana Fênix .PNG",      12, 4, 2),
    ("gotica",      "Mariana Gótica .PNG",     12, 4, 2),
    ("heroina",     "Mariana Heroína .PNG",    12, 4, 2),
    ("kawaii",      "Mariana Kawaii.PNG",      12, 4, 2),
    ("mini",        "Mariana Mini.PNG",        12, 4, 2),
    ("ninja",       "Mariana Ninja.PNG",       12, 4, 2),
    ("pirata",      "Mariana Pirata.PNG",      12, 4, 2),
    ("praia",       "Mariana Praia.PNG",       12, 4, 2),
    ("professora",  "Mariana Professora .PNG", 12, 4, 2),
    ("sakura",      "Mariana Sakura.PNG",      12, 4, 2),
    ("vampira",     "Mariana Vampira.PNG",     12, 4, 2),
]

if __name__ == "__main__":
    # Run one skin per process invocation (pass its id as argv[1]) so a
    # heavy grid-search on one large sheet can't accumulate memory across
    # all 23 files in a single long-lived process -- this environment hit
    # an OOM kill running the whole manifest in one go.
    only = sys.argv[1] if len(sys.argv) > 1 else None
    manifest = [m for m in MANIFEST if only is None or m[0] == only]
    results = {}
    for skin_id, filename, er, ej, ei in manifest:
        actual = resolve_filename(filename)
        results[skin_id] = extract_skin(os.path.join(PACK_DIR, actual), skin_id, er, ej, ei)
    failed = [k for k, v in results.items() if not v]
    print()
    if failed:
        print(f"{len(failed)} skin(s) need manual review: {failed}")
    else:
        print(f"{len(manifest)} skin(s) extracted successfully.")
