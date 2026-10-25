/**
 * Cases for tools/electron/patches: the app-builder-lib patch that `postinstall.electron` applies before any desktop
 * app is packaged.
 *
 * Why the patch existed: electron-builder 26.15.3 built the x64 snap from its template (`buildWithTemplate` in
 * app-builder-lib/out/targets/snap/coreLegacy.js) and, before running mksquashfs, deleted `chrome-sandbox` from
 * `linux-unpacked` - the directory every other Linux target packs from at the same time (snap, tar.gz, AppImage and
 * flatpak build concurrently, deb and rpm after them). When the delete lands while the AppImage target is copying
 * that directory, the copy fails and the job with it ("failed to build AppImage error=ENOENT ... copyfile
 * '.../linux-unpacked/chrome-sandbox' -> '.../__appImage-x64/chrome-sandbox'", API Server stage-apps run 40090832195,
 * both attempts). When the AppImage copy wins the race, the deb and rpm are still packed afterwards from a directory
 * without chrome-sandbox. The mksquashfs argument list already filters chrome-sandbox out of the snap, so the delete
 * buys nothing; electron-builder 26.18.0 removed it upstream for this reason. The patch removed it from 26.15.3.
 *
 * Since electron-builder 26.18.0 (app-builder-lib 26.18.0) the patch is retired: patch-package with --error-on-fail
 * would fail every desktop build on a patch made for a version that is no longer installed, so from that version on
 * these cases check that no app-builder-lib patch is left behind. The patch-package step and its directory stay (the
 * step prints "No patch files found" and succeeds) for the next electron-only patch, and the version check still
 * applies if app-builder-lib is ever pinned below 26.18.0 again.
 *
 * It lives in its own patch directory, not in patches/: `postinstall.manual` applies patches/ in the API and worker
 * images' production-dependency stages too (.deploy/{api,worker}/Dockerfile), where electron-builder (a
 * devDependency) and so app-builder-lib are not installed, and their `ENV CI=true` makes patch-package exit 1 on a
 * patch for a package that is not there - the image build would fail.
 *
 * Nothing here needs node_modules: the static checks job runs without an install.
 *
 * Run: `node --test tools/electron/app-builder-lib-patch.test.js`
 *
 * cspell:words mksquashfs copyfile
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const PATCH_DIR = path.join('tools', 'electron', 'patches');
const PATCHED_FILE = 'node_modules/app-builder-lib/out/targets/snap/coreLegacy.js';
/** The first electron-builder release whose coreLegacy.js filters chrome-sandbox instead of deleting it. */
const FIXED_UPSTREAM = '26.18.0';
/** The only lines the patch removes (trimmed): the snap template's delete of chrome-sandbox and its comment. */
const INTENDED_REMOVAL = [
	'// Best-effort: remove chrome-sandbox from app dir before mksquashfs scans it.',
	'await (0, promises_1.rm)(path.join(appOutDir, "chrome-sandbox"), { force: true });'
];

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

/** The app-builder-lib patch files in the electron patch directory, with the version each is made for. */
function appBuilderLibPatches() {
	const dir = path.join(ROOT, PATCH_DIR);
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir)
		.map((name) => ({ name, match: /^app-builder-lib\+(\d+\.\d+\.\d+)\.patch$/.exec(name) }))
		.filter((entry) => entry.match)
		.map((entry) => ({ name: entry.name, version: entry.match[1] }));
}

/** The single app-builder-lib patch; fails when there is none or more than one. */
function thePatch() {
	const patches = appBuilderLibPatches();
	assert.equal(patches.length, 1, `expected one app-builder-lib patch in ${PATCH_DIR}, found ${patches.length}`);
	const [patch] = patches;
	return { ...patch, text: read(path.join(PATCH_DIR, patch.name)) };
}

/** The files a git-format patch changes, and its removed and added lines (without the leading -/+). */
function parse(text) {
	const lines = text.split(/\r?\n/);
	const files = lines
		.map((line) => /^diff --git a\/(\S+) b\/(\S+)$/.exec(line))
		.filter(Boolean)
		.map((match) => {
			assert.equal(match[1], match[2], 'the patch renames a file');
			return match[1];
		});
	const changed = (sign, header) =>
		lines.filter((line) => line.startsWith(sign) && !line.startsWith(header)).map((line) => line.slice(1));
	return { files, removed: changed('-', '---'), added: changed('+', '+++') };
}

/** Every version yarn.lock resolves app-builder-lib to. */
function lockedAppBuilderLibVersions() {
	const lock = read('yarn.lock');
	const versions = new Set();
	const entry = /^"?app-builder-lib@[^\n]*:\r?\n\s+version "([^"]+)"/gm;
	let match;
	while ((match = entry.exec(lock)) !== null) versions.add(match[1]);
	return [...versions];
}

/** Numeric x.y.z comparison: negative when a < b. */
function compareVersions(a, b) {
	const [left, right] = [a, b].map((version) => version.split('.').map(Number));
	for (let i = 0; i < 3; i++) {
		if (left[i] !== right[i]) return left[i] - right[i];
	}
	return 0;
}

/** Whether the locked app-builder-lib already filters chrome-sandbox instead of deleting it. */
function fixedUpstream() {
	const locked = lockedAppBuilderLibVersions();
	assert.equal(locked.length, 1, `yarn.lock resolves app-builder-lib to ${locked.length} versions: ${locked}`);
	return compareVersions(locked[0], FIXED_UPSTREAM) >= 0;
}

test('the patch is made for the app-builder-lib the lockfile installs, and is gone once upstream fixed it', () => {
	const [version] = lockedAppBuilderLibVersions();
	if (fixedUpstream()) {
		const stale = appBuilderLibPatches().map((entry) => entry.name);
		assert.deepEqual(
			stale,
			[],
			`yarn.lock installs app-builder-lib ${version}, which no longer deletes chrome-sandbox (fixed upstream in ` +
				`${FIXED_UPSTREAM}): ${stale.join(', ')} in ${PATCH_DIR} no longer applies and patch-package ` +
				'--error-on-fail would fail every desktop build. Delete it.'
		);
		return;
	}
	const patch = thePatch();
	assert.equal(
		patch.version,
		version,
		`${patch.name} is made for app-builder-lib ${patch.version} but yarn.lock installs ${version}: ` +
			`patch-package fails every desktop build on CI until the patch is regenerated for ${version} ` +
			`(or removed, from ${FIXED_UPSTREAM} on).`
	);
});

test('the patch only stops the snap target deleting chrome-sandbox from the shared app directory', (t) => {
	if (fixedUpstream()) {
		t.skip(`app-builder-lib ${FIXED_UPSTREAM}+ is installed: there is no patch to check`);
		return;
	}
	const { files, removed, added } = parse(thePatch().text);

	assert.deepEqual(files, [PATCHED_FILE]);
	// Exactly these lines: the mksquashfs filter a few lines below names "chrome-sandbox" too, and removing it would
	// put the setuid helper into the snap.
	assert.deepEqual(
		removed.map((line) => line.trim()),
		INTENDED_REMOVAL,
		`the patch must remove the chrome-sandbox delete and its comment, and nothing else: ${removed.join(' | ')}`
	);
	assert.ok(
		added.every((line) => line.trim() === '' || line.trim().startsWith('//')),
		`the patch adds code, not only a comment: ${added.join(' | ')}`
	);
});

test('postinstall.electron applies the electron patches, failing if one does not apply, before packaging', () => {
	const script = JSON.parse(read('package.json')).scripts['postinstall.electron'];
	const patchStep = script
		.split('&&')
		.map((command) => command.trim())
		.find((command) => command.startsWith('patch-package '));
	const patchDir = `--patch-dir ${PATCH_DIR.split(path.sep).join('/')}`;

	assert.ok(patchStep, `postinstall.electron does not run patch-package: ${script}`);
	assert.ok(patchStep.includes(patchDir), `postinstall.electron's patch-package lacks "${patchDir}": ${script}`);
	// Without it patch-package exits 0 on a patch that does not apply (outside CI), and the && chain packages the
	// Linux targets with the original delete.
	assert.ok(
		patchStep.split(/\s+/).includes('--error-on-fail'),
		`postinstall.electron's patch-package lacks --error-on-fail: ${script}`
	);
	assert.ok(
		script.indexOf(patchStep) < script.indexOf('electron-builder'),
		`postinstall.electron runs electron-builder before applying the patch: ${script}`
	);
});

test('no app-builder-lib patch sits in patches/, which the API and worker production-dependency stages apply', () => {
	const stray = fs.readdirSync(path.join(ROOT, 'patches')).filter((name) => name.startsWith('app-builder-lib+'));

	assert.deepEqual(
		stray,
		[],
		`patches/ holds ${stray.join(', ')}: the API and worker images install production dependencies only ` +
			`(no app-builder-lib) and run patch-package with CI=true, so their builds fail. Keep it in ${PATCH_DIR}.`
	);
});
