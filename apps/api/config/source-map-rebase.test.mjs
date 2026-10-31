// Cases for ./source-map-rebase.js and its use in ./webpack-package-copy-patterns.js (ever-co/ever-gauzy#9573).
// Run with `node --test apps/api/config/source-map-rebase.test.mjs`; it needs nothing but Node (no install, no build).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isRelativeSourcePath, rebaseSourceMap, sourceMapRebaseTransform } = require('./source-map-rebase.js');
const { getCopyPatterns } = require('./webpack-package-copy-patterns.js');

// A workspace laid out like this repository: compiled packages under dist/packages, the API's copies under
// dist/apps/api/node_modules/@gauzy.
const WORKSPACE = path.resolve(os.tmpdir(), 'gauzy-source-map-rebase-workspace');
const COMPILED = path.join(WORKSPACE, 'dist', 'packages', 'core');
const COPIED = path.join(WORKSPACE, 'dist', 'apps', 'api', 'node_modules', '@gauzy', 'core');
const BOOTSTRAP = path.join('src', 'lib', 'bootstrap');
const SOURCE = path.join(WORKSPACE, 'packages', 'core', 'src', 'lib', 'bootstrap', 'index.ts');

/** What `tsc` writes for packages/core/src/lib/bootstrap/index.ts. */
const TSC_MAP = {
	version: 3,
	file: 'index.js',
	sourceRoot: '',
	sources: ['../../../../../../packages/core/src/lib/bootstrap/index.ts'],
	names: [],
	mappings: ';;AAiBA,oCAQC'
};

/** Resolves every source of `map` the way debuggers and source-map-support do: against the map's directory. */
function resolveSources(map, mapDir) {
	return map.sources.map((source) => path.resolve(mapDir, map.sourceRoot ?? '', source));
}

describe('isRelativeSourcePath', () => {
	it('is true for paths relative to the map', () => {
		assert.equal(isRelativeSourcePath('../../src/index.ts'), true);
		assert.equal(isRelativeSourcePath('index.ts'), true);
		assert.equal(isRelativeSourcePath('./index.ts'), true);
	});

	it('is false for URLs, absolute paths, empty and non-string values', () => {
		for (const value of [
			'webpack:///./src/main.ts',
			'webpack://api/./src/main.ts',
			'file:///srv/gauzy/index.ts',
			'https://example.com/index.ts',
			'/srv/gauzy/packages/core/src/index.ts',
			'C:\\gauzy\\packages\\core\\src\\index.ts',
			'C:/gauzy/packages/core/src/index.ts',
			'',
			null,
			undefined,
			42
		]) {
			assert.equal(isRelativeSourcePath(value), false, String(value));
		}
	});
});

describe('rebaseSourceMap', () => {
	const fromDir = path.join(COMPILED, BOOTSTRAP);
	const toDir = path.join(COPIED, BOOTSTRAP);

	it('CONTROL: the map tsc wrote does not resolve to the source once copied into the API', () => {
		const [resolved] = resolveSources(TSC_MAP, toDir);
		assert.notEqual(resolved, SOURCE);
		assert.equal(
			resolved,
			path.join(WORKSPACE, 'dist', 'apps', 'api', 'packages', 'core', 'src', 'lib', 'bootstrap', 'index.ts')
		);
	});

	it('rewrites the sources so the copied map resolves to the same file as the original', () => {
		const rebased = JSON.parse(rebaseSourceMap(JSON.stringify(TSC_MAP), fromDir, toDir));
		assert.deepEqual(resolveSources(TSC_MAP, fromDir), [SOURCE]);
		assert.deepEqual(resolveSources(rebased, toDir), [SOURCE]);
		// Written with forward slashes on every platform, as the source map format expects.
		assert.equal(rebased.sources[0], '../../../../../../../../../packages/core/src/lib/bootstrap/index.ts');
	});

	it('keeps everything else in the map as it is', () => {
		const map = { ...TSC_MAP, names: ['bootstrap'], sourcesContent: ['export {}'], x_google_ignoreList: [] };
		const rebased = JSON.parse(rebaseSourceMap(JSON.stringify(map), fromDir, toDir));
		assert.deepEqual({ ...rebased, sources: map.sources }, map);
	});

	it('leaves URL and absolute sources alone and rebases only the relative ones', () => {
		const map = { ...TSC_MAP, sources: ['webpack:///./x.ts', '/abs/y.ts', null, ...TSC_MAP.sources] };
		const rebased = JSON.parse(rebaseSourceMap(JSON.stringify(map), fromDir, toDir));
		assert.deepEqual(rebased.sources.slice(0, 3), ['webpack:///./x.ts', '/abs/y.ts', null]);
		assert.equal(path.resolve(toDir, rebased.sources[3]), SOURCE);
	});

	it('folds a relative sourceRoot into the sources', () => {
		const map = {
			...TSC_MAP,
			sourceRoot: '../../../../../../packages/core/src',
			sources: ['lib/bootstrap/index.ts']
		};
		const rebased = JSON.parse(rebaseSourceMap(JSON.stringify(map), fromDir, toDir));
		assert.equal(rebased.sourceRoot, '');
		assert.deepEqual(resolveSources(rebased, toDir), [SOURCE]);
	});

	it('returns null when nothing has to change', () => {
		assert.equal(rebaseSourceMap(JSON.stringify(TSC_MAP), fromDir, fromDir), null);
		assert.equal(rebaseSourceMap(JSON.stringify({ ...TSC_MAP, sourceRoot: 'webpack:///' }), fromDir, toDir), null);
		assert.equal(
			rebaseSourceMap(JSON.stringify({ ...TSC_MAP, sources: ['webpack:///./x.ts'] }), fromDir, toDir),
			null
		);
	});

	it('returns null for content that is not a source map', () => {
		for (const content of ['', 'not json', '[]', 'null', '{"version":3}', '{"sources":"index.ts"}']) {
			assert.equal(rebaseSourceMap(content, fromDir, toDir), null, content);
		}
	});
});

describe('sourceMapRebaseTransform', () => {
	const transform = sourceMapRebaseTransform(COMPILED, COPIED);

	it('rebases a copied .map file for its place in the copy', () => {
		const content = Buffer.from(JSON.stringify(TSC_MAP));
		const out = transform(content, path.join(COMPILED, BOOTSTRAP, 'index.js.map'));
		assert.deepEqual(resolveSources(JSON.parse(out), path.join(COPIED, BOOTSTRAP)), [SOURCE]);
	});

	it('passes every other file through untouched (the same Buffer)', () => {
		const content = Buffer.from('//# sourceMappingURL=index.js.map');
		assert.equal(transform(content, path.join(COMPILED, BOOTSTRAP, 'index.js')), content);
	});

	it('never fails the build on a broken map: the content passes through', () => {
		const content = Buffer.from('{ broken');
		assert.equal(transform(content, path.join(COMPILED, BOOTSTRAP, 'index.js.map')), content);
	});
});

describe('getCopyPatterns', () => {
	const distPackages = path.join(WORKSPACE, 'dist', 'packages');
	const target = path.join(WORKSPACE, 'dist', 'apps', 'api', 'node_modules', '@gauzy');

	fs.rmSync(WORKSPACE, { recursive: true, force: true });
	fs.mkdirSync(path.join(COMPILED, BOOTSTRAP), { recursive: true });
	fs.writeFileSync(path.join(COMPILED, 'package.json'), JSON.stringify({ name: '@gauzy/core' }));
	// @gauzy/config, whose environment.js the build replaces with the requested environment.
	const configDir = path.join(distPackages, 'config');
	const environments = path.join(configDir, 'src', 'lib', 'environments');
	fs.mkdirSync(environments, { recursive: true });
	fs.writeFileSync(path.join(configDir, 'package.json'), JSON.stringify({ name: '@gauzy/config' }));
	fs.writeFileSync(
		path.join(environments, 'select-compiled-environment.js'),
		'exports.compiledEnvironmentContent = (_dir, environment) => `selected:${environment}`;'
	);

	after(() => fs.rmSync(WORKSPACE, { recursive: true, force: true }));

	/** Runs a pattern's transform, whether it is a function or a `{ transformer, cache }` object. */
	const run = (pattern, content, absoluteFrom) =>
		(typeof pattern.transform === 'function' ? pattern.transform : pattern.transform.transformer)(
			content,
			absoluteFrom
		);

	const patterns = getCopyPatterns(distPackages, target, { environment: 'production' });
	const core = patterns.find((pattern) => pattern.to === path.join(target, 'core'));
	const config = patterns.find((pattern) => pattern.to === path.join(target, 'config'));

	it('rebases the source maps of every copied package', () => {
		const out = run(core, Buffer.from(JSON.stringify(TSC_MAP)), path.join(COMPILED, BOOTSTRAP, 'index.js.map'));
		assert.deepEqual(resolveSources(JSON.parse(out), path.join(COPIED, BOOTSTRAP)), [SOURCE]);
	});

	it('caches the rebase per file content and directories (a watch rebuild does not redo it)', () => {
		assert.equal(typeof core.transform, 'object');
		assert.deepEqual(core.transform.cache, { keys: { rebaseFrom: COMPILED, rebaseTo: path.join(target, 'core') } });
	});

	it('still selects the @gauzy/config environment, uncached, and rebases its maps too', () => {
		assert.equal(typeof config.transform, 'function');
		assert.equal(
			String(run(config, Buffer.from('dev'), path.join(environments, 'environment.js'))),
			'selected:production'
		);

		const map = { ...TSC_MAP, sources: ['../../../../../../packages/config/src/lib/environments/environment.ts'] };
		const out = run(config, Buffer.from(JSON.stringify(map)), path.join(environments, 'environment.js.map'));
		const copiedDir = path.join(target, 'config', 'src', 'lib', 'environments');
		assert.deepEqual(resolveSources(JSON.parse(out), copiedDir), [
			path.join(WORKSPACE, 'packages', 'config', 'src', 'lib', 'environments', 'environment.ts')
		]);
	});

	it('copies @gauzy/config as compiled when no environment is requested, still rebasing its maps', () => {
		const plain = getCopyPatterns(distPackages, target).find(
			(pattern) => pattern.to === path.join(target, 'config')
		);
		const content = Buffer.from('dev');
		assert.equal(run(plain, content, path.join(environments, 'environment.js')), content);
	});
});
