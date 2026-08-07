/**
 * Regenerates `src/lib/editor/styles/_katex.scss` from the installed `katex` package.
 *
 * The upstream sheet (`katex/dist/katex.min.css`) points at its fonts with `url(fonts/…)`,
 * a path that is only correct relative to `node_modules/katex/dist`. Sass inlines the sheet
 * verbatim into `document-editor.component.scss`, after which the bundler resolves those URLs
 * against the *component* directory and every `@font-face` fails to resolve.
 *
 * This script rewrites each font URL to the package specifier `katex/dist/fonts/…`, which the
 * bundler resolves through node_modules and inlines into the editor lazy chunk — keeping the
 * "zero runtime network fetches" guarantee of spec 05 §3.8.
 *
 * It also drops the `woff` / `truetype` fallbacks: every browser Gauzy supports (and the
 * Electron/Chromium desktop shell) reads `woff2`, and the duplicates cost ~800 KB of base64.
 *
 * Usage:  node packages/plugins/docs-ui/tools/generate-katex-css.js
 */
const fs = require('fs');
const path = require('path');

const OUT_FILE = path.join(__dirname, '..', 'src', 'lib', 'editor', 'styles', '_katex.scss');

const cssPath = require.resolve('katex/dist/katex.min.css');
const version = require('katex/package.json').version;
const source = fs.readFileSync(cssPath, 'utf8');

// `src:url(fonts/X.woff2) format("woff2"),url(fonts/X.woff) format("woff"),url(fonts/X.ttf) format("truetype")`
const SRC_LIST =
	/src:url\(fonts\/([^)]+)\.woff2\) format\("woff2"\),url\(fonts\/[^)]+\.woff\) format\("woff"\),url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g;

const rewritten = source.replace(SRC_LIST, (_match, name) => `src:url(katex/dist/fonts/${name}.woff2) format("woff2")`);

const leftovers = (rewritten.match(/url\(fonts\//g) || []).length;
if (leftovers > 0) {
	throw new Error(
		`${leftovers} font URL(s) were not rewritten — the katex stylesheet format changed, update SRC_LIST.`
	);
}

const header = `/*!
 * Vendored from katex@${version} (dist/katex.min.css) — MIT © KaTeX contributors.
 *
 * WHY THIS FILE EXISTS: the upstream sheet references its fonts as \`url(fonts/…)\`,
 * relative to \`node_modules/katex/dist\`. When Sass inlines that sheet into a component
 * stylesheet the bundler resolves those URLs against the *component* directory and the
 * build fails. This copy rewrites them to the package specifier \`katex/dist/fonts/…\`,
 * which the bundler resolves through node_modules and inlines into the editor chunk
 * (spec 05 §3.8 — zero runtime network fetches).
 *
 * Only the \`woff2\` source is kept (every supported browser + Electron/Chromium reads
 * woff2); dropping the woff/ttf duplicates saves ~800 KB of base64 in the chunk.
 *
 * DO NOT EDIT BY HAND. Regenerate after a katex bump with:
 *   node packages/plugins/docs-ui/tools/generate-katex-css.js
 */
`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, header + rewritten.trimEnd() + '\n');
console.log(`Wrote ${OUT_FILE} from katex@${version}.`);
