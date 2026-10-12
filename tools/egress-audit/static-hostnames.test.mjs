// cspell:ignore notever
// node --test tools/egress-audit/static-hostnames.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import {
	allowed,
	bundleGrowth,
	codeGrowth,
	main,
	occurrences,
	readBaseline,
	REPO_ROOT,
	scanCode
} from './static-hostnames.mjs';

const quiet = () => {
	const lines = [];
	return { lines, io: { log: (s) => lines.push(s), err: (s) => lines.push(s) } };
};

test('the tree names no Ever host outside the modules beyond the baseline', () => {
	const { lines, io } = quiet();
	assert.equal(main([], io), 0, lines.join('\n'));
});

test('the known-bad fixture fails and names its file, its host and its variable', () => {
	const { lines, io } = quiet();
	assert.equal(main(['--fixture', join(REPO_ROOT, 'tools/egress-audit/fixtures/static-bad')], io), 1);
	const out = lines.join('\n');
	assert.match(out, /packages\/core\/src\/core-host\.ts: api\.ever\.co x1/);
	assert.match(out, /core-host\.ts: EVER_PLATFORM_API_URL x1/);
});

test('one more occurrence of a recorded host in a recorded file fails; one less passes', () => {
	const baseline = { 'packages/config/src/a.ts': { 'gauzy.co': 2 } };
	assert.deepEqual(codeGrowth({ 'packages/config/src/a.ts': { 'gauzy.co': 3 } }, baseline), [
		'packages/config/src/a.ts: gauzy.co x3 (recorded: 2)'
	]);
	assert.deepEqual(codeGrowth({ 'packages/config/src/a.ts': { 'gauzy.co': 1 } }, baseline), []);
	assert.equal(codeGrowth({ 'packages/core/src/b.ts': { 'api.ever.co': 1 } }, baseline).length, 1);
});

test('a host new to the built web app fails', () => {
	assert.deepEqual(bundleGrowth(['gauzy.co', 'api.ever.co'], ['gauzy.co']), ['api.ever.co']);
	assert.deepEqual(bundleGrowth(['gauzy.co'], ['gauzy.co', 'docs.gauzy.co']), []);
});

test('every Ever-owned name counts, names under it included; other hosts do not', () => {
	assert.deepEqual(occurrences('see https://docs.gauzy.co and https://example.com, mail ops@ever.team'), {
		'docs.gauzy.co': 1,
		'ever.team': 1
	});
	assert.deepEqual(occurrences('new URL(process.env.EVER_STATS_API_URL)'), { EVER_STATS_API_URL: 1 });
	assert.deepEqual(occurrences('notever.co.uk forever.com'), {});
});

test('the modules, docs, the audit and tests may name Ever hosts; core code may not', () => {
	for (const file of [
		'packages/plugins/ever-connect/src/lib/sdk.ts',
		'packages/plugins/ever-stats-ui/src/index.ts',
		'docs/ever-platform/outbound-calls.md',
		'README.md',
		'packages/core/src/lib/user/user.service.spec.ts',
		'tools/egress-audit/adapter.mjs'
	])
		assert.equal(allowed(file), true, file);
	for (const file of [
		'packages/core/src/lib/user/user.service.ts',
		'apps/gauzy/src/app/app.component.ts',
		'.env.sample',
		'packages/plugins/ever-connector/x.ts'
	])
		assert.equal(allowed(file), false, file);
});

test('the baseline holds no file the scan does not reach (an entry for an allowed file would excuse nothing)', () => {
	const { code } = readBaseline();
	for (const file of Object.keys(code)) assert.equal(allowed(file), false, file);
	assert.ok(Object.keys(scanCode(REPO_ROOT)).length > 0);
});
