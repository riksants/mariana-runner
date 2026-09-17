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

`noiva/` additionally holds a second, unrelated set — `wedding_decelerate_01..08.png`,
`wedding_walk_01..08.png`, `wedding_stop_01..06.png`, `wedding_idle_01..03.png`
— for the wedding-ending walk-to-the-altar cutscene (state `'wedding'`
in `js/game.js`, not the normal run/jump/idle gameplay cycle above).
Sliced from `assets/skins/mariana_noiva_wedding.png` by
`scripts/extract_wedding_walk_frames.py` (2026-09-14): unlike the
run+jump/idle sheets above, this one has four independent single-pose
rows with a real transparent gap around every frame already, so the
script only needed plain per-row gap detection (no flood-fill, no
label/character disambiguation, no seam carving) — see the script's
module docstring for why. Every frame in one row shares that row's own
y-crop (never a per-frame tight crop) so the ground line lands on the
same pixel row across a phase, which is what keeps `drawSpriteRB`'s
fixed-height scaling from making the feet jitter frame to frame.

Continuing straight on from that walk cycle, `noiva/` also holds the
groom-waiting + four-kisses + final-pose set: `wedding_groom_idle_01..04.png`
(solo groom, drawn separately), and four **two-character** sets —
`wedding_kiss_left_01..04.png`, `wedding_kiss_right_01..04.png`,
`wedding_kiss_forehead_01..04.png`, `wedding_kiss_lips_01..04.png` — plus
`wedding_final_01..04.png`. Each frame in those five couple sets already
has both Mariana and the groom drawn together by the artist as one
image; `js/game.js` draws them as a single sprite (see
`drawWeddingCouple()`), never repositions the two characters separately.
Sliced from `assets/skins/mariana_wedding_kiss_scene.png` by
`scripts/extract_wedding_kiss_frames.py` (2026-09-14). This sheet's
poses touch/overlap at the pixel level within a row (unlike the walk
sheet above), so plain zero-gap detection doesn't find frame
boundaries reliably — the script instead finds the deep-but-nonzero
density troughs between poses and cuts at the midpoint of each,
keeping every low-density pixel on either side (so a hand or a trailing
sleeve is never lost) rather than bounding the crop by the trough
itself. Two extra defects that showed up only on this sheet, both
fixed in `save_frame()`: a number label sitting close enough to
overlap a pose's own row range (labels are masked out of the saved
pixels directly via the same short-component mask used for detection,
not just excluded from band detection) and a sliver of a neighboring
pose bleeding across a cut point (dropped via the same
touches-the-crop's-own-edge rule `extract_skin_frames_alpha.py`'s
`save_frame_clean` already uses).

All 31 folders here already follow this exact convention, sliced from
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
- Professora had the same idle-pose-count bug as Kawaii, just missed
  by the first automated check: its sheet has 4 "parado" poses, not 2,
  and since ALL of them got fused pairwise (not just one, like Chef's
  13th run pose), both output idle frames were equally wide — a
  same-kind width comparison (each frame vs its own kind's mean) sees
  no outlier when every frame in that kind is uniformly affected.
  Re-checked all 30 skins with a cross-kind comparison instead (each
  jump/idle frame's width vs that skin's own run-frame median, since a
  real single-character run pose is a reliable width reference); this
  also flagged several skins' widest jump/idle frames (Anjo, Boneca,
  Diabinha, Fenix, Gatinha, Mini, Retro, Sakura, Coelhinha) at 1.55x+
  the run median. Every one of those was individually confirmed by eye
  to be a real, single, un-fused character — hair, wings, a dress, or a
  tail legitimately spreading wider in that one pose — not a repeat of
  this bug. Re-ran Professora with `expected_idle=4` and kept the first
  2 poses.
- `rapunzel`/Alberto's `pascal` (added 2026-09-17, from a themed pair the
  user downloaded together to `Downloads/mariana_rapunzel_e_alberto_e_pascal/`):
  same numbered-label contact-sheet convention as every sheet above,
  alpha=0 background, extracted with the existing alpha pipeline
  (`scripts/extract_rapunzel_pascal_2026-09-17.py`, reusing
  `full_extract_alpha`/`save_frame_clean` unchanged) — no new extraction
  technique needed. Both sheets segmented cleanly on the first attempt
  (12/4/2 frame counts matched exactly) and passed a full-strip visual
  review with no label bleed, fused limbs, or neighbor-frame overlap.
  `rapunzel`'s source sheet is kept at `assets/skins/mariana_rapunzel.png`
  like every other Mariana skin; `pascal`'s source sheet is not
  committed to the repo, matching every other Alberto skin (only
  Mariana's source sheets are kept under `assets/skins/`).
