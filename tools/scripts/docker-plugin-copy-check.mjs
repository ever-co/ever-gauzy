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
 * stage that copies `apps/<app>/package.json`).
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

/** The Dockerfile split into stages (`FROM ...` up to the next `FROM`). */
function stages(text) {
	return text.split(/^(?=FROM\s)/im);
}

/**
 * The source paths of a stage's active `COPY` instructions, without `./`. A commented-out `COPY`, or a path named
 * in a comment or a `RUN` argument, copies nothing and does not count. Flags (`--chown=...`, `--from=...`) are
 * skipped and the last argument is the destination.
 */
export function copiedSources(stage) {
	const out = new Set();
	for (const raw of stage.split(/\r?\n/)) {
		const line = raw.trim();
		const match = /^COPY\s+(.+)$/i.exec(line);
		if (!match) continue;
		const args = match[1].split(/\s+/).filter((a) => !a.startsWith('--'));
		for (const src of args.slice(0, -1)) out.add(src.replace(/^\.\//, ''));
	}
	return out;
}

/** Problems for one app: its dependency stages are those that copy `apps/<app>/package.json`. */
export function check(dockerfileText, app, deps, plugins, label = `.deploy/${app}/Dockerfile`) {
	const problems = [];
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
		for (const name of deps.filter((n) => !copied.has(`packages/plugins/${plugins.get(n)}/package.json`))) {
			const dir = plugins.get(name);
			problems.push(
				`${label} (dependency stage ${i + 1} of ${installStages.length}): apps/${app} depends on ${name} but the stage does not copy it:\n` +
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
		['the app manifest only in a comment', 'FROM node AS deps\n# apps/api/package.json\n', 1]
	];
	let failed = 0;
	for (const [name, text, want] of cases) {
		const got = check(text, 'api', deps, plugins, 'fixture').problems.length;
		if (got !== want) {
			failed++;
			console.error(`self-test FAILED: ${name}: ${got} problem(s), expected ${want}`);
		}
	}
	if (failed) process.exit(1);
	console.log(`docker-plugin-copy-check self-test ok: ${cases.length} cases`);
}

if (process.argv.includes('--self-test')) {
	selfTest();
} else {
	const plugins = pluginDirs();
	const problems = [];
	for (const app of APPS) {
		const dockerfile = `.deploy/${app}/Dockerfile`;
		const pkg = JSON.parse(readFileSync(join(ROOT, 'apps', app, 'package.json'), 'utf8'));
		const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((n) => plugins.has(n));
		const result = check(readFileSync(join(ROOT, dockerfile), 'utf8'), app, deps, plugins, dockerfile);
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
