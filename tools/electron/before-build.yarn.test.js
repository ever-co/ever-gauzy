/**
 * before-build.js against the real yarn 1, offline: local fixture packages with `cpu` fields stand in for optional platform
 * packages (sharp's `@img/*`, `@libsql/*`). Shows the yarn behaviour the cross build works around (it picks optional platform
 * packages by the build machine's CPU) and that a build for another CPU ends with exactly the target's package.
 * Skipped when no yarn 1 is on PATH.
 *
 * Run: `node --test tools/electron/before-build.yarn.test.js`
 */
'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, beforeEach, mock, test } = require('node:test');

const { default: beforeBuild } = require('./before-build.js');

// The repository's own Yarn declaration: with Corepack, a fixture without one could run another Yarn than the one checked here.
const { packageManager } = require('../../package.json');
const shell = process.platform === 'win32';
const yarnVersion = spawnSync('yarn', ['--version'], { encoding: 'utf8', shell }).stdout || '';
const skip = yarnVersion.startsWith('1.') ? false : 'yarn 1 is not on PATH';

/** A CPU this machine is not, and what electron-builder hands the hook for this OS (a Platform object). */
const OTHER = process.arch === 'arm64' ? 'x64' : 'arm64';
const PLATFORM = { name: 'this-os', nodeName: process.platform, toString: () => 'this-os' };

let root;
let appDir;
// The hook prefers the yarn that runs it (npm_execpath, under `yarn test`): unset, so it runs the yarn on PATH this file checked.
let execPath;

function writePackage(dir, manifest) {
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '1.0.0', ...manifest }));
	fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = 1;\n');
}

beforeEach(() => {
	execPath = process.env.npm_execpath;
	delete process.env.npm_execpath;
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'before-build-yarn-'));
	appDir = path.join(root, 'app');
	writePackage(path.join(root, 'native-this'), { name: 'native-this', cpu: [process.arch] });
	writePackage(path.join(root, 'native-other'), { name: 'native-other', cpu: [OTHER] });
	writePackage(path.join(root, 'plain'), { name: 'plain' });
	writePackage(appDir, {
		name: 'app',
		...(packageManager ? { packageManager } : {}),
		dependencies: { plain: 'file:../plain' },
		optionalDependencies: { 'native-this': 'file:../native-this', 'native-other': 'file:../native-other' }
	});
	mock.method(console, 'log', () => {});
	mock.method(console, 'warn', () => {});
});

afterEach(() => {
	if (execPath !== undefined) process.env.npm_execpath = execPath;
	mock.restoreAll();
	fs.rmSync(root, { recursive: true, force: true });
});

const installed = (name) => fs.existsSync(path.join(appDir, 'node_modules', name, 'package.json'));

test('yarn 1 picks optional platform packages by the build machine CPU', { skip }, async () => {
	assert.equal(await beforeBuild({ appDir, electronVersion: '38.2.0', platform: PLATFORM, arch: process.arch }), true);

	assert.ok(installed('plain'));
	assert.ok(installed('native-this'));
	assert.equal(installed('native-other'), false);
});

test('a build for another CPU ends with the target CPU package only', { skip }, async () => {
	assert.equal(await beforeBuild({ appDir, electronVersion: '38.2.0', platform: PLATFORM, arch: OTHER }), true);

	assert.ok(installed('plain'));
	assert.ok(installed('native-other'), 'the target CPU package is installed');
	assert.equal(installed('native-this'), false, "the build machine's CPU package is removed");
});
