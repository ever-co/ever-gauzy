#!/usr/bin/env node
/**
 * The one exception to "ui-baseline.json may only shrink": a change that makes the browser walk open
 * routes it did not open before (a newer harness or route generator), whose pages show the same
 * pre-existing links as every other page. The workflow runs this instead of the harness's
 * check-baseline-shrink only while BASELINE_REWALK is 'true' in that one change.
 *
 *   node tools/egress-audit/check-baseline-rewalk.mjs --base <git ref>
 *
 * Passes when base_commit is unchanged and every entry added since <git ref> repeats a link (same
 * attribute and URL) the baseline already had at <git ref> for another route: no new Ever link can
 * enter the baseline this way, only a route for a link it already excused. Exit 0, 1 naming each
 * entry with a link the base did not have, 2 on a usage error.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, 'ui-baseline.json');

const key = (e) => `${e.route}|${e.attribute}|${e.url}`;
const link = (e) => `${e.attribute}|${e.url}`;

/** The entries added since `base` whose link the base did not have, and the count of all added. */
export function newLinks(current, base) {
	const before = new Set((base.entries ?? []).map(key));
	const links = new Set((base.entries ?? []).map(link));
	const added = (current.entries ?? []).filter((e) => !before.has(key(e)));
	return { added: added.length, unknown: added.filter((e) => !links.has(link(e))) };
}

export function main(argv) {
	const i = argv.indexOf('--base');
	const ref = i >= 0 ? argv[i + 1] : null;
	if (!ref) {
		process.stderr.write('check-baseline-rewalk: --base <git ref> is required\n');
		return 2;
	}
	const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: HERE, encoding: 'utf8' }).trim();
	const path = relative(top, FILE).split(sep).join('/');
	let base;
	try {
		base = JSON.parse(execFileSync('git', ['show', `${ref}:${path}`], { cwd: top, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
	} catch (error) {
		process.stderr.write(`check-baseline-rewalk: ${path} at ${ref} could not be read: ${String(error.stderr ?? error.message).trim()}\n`);
		return 2;
	}
	const current = JSON.parse(readFileSync(FILE, 'utf8'));
	if (current.base_commit !== base.base_commit) {
		process.stderr.write(`check-baseline-rewalk: base_commit changed since ${ref}; it is fixed once the baseline exists\n`);
		return 1;
	}
	const { added, unknown } = newLinks(current, base);
	if (unknown.length) {
		process.stderr.write(
			`check-baseline-rewalk: entries with a link the baseline did not have at ${ref} (only routes for links it already excused may be added):\n  ${unknown.map((e) => `${e.route} ${e.attribute} ${e.url}`).join('\n  ')}\n`
		);
		return 1;
	}
	process.stdout.write(`check-baseline-rewalk: ok (${added} entries added since ${ref}, each a link the baseline already had)\n`);
	return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
