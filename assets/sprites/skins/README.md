# Skin artwork drop-in folder

To give a skin real illustrated art, add a folder here named exactly
after the skin id (see `SKIN_DEFS` in `js/skins.js`: `princesa`, `volei`,
`pijama`, `gold`, `noiva`) containing:

- `girl_run_01.png` … `girl_run_12.png` (12 frames)
- `girl_jump_01.png` … `girl_jump_04.png` (4 frames)
- `girl_idle_01.png` … `girl_idle_02.png` (2 frames)

Same pixel style, proportions, and anchor point as the existing
`assets/sprites/girl_*.png` set (bottom-right anchored — see
`drawSpriteRB` in `js/sprites.js`). No code changes are needed: once
every file for a skin's folder exists, the game automatically uses it
in the wardrobe preview and during gameplay instead of falling back to
normal Mariana.

All 5 folders here (`princesa`, `volei`, `pijama`, `gold`, `noiva`)
already follow this exact convention — added 2026-09-05 by slicing the
user-supplied reference sheets in `assets/skins/mariana_*.png` (kept
there as the source) with a one-off extraction script (grid-detects
each labeled frame, removes the background via flood-fill from the
sheet's own edges so it survives near-white costumes like Noiva's
dress, keeps only the largest connected shape per frame to drop stray
label text). That script wasn't kept in the repo — if a 6th skin needs
slicing from a similar sheet, redo the same steps rather than looking
for a build tool here.
