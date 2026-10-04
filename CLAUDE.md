# Wall Mapper

- Single-page app built into one HTML file by `node build.mjs` (no deps). Source in `src/`.
- `index.test.html` is the test build and `index.html` is production; both are committed on `main`.
  Every change to `src/` must run `npm run build` and commit the new `index.test.html` with it
  (CI fails otherwise). Never edit or rebuild `index.html` as part of a change.
- **"Promote to production"** (Bryan's phrase): on an up-to-date `main`, check `index.test.html`
  loads in Chromium with no page errors, run `npm run promote`, and commit only `index.html`
  straight to `main` ("Promote test build to production"), then push. Pages republishes it.
- JS files are classic scripts concatenated in `src/index.html` include order; everything is global
  and wired from inline `onclick=` handlers. Don't convert files to ES modules piecemeal.
- Match the existing terse style: short names, `/* ... */` section comments, two-space indent.
- After a change, run `npm run build` and load `index.test.html` in Chromium (Playwright)
  to check for page errors.
