/**
 * ⚠️ SUPERSEDED — the sheet this script generates is NOT part of any build.
 *
 * KaTeX now loads as a GLOBAL stylesheet contributed by the host app:
 * `node_modules/katex/dist/katex.min.css` in `apps/gauzy/project.json`
 * (targets `build`, `desktop-ui`, `server-ui`). `document-editor.component.scss`
 * no longer imports the vendored copy. Two reasons the inlining approach was
 * dropped — do NOT wire it back in without addressing both:
 *
 *   1. RUNTIME: KaTeX markup is created by ProseMirror, not by an Angular
 *      template, so it never carries the component's `_ngcontent-*` attribute.
 *      Under the default emulated encapsulation an inlined `.katex { … }` rule
 *      becomes `.katex[_ngcontent-*]` and matches nothing (the sheet's
 *      `body { counter-reset: … }` is killed outright).
 *   2. BUILD: the package-specifier rewrite below (`url(katex/dist/fonts/…)`)
 *      survives ng-packagr but NOT the app's webpack build — the SCSS URL
 *      resolver re-anchors the URL to the importing component's directory and
 *      fails with `Can't resolve './styles/katex/dist/fonts/KaTeX_*.woff2'`.
 *
 * Kept for reference / for a future consumer that needs a self-contained
 * component-scoped copy. Running it only refreshes the unused
 * `src/lib/editor/styles/_katex.scss`; nothing imports that file.
 *
 * Original intent (spec 05 §3.8): inline the sheet into the editor lazy chunk
 * with only the `woff2` sources, since every browser Gauzy supports (and the
 * Electron/Chromium desktop shell) reads woff2 and the `woff`/`truetype`
 * duplicates cost ~800 KB of base64.
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
 * ⚠️ UNUSED — nothing imports this file. KaTeX ships as a GLOBAL stylesheet
 * (\`node_modules/katex/dist/katex.min.css\` in the host app's build \`styles\`;
 * see \`apps/gauzy/project.json\` and this package's README).
 *
 * Do NOT \`@import\` it from a component stylesheet:
 *   - the \`url(katex/dist/fonts/…)\` specifiers below break the app's webpack
 *     build (the SCSS URL resolver re-anchors them to the importing component's
 *     directory → \`Can't resolve './styles/katex/dist/fonts/KaTeX_*.woff2'\`), and
 *   - Angular's emulated encapsulation would rewrite every \`.katex\` rule to
 *     \`.katex[_ngcontent-*]\`, which never matches ProseMirror-generated markup.
 *
 * Only the \`woff2\` source is kept (every supported browser + Electron/Chromium reads
 * woff2); dropping the woff/ttf duplicates saves ~800 KB of base64.
 *
 * DO NOT EDIT BY HAND. Regenerate after a katex bump with:
 *   node packages/plugins/docs-ui/tools/generate-katex-css.js
 */
`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, header + rewritten.trimEnd() + '\n');
console.log(`Wrote ${OUT_FILE} from katex@${version}.`);
