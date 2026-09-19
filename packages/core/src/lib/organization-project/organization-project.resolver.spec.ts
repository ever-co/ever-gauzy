/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ProjectManagerOrPermissionGuard } from './guards/project-manager-or-permission.guard';
import { OrganizationProjectController } from './organization-project.controller';
import { OrganizationProjectResolver } from './organization-project.resolver';
import {
	OrganizationProjectCreateCommand,
	OrganizationProjectEditByEmployeeCommand,
	OrganizationProjectSettingUpdateCommand,
	OrganizationProjectUpdateCommand
} from './commands';

/**
 * The project over GraphQL.
 *
 * The delivered REST routes serve a project list twice over, one project, a count, the projects one
 * employee works, the linked projects page, the manager question, a filing, an edit, a task view
 * change, a setting change, an employee assignment, a removal, and the withdrawal and restoration of
 * a project. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the two list
 *   readings are connections with the platform's own cursor codec behind them, so a cursor obtained
 *   over REST resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the readings that are easy to get backwards: the create states the add
 *   permission its route states beside the class's edit pair, the removal states the delete
 *   permission, and the four fields whose routes declare nothing of their own (the synced page, the
 *   setting write and the two lifecycle moves the controller inherits) state the class-level pair;
 * - the employee look-up and the synced page are root fields of their own rather than filters, because
 *   the reads behind them join a pivot and a custom-field relation the list read does not join — and
 *   the synced read answers a bounded page, so its connection's total counts the rows that read
 *   answered rather than every linked project in the store;
 * - the members the delivered reads can produce are what the object type carries, a relation the reads
 *   do not join is an identifier rather than a field that would answer null, money is an exact decimal
 *   and the two durations are stated in days;
 * - a project the delivered read reports as missing is `null` on the one-row field rather than a
 *   refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CONTACT = '00000000-0000-4000-8000-000000000003';
const TEAM = '00000000-0000-4000-8000-000000000004';
const EMPLOYEE = '00000000-0000-4000-8000-000000000005';
const MANAGER = '00000000-0000-4000-8000-000000000006';
const PROJECT = '00000000-0000-4000-8000-000000000010';
const OTHER_PROJECT = '00000000-0000-4000-8000-000000000011';

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them.
 */
const ROWS = [
	{
		id: OTHER_PROJECT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Zephyr Migration',
		status: 'completed',
		billing: 'FLAT_FEE',
		budget: 1400,
		budgetType: 'cost',
		currency: 'EUR',
		taskListType: 'SPRINT',
		billingFlat: false,
		public: false,
		owner: 'CLIENT',
		membersCount: 4,
		organizationContactId: CONTACT,
		startDate: new Date('2026-03-01T10:00:00.000Z'),
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: PROJECT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Acme Rebrand',
		status: 'open',
		billing: 'HOURLY',
		budget: 900,
		budgetType: 'hours',
		currency: 'USD',
		taskListType: 'GRID',
		billingFlat: true,
		public: true,
		owner: 'INTERNAL',
		membersCount: 2,
		organizationContactId: null,
		startDate: new Date('2026-02-01T10:00:00.000Z'),
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/**
 * The row the employee look-up answers with: the projection the delivered read selects, with the
 * teams it joins, and none of the columns it does not select.
 */
const PROJECTION = {
	id: PROJECT,
	name: 'Acme Rebrand',
	imageUrl: null,
	currency: 'USD',
	billing: 'HOURLY',
	public: true,
	owner: 'INTERNAL',
	taskListType: 'GRID',
	teams: [{ id: TEAM }]
};

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const organizationProjectService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findById: jest.fn().mockResolvedValue(ROWS[1]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		findByEmployee: jest.fn().mockResolvedValue([PROJECTION]),
		findSyncedProjects: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		isManagerOfProject: jest.fn().mockResolvedValue(true),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[1], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[1])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[1]) };

	return {
		organizationProjectService,
		commandBus,
		resolver: new OrganizationProjectResolver(organizationProjectService as never, commandBus as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return (
		error instanceof Error &&
		'getStatus' in error &&
		typeof (error as { getStatus(): number }).getStatus === 'function' &&
		(error as { getStatus(): number }).getStatus() >= 400 &&
		(error as { getStatus(): number }).getStatus() !== 404
	);
}

/**
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the
 * boot loader globs, which is what makes a reference from this domain to another one resolvable.
 */
function composedSchema(): string {
	const root = join(__dirname, '..');
	const documents: string[] = [];

	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) {
				documents.push(readFileSync(path, 'utf8'));
			}
		}
	};

	walk(root);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/**
 * The root fields this domain contributes.
 *
 * The concept's name is a *prefix* of its neighbours' — `organizationProject`, `organizationProjects`
 * and the rest all begin with the same nineteen letters, and the module domain beside this one serves
 * `updateOrganizationProjectModule` and its siblings — so the match is anchored at both ends and names
 * the whole set, rather than a prefix search that would have counted another domain's fields as this
 * one's. The two fields whose names do not begin with the concept are stated in the same pattern, so
 * the surface's whole contribution is compared in one assertion.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned =
		operation === 'Query'
			? /^(organizationProject|organizationProjects|organizationProjectCount|organizationProjectsByEmployee|syncedOrganizationProjects|isOrganizationProjectManager)$/
			: /^(create|update|delete|softDelete|recover)OrganizationProject(ByEmployee|Setting|TaskViewMode)?$/;

	return rootFields(operation)
		.filter((field) => owned.test(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input, so a member the delivered body does not read can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationProjectController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof OrganizationProjectController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationProjectController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationProjectResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/**
 * The resolver field each delivered route is mirrored by.
 *
 * Stated once, so the guard suite and the permission suite hold the resolver to the same map: a field
 * that mirrors a different route in one assertion than in the other would be a field whose scope is
 * only accidentally right.
 */
const ROUTES: ReadonlyArray<readonly [string, string]> = [
	['organizationProjects', 'findAll'],
	['organizationProject', 'findById'],
	['organizationProjectCount', 'getCount'],
	['organizationProjectsByEmployee', 'findProjectsByEmployee'],
	['syncedOrganizationProjects', 'findSyncedProjects'],
	['isOrganizationProjectManager', 'isProjectManager'],
	['createOrganizationProject', 'create'],
	['updateOrganizationProject', 'update'],
	['updateOrganizationProjectTaskViewMode', 'updateTaskViewMode'],
	['updateOrganizationProjectSetting', 'updateProjectSetting'],
	['updateOrganizationProjectByEmployee', 'updateProjectByEmployee'],
	['deleteOrganizationProject', 'delete'],
	['softDeleteOrganizationProject', 'softRemove'],
	['recoverOrganizationProject', 'softRecover']
];

describe('OrganizationProjectResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the two connection queries, the one-row query, the count, the employee look-up and the manager question', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'organizationProjects',
				'syncedOrganizationProjects',
				'organizationProject',
				'organizationProjectCount',
				'organizationProjectsByEmployee',
				'isOrganizationProjectManager'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationProject',
				'updateOrganizationProject',
				'updateOrganizationProjectTaskViewMode',
				'updateOrganizationProjectSetting',
				'updateOrganizationProjectByEmployee',
				'deleteOrganizationProject',
				'softDeleteOrganizationProject',
				'recoverOrganizationProject'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one. The employee look-up and the synced
		// page are fields of their own, because the reads behind them join what the list read does not.
		expect(ownedRootFields('Query')).toEqual([
			'isOrganizationProjectManager',
			'organizationProject',
			'organizationProjectCount',
			'organizationProjects',
			'organizationProjectsByEmployee',
			'syncedOrganizationProjects'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOrganizationProject',
			'deleteOrganizationProject',
			'recoverOrganizationProject',
			'softDeleteOrganizationProject',
			'updateOrganizationProject',
			'updateOrganizationProjectByEmployee',
			'updateOrganizationProjectSetting',
			'updateOrganizationProjectTaskViewMode'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OrganizationProjectConnection \{\s*nodes: \[OrganizationProject!\]!\s*edges: \[OrganizationProjectEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type OrganizationProjectEdge \{\s*node: OrganizationProject!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input OrganizationProjectFilter \{/);
		expect(printed).toMatch(/input OrganizationProjectSort \{/);
		expect(printed).toMatch(
			/enum OrganizationProjectSortField \{\s*createdAt\s*updatedAt\s*name\s*startDate\s*endDate\s*budget\s*status\s*taskListType\s*\}/
		);
	});

	it('carries the row’s own columns, with the amount as an exact decimal and the two durations in days', () => {
		const body = typeBody('OrganizationProject');

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/status: String/);
		expect(body).toMatch(/taskListType: String/);
		expect(body).toMatch(/billing: String/);
		expect(body).toMatch(/budgetType: String/);
		expect(body).toMatch(/currency: String/);
		expect(body).toMatch(/public: Boolean/);
		expect(body).toMatch(/membersCount: Int/);
		expect(body).toMatch(/customFields: JSON/);
		// The budget is an amount — money when its unit member says so — and money is never a Float,
		// because a binary fraction cannot hold a cent exactly.
		expect(body).toMatch(/budget: Decimal/);
		expect(body).not.toMatch(/budget: Float/);
		// The two task durations are not amounts, and the column behind each of them is an exact
		// decimal, so they are carried as Floats with their unit stated in the description beside them.
		expect(body).toMatch(/archiveTasksIn: Float/);
		expect(body).toMatch(/closeTasksIn: Float/);
		expect(body).toMatch(/A duration in\s+days/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('carries the relation the delivered reads always join, and identifiers for the ones they do not', () => {
		const body = typeBody('OrganizationProject');

		// `image` is declared eager on the entity, so it travels on every read of the full row.
		expect(body).toMatch(/image: ImageAsset/);
		expect(body).toMatch(/imageId: ID/);
		// The party, the assignee and the organization are relations the list read does not join, and
		// the identifier is the column this row carries for each of them.
		expect(body).toMatch(/organizationContactId: ID/);
		expect(body).toMatch(/defaultAssigneeId: ID/);
		expect(body).toMatch(/organizationId: ID/);
		expect(body).toMatch(/tenantId: ID/);
		expect(body).not.toMatch(/\borganizationContact: OrganizationContact\b/);
		// The collections are neither joined by the list read nor named by a column of the row, and the
		// issue count the synced read computes belongs to that read rather than to the row.
		for (const collection of [
			'members',
			'teams',
			'tags',
			'tasks',
			'timeLogs',
			'invoiceItems',
			'organizationSprints',
			'payments',
			'expenses',
			'activities',
			'statuses',
			'relatedIssueTypes',
			'priorities',
			'sizes',
			'versions',
			'views',
			'modules',
			'issueCount'
		]) {
			expect(body).not.toMatch(new RegExp(`\\b${collection}:`));
		}
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list method reads live rows only, so neither connection offers `withDeleted`.
		expect(printed).not.toMatch(/organizationProjects\([^)]*withDeleted/);
		expect(printed).not.toMatch(/syncedOrganizationProjects\([^)]*withDeleted/);
		// The count is nullable and takes nothing: the delivered route hands its query string to the
		// store's own `where`, which this surface cannot pass on, and a non-null field would turn "not
		// answered" into a fabricated zero.
		expect(printed).toMatch(/organizationProjectCount: Int\b/);
		expect(printed).not.toMatch(/organizationProjectCount\(/);
	});

	it('declares only the create members the delivered body validates, and not one it discards', () => {
		const body = inputBody('CreateOrganizationProjectInput');

		expect(body).toMatch(/organizationId: ID!/);
		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/imageId: ID/);
		expect(body).toMatch(/billing: String/);
		expect(body).toMatch(/budgetType: String/);
		expect(body).toMatch(/taskListType: String/);
		expect(body).toMatch(/memberIds: \[ID!\]/);
		expect(body).toMatch(/managerIds: \[ID!\]/);
		// No member names the tenant, because the tenant comes from the credential on every write here.
		expect(body).not.toContain('tenantId');
		// The delivered body validates no tag list — the relations it validates are the two employee
		// lists — so a tag member here would be accepted by this surface and refused by the route.
		expect(body).not.toMatch(/\btagIds/);
		// The commercial terms on the same row are written by no declared body of this resource, so
		// they are readable and filterable on the type and are not offered as members of a write.
		expect(body).not.toMatch(/\bbudget:/);
		expect(body).not.toMatch(/\bstatus:/);
		expect(body).not.toMatch(/\bcurrency:/);
	});

	it('declares the edit body relaxed, the task-mode body, the setting body and the employee body', () => {
		const update = inputBody('UpdateOrganizationProjectInput');

		expect(update).toMatch(/id: ID!/);
		expect(update).toMatch(/organizationId: ID!/);
		// The delivered edit body is the create body with every member relaxed, the name included.
		expect(update).toMatch(/^\s*name: String$/m);
		expect(update).not.toMatch(/name: String!/);
		expect(update).toMatch(/memberIds: \[ID!\]/);
		expect(update).toMatch(/managerIds: \[ID!\]/);
		expect(update).not.toContain('tenantId');

		const taskMode = inputBody('OrganizationProjectTaskViewModeInput');

		expect(taskMode).toMatch(/organizationId: ID!/);
		// The column's own validation states the list type, so the task-mode body requires it.
		expect(taskMode).toMatch(/taskListType: String!/);
		expect(taskMode).not.toContain('tenantId');

		const setting = inputBody('OrganizationProjectSettingInput');

		expect(setting).toMatch(/organizationId: ID!/);
		expect(setting).toMatch(/isTasksAutoSync: Boolean/);
		expect(setting).toMatch(/isTasksAutoSyncOnLabel: Boolean/);
		expect(setting).toMatch(/syncTag: String/);
		expect(setting).toMatch(/customFields: JSON/);
		expect(setting).not.toContain('tenantId');

		const byEmployee = inputBody('UpdateOrganizationProjectByEmployeeInput');

		expect(byEmployee).toMatch(/organizationId: ID!/);
		// The delivered body carries the employee row; the identifier is what the write keys the member
		// pivot by, so the identifier is what this input states.
		expect(byEmployee).toMatch(/memberId: ID!/);
		expect(byEmployee).toMatch(/addedProjectIds: \[ID!\]/);
		expect(byEmployee).toMatch(/removedProjectIds: \[ID!\]/);
		expect(byEmployee).not.toContain('tenantId');
	});

	it('states the writes’ payloads and answers exactly as the delivered routes do', () => {
		expect(printed).toMatch(
			/createOrganizationProject\(input: CreateOrganizationProjectInput!\): OrganizationProject!/
		);
		expect(printed).toMatch(
			/updateOrganizationProject\(input: UpdateOrganizationProjectInput!\): OrganizationProject!/
		);
		expect(printed).toMatch(
			/updateOrganizationProjectTaskViewMode\(id: ID!, input: OrganizationProjectTaskViewModeInput!\): OrganizationProject!/
		);
		expect(printed).toMatch(
			/updateOrganizationProjectSetting\(id: ID!, input: OrganizationProjectSettingInput!\): OrganizationProject!/
		);
		expect(printed).toMatch(
			/updateOrganizationProjectByEmployee\(input: UpdateOrganizationProjectByEmployeeInput!\): Boolean!/
		);
		expect(printed).toMatch(/deleteOrganizationProject\(id: ID!\): Boolean!/);
		expect(printed).toMatch(/softDeleteOrganizationProject\(id: ID!\): OrganizationProject!/);
		expect(printed).toMatch(/recoverOrganizationProject\(id: ID!\): OrganizationProject!/);
		// The employee look-up answers a bare list because the delivered read has no page to take, and
		// the manager question answers a flag because it is a question rather than a row.
		expect(printed).toMatch(
			/organizationProjectsByEmployee\([\s\S]*?\): \[OrganizationProject!\]!/
		);
		expect(printed).toMatch(/isOrganizationProjectManager\(projectId: ID!, employeeId: ID!\): Boolean!/);
	});
});

describe('OrganizationProjectResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationProjectService } = surfaces();

		const connection = await resolver.organizationProjects(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its query string states nothing.
		expect(organizationProjectService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(PROJECT);
	});

	it('orders by name when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationProjects();

		expect(connection.nodes.map((node) => node.id)).toEqual([PROJECT, OTHER_PROJECT]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.organizationProjects({ status: { eq: 'open' } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([PROJECT]);

		const byFlat = await resolver.organizationProjects({ billingFlat: { eq: true } });
		expect(byFlat.nodes.map((node) => node.id)).toEqual([PROJECT]);

		const byMembers = await resolver.organizationProjects({ membersCount: { gte: 4 } });
		expect(byMembers.nodes.map((node) => node.id)).toEqual([OTHER_PROJECT]);

		const byParty = await resolver.organizationProjects({ organizationContactId: { isNull: true } });
		expect(byParty.nodes.map((node) => node.id)).toEqual([PROJECT]);
	});

	it('refuses a filter on a relation the delivered list read does not join', async () => {
		const { resolver } = surfaces();

		// A filter on a pivot the read never joined would be evaluated against a row that carries none
		// of it and would select nothing at all, which is the worst answer a filter can give.
		for (const field of ['members', 'teams', 'tags']) {
			const refusal = await resolver
				.organizationProjects({ [field]: { eq: PROJECT } })
				.catch((thrown) => thrown);

			expect(isRefusal(refusal)).toBe(true);
			expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
		}
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationProjects(undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([OTHER_PROJECT, PROJECT]);

		const byBudget = await resolver.organizationProjects(undefined, [{ field: 'budget', direction: 'DESC' }]);
		expect(byBudget.nodes.map((node) => node.id)).toEqual([OTHER_PROJECT, PROJECT]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationProjects(undefined, [{ field: 'budgetType', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationProjects(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([PROJECT]);

		const second = await resolver.organizationProjects(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_PROJECT]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.organizationProjects(undefined, undefined, undefined, 20);

		const last = await resolver.organizationProjects(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([PROJECT]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationProjects(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('OrganizationProjectResolver — the synced page and the employee look-up read on their own terms', () => {
	it('answers the synced page through the same service method the REST route calls, with the route’s own options', async () => {
		const { resolver, organizationProjectService } = surfaces();

		const connection = await resolver.syncedOrganizationProjects();

		// An empty DTO is the route's own defaults: the first ten linked projects, in the store's order.
		expect(organizationProjectService.findSyncedProjects).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
	});

	it('counts the rows the synced read answered rather than the store-wide total beside them', async () => {
		const { resolver, organizationProjectService } = surfaces();
		organizationProjectService.findSyncedProjects.mockResolvedValueOnce({ items: [ROWS[0]], total: 57 });

		const connection = await resolver.syncedOrganizationProjects();

		// The delivered read answers a bounded page and reports the store-wide total beside it; the
		// connection's total is the size of the set it was given, because that is the set its filters
		// select from — a number that counted beyond it would disagree with every other answer here.
		expect(connection.nodes.map((node) => node.id)).toEqual([OTHER_PROJECT]);
		expect(connection.totalCount).toBe(1);
	});

	it('narrows the synced page by the same filter the connection declares', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.syncedOrganizationProjects({ status: { eq: 'open' } });

		expect(connection.nodes.map((node) => node.id)).toEqual([PROJECT]);
		expect(connection.totalCount).toBe(1);
	});

	it('reads the projects one employee works through the same service method the route calls, with its options', async () => {
		const { resolver, organizationProjectService } = surfaces();

		const projects = await resolver.organizationProjectsByEmployee(EMPLOYEE, ORGANIZATION, CONTACT, TEAM);

		expect(organizationProjectService.findByEmployee).toHaveBeenCalledWith(EMPLOYEE, {
			organizationId: ORGANIZATION,
			organizationContactId: CONTACT,
			organizationTeamId: TEAM
		});
		// The answer is the read's own projection, which is why the field is not a filter on the
		// connection: the rows carry the teams the read joined and nothing else.
		expect(projects).toEqual([PROJECTION]);
		expect(projects[0]).not.toHaveProperty('status');
	});

	it('leaves the two optional narrowings of the employee look-up unstated rather than inventing them', async () => {
		const { resolver, organizationProjectService } = surfaces();

		await resolver.organizationProjectsByEmployee(EMPLOYEE, ORGANIZATION);

		expect(organizationProjectService.findByEmployee).toHaveBeenCalledWith(EMPLOYEE, {
			organizationId: ORGANIZATION,
			organizationContactId: undefined,
			organizationTeamId: undefined
		});
	});

	it('answers the manager question through the same service method the route calls, and reads no row', async () => {
		const { resolver, organizationProjectService } = surfaces();

		expect(await resolver.isOrganizationProjectManager(PROJECT, EMPLOYEE)).toBe(true);
		expect(organizationProjectService.isManagerOfProject).toHaveBeenCalledWith(PROJECT, EMPLOYEE);
		expect(organizationProjectService.findById).not.toHaveBeenCalled();
	});
});

describe('OrganizationProjectResolver — one concept, two protocols, the same operations', () => {
	it('reads one project through the same service method the REST route calls', async () => {
		const { resolver, organizationProjectService } = surfaces();

		expect(await resolver.organizationProject(PROJECT)).toBe(ROWS[1]);
		// That method also records the caller's recent visit, which is what the delivered route does:
		// the same read behind both protocols leaves the same history behind them.
		expect(organizationProjectService.findById).toHaveBeenCalledWith(PROJECT);
	});

	it('answers null for a project the delivered read reports as missing, which is the route’s miss in this vocabulary', async () => {
		const { resolver, organizationProjectService } = surfaces();
		organizationProjectService.findById.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organizationProject(OTHER_PROJECT)).toBeNull();
	});

	it('surfaces a refusal the delivered read raises as a 4xx that is not a 404', async () => {
		const { resolver, organizationProjectService } = surfaces();
		const refusal = new Error('PROJECT_READ_REFUSED: the project is outside the caller’s scope.');

		organizationProjectService.findById.mockRejectedValueOnce(refusal);

		await expect(resolver.organizationProject(PROJECT)).rejects.toBe(refusal);
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, organizationProjectService } = surfaces();

		expect(await resolver.organizationProjectCount()).toBe(2);
		expect(organizationProjectService.countBy).toHaveBeenCalledWith();
	});

	it('files a project through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createOrganizationProject({
			organizationId: ORGANIZATION,
			name: 'Acme Rebrand',
			billing: 'HOURLY',
			taskListType: 'GRID',
			memberIds: [EMPLOYEE],
			managerIds: [MANAGER]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationProjectCreateCommand);
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			name: 'Acme Rebrand',
			billing: 'HOURLY',
			taskListType: 'GRID',
			memberIds: [EMPLOYEE],
			managerIds: [MANAGER]
		});
		// The tenant is never a member of the payload: the handler stamps it from the credential.
		expect(command.input).not.toHaveProperty('tenantId');
	});

	it('edits a project through the command the REST route dispatches, with the identifier as the criterion', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateOrganizationProject({
			id: PROJECT,
			organizationId: ORGANIZATION,
			name: 'Acme Rebrand II',
			memberIds: [EMPLOYEE],
			managerIds: []
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationProjectUpdateCommand);
		expect(command.id).toBe(PROJECT);
		// The delivered route carries the identifier in the path and the facts in the body, so the
		// payload is the body and the identifier is not repeated inside it.
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			name: 'Acme Rebrand II',
			memberIds: [EMPLOYEE],
			managerIds: []
		});
	});

	it('changes the task view mode through the command the REST route dispatches, with the task-mode body', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateOrganizationProjectTaskViewMode(PROJECT, {
			organizationId: ORGANIZATION,
			taskListType: 'SPRINT'
		});

		const command = commandBus.execute.mock.calls[0][0];
		// The delivered route dispatches the edit command with the task-mode DTO, which is the list
		// type plus the organization that scopes the row — not a command of its own.
		expect(command).toBeInstanceOf(OrganizationProjectUpdateCommand);
		expect(command.id).toBe(PROJECT);
		expect(command.input).toEqual({ organizationId: ORGANIZATION, taskListType: 'SPRINT' });
	});

	it('changes the settings through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateOrganizationProjectSetting(PROJECT, {
			organizationId: ORGANIZATION,
			isTasksAutoSync: true,
			isTasksAutoSyncOnLabel: false,
			syncTag: 'gauzy',
			customFields: { repositoryId: PROJECT }
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationProjectSettingUpdateCommand);
		expect(command.id).toBe(PROJECT);
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			isTasksAutoSync: true,
			isTasksAutoSyncOnLabel: false,
			syncTag: 'gauzy',
			customFields: { repositoryId: PROJECT }
		});
	});

	it('moves projects into and out of an employee’s list through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		commandBus.execute.mockResolvedValueOnce(true);

		const answer = await resolver.updateOrganizationProjectByEmployee({
			organizationId: ORGANIZATION,
			memberId: EMPLOYEE,
			addedProjectIds: [PROJECT]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationProjectEditByEmployeeCommand);
		expect(command.input.organizationId).toBe(ORGANIZATION);
		// The delivered body carries the employee row; the command takes the row its identifier names.
		expect(command.input.member).toEqual({ id: EMPLOYEE });
		expect(command.input.addedProjectIds).toEqual([PROJECT]);
		// A list the caller does not state is left out: the delivered write reads "nothing stated" and
		// "nothing to change" as the same instruction.
		expect(command.input.removedProjectIds).toBeUndefined();
		expect(answer).toBe(true);
	});

	it('removes a project through the same service method the REST route calls', async () => {
		const { resolver, organizationProjectService } = surfaces();

		expect(await resolver.deleteOrganizationProject(PROJECT)).toBe(true);
		expect(organizationProjectService.delete).toHaveBeenCalledWith(PROJECT);
	});

	it('surfaces a refusal the removal raises rather than answering success', async () => {
		const { resolver, organizationProjectService } = surfaces();
		const refusal = new Error('PROJECT_STILL_REFERENCED: a task still points at this project.');

		organizationProjectService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteOrganizationProject(PROJECT)).rejects.toBe(refusal);
	});

	it('withdraws and restores a project through the same service methods the REST routes call', async () => {
		const { resolver, organizationProjectService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganizationProject(PROJECT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(organizationProjectService.softRemove).toHaveBeenCalledWith(PROJECT);

		expect(await resolver.recoverOrganizationProject(PROJECT)).toBe(ROWS[1]);
		expect(organizationProjectService.softRecover).toHaveBeenCalledWith(PROJECT);
	});
});

describe('OrganizationProjectResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationProjectResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationProjectController) ?? [];

		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, ProjectManagerOrPermissionGuard])
		);
		expect(controllerGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, ProjectManagerOrPermissionGuard])
		);
	});

	it('carries the controller’s module-local guard, which is the permission guard with a manager short-circuit', () => {
		// The guard the controller states instead of the platform's own is not a second scope: it is
		// the permission guard, and it admits the employee who manages the project named in the path
		// before the grant is consulted. Stating it here is what keeps a project manager's own access
		// — the access the REST route grants — available over this protocol as well.
		expect(ProjectManagerOrPermissionGuard.prototype instanceof PermissionGuard).toBe(true);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', OrganizationProjectResolver) ?? [];

		for (const [, handler] of ROUTES) {
			// The controller's chain plus the resolver's own gate are the same set as the chain the
			// resolver states, which is the whole parity claim: a route that added a guard of its own
			// would narrow REST below GraphQL and is caught here.
			expect([...guardsOfRoute(OrganizationProjectController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationProjectResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationProjectController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationProjectResolver)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_PROJECT_EDIT
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(OrganizationProjectController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the add permission on the filing and the delete permission on the removal, and neither on a read', () => {
		// The two routes that hold a grant of their own beside the class's pair. Folding either write
		// under the class pair alone would widen who may file or remove a project.
		expect(permissionOfField('createOrganizationProject')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_PROJECT_ADD
		]);
		expect(permissionOfField('deleteOrganizationProject')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_PROJECT_DELETE
		]);

		// The five fields that mirror a route stating the view pair state that pair, and never the
		// class's edit pair: a caller allowed to read projects is not thereby allowed to change one.
		for (const field of [
			'organizationProjects',
			'organizationProject',
			'organizationProjectCount',
			'organizationProjectsByEmployee',
			'isOrganizationProjectManager'
		]) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_VIEW,
				PermissionsEnum.ORG_PROJECT_VIEW
			]);
		}
	});

	it('states the class-level pair on the fields whose routes declare nothing of their own', () => {
		// The synced page and the setting write declare no permission beside the class's, and the two
		// lifecycle moves are inherited from the CRUD base, where the class's declaration is the whole
		// of their scope. Every one of the four therefore resolves to the class pair, and every one of
		// the four states it rather than leaving it to be inherited, so the parity is readable.
		const classLevel: ReadonlyArray<readonly [string, string]> = [
			['syncedOrganizationProjects', 'findSyncedProjects'],
			['updateOrganizationProjectSetting', 'updateProjectSetting'],
			['softDeleteOrganizationProject', 'softRemove'],
			['recoverOrganizationProject', 'softRecover']
		];

		for (const [field, handler] of classLevel) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(OrganizationProjectController)[handler])
			).toBeUndefined();
			expect(permissionOfRoute(OrganizationProjectController, handler)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.ORG_PROJECT_EDIT
			]);
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.ORG_PROJECT_EDIT
			]);
		}
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller’s scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (OrganizationProjectResolver.prototype as never)[field],
		getClass: () => OrganizationProjectResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationProjectResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationProjectResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationProjectResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('organizationProjects')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('organizationProjects');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationProjects'))).resolves.toBe(true);
	});
});
