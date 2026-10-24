/**
 * Cases for before-build.js: the packaged app's production install and its one retry against the public registry.
 * `spawnSync` is stubbed, so nothing is installed and no network is used.
 *
 * Run: `node --test tools/electron/before-build.test.js`
 */
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, beforeEach, mock, test } = require('node:test');

const PUBLIC_REGISTRY = 'https://registry.yarnpkg.com';

// before-build.js takes `spawnSync` when it loads, so the stub goes in first; each test sets what it answers.
const calls = [];
let answer = () => ({ status: 0 });
childProcess.spawnSync = (command, args, options) => {
	calls.push({ command, args, options });
	return answer(calls.length);
};
const { default: beforeBuild } = require('./before-build.js');

const BUILD = { electronVersion: '38.2.0', platform: process.platform, arch: 'x64' };
let appDir;
let logged;

beforeEach(() => {
	calls.length = 0;
	appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'before-build-test-'));
	logged = [];
	// The fallback's warning is an annotation on GitHub Actions: keep it out of this run's own summary.
	mock.method(console, 'log', (...line) => logged.push(line.join(' ')));
	mock.method(console, 'warn', (...line) => logged.push(line.join(' ')));
});

afterEach(() => {
	mock.restoreAll();
	fs.rmSync(appDir, { recursive: true, force: true });
});

/** The install the app's build would run, with the electron-builder context it is given. */
const run = () => beforeBuild({ appDir, ...BUILD });
const usesPublicRegistry = (call) => call.args.includes('--registry');

/** Each install runs in the app's directory with the environment that builds native modules for Electron. */
function assertElectronInstall(call) {
	assert.equal(call.options.cwd, appDir);
	assert.ok(call.args.includes('install') && call.args.includes('--production'));
	assert.equal(call.options.env.npm_config_runtime, 'electron');
	assert.equal(call.options.env.npm_config_target, BUILD.electronVersion);
	assert.equal(call.options.env.npm_config_arch, 'x64');
}

test('an install that succeeds runs once, against the configured registry', async () => {
	answer = () => ({ status: 0 });

	assert.equal(await run(), true);

	assert.equal(calls.length, 1);
	assertElectronInstall(calls[0]);
	assert.equal(usesPublicRegistry(calls[0]), false);
	assert.equal(logged.some((line) => line.includes('retrying')), false);
});

test('a failed install is retried once against the public registry, with a warning', async () => {
	answer = (attempt) => ({ status: attempt === 1 ? 1 : 0 });

	assert.equal(await run(), true);

	assert.equal(calls.length, 2);
	calls.forEach(assertElectronInstall);
	assert.equal(usesPublicRegistry(calls[0]), false);
	assert.deepEqual(calls[1].args.slice(-2), ['--registry', PUBLIC_REGISTRY]);
	assert.deepEqual(calls[1].args.slice(0, -2), calls[0].args);
	assert.ok(logged.some((line) => line.includes(`retrying once against ${PUBLIC_REGISTRY}`)));
});

test('two failed installs fail the build', async () => {
	answer = () => ({ status: 1 });

	await assert.rejects(run, /Installing the production dependencies of .* failed \(exit code 1\)/);

	assert.equal(calls.length, 2);
	assert.deepEqual(calls[1].args.slice(-2), ['--registry', PUBLIC_REGISTRY]);
});

test('a package manager that cannot be started fails the build without a retry', async () => {
	answer = () => ({ status: null, error: new Error('spawn yarn ENOENT') });

	await assert.rejects(run, /spawn yarn ENOENT/);

	assert.equal(calls.length, 1);
});

test('an app directory that already has its node_modules installs nothing', async () => {
	fs.mkdirSync(path.join(appDir, 'node_modules'));

	assert.equal(await run(), true);

	assert.equal(calls.length, 0);
});
