#!/usr/bin/env node
/**
 * The mock platform's rate limiter, made to survive the clock moves the entitlement ladder makes.
 *
 * `entitlement_ladder` dates the documents the mock signs by moving the mock's clock: a document
 * "issued 8 days ago, expired a day ago (grace)" is read with the clock set 8 days back, one "issued
 * 38 days ago (paused)" with it 38 days back, and the clock is put back to real time after each step.
 * Since `@ever-co/connect-tools` 1.0.0-rc.6 (f95b0c3b041, 2026-10-10) the mock limits entitlement
 * reads with a bucket (`MockState.bucket`), which remembers when the next read may arrive in the
 * mock clock's own time. The installation's reads at real time leave that "next arrival" days ahead of
 * a clock moved back 8 days, so the bucket answers `429 rate_limited` with a retry-after of about 8
 * days — the ladder's grace step has failed with exactly that on every run since (the scheduled
 * audit on develop since 2026-10-11, and #10488's own last run). No `limits` value can absorb it: a
 * bucket's tolerance is less than its one-hour window.
 *
 * The patch changes one line of the installed mock so that a remembered arrival more than a whole
 * window ahead of the clock — which only a clock moved back can produce — starts the bucket afresh.
 * Every rate limit the platform states still holds at a steady clock. It is applied to the harness
 * `npm ci` installed (the mock image is built from that directory), refuses to run when the line it
 * replaces is not there (a harness that changed is a harness this patch was not written for), and
 * says when it is already applied. Remove it once the SDK's mock handles a clock moved back.
 *
 *   node tools/egress-audit/patch-mock-clock.mjs           patch the installed harness
 *   node tools/egress-audit/patch-mock-clock.mjs --check   exit 1 unless it is patched
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE = new URL('./node_modules/@ever-co/connect-tools/', import.meta.url);
export const STATE_FILE = fileURLToPath(new URL('dist/mock-platform/src/state.mjs', PACKAGE));

/**
 * The harness versions this patch was written for. 1.0.0-rc.8 keeps the bucket of rc.7 line for line
 * (`MockState.bucket` in `dist/mock-platform/src/state.mjs`), so the same one-line patch applies.
 */
export const PATCHED_VERSIONS = ['1.0.0-rc.7', '1.0.0-rc.8'];

export const BEFORE = '    const arrival = Math.max(this.arrivals.get(key) ?? now, now);';

export const AFTER = [
	'    // Patched by Gauzy (tools/egress-audit/patch-mock-clock.mjs): an arrival remembered more than a',
	'    // whole window ahead of the clock means the clock was moved back; the bucket starts afresh.',
	'    const remembered = this.arrivals.get(key);',
	'    const arrival = Math.max(remembered !== undefined && remembered - now > windowS ? now : (remembered ?? now), now);'
].join('\n');

/**
 * The source with the bucket patched.
 *
 * @param source `state.mjs` as installed.
 * @returns `{ source, changed }`; `changed` is false when the patch was already there.
 * @throws when neither the original line nor the patch is found.
 */
export function patchSource(source) {
	const eol = source.includes('\r\n') ? '\r\n' : '\n';
	const after = AFTER.split('\n').join(eol);

	if (source.includes(after)) return { source, changed: false };
	if (!source.includes(BEFORE)) {
		throw new Error(
			'patch-mock-clock: the line this patch replaces is not in the installed mock platform; the harness changed, so check whether its bucket still needs the patch'
		);
	}

	return { source: source.replace(BEFORE, after), changed: true };
}

function main(argv) {
	const version = JSON.parse(readFileSync(new URL('package.json', PACKAGE), 'utf8')).version;
	if (!PATCHED_VERSIONS.includes(version)) {
		console.error(
			`patch-mock-clock: the installed harness is ${version}, this patch was written for ${PATCHED_VERSIONS.join(', ')}`
		);
		return 1;
	}

	const original = readFileSync(STATE_FILE, 'utf8');

	if (argv.includes('--check')) {
		const patched = !patchSource(original).changed;
		console.log(`patch-mock-clock: ${patched ? 'patched' : 'NOT patched'} (${version})`);
		return patched ? 0 : 1;
	}

	const { source, changed } = patchSource(original);
	if (changed) writeFileSync(STATE_FILE, source);
	console.log(`patch-mock-clock: ${changed ? 'patched' : 'already patched'} the mock platform's bucket (${version})`);
	return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	process.exit(main(process.argv.slice(2)));
}
