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
import { join, relative, sep } from 'node:path';
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
 *
 * The two job-search entries are the ones that need a decision rather than a patch: the grants that would
 * naturally govern these rows (`ORG_JOB_SEARCH`, `ORG_JOB_EDIT`) are seeded for SUPER_ADMIN and ADMIN
 * only (`default-role-permissions.ts`), while the feature they belong to is one an employee uses for
 * their own presets — so stating them would lock employees out of their own data unless the catalogue's
 * defaults move with them. That is a product call, not a syntax fix.
 */
const EXEMPTIONS = new Map([
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
			reason: 'pre-existing platform plugin; no guard and no permission on any route, and the grants that would fit them are not seeded for the employee role'
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
let gatedByRole = 0;

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

		// A route may state a permission, or name the roles allowed to reach it. `RoleGuard` is applied
		// per route and refuses every caller whose role is not listed, which is a narrower gate than a
		// permission — `ChangelogController` writes are SUPER_ADMIN-only for exactly that reason — so the
		// two forms both count, and the summary reports how many of each.
		const permission = member.decorators.match(/@Permissions\(([^)]*)\)/);
		if (!permission || permission[1] === '') {
			const roleGated = /@UseGuards\([^)]*RoleGuard/.test(member.decorators) && /@Roles\(/.test(member.decorators);
			if (roleGated) {
				gatedByRole++;
				continue;
			}
			if (exemption?.handlers.includes(route.handler)) {
				exempted.push(`${path} -> ${route.handler}`);
				continue;
			}
			failures.push(`${path} -> \`${route.handler}\` declares neither @Permissions(...) nor a role guard`);
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

/* ------------------------------------------------------------------------------------------------------
 * Part two — the kernel's controllers (`packages/core`), and the soft-delete/recover pair everywhere.
 *
 * Part one holds the plugin tree to "override all five and state a permission on each", which a plugin can
 * meet because every plugin controller was written after the advisory. The kernel's ~150 CRUD controllers
 * predate it and mostly lean on a class-level grant, so the rule here is what the advisory is actually
 * about, read the way `PermissionGuard` reads it (handler first, then class — `getAllAndOverride`):
 *
 *   1. **No inherited route resolves to an empty permission set** unless it is listed in `CORE_OPEN` below,
 *      with the reason. The list is the measured backlog and can only shrink: a listed route that now
 *      resolves to a grant is a stale row and fails too, so a fix cannot leave the hole re-openable.
 *   2. **The soft-delete/recover pair does not ride a read grant while the update route states a write
 *      grant** (owner decision 5, 2026-10-13: "Require edit permission" — the pair requires the
 *      controller's own edit grant, the one its `update` route uses). This is the shape §7.65 item 2
 *      recorded: `DELETE /:id/soft` and `PUT /:id/recover` left inherited stand on the class's `*_VIEW`
 *      grant, so a role that may only read could withdraw and restore rows. No baseline: there are none.
 *   3. **A stated permission is read by a guard.** `@Permissions(...)` only sets metadata; it is
 *      `PermissionGuard`, `TenantPermissionGuard` or `OrganizationPermissionGuard` that reads it, so a
 *      route whose grant no guard in scope reads is as open as one that states none.
 *
 * The reading is textual, like part one's (this job installs nothing): comments are stripped, decorator
 * arguments are read with balanced parentheses, and a member is a declaration at class-body indentation.
 * `mutating-route-permissions.spec.ts` pins the same property at runtime for the kernel, so a divergence
 * between this reading and Nest's own metadata shows up as a failing suite rather than as silent blindness.
 * ---------------------------------------------------------------------------------------------------- */

const CORE = join(ROOT, 'packages', 'core', 'src');

/** The guards that read `@Permissions(...)` metadata; any other guard leaves a stated grant unread. */
const PERMISSION_READING_GUARDS = new Set(['PermissionGuard', 'TenantPermissionGuard', 'OrganizationPermissionGuard']);

/** A grant that only lets its holder look: `*_VIEW`, `*_READ`, `VIEW_*` (`VIEW_SALES_PIPELINES`). */
const READ_GRANT = /(?:^|_)(?:VIEW|READ)(?:_|$)/;

/** The five routes `CrudController` and `CrudFactory` contribute, and the decorator each one is declared under. */
const INHERITED = ['create', 'update', 'delete', 'softRemove', 'softRecover'];

/** The handlers of the soft-delete/recover pair. */
const SOFT_PAIR = ['softRemove', 'softRecover'];

/**
 * The kernel's inherited routes that resolve to no permission today, by controller, with the reason.
 *
 * Two kinds, and the reason says which:
 *   - **the update route is open too.** Owner decision 5 makes the soft pair require "the controller's own
 *     edit permission (the one its `update` route uses)". These resources' `update` states none — no edit
 *     grant exists for them, every member writes them today — so the pair stays equal to `update` rather than
 *     being narrowed past it. A grant for them would have to be invented, seeded and applied to their create /
 *     update / delete too; that is the remaining part of `mutating-route-permissions.spec.ts`'s triage.
 *   - **owner-scoped by the service.** Rows a member writes for themself (comments, reactions, favourites…):
 *     `mutating-route-permissions.spec.ts` lists them as DELIBERATELY_OPEN and names the service check.
 *
 * Every create/update/delete row here is also in that spec's AWAITING_TRIAGE or DELIBERATELY_OPEN list.
 */
const CORE_OPEN = {
	AppointmentEmployeesController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	AvailabilitySlotsController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	CandidateFeedbacksController: {
		handlers: ['delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	CandidatePersonalQualitiesController: {
		handlers: ['update'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	CandidateTechnologiesController: {
		handlers: ['update'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	CommentController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'user-owned: CommentService pins the author to the caller’s employee; only a CHANGE_SELECTED_EMPLOYEE holder may edit or delete another employee’s comment'
	},
	ContactController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	EmployeeAppointmentController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	EmployeeLevelController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	EmployeeNotificationController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'own notifications: the service pins the receiver to the caller’s employee and the rows are employee-scoped'
	},
	EmployeeNotificationSettingController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	EmployeeSettingController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'own settings: the rows carry employeeId, so TenantAwareCrudService scopes every read and write to the caller’s employee unless they hold CHANGE_SELECTED_EMPLOYEE'
	},
	EntitySubscriptionController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	EquipmentController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	EquipmentSharingController: {
		handlers: ['create', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	EventTypeController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	FavoriteController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'user-owned: FavoriteService pins the favourite to the caller’s employee and refuses to delete somebody else’s'
	},
	GoalController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	GoalGeneralSettingController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	GoalKpiController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	GoalKpiTemplateController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	GoalTemplateController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	GoalTimeFrameController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	InvoiceEstimateHistoryController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	InvoiceItemController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	IssueTypeController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	KeyResultController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	KeyresultTemplateController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	KeyResultUpdateController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	MentionController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	OrganizationAwardController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	OrganizationDocumentController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	OrganizationLanguageController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	OrganizationRecurringExpenseController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	OrganizationVendorController: {
		handlers: ['create'],
		reason: 'the shared vendor select creates a vendor inline from the Expenses dialog, which expense editors reach without ALL_ORG_EDIT'
	},
	ProductOptionController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	ProductVariantController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	ProductVariantPriceController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	ProductVariantSettingController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	ReactionController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'user-owned: ReactionService pins the reacting employee to the caller and refuses another employee’s reaction'
	},
	RequestApprovalController: {
		handlers: ['delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	ResourceLinkController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	ScreeningTasksController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	SharedEntityController: {
		handlers: ['create', 'update', 'delete', 'softRemove', 'softRecover'],
		reason: 'no write grant exists for this resource and every member writes it today; the soft pair stays equal to update, which states none (owner decision 5) — awaiting triage'
	},
	SkillController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	TagTypeController: {
		handlers: ['delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	TaskPriorityController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	TaskRelatedIssueTypeController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	TaskSizeController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	TaskStatusController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	TaskVersionController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	},
	TaskViewController: {
		handlers: ['create', 'update', 'delete'],
		reason: 'awaiting triage (GHSA-v79w-54p2-wmh5 inventory): no write grant stated on these routes yet'
	}
};

/** Removes comments, keeping line structure, so prose about a decorator never reads as one. */
function stripComments(source) {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
		.replace(/(^|[\s;,{}()])\/\/[^\n]*/g, '$1');
}

/** The arguments of the first `@<name>(...)` in a block, read with balanced parentheses; `null` when absent. */
function decoratorArguments(block, name) {
	const start = block.indexOf(`@${name}(`);
	if (start === -1) return null;
	let depth = 0;
	const open = block.indexOf('(', start);
	for (let index = open; index < block.length; index++) {
		if (block[index] === '(') depth++;
		else if (block[index] === ')' && --depth === 0) {
			return splitTopLevel(block.slice(open + 1, index));
		}
	}
	return null;
}

/** Splits an argument list on its top-level commas. */
function splitTopLevel(text) {
	const parts = [];
	let depth = 0;
	let current = '';
	for (const character of text) {
		if (character === '(' || character === '[' || character === '{') depth++;
		if (character === ')' || character === ']' || character === '}') depth--;
		if (character === ',' && depth === 0) {
			parts.push(current);
			current = '';
		} else {
			current += character;
		}
	}
	parts.push(current);
	return parts.map((part) => part.replace(/\s+/g, '')).filter(Boolean);
}

/** The enum member a permission argument names: `MEASUREMENT_PERMISSIONS.UNITS_EDIT` → `UNITS_EDIT`. */
function grantName(argument) {
	const inner = argument.replace(/asPermissionsEnum$/, '').replace(/^\w+\(([^()]*)\)$/, '$1');
	return inner.split('.').pop();
}

/** Every `*.controller.ts` under a directory, skipping build output. */
function filesUnder(dir, found = []) {
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'dist') continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) filesUnder(full, found);
		else if (entry.endsWith('.controller.ts') && !entry.endsWith('.spec.ts')) found.push(full);
	}
	return found;
}

/**
 * Reads one CRUD controller: for each inherited route, the permission set `PermissionGuard` resolves and
 * whether a guard that reads it is in scope. A route the class re-declares without an HTTP decorator is no
 * longer a route (Nest maps the most derived method), and is reported as removed.
 */
function readCrudController(source) {
	const code = stripComments(source);
	const declaration = /export class (\w+)\s+extends\s+(?:CrudController|CrudFactory)\b/.exec(code);
	if (!declaration) return null;

	const classIndex = code.lastIndexOf('\n', declaration.index);
	const classBlock = code.slice(Math.max(code.lastIndexOf('\n}', classIndex), 0), declaration.index);
	const classGrants = decoratorArguments(classBlock, 'Permissions');
	const classGuards = decoratorArguments(classBlock, 'UseGuards') ?? [];
	const classPublic = /@Public\(/.test(classBlock);
	const classRoles = /@Roles\(/.test(classBlock);

	const body = code.slice(declaration.index);
	const found = new Map();
	for (const member of rawMembers(body)) if (!found.has(member.name)) found.set(member.name, member.raw);

	const routes = {};
	for (const handler of INHERITED) {
		const block = found.get(handler);
		if (block !== undefined && !/@(?:Get|Post|Put|Patch|Delete)\(/.test(block)) {
			routes[handler] = { removed: true };
			continue;
		}
		const handlerGrants = block === undefined ? null : decoratorArguments(block, 'Permissions');
		const grants = (handlerGrants ?? classGrants ?? []).map(grantName);
		const guards = [...classGuards, ...(block === undefined ? [] : decoratorArguments(block, 'UseGuards') ?? [])];
		const roleGated = guards.includes('RoleGuard') && (classRoles || (block !== undefined && /@Roles\(/.test(block)));
		routes[handler] = {
			inherited: block === undefined,
			grants,
			read: guards.some((guard) => PERMISSION_READING_GUARDS.has(guard)),
			open: classPublic || (block !== undefined && /@Public\(/.test(block)) || roleGated
		};
	}
	return { controller: declaration[1], routes };
}

/**
 * The class members of a controller body with their decorator blocks, unflattened (part one's `members`
 * collapses whitespace, which is fine for matching a decorator and not for reading its arguments).
 *
 * A member's block starts where the previous member's body closes: a `}` alone at class-body indentation.
 * A multi-line decorator closes at the same indentation too — `\t})` after `@ApiResponse({ … })` — so the
 * brace only counts when nothing follows it on its line; otherwise the block would start inside its own
 * decorators and lose the ones above that line (`TaskController.delete` is the case that showed it).
 */
function rawMembers(body) {
	const declaration = /^\t(?!\t)(?:public |protected |private )?(?:async )?([A-Za-z_$][\w$]*)\s*\(/gm;
	const found = [];
	let match;
	while ((match = declaration.exec(body)) !== null) {
		let bodyEnd = body.lastIndexOf('\n\t}', match.index);
		while (bodyEnd !== -1 && !/^\n\t\}[ \t]*\r?\n/.test(body.slice(bodyEnd, bodyEnd + 8))) {
			bodyEnd = bodyEnd === 0 ? -1 : body.lastIndexOf('\n\t}', bodyEnd - 1);
		}
		const blockStart = bodyEnd === -1 ? Math.max(body.indexOf('{'), 0) : bodyEnd;
		found.push({ name: match[1], raw: body.slice(blockStart, match.index) });
	}
	return found;
}

const coreFailures = [];
const coreStale = [];
const coreCounts = { controllers: 0, routes: 0, open: 0, softPairs: 0 };
const coreSeen = new Map();
const dump = process.argv.includes('--dump') ? [] : null;

for (const file of [...filesUnder(CORE), ...filesUnder(PLUGINS)].sort()) {
	const read = readCrudController(readFileSync(file, 'utf8'));
	if (!read) continue;

	const path = relative(ROOT, file).split(sep).join('/');
	const isCore = path.startsWith('packages/core/');
	dump?.push({ file: path, ...read });
	if (isCore) coreCounts.controllers++;

	const update = read.routes.update;
	const updateWrites = update && !update.removed && update.grants.some((grant) => !READ_GRANT.test(grant));

	for (const [handler, route] of Object.entries(read.routes)) {
		if (route.removed || route.open) continue;
		const key = `${read.controller}.${handler}`;
		if (isCore) coreCounts.routes++;

		// Rule 3, everywhere: a grant no guard reads is no grant.
		if (route.grants.length > 0 && !route.read) {
			coreFailures.push(`${path} -> \`${handler}\` states ${route.grants.join(' | ')}, and no guard in scope reads @Permissions`);
			continue;
		}

		// Rule 2, everywhere: the soft pair never rides a read grant past a write-gated update.
		if (SOFT_PAIR.includes(handler) && route.grants.length > 0) {
			if (isCore) coreCounts.softPairs++;
			if (route.grants.every((grant) => READ_GRANT.test(grant)) && updateWrites) {
				coreFailures.push(
					`${path} -> \`${handler}\` stands on ${route.grants.join(' | ')}, a read grant, while \`update\` requires ` +
						`${update.grants.join(' | ')} — the pair must require the controller's own edit grant (owner decision 5)`
				);
			}
			continue;
		}

		// Rule 1, the kernel (part one already holds the plugins to a stricter rule).
		if (!isCore || route.grants.length > 0) continue;
		const listed = CORE_OPEN[read.controller];
		coreSeen.set(read.controller, [...(coreSeen.get(read.controller) ?? []), handler]);
		if (listed?.handlers.includes(handler)) {
			coreCounts.open++;
			continue;
		}
		coreFailures.push(`${path} -> \`${handler}\` resolves to no permission (handler, then class), so any tenant member reaches it`);
	}
}

for (const [controller, { handlers }] of Object.entries(CORE_OPEN)) {
	for (const handler of handlers) {
		if (!(coreSeen.get(controller) ?? []).includes(handler)) {
			coreStale.push(`${controller}.${handler} is listed in CORE_OPEN but no longer resolves to an empty set — delete the row`);
		}
	}
}

if (dump) {
	console.log(JSON.stringify(dump, null, 1));
	process.exit(0);
}

const total = ROUTES.length * controllers;
const pluginSummary =
	`${gated} of ${total} mutating route(s) gated by permission across ${controllers} plugin controller(s)` +
	(gatedByRole > 0 ? `, ${gatedByRole} gated by a role guard` : '') +
	(exempted.length > 0 ? `, ${exempted.length} exempted (pre-existing platform plugins, listed in the gate)` : '');
const coreSummary =
	`${coreCounts.routes} inherited route(s) across ${coreCounts.controllers} kernel CRUD controller(s): ` +
	`${coreCounts.routes - coreCounts.open} resolve to a permission, ${coreCounts.open} are listed in CORE_OPEN; ` +
	`no soft-delete/recover pair stands on a read grant past a write-gated update`;

if (failures.length > 0) {
	console.error('FAILED — mutating routes a plugin controller inherits from CrudController without a permission:');
	for (const failure of failures) console.error(`  ${failure}`);
	console.error('');
	console.error(
		`${failures.length} route(s) ungated, ${gated} gated by permission, ${gatedByRole} by role, ${exempted.length} exempted of ${total}.`
	);
}

if (coreFailures.length > 0) {
	console.error('FAILED — inherited CRUD routes (kernel, and the soft-delete/recover pair everywhere):');
	for (const failure of coreFailures) console.error(`  ${failure}`);
	console.error('');
	console.error(
		'Override the route in the controller with @Permissions(<the grant its update route states>) behind a guard that ' +
			'reads it, and give its GraphQL mirror the same grant — or, for a kernel route whose update states no grant ' +
			'either, list it in CORE_OPEN with the reason.'
	);
}

if (coreStale.length > 0) {
	console.error('FAILED — CORE_OPEN no longer matches the tree:');
	for (const entry of coreStale) console.error(`  ${entry}`);
}

if (failures.length > 0 || coreFailures.length > 0 || coreStale.length > 0) process.exit(1);

console.log(`PASSED — ${pluginSummary}; ${coreSummary}.`);
