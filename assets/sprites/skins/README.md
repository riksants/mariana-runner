# Skin artwork drop-in folder

To give a skin real illustrated art, add a folder here named exactly
after the skin id (see the full, current list in `SKIN_DEFS` in
`js/skins.js`) containing:

- `girl_run_01.png` … `girl_run_12.png` (12 frames)
- `girl_jump_01.png` … `girl_jump_04.png` (4 frames)
- `girl_idle_01.png` … `girl_idle_02.png` (2 frames)

Same pixel style, proportions, and anchor point as the existing
`assets/sprites/girl_*.png` set (bottom-right anchored — see
`drawSpriteRB` in `js/sprites.js`). No code changes are needed: once
every file for a skin's folder exists, the game automatically uses it
in the wardrobe preview and during gameplay instead of falling back to
normal Mariana.

All 30 folders here already follow this exact convention, sliced from
the user-supplied reference sheets in `assets/skins/mariana_*.png`
(kept there as the source) — if another skin needs slicing from a
similar sheet, redo the equivalent steps rather than looking for a
build tool here:

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
- `retro`/`cowgirl` (added 2026-09-08, from the `mariana_skins_pack`
  drop): sliced with `scripts/extract_skin_frames.py` (kept in the
  repo this time — see its module docstring for the full algorithm).
  Both of these two skins' frame sets were individually eyeballed
  frame-by-frame and confirmed complete; the pack also contained a
  Futuro skin (48 run/18 jump/3 idle frames) and 11 other skins
  (diabinha, professora, anjo, boneca, chef, coelhinha, gatinha,
  gotica, gótica's witch-reskin as "bruxa", ninja, praia) that the
  extractor could not crop with full confidence — several sheets pack
  poses too tightly (hair/limbs touching between adjacent frames) for
  even a human-in-the-loop pass to always land a clean per-frame
  boundary within reasonable effort. Those are NOT integrated into
  `js/skins.js` and their source sheets aren't in `assets/skins/` —
  revisit with the pack (kept outside the repo, under
  `mariana_skins_completas/mariana_skins_pack/skins_geradas/`) if
  they're wanted later.
- 23-skin drop (added 2026-09-09, from a fresh AI-regenerated batch the
  user downloaded to their Downloads folder — a re-supply of the same
  numbered-label contact-sheet convention, this time with every sheet
  cleanly labeled): 5 of these replace an existing skin's art in place
  (`retro`, `cowgirl`, `boneca`, `bruxa`, `gatinha` — same id/price,
  only the art changed); the other 18 are new. `scripts/extract_skin_frames.py`'s
  RGB-flood-fill pipeline only passed its own plausibility checks for 8
  of the 23 on the first attempt — and, per the correction pass below,
  5 of those 8 turned out to have real defects the plausibility checks
  don't catch. The other 15 needed a second pipeline
  (`scripts/extract_skin_frames_alpha.py`)
  built for this batch, since every sheet in it is confirmed alpha=0 on
  background / alpha>0 on real content (no flood-fill heuristic
  needed — threshold the alpha channel directly). That pipeline also
  fixes two failure modes the first one doesn't have to deal with: a
  title/number label sitting so close to the character art (sometimes
  a single background row) that no row-gap threshold could separate
  them — solved by dropping every connected component shorter than
  45px before band/column detection ever runs, since a label glyph
  never comes close to that height and a real character silhouette
  always does; and a neighboring frame's hair/head bleeding into a
  crop when two adjacent poses genuinely overlap in x (confirmed on
  Gatinha's run cycle) — solved by dropping any kept secondary
  component that touches the crop's own left/right edge. Every one of
  the 23 was reviewed as a composited strip before being treated as
  done — not enough, it turned out; see the correction pass below.
- Correction pass (2026-09-09, same day): 6 of the 23 — retro,
  vampira, professora, sakura, pirata, ninja — had real defects a
  composited strip at thumbnail scale doesn't show: label text baked
  into the crop, a boot rendered as a disconnected floating blob, and
  plain neighbor-frame bleed. 5 of those 6 (all but Kawaii) had passed
  the older RGB-flood-fill pipeline's plausibility checks on the very
  first attempt — before the alpha pipeline above even existed — and
  so were never reprocessed with it; re-running all 6 through the
  alpha pipeline fixed them the same way it fixed the batch above.
  Kawaii's bug was different: its sheet uses 4 "parado" poses instead
  of every other sheet's 2, and the extractor's hardcoded
  `expected_idle=2` had split that 4-pose group into 2 slots of two
  fused poses each. Re-ran it with `expected_idle=4`, kept the first 2
  clean individual poses as `girl_idle_01/02.png` (the fixed 2-frame
  idle convention every skin and the game code assumes) and discarded
  the other 2. Chef had the same class of bug in its run cycle instead
  of its idle cycle: its sheet has 13 running poses, not the usual 12,
  and `expected_run=12` fused the last two into one double-wide frame
  (caught this time by an automated check — each frame's width and
  alpha pixel count compared against its own skin's mean, flagging
  anything under 25% or over 160% of it, run across all 30 skins
  instead of relying on eyeballing). Re-ran with `expected_run=13` and
  kept the first 12. Every one of the 30 skins now passes that
  automated check with zero flags, on top of a frame-by-frame visual
  pass. Lesson for next time: run the automated width/content check on
  a new batch from the start, and don't assume a sheet's frame counts
  match the pack's usual 12/4/2 — check each new sheet's own label
  text ("(N FRAMES)") or count content blobs programmatically.
