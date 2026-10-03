# Wall Mapper

An LED video wall planner for live events. Lay out screens built from LED cabinets, map power
circuits and data chains across the tiles, assign processors, and export the crew paperwork:
a PDF drawing set, PNGs, an Excel pull list with cable and circuit schedules, cable labels
(printed straight to a Brother PT-P710BT over WebUSB), a pixel map with still and MP4 test
patterns, and a Resolume Arena output preset. Projects can sync to a Supabase project you own.

## Build

Requires Node 18+. No dependencies.

```sh
npm run build   # writes dist/wall-mapper.html
npm run dev     # rebuilds on every change under src/
```

The output is one self-contained HTML file: open it in a browser, or paste it into a
claude.ai artifact.

## Publishing

Every push to `main` builds the app and publishes it to GitHub Pages at
https://bryanchorton.github.io/wall-mapper/ (workflow: `.github/workflows/pages.yml`).
One-time setup: Settings → Pages → Source: **GitHub Actions**.

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
