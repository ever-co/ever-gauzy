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
 *
 * Exits 0 when every dependency is copied, 1 otherwise.
 */
'use strict';

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] ? resolve(process.argv[2]) : resolve(HERE, '..', '..');
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
	return text.split(/^(?=FROM\s)/m);
}

const plugins = pluginDirs();
const problems = [];
for (const app of APPS) {
	const dockerfile = `.deploy/${app}/Dockerfile`;
	const pkg = JSON.parse(readFileSync(join(ROOT, 'apps', app, 'package.json'), 'utf8'));
	const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((n) => plugins.has(n));
	const installStages = stages(readFileSync(join(ROOT, dockerfile), 'utf8')).filter((s) =>
		s.includes(`apps/${app}/package.json`)
	);
	if (installStages.length === 0) {
		problems.push(
			`${dockerfile}: no stage copies apps/${app}/package.json, so this check cannot tell the dependency stages`
		);
		continue;
	}
	installStages.forEach((stage, i) => {
		const missing = deps.filter((n) => !stage.includes(`packages/plugins/${plugins.get(n)}/package.json`));
		for (const name of missing) {
			const dir = plugins.get(name);
			problems.push(
				`${dockerfile} (dependency stage ${i + 1} of ${installStages.length}): apps/${app} depends on ${name} but the stage does not copy it:\n` +
					`    COPY --chown=node:node packages/plugins/${dir}/package.json ./packages/plugins/${dir}/`
			);
		}
	});
	console.log(
		`${dockerfile}: ${deps.length} plugin dependencies, ${installStages.length} dependency stage(s) checked`
	);
}

if (problems.length) {
	console.error(`\n${problems.length} plugin package(s) missing from the image dependency stages:\n`);
	for (const p of problems) console.error(`- ${p}`);
	process.exit(1);
}
console.log('every plugin the app images depend on is copied into their dependency stages');
