---
name: imagecompare-artifact
description: Publish a side-by-side image comparison as a shareable web page — a Claude artifact or any static host — using the released ImageCompare standalone page unmodified plus an `imagecompare.json` listing. Use when the user wants to show, share or embed a comparison of image sets (model outputs, variants, before/after) outside VS Code. No viewer code is written.
---

# imagecompare-artifact — publish a comparison as a web page

The released `image_compare.html` opens a comparison by itself when an `imagecompare.json` sits next
to it. You never edit the page and never write a viewer: lay the images out, generate the listing
with one command, upload the folder.

## 1. Lay out the images

ImageCompare's own folder layout — one directory per column, the same image name in every column:

```
comparison/
  01_input/scene_001.webp
  01_input/scene_002.webp
  02_ground_truth/scene_001.webp
  02_ground_truth/scene_002.webp
  03_model_a/scene_001.webp
  03_model_a/scene_002.webp
```

- A directory is a column and its name is the column's label. Columns and rows are sorted by name
  in natural order, so number-prefix the directories to fix the column order.
- A row is the files that share a name across columns (names that share a stem also pair:
  `scene_001_gt.png` with `scene_001_pred.png`).
- Browser formats only: `.webp` (preferred, smallest), `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`.
  Columns may differ in resolution.
- Only what is inside the folder is published: copy or render into it, never link to files elsewhere.

## 2. Write `imagecompare.json`

Run inside the folder:

```bash
python3 -c "import json,pathlib; print(json.dumps({'files': sorted(p.as_posix() for p in pathlib.Path('.').glob('*/*') if p.is_file())}))" > imagecompare.json
```

The file is only a listing — `{"files": ["01_input/scene_001.webp", ...]}`, paths relative to the
page. What the files mean (columns, rows, names, order) is decided exactly as for the same folder
opened locally. Paths are written exactly as `<column>/<image>`: anything else (`./`, `..`, `/abs`, a
URL, a backslash) is refused and reported on the page.

## 3. Put the page next to it

```bash
curl -sSL -o image_compare.html https://raw.githubusercontent.com/toshas/ImageCompare_standalone/main/image_compare.html
```

Use it byte-for-byte: do not edit, re-wrap, inline or rename it.

## 4. Publish

**As a Claude artifact.** Publish `image_compare.html` as the page, with the folder as the publish
root and `imagecompare.json` plus every image as the page's supporting files, at the same relative
paths the listing uses. One publish takes at most 255 files and 64 MB: send the page, the manifest
and a first batch of images, then publish the remaining images to the same artifact URL in further
batches — files already published are kept. A whole artifact holds at most 511 files and 256 MB, and
one image at most 15 MB; beyond that, re-encode smaller (WebP) or use a static host. If your
publishing tool asks you to review files you did not write before publishing them, the page is the
released build (about 300 KB of minified script). Give the user the link.

**Anywhere else.** Upload the folder as it is to any static host (GitHub Pages, a bucket, an intranet
share) and link to `image_compare.html`; locally, `python3 -m http.server` in the folder and open
`http://localhost:8000/image_compare.html`. Opening the file straight from disk (`file://`) shows the
folder picker instead, because browsers block reading neighbouring files there.

## What the viewer gets

The full ImageCompare viewer: zoom and pan kept across columns, `←`/`→` columns, `↑`/`↓` rows, hold
`Space` to flip back, `1`–`9` to jump, a film strip of every row. A published comparison is
read-only: voting, crop and delete are off, since nothing beside the page can be written.

If the page shows the folder picker with an `imagecompare.json: ...` message, the listing is
malformed or names a path outside the folder; regenerate it with step 2. If it shows the picker
with no message, no listing was found next to the page. A single image that fails to load shows
"Image not available" in its own slot: check that it was uploaded at the path the listing names.

For the VS Code extension, the same folder layout opens through a session file — see the
`imagecompare` skill.
