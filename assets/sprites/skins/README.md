# Skin artwork drop-in folder

To give a skin real illustrated art, add a folder here named exactly
after the skin id (see `SKIN_DEFS` in `js/skins.js`: `princesa`, `volei`,
`pijama`, `macaca`, `gold`, `noiva`) containing:

- `girl_run_01.png` … `girl_run_12.png` (12 frames)
- `girl_jump_01.png` … `girl_jump_04.png` (4 frames)
- `girl_idle_01.png` … `girl_idle_02.png` (2 frames)

Same pixel style, proportions, and anchor point as the existing
`assets/sprites/girl_*.png` set (bottom-right anchored — see
`drawSpriteRB` in `js/sprites.js`). No code changes are needed: once
every file for a skin's folder exists, the game automatically uses it
in the wardrobe preview and during gameplay instead of falling back to
normal Mariana.

All 6 folders here (`princesa`, `volei`, `pijama`, `macaca`, `gold`,
`noiva`) already follow this exact convention, sliced from the
user-supplied reference sheets in `assets/skins/mariana_*.png` (kept
there as the source) with one-off extraction scripts that weren't kept
in the repo — if another skin needs slicing from a similar sheet, redo
the equivalent steps rather than looking for a build tool here:

- `princesa`/`volei`/`pijama`/`gold`/`noiva` (added 2026-09-05): each
  sheet has a small number-label band above the run row and above the
  jump+idle row. The extractor finds those labels, then — for each
  frame — labels connected components across the whole row at once and
  assigns each one to whichever label it sits closest to, so a frame's
  crop is exactly the union of its own components (handles a leg that
  renders as its own disconnected blob under a flowing skirt, and never
  bleeds in a neighboring frame's limb).
- `macaca` (added 2026-09-05): this sheet has no number labels at all,
  and the 12 run-cycle frames have zero background gap between them at
  leg height (the forward foot of each stride touches the next frame).
  Only the heads separate cleanly. The extractor used the head gaps as
  anchors, then found a per-row cut (seam carving: minimize total
  foreground pixels crossed, one step of at most 1px left/right per
  row) between each pair of heads instead of a single straight vertical
  line — the cut threads through whatever background exists at each
  row and, where forced through content, picks the thinnest available
  crossing, which is what keeps it off feet/legs. Jump and idle frames
  on this sheet do have real gaps and used the same label-free
  column-detection as a normal grid.
