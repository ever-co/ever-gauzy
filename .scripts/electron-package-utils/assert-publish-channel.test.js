const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const GUARD = path.join(__dirname, 'assert-publish-channel.js');
const GUARD_COMMAND = 'node .scripts/electron-package-utils/assert-publish-channel.js';
const ROOT_PACKAGE = path.join(__dirname, '..', '..', 'package.json');

function run(...args) {
	const result = spawnSync(process.execPath, [GUARD, ...args], { encoding: 'utf8' });
	return { status: result.status, output: result.stdout + result.stderr };
}

// Writes `<tmp>/package.json` with the given build.publish (or raw text) and returns the directory.
function project(t, publish, raw) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-channel-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const content = raw !== undefined ? raw : JSON.stringify({ name: 'app', build: { publish } });
	fs.writeFileSync(path.join(dir, 'package.json'), content);
	return dir;
}

const github = (channel) => ({ provider: 'github', repo: 'ever-gauzy-desktop', releaseType: 'release', channel });

test('passes when every publish entry has the channel of the arch being built', (t) => {
	const x64 = run('--project', project(t, [github('latest-x64')]), '--arch', 'x64');
	assert.equal(x64.status, 0, x64.output);
	assert.match(x64.output, /Update channel OK: .* = latest-x64 \(entries: 1\)/);

	const arm64 = run(`--project=${project(t, [github('latest-arm64')])}`, '--arch=arm64');
	assert.equal(arm64.status, 0, arm64.output);
});

test('fails with an annotation when the channel never reached dist', (t) => {
	const result = run('--project', project(t, [github(undefined)]), '--arch', 'x64');
	assert.equal(result.status, 1);
	assert.match(result.output, /^::error title=Update channel missing::.*"latest-x64" but found \[0\] \(none\)/m);
	assert.match(result.output, /Hint: `yarn run pack/);
});

test('fails on the wrong arch, the default channel, or one entry without a channel', (t) => {
	for (const publish of [[github('latest-arm64')], [github('latest')], [github('latest-x64'), github(undefined)]]) {
		const result = run('--project', project(t, publish), '--arch', 'x64');
		assert.equal(result.status, 1, JSON.stringify(publish));
		assert.match(result.output, /^::error title=Update channel missing::/m);
	}
});

test('fails when build.publish is missing, empty or not a list', (t) => {
	for (const publish of [undefined, [], github('latest-x64')]) {
		const result = run('--project', project(t, publish), '--arch', 'x64');
		assert.equal(result.status, 1, JSON.stringify(publish));
		assert.match(result.output, /build\.publish must be a non-empty array/);
	}
});

test('fails when package.json is missing or not JSON', (t) => {
	const missing = run('--project', path.join(os.tmpdir(), 'publish-channel-does-not-exist'), '--arch', 'x64');
	assert.equal(missing.status, 1);
	assert.match(missing.output, /not found/);

	const broken = run('--project', project(t, undefined, '{ "build": '), '--arch', 'x64');
	assert.equal(broken.status, 1);
	assert.match(broken.output, /is not readable JSON/);
});

test('fails loudly when it is called wrongly', (t) => {
	const dir = project(t, [github('latest-x64')]);
	for (const args of [[], ['--project', dir], ['--arch', 'x64'], ['--project', dir, '--arch', 'ia32'], ['--foo']]) {
		const result = run(...args);
		assert.equal(result.status, 1, args.join(' '));
		assert.match(result.output, /^::error title=Update channel check misconfigured::/m);
	}
});

// The guard only protects releases if it stays wired in: every Windows / Linux release script that stamps a
// per-arch channel with `pack --arch` must run it on the same arch and dist dir right before electron-builder.
test('every per-arch Windows / Linux publishing script runs the guard right before electron-builder', () => {
	const { scripts } = JSON.parse(fs.readFileSync(ROOT_PACKAGE, 'utf8'));
	const targets = Object.entries(scripts).filter(
		([, script]) =>
			/electron-builder/.test(script) &&
			/--publish=always/.test(script) &&
			/ --(windows|linux) /.test(script) &&
			/yarn run pack --desktop=\S+ --arch=/.test(script)
	);
	assert.ok(targets.length >= 28, `expected at least 28 per-arch release scripts, found ${targets.length}`);

	for (const [name, script] of targets) {
		const arch = /yarn run pack --desktop=\S+ --arch=(\S+)/.exec(script)[1];
		const project = /electron-builder .* --project (\S+)/.exec(script)[1];
		const guard = `${GUARD_COMMAND} --project ${project} --arch ${arch} && `;
		assert.ok(
			new RegExp(` --${arch} `).test(script),
			`${name}: electron-builder arch differs from pack --arch ${arch}`
		);
		assert.ok(
			script.includes(`${guard}npm config set cache .cache && yarn electron-builder `),
			`${name}: missing "${guard}"`
		);
	}
});
