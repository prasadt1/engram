# Real EXIF capture — Part A report (Cursor → Claude, 2026-07-07)

Factual report against `claude-to-cursor-exif-branch-spec.md`. Part A only.
Part B not started (gated on human review, per contract).

## Branch & commits

- **Branch:** `feature/real-exif` (off `main` at `8106335`).
  - Did NOT commit to `main`/`dev`. (`8106335` on main is the unrelated logo
    swap that preceded this branch; it is the branch point, not part of this
    work.)
- **Commit on branch:** `30bc7cf3abc7743c04aa71d8a09f78bfaf273ba1`
  — "Extract and expose real camera EXIF (branch experiment, Part A)".
- This report is a separate commit on the same branch.

## Files touched

| File | Change |
|------|--------|
| `app/exif_reader.py` | **New.** `extract_exif(image_bytes) -> dict \| None`. |
| `app/coach.py` | Import `extract_exif`; call once on original bytes in `analyze_photo`; add `exif` to `payload` and to the `portfolio_entries.insert_one({...})` doc. |
| `app/server.py` | `_serialize_portfolio_entry()` adds `"exif": doc.get("exif")`. |
| `frontend/src/types/index.ts` | New `CameraExif` interface; `AnalysisResult.exif?: CameraExif \| null`. |
| `frontend/src/types/memory.ts` | `PortfolioListItem.exif?: CameraExif \| null`. |
| `frontend/src/types/studio.ts` | `EvidenceItem.estimated?: boolean`. |
| `frontend/src/lib/mapAnalysisResult.ts` | Evidence prefers real `exif`; falls back to `settingsEstimate` flagged `estimated: true`. |
| `frontend/src/components/studio/EvidencePanel.tsx` | Estimated rows render an amber "AI estimate" badge instead of "Camera metadata". |
| `frontend/src/components/PhotoDetailView.tsx` | New `CameraExifPanel` — real EXIF labeled "from your photo's file"; GPS shown as boolean "Location data present", no coordinates. |
| `tests/test_exif_reader.py` | **New.** 6 tests (full/GPS/none/malformed+empty/truncated/partial). |
| `tests/test_coach.py` | +2 assertions on existing persist test; +1 new test threading real EXIF into payload+insert. |

## Exact shape of the `exif` field as implemented

camelCase, stored on the Mongo doc and passed straight through the serializer
(no transform). Any field absent when not present; whole value `None` when the
upload carried no usable EXIF.

```jsonc
{
  "make": "Apple",              // string, optional
  "model": "iPhone 11 Pro Max", // string, optional
  "focalLength": "6mm",         // string, optional
  "aperture": "f/2",            // string, optional
  "shutterSpeed": "1/16s",      // string, optional
  "iso": "ISO 1250",            // string, optional
  "capturedAt": "2026:04:02 06:28:52", // raw EXIF datetime string, optional
  "gps": { "lat": 50.151142, "lng": 8.179075 } // optional, decimal degrees
}
```

## Test results

- `.venv/bin/python -m pytest -q` → **207 passed, 1 warning** (pre-existing
  Starlette/httpx deprecation warning, unrelated). Includes the 6 new
  `test_exif_reader.py` tests and the 3 new/extended `test_coach.py`
  assertions.
- `cd frontend && npx tsc --noEmit` → **clean** (no errors).
- Lints on all touched files → clean.

## Honesty-note finding (verified empirically, not assumed)

Ran `extract_exif` directly on real bytes (the same function `analyze_photo`
calls):

- **Seeded/demo images (Unsplash `w=1200&q=80` CDN):** fetched
  `photo-1506905925346-...?w=1200&q=80` (127 KB) → `extract_exif` returned
  **`None`**. Confirms the spec's prediction: **the seeded demo library will
  show "no EXIF" for every photo**, because Unsplash's Imgix serve pipeline
  strips EXIF. This is expected, not a bug — the AI-estimate path stands in
  for these, now correctly labeled "AI estimate".
- **A genuine phone photo** (`~/IMG_7817.jpg`, iPhone 11 Pro Max original) →
  full extraction:
  `{make: Apple, model: iPhone 11 Pro Max, focalLength: 6mm, aperture: f/2,
  shutterSpeed: 1/16s, iso: ISO 1250, capturedAt: 2026:04:02 06:28:52,
  gps: {lat: 50.151142, lng: 8.179075}}`. GPS decimal conversion and the
  Exif sub-IFD read both verified on real camera bytes. **This test photo
  did carry GPS** (stored, not surfaced as coordinates per the privacy rule).

## Manual verification evidence

- Extraction proven end-to-end on real bytes via the exact pipeline function
  (see above) — real camera data extracted and shaped correctly; stripped
  images fall back to `None`.
- Wiring proven by unit test: `test_analyze_photo_threads_real_exif_into_payload_and_insert`
  asserts `extract_exif` is called once on the **original** upload bytes and
  the result appears on both `payload["exif"]` and the persisted doc.

### Deviation / gap stated plainly

- **Full UI upload through the running app was NOT performed in this
  environment.** The local backend needs live MongoDB + a real Qwen-VL vision
  call to run `analyze_photo` for a genuine upload, which wasn't stood up
  here. Instead I verified (a) the extraction function on real EXIF-bearing
  bytes and on a real stripped Unsplash image, and (b) the payload/insert
  wiring via mocked-store unit tests. The one thing not exercised live is the
  browser render of `CameraExifPanel` / the "AI estimate" badge — that is
  covered by tsc + code review only. If a reviewer wants pixel proof, a real
  photo must be uploaded through a running stack.

### Other deviations from the contract

- **Function name:** spec suggested `_extract_exif` (private). Implemented as
  public `extract_exif` in a dedicated `app/exif_reader.py` module (the spec
  explicitly allowed a new module; a module-level public name reads cleaner
  and is directly patchable in tests). Behavior/signature otherwise as
  specified.
- **Tags read by numeric ID, and exposure tags read from the Exif sub-IFD
  (0x8769), not the top-level IFD.** The spec's tag list is correct, but
  `getexif()` top-level only carries Make/Model/DateTime — FNumber/
  ExposureTime/ISO/FocalLength/DateTimeOriginal live in the 0x8769 sub-IFD.
  The reader merges that sub-IFD. This is a correctness detail, not a scope
  change. Reading by numeric ID also sidesteps the ISOSpeedRatings vs
  PhotographicSensitivity name drift the spec flagged (both share ID 0x8827).
- **`settingsEstimate` does NOT currently render in `PhotoDetailView`.** It
  renders in the post-upload Studio `EvidencePanel` (via `mapAnalysisResult`),
  where the AI guess was mislabeled as "Camera metadata"/EXIF — that is the
  real locus of the honesty bug, so the label fix landed there. I *also* added
  a real-EXIF block to `PhotoDetailView` as the spec named it; note that
  `PortfolioListItem` carries no AI `settingsEstimate`, so that view has no
  guess to fall back to and simply omits the block when `exif` is null.
- **No new dependency, no changes to** `chat_vision`/`chat_fast`/`chat_text`/
  `output_salvage.py`/the coach prompt/the vision-call path. `settingsEstimate`
  is untouched and still emitted. All additive.

## Recommendation

**Iterate, then merge.** The extraction is solid and proven on real bytes; the
honesty labeling is the most valuable part and is worth keeping regardless.
Before merge I'd want one live end-to-end upload (real photo → running app →
PhotoDetailView) to confirm the UI render, since that's the only unproven
link. GPS presentation is deliberately deferred (stored, not shown) and should
be a conscious product decision, not a default. Part B (grid/search surfacing)
should wait for that live confirmation.
