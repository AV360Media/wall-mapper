# Wall Mapper

- Single-page app built into one HTML file by `node build.mjs` (no deps). Source in `src/`.
- JS files are classic scripts concatenated in `src/index.html` include order; everything is global
  and wired from inline `onclick=` handlers. Don't convert files to ES modules piecemeal.
- Match the existing terse style: short names, `/* ... */` section comments, two-space indent.
- After a change, run `npm run build` and load `dist/wall-mapper.html` in Chromium (Playwright)
  to check for page errors.
