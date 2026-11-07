#!/usr/bin/env node
/*
 * Every plugin an app image depends on has its package.json copied into that image's dependency stages.
 *
 * `.deploy/api/Dockerfile` and `.deploy/worker/Dockerfile` install with `yarn install --frozen-lockfile` after
 * copying each workspace package's package.json by hand. A plugin that `apps/<app>/package.json` depends on but
 * the Dockerfile does not copy is looked up on npm instead, and the image build stops:
 *
 *   Couldn't find package "@gauzy/plugin-chat@^0.1.0" required by "@gauzy/api@0.1.0" on the "npm" registry.
 *
 * That broke the demo images twice on 2026-11-07 (chat, realtime and integration-linear, then integration-asana),
 * each time only after the merge, because no pull request check builds the images. This check finds it in
 * seconds: for each app, every `@gauzy/plugin-*` it depends on must have a
 * `COPY ... packages/plugins/<dir>/package.json ...` line in each of the Dockerfile's dependency stages (every
 * stage that copies `apps/<app>/package.json`). That includes the plugins those plugins depend on, at any depth:
 * `@gauzy/plugin-chat` came to need `@gauzy/plugin-search`, which the worker image did not copy (develop `4494d2f`).
 *
 * Usage:
 *   node tools/scripts/docker-plugin-copy-check.mjs [repoRoot]
 *   node tools/scripts/docker-plugin-copy-check.mjs --self-test
 *
 * Exits 0 when every dependency is copied, 1 otherwise.
 */
'use strict';

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT =
	process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : resolve(HERE, '..', '..');
const APPS = ['api', 'worker'];

/** `{ packageName: dir }` of every package under packages/plugins. */
function pluginDirs() {
	const out = new Map();
	const base = join(ROOT, 'packages', 'plugins');
	for (const dir of readdirSync(base, { withFileTypes: true })) {
		if (!dir.isDirectory()) continue;
		const file = join(base, dir.name, 'package.json');
		if (!existsSync(file)) continue;
		const name = JSON.parse(readFileSync(file, 'utf8')).name;
		if (name) out.set(name, dir.name);
	}
	return out;
}

/** The plugin dependencies (`dependencies` and `peerDependencies`) of the plugin `name`, read from its package.json. */
function pluginDepsOf(plugins) {
	const cache = new Map();
	return (name) => {
		if (!cache.has(name)) {
			const dir = plugins.get(name);
			if (!dir) throw new Error(`${name} is not a package under packages/plugins`);
			const pkg = JSON.parse(readFileSync(join(ROOT, 'packages', 'plugins', dir, 'package.json'), 'utf8'));
			cache.set(
				name,
				Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).filter((n) => plugins.has(n))
			);
		}
		return cache.get(name);
	};
}

/** `deps` and every plugin they depend on, at any depth. */
export function withPluginDeps(deps, depsOf) {
	const seen = new Set();
	const stack = [...deps];
	while (stack.length) {
		const name = stack.pop();
		if (seen.has(name)) continue;
		seen.add(name);
		stack.push(...depsOf(name));
	}
	return [...seen];
}

/** The Dockerfile split into stages (`FROM ...` up to the next `FROM`). */
function stages(text) {
	return text.split(/^(?=FROM\s)/im);
}

/**
 * A stage's instructions, one string each. A line ending in `\` continues on the next one, and comment lines,
 * inside a continuation too, are dropped, as Docker does.
 */
function instructions(stage) {
	const out = [];
	let current = '';
	for (const raw of stage.split(/\r?\n/)) {
		const line = raw.trim();
		if (line.startsWith('#')) continue;
		const continued = line.endsWith('\\');
		const part = continued ? line.slice(0, -1).trim() : line;
		current = current ? `${current} ${part}` : part;
		if (!continued) {
			if (current) out.push(current);
			current = '';
		}
	}
	if (current) out.push(current);
	return out;
}

/**
 * The source paths of a stage's active `COPY` instructions, without `./`. A commented-out `COPY`, or a path named
 * in a comment or a `RUN` argument, copies nothing and does not count. Flags (`--chown=...`, `--from=...`) are
 * skipped, both the shell form and the JSON form (`COPY ["src", "dest"]`) are read, and the last argument is the
 * destination.
 */
export function copiedSources(stage) {
	const out = new Set();
	for (const instruction of instructions(stage)) {
		const match = /^COPY\s+(.+)$/i.exec(instruction);
		if (!match) continue;
		const args = match[1].replace(/^(?:--\S+\s+)*/, '').trim();
		let paths = [];
		if (args.startsWith('[')) {
			try {
				const parsed = JSON.parse(args);
				if (Array.isArray(parsed)) paths = parsed.map(String);
			} catch {
				paths = [];
			}
		} else {
			paths = args.split(/\s+/);
		}
		for (const src of paths.slice(0, -1)) out.add(src.replace(/^\.\//, ''));
	}
	return out;
}

/**
 * Problems for one app: its dependency stages are those that copy `apps/<app>/package.json`. In each, yarn installs
 * every workspace whose package.json is there, so with `depsOf` the plugins a stage copies need their own plugin
 * dependencies copied too, not only the app's (the worker image copied chat, which needs search, without search).
 */
export function check(dockerfileText, app, deps, plugins, label = `.deploy/${app}/Dockerfile`, depsOf = null) {
	const problems = [];
	const manifest = (name) => `packages/plugins/${plugins.get(name)}/package.json`;
	const installStages = stages(dockerfileText)
		.map(copiedSources)
		.filter((copied) => copied.has(`apps/${app}/package.json`));
	if (installStages.length === 0) {
		problems.push(
			`${label}: no stage copies apps/${app}/package.json, so this check cannot tell the dependency stages`
		);
		return { problems, stages: 0 };
	}
	installStages.forEach((copied, i) => {
		const copiedPlugins = [...plugins.keys()].filter((n) => copied.has(manifest(n)));
		const required = depsOf ? withPluginDeps([...deps, ...copiedPlugins], depsOf) : deps;
		for (const name of required.filter((n) => !copied.has(manifest(n)))) {
			const dir = plugins.get(name);
			const why = deps.includes(name)
				? `apps/${app} depends on ${name}`
				: `a plugin this stage installs depends on ${name}`;
			problems.push(
				`${label} (dependency stage ${i + 1} of ${installStages.length}): ${why} but the stage does not copy it:\n` +
					`    COPY --chown=node:node packages/plugins/${dir}/package.json ./packages/plugins/${dir}/`
			);
		}
	});
	return { problems, stages: installStages.length };
}

/** `--self-test`: the cases a substring search got wrong fail, a real copy passes. */
function selfTest() {
	const plugins = new Map([['@gauzy/plugin-a', 'a']]);
	const deps = ['@gauzy/plugin-a'];
	const head = 'FROM node AS deps\nCOPY --chown=node:node apps/api/package.json ./apps/api/\n';
	const cases = [
		['a real copy', head + 'COPY --chown=node:node packages/plugins/a/package.json ./packages/plugins/a/\n', 0],
		[
			'a commented-out copy',
			head + '# COPY --chown=node:node packages/plugins/a/package.json ./packages/plugins/a/\n',
			1
		],
		['the path in a RUN argument', head + 'RUN cat packages/plugins/a/package.json\n', 1],
		['the app manifest only in a comment', 'FROM node AS deps\n# apps/api/package.json\n', 1],
		[
			'a copy continued over lines, with a comment inside',
			head +
				'COPY --chown=node:node \\\n  # a comment\n  packages/plugins/a/package.json \\\n  ./packages/plugins/a/\n',
			0
		],
		['a copy in JSON form', head + 'COPY ["packages/plugins/a/package.json", "./packages/plugins/a/"]\n', 0],
		[
			'a JSON-form copy of another plugin',
			head + 'COPY ["packages/plugins/b/package.json", "./packages/plugins/b/"]\n',
			1
		]
	];
	let failed = 0;
	for (const [name, text, want] of cases) {
		const got = check(text, 'api', deps, plugins, 'fixture').problems.length;
		if (got !== want) {
			failed++;
			console.error(`self-test FAILED: ${name}: ${got} problem(s), expected ${want}`);
		}
	}
	// a plugin the app's plugin depends on must be copied too: chat → search
	const graph = new Map([
		['@gauzy/plugin-a', ['@gauzy/plugin-b']],
		['@gauzy/plugin-b', []]
	]);
	const closure = withPluginDeps(['@gauzy/plugin-a'], (n) => graph.get(n));
	const two = new Map([
		['@gauzy/plugin-a', 'a'],
		['@gauzy/plugin-b', 'b']
	]);
	const onlyA = check(
		head + 'COPY --chown=node:node packages/plugins/a/package.json ./packages/plugins/a/\n',
		'api',
		closure,
		two,
		'fixture'
	);
	if (closure.length !== 2 || onlyA.problems.length !== 1 || !onlyA.problems[0].includes('@gauzy/plugin-b')) {
		failed++;
		console.error(
			`self-test FAILED: a plugin's own plugin dependency: closure ${closure}, ${onlyA.problems.length} problem(s)`
		);
	}
	// a stage that copies a plugin the app does not depend on still installs it, so its plugins are needed too
	const copiedOnly = check(
		head + 'COPY --chown=node:node packages/plugins/a/package.json ./packages/plugins/a/\n',
		'api',
		[],
		two,
		'fixture',
		(n) => graph.get(n)
	);
	if (copiedOnly.problems.length !== 1 || !copiedOnly.problems[0].includes('a plugin this stage installs')) {
		failed++;
		console.error(`self-test FAILED: a copied plugin's dependency: ${copiedOnly.problems.length} problem(s)`);
	}
	if (failed) process.exit(1);
	console.log(`docker-plugin-copy-check self-test ok: ${cases.length + 2} cases`);
}

if (process.argv.includes('--self-test')) {
	selfTest();
} else {
	const plugins = pluginDirs();
	const problems = [];
	for (const app of APPS) {
		const dockerfile = `.deploy/${app}/Dockerfile`;
		const pkg = JSON.parse(readFileSync(join(ROOT, 'apps', app, 'package.json'), 'utf8'));
		const direct = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((n) => plugins.has(n));
		const depsOf = pluginDepsOf(plugins);
		const deps = withPluginDeps(direct, depsOf);
		const result = check(readFileSync(join(ROOT, dockerfile), 'utf8'), app, deps, plugins, dockerfile, depsOf);
		problems.push(...result.problems);
		console.log(`${dockerfile}: ${deps.length} plugin dependencies, ${result.stages} dependency stage(s) checked`);
	}
	if (problems.length) {
		console.error(`\n${problems.length} plugin package(s) missing from the image dependency stages:\n`);
		for (const p of problems) console.error(`- ${p}`);
		process.exit(1);
	}
	console.log('every plugin the app images depend on is copied into their dependency stages');
}
