/**
 * Cases for runtime-dependency-check.mjs: the import reader and the rule that decides whether an image holds a
 * package. Run: `node --test tools/scripts/runtime-dependency-check.test.mjs`
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	packageOf,
	parseLockfile,
	productionWorkspaces,
	runtimeImports,
	whyMissing
} from './runtime-dependency-check.mjs';

test('value imports, re-exports, side-effect imports, require and import() are read', () => {
	const source = [
		"import * as chalk from 'chalk';",
		"import { rimraf } from 'rimraf';",
		"import Default, { named } from 'default-and-named';",
		"export { thing } from 'reexported/deep/path';",
		"export * from '@scope/star';",
		"import 'side-effect';",
		"const lazy = require('required');",
		"const later = await import('@scope/dynamic/sub');",
		'import {',
		'\tmultiLine,',
		'\tother',
		"} from 'multi-line';"
	].join('\n');

	assert.deepEqual(runtimeImports(source).sort(), [
		'@scope/dynamic',
		'@scope/star',
		'chalk',
		'default-and-named',
		'multi-line',
		'reexported',
		'required',
		'rimraf',
		'side-effect'
	]);
});

test('type-only imports, comments, built-ins and relative paths are not runtime imports', () => {
	const source = [
		"import type { A } from 'type-only';",
		"export type { B } from 'type-reexport';",
		"import { type C, type D } from 'all-specifiers-type';",
		"import { type E, F } from 'one-value-specifier';",
		"// import x from 'line-comment';",
		"/* require('block-comment') */",
		'/**',
		" * import y from 'doc-comment';",
		' */',
		"import * as fs from 'fs';",
		"import { join } from 'node:path';",
		"import { local } from './local';",
		"const url = 'https://example.com/require(\\'not-code\\')';"
	].join('\n');

	assert.deepEqual(runtimeImports(source), ['one-value-specifier']);
});

test('a scoped package is named by its first two segments', () => {
	assert.equal(packageOf('@opentelemetry/instrumentation-http/build/src'), '@opentelemetry/instrumentation-http');
	assert.equal(packageOf('lodash/fp'), 'lodash');
	assert.equal(packageOf('./x'), null);
	assert.equal(packageOf('node:fs'), null);
});

test('the lockfile parser reads every header range, the version and the dependencies', () => {
	const lock = parseLockfile(
		[
			'# yarn lockfile v1',
			'',
			'"glob@^7.1.3", glob@^7.2.0:',
			'  version "7.2.3"',
			'  resolved "https://registry.yarnpkg.com/glob/-/glob-7.2.3.tgz"',
			'  dependencies:',
			'    "fs.realpath" "^1.0.0"',
			'    minimatch "^3.1.1"',
			'',
			'rimraf@^3.0.2:',
			'  version "3.0.2"',
			'  dependencies:',
			'    glob "^7.1.3"',
			''
		].join('\n')
	);

	assert.equal(lock.get('glob@^7.1.3').version, '7.2.3');
	assert.equal(lock.get('glob@^7.2.0'), lock.get('glob@^7.1.3'));
	assert.deepEqual(lock.get('glob@^7.1.3').dependencies, [
		['fs.realpath', '^1.0.0'],
		['minimatch', '^3.1.1']
	]);
	assert.deepEqual(lock.get('rimraf@^3.0.2').dependencies, [['glob', '^7.1.3']]);
});

test('the installed workspaces are the manifests the prod-dependencies stage copies', () => {
	const dockerfile = [
		'FROM node:26 AS dependencies',
		'COPY --chown=node:node packages/not-this/package.json ./packages/not-this/',
		'FROM node:26 AS prod-dependencies',
		'COPY --chown=node:node apps/api/package.json ./apps/api/',
		'COPY --chown=node:node packages/plugins/cart/package.json ./packages/plugins/cart/',
		'COPY --chown=node:node decorate-angular-cli.js lerna.json package.json yarn.lock ./',
		'FROM node:26 AS production'
	].join('\n');

	assert.deepEqual(productionWorkspaces(dockerfile), ['apps/api', 'packages/plugins/cart']);
	assert.throws(() => productionWorkspaces('FROM node:26 AS build\n'), /prod-dependencies/);
});

const lock = parseLockfile(
	[
		'rimraf@^3.0.2:',
		'  version "3.0.2"',
		'rimraf@^6.1.3:',
		'  version "6.1.3"',
		'"@nestjs/graphql@^14.0.3":',
		'  version "14.0.3"',
		'qs@^6.14.0, qs@^6.16.0:',
		'  version "6.16.0"',
		''
	].join('\n')
);

test('the rimraf failure: a devDependency at the root and in the importer is not in the image', () => {
	const root = { devDependencies: { rimraf: '^6.1.3' } };
	const core = { name: '@gauzy/core', devDependencies: { rimraf: '^6.1.3' } };

	assert.match(whyMissing('rimraf', core, root, [core], lock), /declared only as devDependencies/);
});

test('the fix: the importer declares it as a dependency', () => {
	const root = { devDependencies: { rimraf: '^6.1.3' } };
	const core = { name: '@gauzy/core', dependencies: { rimraf: '^6.1.3' } };

	assert.equal(whyMissing('rimraf', core, root, [core], lock), null);
});

test('a dependency the root declares is the root copy', () => {
	const root = { dependencies: { qs: '^6.16.0' } };
	const plugin = { name: '@gauzy/plugin-x' };

	assert.equal(whyMissing('qs', plugin, root, [plugin], lock), null);
});

test("another workspace's dependency is found when every installed declaration is one version", () => {
	const root = { devDependencies: { '@nestjs/graphql': '^14.0.3' } };
	const core = { name: '@gauzy/core', dependencies: { '@nestjs/graphql': '^14.0.3' } };
	const plugin = { name: '@gauzy/plugin-tax', peerDependencies: { '@nestjs/graphql': '^13.0.0 || ^14.0.0' } };

	assert.equal(whyMissing('@nestjs/graphql', plugin, root, [core, plugin], lock), null);
});

test("another workspace's dependency is refused when a devDependency of another version can claim the root", () => {
	const root = { devDependencies: { rimraf: '^6.1.3' } };
	const other = { name: '@gauzy/other', dependencies: { rimraf: '^3.0.2' } };
	const core = { name: '@gauzy/core' };

	assert.match(whyMissing('rimraf', core, root, [other, core], lock), /declared at 2 versions/);
});

test('a package that only arrives through another package is refused', () => {
	const root = {};
	const plugin = { name: '@gauzy/plugin-integration-ai' };

	assert.match(whyMissing('qs', plugin, root, [plugin], lock), /declared by no manifest the image installs/);
});

test('a loaded workspace whose manifest the image does not install cannot vouch for its own dependency', () => {
	const root = {};
	const core = { name: '@gauzy/core' };
	const cart = { name: '@gauzy/plugin-cart', dependencies: { qs: '^6.16.0' } };

	// The worker loads plugin-cart (copied by webpack) without installing its manifest.
	assert.match(whyMissing('qs', null, root, [core], lock), /declared by no manifest the image installs/);
	assert.equal(whyMissing('qs', cart, root, [core, cart], lock), null);
});
