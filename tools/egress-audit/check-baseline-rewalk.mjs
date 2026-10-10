#!/usr/bin/env node
/**
 * The one exception to "ui-baseline.json may only shrink": a change that makes the browser walk open
 * routes it did not open before (a newer harness or route generator), whose pages show the same
 * pre-existing links as every other page. The workflow runs this after the harness's
 * check-baseline-shrink only while BASELINE_REWALK is 'true' in that one change.
 *
 *   git show origin/develop:tools/egress-audit/ui-baseline.json > base.json
 *   node tools/egress-audit/check-baseline-rewalk.mjs --base-file base.json
 *
 * Passes when base_commit is unchanged and every entry added since the base is on a route the base
 * had no entry for (a route the walk did not record before) and repeats a link (same attribute and
 * URL) the base baseline already had for another route: no new Ever link can enter the baseline
 * this way, and no route walked before can gain one, except a signed-out page (`/auth/`, `/share/`,
 * `/legal/`) gaining a link the base recorded under `/`, where those pages were recorded before. Exit 0, 1 naming each entry
 * with a link the base did not have, 2 on a usage error.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), 'ui-baseline.json');

const key = (e) => `${e.route}|${e.attribute}|${e.url}`;
const link = (e) => `${e.attribute}|${e.url}`;
const show = (e) => `${e.route} ${e.attribute} ${e.url}`;

/**
 * The entries added since `base` that this exception does not cover: on a route the base already
 * had entries for (a route walked before may never gain a link), or with a link the base did not
 * have anywhere. Answers those and the count of all added.
 */
export function newLinks(current, base) {
	const before = new Set((base.entries ?? []).map(key));
	const links = new Set((base.entries ?? []).map(link));
	const routes = new Set((base.entries ?? []).map((e) => e.route));
	// The signed-out pages' links were recorded under the path `/`; the hash-routed walk records
	// them under each page's own route.
	const signedOut = new Set((base.entries ?? []).filter((e) => e.route === '/').map(link));
	const isSignedOutPage = (route) => /^\/(auth|share|legal)\//.test(route);
	const covered = (e) =>
		(!routes.has(e.route) && links.has(link(e))) || (isSignedOutPage(e.route) && signedOut.has(link(e)));
	const added = (current.entries ?? []).filter((e) => !before.has(key(e)));
	return { added: added.length, unknown: added.filter((e) => !covered(e)) };
}

export function main(argv) {
	const i = argv.indexOf('--base-file');
	const baseFile = i >= 0 ? argv[i + 1] : null;
	if (!baseFile) {
		process.stderr.write('check-baseline-rewalk: --base-file <the baseline at the base> is required\n');
		return 2;
	}
	let base;
	let current;
	try {
		base = JSON.parse(readFileSync(resolve(baseFile), 'utf8'));
		current = JSON.parse(readFileSync(FILE, 'utf8'));
	} catch (error) {
		process.stderr.write(`check-baseline-rewalk: ${error.message}\n`);
		return 2;
	}
	if (current.base_commit !== base.base_commit) {
		process.stderr.write('check-baseline-rewalk: base_commit changed; it is fixed once the baseline exists\n');
		return 1;
	}
	const { added, unknown } = newLinks(current, base);
	if (unknown.length) {
		const list = unknown.map(show).join('\n  ');
		process.stderr.write(
			'check-baseline-rewalk: entries on a route the base baseline already had, or with a link it did not have (only routes it did not record may be added, for links it already excused):\n  ' +
				list +
				'\n'
		);
		return 1;
	}
	process.stdout.write(`check-baseline-rewalk: ok (${added} entries added, each a link the baseline already had)\n`);
	return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
