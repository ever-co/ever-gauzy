/**
 * The webapp image's entrypoints put `EVER_APP_LINKS` (the app switcher's links) into the built bundles at container
 * start: `envsubst` writes the value into `replacements.sed` as it is, then `sed -f` replaces the
 * `DOCKER_EVER_APP_LINKS` placeholder inside a JS string. Each entrypoint escapes the value for both first
 * (`EVER_APP_LINKS_SED`); this holds that escaping to its promise: whatever the value, sed accepts the script and the
 * app reads back exactly the value that was set, from a single-quoted and from a double-quoted string.
 *
 * Needs `sh` and `sed` (as the image has). Run from the repository root:
 * `node --test tools/scripts/webapp-ever-app-links.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const WEBAPP = join('.deploy', 'webapp');
const ENTRYPOINTS = ['entrypoint.prod.sh', 'entrypoint.compose.sh'];

/** The entrypoint's own line that makes `EVER_APP_LINKS_SED`. */
function escapingLine(entrypoint) {
	const line = readFileSync(join(WEBAPP, entrypoint), 'utf8')
		.split(/\r?\n/)
		.find((text) => text.startsWith('EVER_APP_LINKS_SED='));
	assert.ok(line, `${entrypoint} makes EVER_APP_LINKS_SED`);
	return line;
}

/** The `replacements.sed` rule of the placeholder. */
function placeholderRule() {
	const rule = readFileSync(join(WEBAPP, 'replacements.sed'), 'utf8')
		.split(/\r?\n/)
		.find((text) => text.includes('DOCKER_EVER_APP_LINKS'));
	assert.equal(rule, 's|DOCKER_EVER_APP_LINKS|$EVER_APP_LINKS_SED|g');
	return rule;
}

/** What the app reads after the entrypoint substituted `value`, from both kinds of JS string. */
function substituted(entrypoint, value) {
	const dir = mkdtempSync(join(tmpdir(), 'ever-app-links-'));
	try {
		// The entrypoint's line, run by sh from a file (as the image runs it; an argument would be re-quoted on Windows).
		writeFileSync(join(dir, 'escape.sh'), `${escapingLine(entrypoint)}\nprintf '%s' "$EVER_APP_LINKS_SED"\n`);
		const escaped = execFileSync('sh', [join(dir, 'escape.sh')], {
			env: { ...process.env, EVER_APP_LINKS: value },
			encoding: 'utf8'
		});
		// envsubst: the value goes in as it is.
		writeFileSync(join(dir, 'values.sed'), placeholderRule().replace('$EVER_APP_LINKS_SED', () => escaped) + '\n');
		writeFileSync(join(dir, 'bundle.js'), `a = 'DOCKER_EVER_APP_LINKS'; b = "DOCKER_EVER_APP_LINKS";\n`);
		execFileSync('sed', ['-i', '-f', join(dir, 'values.sed'), join(dir, 'bundle.js')]);
		const context = {};
		runInNewContext(readFileSync(join(dir, 'bundle.js'), 'utf8'), context);
		return [context.a, context.b];
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

const VALUES = [
	'',
	'platform=https://platform.example.com,works=https://works.example.com',
	'platform=https://platform.example.com/?a=1&b=2,works=https://works.example.com/x|y',
	"works=https://works.example.com/a'b",
	'platform=https://platform.example.com/q"r',
	'platform=https://example.com\\app',
	'platform=https://e.example.com/\\\\&|\'"\\n$HOME`x`'
];

for (const entrypoint of ENTRYPOINTS) {
	for (const value of VALUES) {
		test(`${entrypoint}: ${JSON.stringify(value)} reaches the app as it was set`, () => {
			assert.deepEqual(substituted(entrypoint, value), [value, value]);
		});
	}
}
