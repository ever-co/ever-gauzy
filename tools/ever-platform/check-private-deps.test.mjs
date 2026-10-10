// node --test tools/ever-platform/check-private-deps.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { check, findRefs, isPublicOnGitHub } from './check-private-deps.mjs';

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

test('every reference form is found: github:, git+https, git+ssh, git:// and workflow uses', () => {
	const text = [
		'"a": "github:ever-co/one#main"',
		'"b": "git+https://github.com/ever-co/two.git"',
		'"c": "git+ssh://git@github.com:ever-co/three.git"',
		'"d": "git://github.com/ever-co/four"',
		'      uses: ever-co/five/.github/actions/x@abc',
		'"e": "github:other-org/six"'
	].join('\n');
	assert.deepEqual(
		findRefs(text, 'f').map((r) => r.repo),
		['one', 'two', 'three', 'four', 'five']
	);
});

test('an answer other than 200 or 404 is inconclusive (exit 2), never a pass', async () => {
	const result = await check([{ repo: 'x', file: 'f', line: 1 }], async () => null);
	assert.equal(result.exit, 2);
	const rateLimited = async () => ({ status: 403 });
	assert.equal(await isPublicOnGitHub('x', rateLimited), null);
	assert.equal(await isPublicOnGitHub('x', async () => ({ status: 404 })), false);
	assert.equal(await isPublicOnGitHub('x', async () => ({ status: 200 })), true);
});

test('the request carries no credentials', async () => {
	let seen;
	await isPublicOnGitHub('x', async (url, init) => {
		seen = { url, headers: init.headers };
		return { status: 200 };
	});
	assert.equal(seen.url, 'https://github.com/ever-co/x');
	assert.equal(Object.keys(seen.headers).some((h) => h.toLowerCase() === 'authorization'), false);
});
