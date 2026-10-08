# Wall Mapper

An LED video wall planner for live events. Lay out screens built from LED cabinets, map power
circuits and data chains across the tiles, assign processors, and export the crew paperwork:
a PDF drawing set, PNGs, an Excel pull list with cable and circuit schedules, cable labels
(printed straight to a Brother PT-P710BT over WebUSB), a pixel map with still and MP4 test
patterns, and a Resolume Arena output preset. Projects can sync to a Supabase project you own.

## Build

Requires Node 18+. No dependencies.

```sh
npm run build     # rebuilds index.test.html from src/
npm run dev       # rebuilds on every change under src/
npm run promote   # copies index.test.html over index.html (production)
```

Both files are self-contained: open either in a browser, or paste it into a claude.ai artifact.

## Test and production

Two copies of the app live on `main`:

| File | Site | Changes when |
|---|---|---|
| `index.test.html` | https://av360media.github.io/wall-mapper/index.test.html | every change to `src/` (rebuilt and committed with it) |
| `index.html` | https://av360media.github.io/wall-mapper/ | only when the test build is promoted |

Every edit is committed straight to `main` and lands in `index.test.html` first. After testing it, promoting copies it over
`index.html` in one commit on `main`; asking Claude to **"Promote to production"** does that.
GitHub Pages republishes both files whenever either changes (`.github/workflows/pages.yml`),
so production only moves on a promotion. The test page shows a red TEST BUILD tag and keeps its
projects separate from production's; use Export / Import to carry a project across.

`.github/workflows/check.yml` fails any push or pull request whose `index.test.html` is not the
current build of `src/`.

## Layout

```
src/index.html        markup, with <!--#include path--> markers the build inlines
src/styles/           fonts (base64 woff2), main and studio stylesheets
src/vendor/           mp4-muxer 5.2.2 (MIT)
src/js/               the app, as classic scripts sharing one global scope
  data/               LED panel and processor libraries (v:0 = estimated spec)
  draw/ canvas/       drawing set, viewport, interaction
  export/ labels/     PDF/PNG, xlsx, MP4 patterns, cable labels and USB printing
  pixelmap/           pixel map packing, test patterns, Resolume preset
  cloud/ projects/    Supabase sync, project library, batch screen creation
```

The JS files are concatenated in the order `src/index.html` lists them, so a new file needs an
include line there. Handlers are wired with inline `onclick=`, so functions stay global.

## Saving

Inside a claude.ai artifact projects are kept with `window.storage`. Anywhere else they go
to IndexedDB (or localStorage if that is blocked) in the browser that opened the file.
