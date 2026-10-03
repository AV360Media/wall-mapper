// Inlines every <!--#include path--> in src/index.html to produce one self-contained HTML file.
// The scripts are classic (non-module) scripts sharing one global scope, so files are
// concatenated in the order index.html lists them. Usage: node build.mjs [--watch]
import { readFileSync, writeFileSync, mkdirSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const out = join(root, 'dist', 'wall-mapper.html');

function build() {
  const html = readFileSync(join(src, 'index.html'), 'utf8')
    .replace(/<!--#include (\S+)-->\n/g, (_, p) => readFileSync(join(src, p), 'utf8'));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`built ${out} (${(html.length / 1024).toFixed(0)} KB)`);
}

build();
if (process.argv.includes('--watch')) {
  let t;
  watch(src, { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 100); });
  console.log('watching src/ …');
}
