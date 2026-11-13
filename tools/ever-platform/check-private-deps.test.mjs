// node --test tools/ever-platform/check-private-deps.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
	ATTEMPTS,
	check,
	findRefs,
	isPublicOnGitHub,
	MAX_WAIT_MS,
	repoOfSpec,
	retryAfterMs
} from './check-private-deps.mjs';

const fixture = (name) => readFileSync(new URL(`./fixtures/private-deps/${name}`, import.meta.url), 'utf8');

/** A stand-in for GitHub: `platform` is private, everything else public. */
const isPublic = async (repo) => repo !== 'platform';

test('a git dependency on a private ever-co repository fails, naming the file and line', async () => {
	const refs = findRefs(fixture('package.json'), 'fixtures/private-deps/package.json');
	const result = await check(refs, isPublic);
	assert.equal(result.exit, 1);
	assert.deepEqual(
		result.privateRefs.map((r) => `${r.file}:${r.line} ${r.repo}`),
		['fixtures/private-deps/package.json:5 platform']
	);
});

test('a published npm version and a public ever-co repository pass', async () => {
	const text = JSON.stringify(
		{
			dependencies: {
				'@ever-co/connect-sdk': '1.0.0-rc.5',
				'@nestjs/axios': 'github:ever-co/nestjs-axios#master',
				x: 'git+https://github.com/ever-co/ever-connect-sdk.git#main'
			}
		},
		null,
		'\t'
	);
	const refs = findRefs(text, 'package.json');
	assert.deepEqual(refs.map((r) => r.repo).sort(), ['ever-connect-sdk', 'nestjs-axios']);
	assert.equal((await check(refs, isPublic)).exit, 0);
});

test('every dependency form is recognized', () => {
	const forms = {
		'github:ever-co/one#main': 'one',
		'ever-co/two': 'two',
		'ever-co/three#v1': 'three',
		'git+https://github.com/ever-co/four.git': 'four',
		'https://github.com/ever-co/five.git#main': 'five',
		'git+ssh://git@github.com:ever-co/six.git': 'six',
		'git+ssh://git@github.com/ever-co/seven.git': 'seven',
		'git@github.com:ever-co/eight.git': 'eight',
		'git://github.com/ever-co/nine': 'nine',
		'https://codeload.github.com/ever-co/ten/tar.gz/main': 'ten',
		'https://github.com/ever-co/eleven/archive/main.tar.gz': 'eleven'
	};
	for (const [spec, repo] of Object.entries(forms)) assert.equal(repoOfSpec(spec), repo, spec);
	for (const spec of [
		'1.2.3',
		'^1.0.0',
		'npm:@ever-co/x@1',
		'github:other-org/x',
		'file:../x',
		'https://github.com/ever-co/x'
	])
		assert.equal(repoOfSpec(spec), null, spec);
});

test('a manifest that installs only a GitHub tarball of a private repository fails', async () => {
	const text = JSON.stringify({ dependencies: { x: 'https://codeload.github.com/ever-co/platform/tar.gz/main' } });
	const result = await check(findRefs(text, 'package.json'), isPublic);
	assert.equal(result.exit, 1);
	assert.deepEqual(
		result.privateRefs.map((r) => r.repo),
		['platform']
	);
});

test('only dependency fields are read: repository and bugs links are not dependencies', () => {
	const text = JSON.stringify({
		repository: 'github:ever-co/platform',
		bugs: { url: 'https://github.com/ever-co/platform/issues' },
		dependencies: { a: '1.0.0' },
		overrides: { b: { c: 'ever-co/nested' } },
		resolutions: { d: 'git+https://github.com/ever-co/resolved.git' }
	});
	assert.deepEqual(
		findRefs(text, 'package.json').map((r) => r.repo),
		['resolved', 'nested']
	);
});

test('yarn.lock entries and workflow uses are found; other workflow text is not', () => {
	const lock = [
		'"@nestjs/axios@github:ever-co/nestjs-axios#master":',
		'  resolved "https://codeload.github.com/ever-co/nestjs-axios/tar.gz/abc"',
		'"@ever-co/legal@^0.1.0":',
		'  resolved "https://registry.npmjs.org/@ever-co/legal/-/legal-0.1.2.tgz"'
	].join('\n');
	assert.deepEqual(
		findRefs(lock, 'yarn.lock').map((r) => r.repo),
		['nestjs-axios', 'nestjs-axios']
	);
	const moreLock = [
		'"x@git@github.com:ever-co/ssh-repo.git":',
		'  resolved "git@github.com:ever-co/ssh-repo.git#abc"',
		'"y@ever-co/short#main":',
		'  version "1.0.0"',
		'  dependencies:',
		'    "@ever-co/connect-contracts" "1.0.0-rc.3"'
	].join('\n');
	// The SSH form, and the shorthand as a selector's spec (a package name before the @); never the
	// npm scope of a dependency line.
	assert.deepEqual([...new Set(findRefs(moreLock, 'yarn.lock').map((r) => r.repo))].sort(), ['short', 'ssh-repo']);
	assert.deepEqual(findRefs('    "@ever-co/connect-contracts" "1.0.0-rc.3"', 'yarn.lock'), []);
	// The shorthand after a quote or a space counts too.
	assert.deepEqual(
		findRefs('"y" "ever-co/short#main"', 'yarn.lock').map((r) => r.repo),
		['short']
	);
	const workflow = [
		'      - uses: ever-co/five/.github/actions/x@abc',
		'        uses: ever-co/six@v1',
		'        with: { repository: ever-co/other }',
		'      # see https://github.com/ever-co/seven'
	].join('\n');
	assert.deepEqual(
		findRefs(workflow, '.github/workflows/x.yml').map((r) => r.repo),
		['five', 'six']
	);
});

test('an answer other than 200 or 404 is inconclusive (exit 2), never a pass', async () => {
	const result = await check([{ repo: 'x', file: 'f', line: 1 }], async () => null);
	assert.equal(result.exit, 2);
	assert.equal(await isPublicOnGitHub('x', async () => ({ status: 403 }), 1), null);
	assert.equal(await isPublicOnGitHub('x', async () => ({ status: 404 }), 1), false);
	assert.equal(await isPublicOnGitHub('x', async () => ({ status: 200 }), 1), true);
});

test('a rate-limited ask is repeated with growing pauses, honouring Retry-After, and the answers are reported', async () => {
	// Two 429s, then the page: public, after the backoff.
	const answers = [429, 429, 200];
	const lines = [];
	assert.equal(
		await isPublicOnGitHub(
			'x',
			async () => ({ status: answers.shift() }),
			1,
			(line) => lines.push(line)
		),
		true
	);
	assert.deepEqual(lines, [
		`ever-co/x: GitHub answered 429; asking again in 1 s (2 of ${ATTEMPTS})`,
		`ever-co/x: GitHub answered 429; asking again in 1 s (3 of ${ATTEMPTS})`
	]);

	// Never anything but 429: ATTEMPTS asks with doubling pauses, then inconclusive, the last answer named.
	let asks = 0;
	const last = [];
	const { result: exhausted, waits: backoff } = await withWaits(() =>
		isPublicOnGitHub(
			'x',
			async () => {
				asks += 1;
				return { status: 429 };
			},
			1,
			(line) => last.push(line)
		)
	);
	assert.equal(exhausted, null);
	assert.equal(asks, ATTEMPTS);
	assert.deepEqual(backoff, [1, 2, 4, 8, 16]);
	assert.equal(last.at(-1), `ever-co/x: GitHub answered 429 to the last of ${ATTEMPTS} asks`);

	// Retry-After as delay-seconds and as an HTTP-date (measured from a fixed clock), each capped at MAX_WAIT_MS.
	const headers = (value) => ({ get: (name) => (name === 'retry-after' ? value : null) });
	const now = Date.parse('Thu, 12 Nov 2026 20:00:00 GMT');
	const replies = [
		{ status: 429, headers: headers('3') },
		{ status: 429, headers: headers('3600') },
		{ status: 429, headers: headers('Thu, 12 Nov 2026 20:01:30 GMT') },
		{ status: 429, headers: headers('Thu, 12 Nov 2026 20:00:10 GMT') },
		{ status: 404 }
	];
	const { result, waits } = await withWaits(() => isPublicOnGitHub('x', async () => replies.shift(), 1), now);
	assert.equal(result, false);
	assert.deepEqual(waits, [3000, MAX_WAIT_MS, MAX_WAIT_MS, 10_000]);
});

test('Retry-After is read as delay-seconds or an HTTP-date; anything else names no pause', () => {
	const now = Date.parse('Thu, 12 Nov 2026 20:00:00 GMT');
	assert.equal(retryAfterMs('120', now), 120_000);
	assert.equal(retryAfterMs(' 7 ', now), 7_000);
	assert.equal(retryAfterMs('Thu, 12 Nov 2026 20:01:30 GMT', now), 90_000);
	assert.equal(retryAfterMs('Thu, 12 Nov 2026 19:59:00 GMT', now), 0); // already past
	assert.equal(retryAfterMs(null, now), null);
	assert.equal(retryAfterMs('', now), null);
	assert.equal(retryAfterMs('soon', now), null);
	assert.equal(retryAfterMs('-5', now), null);
});

/**
 * Runs `fn` with setTimeout recording each pause and firing at once, and with Date.now fixed at `now`
 * when one is given: {result, waits}. Both are restored afterwards.
 */
async function withWaits(fn, now) {
	const waits = [];
	const realSetTimeout = globalThis.setTimeout;
	const realNow = Date.now;
	globalThis.setTimeout = (callback, ms) => {
		waits.push(ms);
		return realSetTimeout(callback, 0);
	};
	if (now !== undefined) Date.now = () => now;
	try {
		return { result: await fn(), waits };
	} finally {
		globalThis.setTimeout = realSetTimeout;
		Date.now = realNow;
	}
}

test('the request carries no credentials', async () => {
	let seen;
	await isPublicOnGitHub('x', async (url, init) => {
		seen = { url, headers: init.headers };
		return { status: 200 };
	});
	assert.equal(seen.url, 'https://github.com/ever-co/x');
	assert.equal(
		Object.keys(seen.headers).some((h) => h.toLowerCase() === 'authorization'),
		false
	);
});
