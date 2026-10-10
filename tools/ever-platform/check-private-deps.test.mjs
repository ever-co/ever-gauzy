// node --test tools/ever-platform/check-private-deps.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { check, findRefs, isPublicOnGitHub, repoOfSpec } from './check-private-deps.mjs';

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
	for (const spec of ['1.2.3', '^1.0.0', 'npm:@ever-co/x@1', 'github:other-org/x', 'file:../x', 'https://github.com/ever-co/x'])
		assert.equal(repoOfSpec(spec), null, spec);
});

test('a manifest that installs only a GitHub tarball of a private repository fails', async () => {
	const text = JSON.stringify({ dependencies: { x: 'https://codeload.github.com/ever-co/platform/tar.gz/main' } });
	const result = await check(findRefs(text, 'package.json'), isPublic);
	assert.equal(result.exit, 1);
	assert.deepEqual(result.privateRefs.map((r) => r.repo), ['platform']);
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
	assert.deepEqual(
		[...new Set(findRefs(moreLock, 'yarn.lock').map((r) => r.repo))].sort(),
		['short', 'ssh-repo']
	);
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
