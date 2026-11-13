// cspell:ignore notever
// node --test tools/egress-audit/static-hostnames.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
	allowed,
	bundleGrowth,
	bundleHostsToRecord,
	codeGrowth,
	main,
	moduleHosts,
	occurrences,
	readBaseline,
	REPO_ROOT,
	scanCode,
	sourceFiles
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

test("in the built web app, a host a module's web part names passes; one only its tests, a server module or core code name does not", () => {
	const dir = mkdtempSync(join(tmpdir(), 'static-hostnames-modules-'));
	const write = (file, text) => {
		mkdirSync(join(dir, file, '..'), { recursive: true });
		writeFileSync(join(dir, file), text);
	};
	try {
		execFileSync('git', ['init', '-q'], { cwd: dir });
		write('packages/plugins/ever-connect-ui/src/lib/catalog.ts', "const url = 'https://everdemand.co';\n");
		write('packages/plugins/ever-stats-ui/src/lib/page.html', '<a href="https://app.ever.works">Works</a>\n');
		write('packages/plugins/ever-connect-ui/src/lib/catalog.spec.ts', "expect('https://rec.so');\n");
		write('packages/plugins/ever-connect-ui/README.md', 'See https://traduora.co.\n');
		// The package's own files never reach the web app: its manifest, jest config and test setup.
		write('packages/plugins/ever-connect-ui/package.json', '{"homepage": "https://pkg.ever.works"}\n');
		write('packages/plugins/ever-connect-ui/jest.config.ts', "const url = 'https://jest.ever.works';\n");
		write('packages/plugins/ever-stats-ui/src/test-setup.ts', "const url = 'https://setup.ever.works';\n");
		write('packages/plugins/ever-connect/src/lib/sdk.ts', "const api = 'https://app-dev.ever.co';\n");
		write('packages/core/src/lib/core.ts', "const app = 'https://app.ever.team';\n");
		assert.deepEqual(moduleHosts(dir), ['app.ever.works', 'everdemand.co']);

		const bundle = join(dir, 'srv');
		mkdirSync(bundle);
		const scan = (text) => {
			writeFileSync(join(bundle, 'main.js'), text);
			const { lines, io } = quiet();
			return { code: main(['--root', dir, '--bundle', bundle], io), out: lines.join('\n') };
		};
		assert.equal(scan("['https://everdemand.co', 'https://app.ever.works']").code, 0);
		for (const host of [
			'rec.so',
			'traduora.co',
			'pkg.ever.works',
			'jest.ever.works',
			'setup.ever.works',
			'app-dev.ever.co',
			'app.ever.team'
		]) {
			const { code, out } = scan(`['https://everdemand.co', 'https://${host}']`);
			assert.equal(code, 1, host);
			assert.match(out, new RegExp(`^  ${host.replace(/\./g, '\\.')}$`, 'm'));
			assert.doesNotMatch(out, /everdemand\.co/);
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('rewriting the bundle list keeps a recorded host a module also names, and records only the new hosts of no module', () => {
	const recorded = ['app.gauzy.co', 'gauzy.co', 'old.gauzy.co'];
	const own = ['app.gauzy.co', 'app.ever.works'];
	// app.gauzy.co stays (core code names it too), old.gauzy.co goes (the bundle no longer names it),
	// app.ever.works is the module's own, and api.ever.co is new and no module's: recorded, so --write refuses it.
	assert.deepEqual(
		bundleHostsToRecord(['api.ever.co', 'app.ever.works', 'app.gauzy.co', 'gauzy.co'], recorded, own),
		['api.ever.co', 'app.gauzy.co', 'gauzy.co']
	);
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
		'tools/ever-platform/outbound-calls.md',
		'README.md',
		'packages/core/src/lib/user/user.service.spec.ts',
		'tools/egress-audit/adapter.mjs',
		// A CI probe of the production hosts from outside; it builds and ships nothing.
		'.github/workflows/external-uptime-monitor.yml'
	])
		assert.equal(allowed(file), true, file);
	for (const file of [
		'packages/core/src/lib/user/user.service.ts',
		'apps/gauzy/src/app/app.component.ts',
		'.env.sample',
		'packages/plugins/ever-connector/x.ts',
		// The workflows that build and deploy the images stay in the scan: only the monitor is named.
		'.github/workflows/deploy-do-app-platform-prod.yml',
		'.github/workflows/external-uptime-monitor-copy.yml'
	])
		assert.equal(allowed(file), false, file);
});

test('a git work tree is scanned as git sees it: tracked and new files, not ignored or build output', () => {
	const dir = mkdtempSync(join(tmpdir(), 'static-hostnames-'));
	try {
		execFileSync('git', ['init', '-q'], { cwd: dir });
		writeFileSync(join(dir, '.gitignore'), 'environment.ts\n');
		mkdirSync(join(dir, 'src'));
		writeFileSync(join(dir, 'src', 'tracked.ts'), "const api = 'https://api.ever.co';\n");
		execFileSync('git', ['add', '.'], { cwd: dir });
		// Not added yet but not ignored: scanned, so a new file is caught before it is committed.
		writeFileSync(join(dir, 'src', 'new.ts'), "const api = 'https://api.ever.co';\n");
		// Ignored (generated from .env in a real checkout) and build output: never scanned.
		writeFileSync(join(dir, 'src', 'environment.ts'), "const api = 'https://api.ever.co';\n");
		mkdirSync(join(dir, 'dist'));
		writeFileSync(join(dir, 'dist', 'main.js'), "const api = 'https://api.ever.co';\n");

		assert.deepEqual(sourceFiles(dir), ['.gitignore', 'src/new.ts', 'src/tracked.ts']);
		assert.deepEqual(Object.keys(scanCode(dir, { patterns: [] })), ['src/new.ts', 'src/tracked.ts']);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('the baseline holds no file the scan does not reach (an entry for an allowed file would excuse nothing)', () => {
	const { code } = readBaseline();
	for (const file of Object.keys(code)) assert.equal(allowed(file), false, file);
	assert.ok(Object.keys(scanCode(REPO_ROOT)).length > 0);
});
