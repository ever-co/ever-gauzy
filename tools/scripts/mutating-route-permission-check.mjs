#!/usr/bin/env node
/**
 * Gate: every mutating route a plugin controller inherits from `CrudController` must state its own
 * permission.
 *
 * `CrudController` (`packages/core/src/lib/core/crud/crud.controller.ts`) declares five mutating routes
 * with no `@Permissions` metadata of its own, and `PermissionGuard` returns `true` when the metadata it
 * reads is empty (`permission.guard.ts`, the `isEmpty(permissions)` return). Nest resolves that metadata
 * handler-first-then-class, so a controller that does not override one of those handlers inherits a
 * route that stands on the controller's class-level grant alone — which is the read/view grant. The
 * defect is not theoretical: `DELETE /api/carts/:id` stood on `CARTS_VIEW` while the `deleteCart`
 * mutation required `CARTS_DELETE`.
 *
 * This is the static half of `packages/core/src/lib/shared/guards/mutating-route-permissions.spec.ts`,
 * which pins the same property for the core controllers by reflecting on them at runtime. A script
 * cannot load TS decorators without a Nest context, so this gate reads the declarations instead: a
 * controller that extends `CrudController` must declare each of the five routes itself and carry
 * `@Permissions(...)` on every one of them.
 *
 * A route stating the same permission as the class is a failure when the class-level grant is a `_VIEW`
 * value — the override would then have restated the read grant rather than the destructive one, which
 * is the shape of the bug this gate exists to catch.
 *
 * Run from the repository root: `node tools/scripts/mutating-route-permission-check.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PLUGINS = join(ROOT, 'packages', 'plugins');

/**
 * Routes `CrudController` declares, with the decorator each one is declared under. The handler names
 * are the base class's own, and a subclass override wins only when it re-declares the same name.
 */
const ROUTES = [
	{ handler: 'create', decorator: /@Post\(\s*['"]?\/?['"]?\s*\)/ },
	{ handler: 'update', decorator: /@Put\(\s*['"]\/?:id['"]\s*\)/ },
	{ handler: 'delete', decorator: /@Delete\(\s*['"]\/?:id['"]\s*\)/ },
	{ handler: 'softRemove', decorator: /@Delete\(\s*['"]\/?:id\/soft['"]\s*\)/ },
	{ handler: 'softRecover', decorator: /@Put\(\s*['"]\/?:id\/recover['"]\s*\)/ }
];

/**
 * Controllers that predate this gate and are not this branch's to change, keyed by path and handler.
 *
 * Each one belongs to an existing platform plugin that the GHSA-v79w-54p2-wmh5 fix did not reach. They
 * are listed rather than silently skipped so the gap stays visible: an exemption records a defect, it
 * does not call the route safe.
 */
const EXEMPTIONS = new Map([
	[
		'packages/plugins/changelog/src/lib/changelog.controller.ts',
		{
			handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
			reason: 'pre-existing platform plugin; the controller declares no permission on any route'
		}
	],
	[
		'packages/plugins/job-proposal/src/lib/proposal-template/employee-proposal-template.controller.ts',
		{
			handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
			reason: 'pre-existing platform plugin; create/update state no permission and the three destructive routes are inherited'
		}
	],
	[
		'packages/plugins/job-search/src/lib/employee-job-preset/job-search-category/job-search-category.controller.ts',
		{
			handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
			reason: 'pre-existing platform plugin; the controller declares no guard and no permission at all, so every route needs a product decision about its grant'
		}
	],
	[
		'packages/plugins/job-search/src/lib/employee-job-preset/job-search-occupation/job-search-occupation.controller.ts',
		{
			handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
			reason: 'pre-existing platform plugin; as above'
		}
	]
]);

/** Every `.controller.ts` under `packages/plugins`, skipping build output. */
function controllerFiles(dir, found = []) {
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'dist') continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			controllerFiles(full, found);
		} else if (entry.endsWith('.controller.ts')) {
			found.push(full);
		}
	}
	return found;
}

/**
 * The class members of a controller, each with the decorators written above it.
 *
 * A member is a declaration at class-body indentation (one tab). Everything between the end of the
 * previous member's body and the declaration is its decorator block, which is what makes multi-line
 * decorators such as `@Idempotent({ ... })` part of the block rather than a break in it.
 */
function members(source) {
	const declaration = /^\t(?!\t)(?:public |protected |private )?(?:async )?([A-Za-z_$][\w$]*)\s*\(/gm;
	const found = [];
	let match;
	while ((match = declaration.exec(source)) !== null) {
		const bodyEnd = source.lastIndexOf('\n\t}', match.index);
		const blockStart = bodyEnd === -1 ? Math.max(source.indexOf('{'), 0) : bodyEnd;
		found.push({ name: match[1], decorators: source.slice(blockStart, match.index).replace(/\s+/g, '') });
	}
	return found;
}

/** The class-level `@Permissions(...)` arguments, when the controller states any. */
function classLevelPermission(source) {
	const classIndex = source.search(/^[ \t]*export class\s/m);
	if (classIndex === -1) return null;
	const blockStart = Math.max(source.lastIndexOf('\n}', classIndex), 0);
	const decorators = source.slice(blockStart, classIndex);
	const permission = decorators.match(/@Permissions\(([^)]*)\)/);
	return permission ? permission[1].replace(/\s+/g, '') : null;
}

const failures = [];
const exempted = [];
let controllers = 0;
let gated = 0;

for (const file of controllerFiles(PLUGINS)) {
	const source = readFileSync(file, 'utf8');
	if (!/extends\s+CrudController\b/.test(source)) continue;

	controllers++;
	const path = relative(ROOT, file).split('\\').join('/');
	const found = members(source);
	const classPermission = classLevelPermission(source);
	const exemption = EXEMPTIONS.get(path);

	for (const route of ROUTES) {
		const member = found.find((block) => block.name === route.handler && route.decorator.test(block.decorators));

		if (!member) {
			if (exemption?.handlers.includes(route.handler)) {
				exempted.push(`${path} -> ${route.handler}`);
				continue;
			}
			failures.push(`${path} -> inherits \`${route.handler}\` without overriding it, so the route states no permission`);
			continue;
		}

		const permission = member.decorators.match(/@Permissions\(([^)]*)\)/);
		if (!permission || permission[1] === '') {
			if (exemption?.handlers.includes(route.handler)) {
				exempted.push(`${path} -> ${route.handler}`);
				continue;
			}
			failures.push(`${path} -> \`${route.handler}\` declares no @Permissions(...)`);
			continue;
		}

		if (classPermission && classPermission === permission[1] && /_VIEW/.test(classPermission)) {
			failures.push(
				`${path} -> \`${route.handler}\` states ${permission[1]}, which is the class-level read grant it was meant to stop standing on`
			);
			continue;
		}

		gated++;
	}
}

const total = ROUTES.length * controllers;

if (failures.length > 0) {
	console.error('FAILED — mutating routes a plugin controller inherits from CrudController without a permission:');
	for (const failure of failures) console.error(`  ${failure}`);
	console.error('');
	console.error(`${failures.length} route(s) ungated, ${gated} gated, ${exempted.length} exempted of ${total}.`);
	process.exit(1);
}

console.log(
	`PASSED — ${gated} of ${total} mutating route(s) gated across ${controllers} plugin controller(s)` +
		(exempted.length > 0 ? `, ${exempted.length} exempted (pre-existing platform plugins, listed in the gate)` : '') +
		'.'
);
