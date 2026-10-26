'use strict';

// node --test .github/actions/set-mac-minimum-system-version/set-mac-minimum-system-version.test.cjs

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { compareVersions, ensureMinimumSystemVersion, resolveTarget } = require('./manifest.cjs');
const run = require('./index.cjs');

// Shape of what electron-builder 26 publishes for a two-arch mac build.
const MANIFEST = [
	'version: 111.136.7',
	'files:',
	'  - url: gauzy-desktop-timer-x64-111.136.7.zip',
	'    sha512: ZmFrZQ==',
	'    size: 189861577',
	'  - url: gauzy-desktop-timer-arm64-111.136.7.zip',
	'    sha512: ZmFrZQ==',
	'    size: 183544209',
	'path: gauzy-desktop-timer-x64-111.136.7.zip',
	'sha512: ZmFrZQ==',
	"releaseDate: '2026-10-24T18:02:41.123Z'",
	''
].join('\n');

test('compareVersions orders X.Y.Z numerically', () => {
	assert.ok(compareVersions('21.6.0', '22.0.0') < 0);
	assert.ok(compareVersions('22.0.0', '22.0.0') === 0);
	assert.ok(compareVersions('22.10.0', '22.9.9') > 0);
});

test('adds the key as the last top-level line and keeps every other byte', () => {
	const { text, changed, previous } = ensureMinimumSystemVersion(MANIFEST, '22.0.0');
	assert.equal(changed, true);
	assert.equal(previous, null);
	assert.equal(text, `${MANIFEST}minimumSystemVersion: 22.0.0\n`);
	assert.ok(text.startsWith(MANIFEST));
});

test('adds a line break first when the manifest does not end with one', () => {
	const { text } = ensureMinimumSystemVersion(MANIFEST.trimEnd(), '22.0.0');
	assert.equal(text, `${MANIFEST}minimumSystemVersion: 22.0.0\n`);
});

test('keeps CRLF line endings', () => {
	const crlf = MANIFEST.replace(/\n/g, '\r\n');
	const { text } = ensureMinimumSystemVersion(crlf, '22.0.0');
	assert.equal(text, `${crlf}minimumSystemVersion: 22.0.0\r\n`);
});

test('leaves a manifest that already requires at least the minimum untouched', () => {
	for (const value of ['22.0.0', '23.1.0', "'22.0.0'", '"24.0.0"', '22.0.0 # macOS 13']) {
		const input = `${MANIFEST}minimumSystemVersion: ${value}\n`;
		const result = ensureMinimumSystemVersion(input, '22.0.0');
		assert.equal(result.changed, false, value);
		assert.equal(result.text, input, value);
	}
});

test('raises a lower or unreadable value in place', () => {
	// '13.0' is the macOS-style value semver cannot read: electron-updater would only warn and update.
	for (const [value, previous] of [['21.0.0', '21.0.0'], ['13.0', '13.0'], ["'20.6.0'", '20.6.0']]) {
		const input = `version: 1.0.0\nminimumSystemVersion: ${value}\nfiles:\n  - url: a.zip\n`;
		const result = ensureMinimumSystemVersion(input, '22.0.0');
		assert.equal(result.changed, true, value);
		assert.equal(result.previous, previous, value);
		assert.equal(result.text, 'version: 1.0.0\nminimumSystemVersion: 22.0.0\nfiles:\n  - url: a.zip\n', value);
	}
});

test('raises a lower value in a CRLF manifest without dropping its CR', () => {
	const input = 'version: 1.0.0\r\nminimumSystemVersion: 21.0.0\r\nfiles:\r\n  - url: a.zip\r\n';
	const { text } = ensureMinimumSystemVersion(input, '22.0.0');
	assert.equal(text, 'version: 1.0.0\r\nminimumSystemVersion: 22.0.0\r\nfiles:\r\n  - url: a.zip\r\n');
});

test('an indented key is not the top-level one', () => {
	const input = `${MANIFEST}extra:\n  minimumSystemVersion: 30.0.0\n`;
	const { text, changed } = ensureMinimumSystemVersion(input, '22.0.0');
	assert.equal(changed, true);
	assert.equal(text, `${input}minimumSystemVersion: 22.0.0\n`);
});

test('refuses what it cannot edit safely', () => {
	assert.throws(() => ensureMinimumSystemVersion('<html>Not Found</html>', '22.0.0'), /update manifest/);
	assert.throws(() => ensureMinimumSystemVersion(`---\n${MANIFEST}`, '22.0.0'), /document marker/);
	assert.throws(
		() => ensureMinimumSystemVersion(`${MANIFEST}minimumSystemVersion: 22.0.0\nminimumSystemVersion: 21.0.0\n`, '22.0.0'),
		/2 times/
	);
	for (const minimum of ['13.0', '22', 'v22.0.0', '', undefined]) {
		assert.throws(() => ensureMinimumSystemVersion(MANIFEST, minimum), /X\.Y\.Z/, String(minimum));
	}
});

const PACKAGE = {
	version: '111.136.7',
	build: { publish: [{ provider: 'github', owner: 'ever-co', repo: 'ever-gauzy-desktop-timer', releaseType: 'prerelease' }] }
};

test('resolveTarget uses the gate tag and checks it against the published package', () => {
	const target = { owner: 'ever-co', repo: 'ever-gauzy-desktop-timer' };
	assert.deepEqual(resolveTarget({ ...target, tag: 'v111.136.7', appPackage: PACKAGE }), { ...target, tag: 'v111.136.7' });
	assert.deepEqual(resolveTarget({ ...target, tag: 'v111.136.7', appPackage: null }), { ...target, tag: 'v111.136.7' });
	assert.deepEqual(resolveTarget({ ...target, tag: '', appPackage: PACKAGE }), { ...target, tag: 'v111.136.7' });
	assert.deepEqual(resolveTarget({ owner: 'Ever-Co', repo: 'ever-gauzy-desktop-timer', tag: '', appPackage: PACKAGE }).tag, 'v111.136.7');
	assert.throws(() => resolveTarget({ ...target, tag: 'v111.136.8', appPackage: PACKAGE }), /not the one electron-builder published to/);
	assert.throws(() => resolveTarget({ ...target, repo: 'ever-gauzy-desktop', tag: '', appPackage: PACKAGE }), /ever-co\/ever-gauzy-desktop-timer/);
	assert.throws(() => resolveTarget({ ...target, tag: 'stage', appPackage: null }), /vX\.Y\.Z/);
	assert.throws(() => resolveTarget({ owner: '', repo: 'x', tag: 'v1.0.0', appPackage: null }), /required/);
	assert.ok(resolveTarget({ ...target, tag: '', appPackage: null }).skip);
});

/** A GitHub release repository in memory, behind the Octokit methods the action calls. */
function fakeGitHub({ releases, faults = [] }) {
	let nextId = 1000;
	const calls = [];
	const fail = (method) => {
		const index = faults.findIndex((fault) => fault.method === method);
		if (index !== -1) {
			const [fault] = faults.splice(index, 1);
			throw Object.assign(new Error(fault.message || `injected ${fault.status}`), { status: fault.status });
		}
	};
	const notFound = () => Object.assign(new Error('Not Found'), { status: 404 });
	const assetsOf = (id) => releases.find((release) => release.id === id).assets;
	const findAsset = (id) => {
		for (const release of releases) {
			const asset = release.assets.find((candidate) => candidate.id === id);
			if (asset) return { release, asset };
		}
		throw notFound();
	};
	const view = (asset) => ({ id: asset.id, name: asset.name, size: Buffer.byteLength(asset.content), content_type: asset.content_type });
	const method = (name, impl) => async (params) => {
		calls.push({ name, params });
		fail(name);
		return impl(params);
	};
	const repos = {
		getReleaseByTag: method('getReleaseByTag', ({ tag }) => {
			const release = releases.find((candidate) => candidate.tag_name === tag && !candidate.draft);
			if (!release) throw notFound();
			return { data: release };
		}),
		listReleases: method('listReleases', () => ({ data: releases })),
		listReleaseAssets: method('listReleaseAssets', ({ release_id }) => ({ data: assetsOf(release_id).map(view) })),
		getReleaseAsset: method('getReleaseAsset', ({ asset_id }) => {
			const bytes = Buffer.from(findAsset(asset_id).asset.content, 'utf8');
			return { data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
		}),
		uploadReleaseAsset: method('uploadReleaseAsset', ({ release_id, name, data, headers }) => {
			const assets = assetsOf(release_id);
			if (assets.some((asset) => asset.name === name)) throw Object.assign(new Error('already_exists'), { status: 422 });
			const asset = { id: nextId++, name, content: Buffer.from(data).toString('utf8'), content_type: headers['content-type'] };
			assets.push(asset);
			return { data: view(asset) };
		}),
		deleteReleaseAsset: method('deleteReleaseAsset', ({ asset_id }) => {
			const { release, asset } = findAsset(asset_id);
			release.assets.splice(release.assets.indexOf(asset), 1);
			return { data: null };
		}),
		updateReleaseAsset: method('updateReleaseAsset', ({ asset_id, name }) => {
			const { release, asset } = findAsset(asset_id);
			if (release.assets.some((other) => other !== asset && other.name === name)) {
				throw Object.assign(new Error('already_exists'), { status: 422 });
			}
			asset.name = name;
			return { data: view(asset) };
		})
	};
	return {
		calls,
		github: { rest: { repos }, paginate: async (fn, params) => (await fn(params)).data }
	};
}

function fakeCore() {
	const log = { info: [], notice: [] };
	return {
		log,
		info: (message) => log.info.push(message),
		notice: (message) => log.notice.push(message),
		startGroup: () => {},
		endGroup: () => {}
	};
}

const ENV = {
	RELEASE_OWNER: 'ever-co',
	RELEASE_REPO: 'ever-gauzy-desktop-timer',
	RELEASE_TAG: 'v111.136.7',
	APP_PACKAGE_JSON: '',
	MINIMUM_SYSTEM_VERSION: '22.0.0'
};

const releaseWith = (assets, extra = {}) => ({
	id: 7,
	tag_name: 'v111.136.7',
	draft: false,
	assets: assets.map((asset, index) => ({ id: index + 1, content_type: 'application/x-yaml', ...asset })),
	...extra
});

const WRITES = ['uploadReleaseAsset', 'deleteReleaseAsset', 'updateReleaseAsset'];

test('swaps in the edited manifest through a staged asset and verifies it', async () => {
	const release = releaseWith([{ name: 'gauzy-desktop-timer-x64-111.136.7.dmg', content: 'dmg' }, { name: 'latest-mac.yml', content: MANIFEST }]);
	const { github, calls } = fakeGitHub({ releases: [release] });
	const core = fakeCore();
	const sleeps = [];
	const result = await run({ github, core, env: ENV, sleep: async (ms) => sleeps.push(ms) });

	assert.equal(result.changed, true);
	assert.deepEqual(release.assets.map((asset) => asset.name), ['gauzy-desktop-timer-x64-111.136.7.dmg', 'latest-mac.yml']);
	const manifest = release.assets.find((asset) => asset.name === 'latest-mac.yml');
	assert.equal(manifest.content, `${MANIFEST}minimumSystemVersion: 22.0.0\n`);
	assert.equal(manifest.content_type, 'application/x-yaml');
	assert.deepEqual(
		calls.filter((call) => WRITES.includes(call.name)).map((call) => [call.name, call.params.name ?? call.params.asset_id]),
		[['uploadReleaseAsset', 'latest-mac.yml.staged'], ['deleteReleaseAsset', 2], ['updateReleaseAsset', 'latest-mac.yml']]
	);
	assert.deepEqual(sleeps, []);
	assert.match(core.log.notice.join('\n'), /now declares 'minimumSystemVersion: 22\.0\.0'/);
});

test('changes nothing when the manifest already declares the minimum', async () => {
	const release = releaseWith([{ name: 'latest-mac.yml', content: `${MANIFEST}minimumSystemVersion: 22.0.0\n` }]);
	const { github, calls } = fakeGitHub({ releases: [release] });
	const result = await run({ github, core: fakeCore(), env: ENV, sleep: async () => {} });
	assert.equal(result.changed, false);
	assert.deepEqual(calls.filter((call) => WRITES.includes(call.name)), []);
});

test('retries transient errors at every step', async () => {
	const release = releaseWith([{ name: 'latest-mac.yml', content: MANIFEST }]);
	const faults = ['getReleaseByTag', 'listReleaseAssets', 'getReleaseAsset', 'deleteReleaseAsset'].map((method, index) => ({
		method,
		status: [502, 503, 500, 429][index]
	}));
	const { github } = fakeGitHub({ releases: [release], faults });
	const sleeps = [];
	const result = await run({ github, core: fakeCore(), env: ENV, sleep: async (ms) => sleeps.push(ms) });
	assert.equal(result.changed, true);
	assert.equal(sleeps.length, 4);
	assert.deepEqual(release.assets.map((asset) => asset.name), ['latest-mac.yml']);
	assert.equal(release.assets[0].content, `${MANIFEST}minimumSystemVersion: 22.0.0\n`);
});

test('completes a swap interrupted after the original was deleted', async () => {
	const release = releaseWith([{ name: 'latest-mac.yml', content: MANIFEST }]);
	// The rename fails once: the next pass finds only the staged asset and finishes the swap.
	const { github } = fakeGitHub({ releases: [release], faults: [{ method: 'updateReleaseAsset', status: 502 }] });
	const result = await run({ github, core: fakeCore(), env: ENV, sleep: async () => {} });
	assert.equal(result.changed, true);
	assert.deepEqual(release.assets.map((asset) => asset.name), ['latest-mac.yml']);
	assert.equal(release.assets[0].content, `${MANIFEST}minimumSystemVersion: 22.0.0\n`);
});

test('replaces a stale staged asset left by an earlier run', async () => {
	const release = releaseWith([
		{ name: 'latest-mac.yml', content: MANIFEST },
		{ name: 'latest-mac.yml.staged', content: 'stale' }
	]);
	const { github } = fakeGitHub({ releases: [release] });
	await run({ github, core: fakeCore(), env: ENV, sleep: async () => {} });
	assert.deepEqual(release.assets.map((asset) => asset.name), ['latest-mac.yml']);
	assert.equal(release.assets[0].content, `${MANIFEST}minimumSystemVersion: 22.0.0\n`);
});

test('fails fast on a token problem', async () => {
	const release = releaseWith([{ name: 'latest-mac.yml', content: MANIFEST }]);
	const { github } = fakeGitHub({ releases: [release], faults: [{ method: 'getReleaseByTag', status: 401, message: 'Bad credentials' }] });
	const sleeps = [];
	await assert.rejects(run({ github, core: fakeCore(), env: ENV, sleep: async (ms) => sleeps.push(ms) }), /Bad credentials/);
	assert.deepEqual(sleeps, []);
});

test('fails when the release has no latest-mac.yml after the retries', async () => {
	const release = releaseWith([{ name: 'gauzy-desktop-timer-x64-111.136.7.dmg', content: 'dmg' }]);
	const { github } = fakeGitHub({ releases: [release] });
	const sleeps = [];
	await assert.rejects(run({ github, core: fakeCore(), env: ENV, sleep: async (ms) => sleeps.push(ms) }), /latest-mac\.yml is not among/);
	assert.equal(sleeps.length, 4);
});

test('fails without retrying on a manifest it cannot edit', async () => {
	const release = releaseWith([{ name: 'latest-mac.yml', content: '<html>Not Found</html>' }]);
	const { github } = fakeGitHub({ releases: [release] });
	const sleeps = [];
	await assert.rejects(run({ github, core: fakeCore(), env: ENV, sleep: async (ms) => sleeps.push(ms) }), /update manifest/);
	assert.deepEqual(sleeps, []);
});

test('finds a draft or bare-version release through the release list', async () => {
	const release = releaseWith([{ name: 'latest-mac.yml', content: MANIFEST }], { tag_name: '111.136.7', draft: true });
	const { github } = fakeGitHub({ releases: [release] });
	const result = await run({ github, core: fakeCore(), env: ENV, sleep: async () => {} });
	assert.equal(result.changed, true);
});

test('derives the tag from the app package when the gate resolved none (temp pushes publish too)', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mac-min-os-test-'));
	try {
		const packageJson = path.join(dir, 'package.json');
		fs.writeFileSync(packageJson, JSON.stringify(PACKAGE));
		const release = releaseWith([{ name: 'latest-mac.yml', content: MANIFEST }]);
		const { github } = fakeGitHub({ releases: [release] });
		const result = await run({ github, core: fakeCore(), env: { ...ENV, RELEASE_TAG: '', APP_PACKAGE_JSON: packageJson }, sleep: async () => {} });
		assert.equal(result.changed, true);
		assert.equal(release.assets[0].content, `${MANIFEST}minimumSystemVersion: 22.0.0\n`);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test('skips with a notice when nothing names a release', async () => {
	const { github, calls } = fakeGitHub({ releases: [] });
	const core = fakeCore();
	const result = await run({ github, core, env: { ...ENV, RELEASE_TAG: '' }, sleep: async () => {} });
	assert.deepEqual(result, { skipped: true });
	assert.deepEqual(calls, []);
	assert.equal(core.log.notice.length, 1);
});
