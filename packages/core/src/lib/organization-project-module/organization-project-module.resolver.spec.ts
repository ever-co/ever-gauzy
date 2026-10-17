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
import { OrganizationProjectModuleController } from './organization-project-module.controller';
import { OrganizationProjectModuleResolver } from './organization-project-module.resolver';
import { OrganizationProjectModuleCreateCommand, OrganizationProjectModuleUpdateCommand } from './commands';

/**
 * The project module over GraphQL.
 *
 * The delivered REST routes serve a module list, one module, a count, three reads that join a pivot the
 * list read does not, a filing, an edit, a removal, and the withdrawal and restoration of a module. This
 * suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the reading that is easy to get backwards: the count and the two lifecycle moves
 *   are inherited from the platform's CRUD base without a permission of their own, so they run under the
 *   controller's class-level edit permission and the fields state that rather than the read permission
 *   their neighbours carry;
 * - **the three pivot reads are root fields of their own**, because a pivot is not a column of the row
 *   and a filter cannot state who is asking;
 * - the members the delivered reads can produce are what the object type carries, and a relation those
 *   reads do not join is an identifier rather than a field that would answer null;
 * - a module that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const FIRST_PROJECT = '00000000-0000-4000-8000-000000000003';
const SECOND_PROJECT = '00000000-0000-4000-8000-000000000004';
const ONBOARDING = '00000000-0000-4000-8000-000000000010';
const ROLLOUT = '00000000-0000-4000-8000-000000000011';
const EMPLOYEE = '00000000-0000-4000-8000-000000000020';
const TASK = '00000000-0000-4000-8000-000000000030';

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them — which
 * is deliberately not the order the connection means, so that "the order it applies when the caller
 * states none" is a statement the suite can actually make.
 */
const ROWS = [
	{
		id: ONBOARDING,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Acme Onboarding',
		description: 'The first wave',
		status: 'backlog',
		startDate: new Date('2026-04-01T00:00:00.000Z'),
		endDate: null,
		public: false,
		isFavorite: true,
		parentId: null,
		projectId: FIRST_PROJECT,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	},
	{
		id: ROLLOUT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Zephyr Rollout',
		description: 'The second wave',
		status: 'in-progress',
		startDate: new Date('2026-03-01T00:00:00.000Z'),
		endDate: new Date('2026-05-01T00:00:00.000Z'),
		public: true,
		isFavorite: false,
		parentId: ONBOARDING,
		projectId: SECOND_PROJECT,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const organizationProjectModuleService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[1]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		getEmployeeProjectModules: jest.fn().mockResolvedValue({ items: [ROWS[0]], total: 1 }),
		findTeamProjectModules: jest.fn().mockResolvedValue({ items: [ROWS[1]], total: 1 }),
		findByEmployee: jest.fn().mockResolvedValue({ items: [ROWS[0]], total: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[1], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[1])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[1]) };

	return {
		organizationProjectModuleService,
		commandBus,
		resolver: new OrganizationProjectModuleResolver(
			organizationProjectModuleService as never,
			commandBus as never
		)
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
 * The concept's name is a *prefix* of its neighbours' — the project a module belongs to, the module
 * itself and the module's own employee pivot all begin with the same letters — so the match is anchored
 * at both ends rather than a substring search, which would have counted another domain's fields as this
 * one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned =
		operation === 'Query'
			? /^(organizationProjectModules|organizationProjectModule|organizationProjectModuleCount|organizationProjectModulesByEmployee|employeeProjectModules|teamProjectModules)$/
			: /^(create|update|delete|softDelete|recover)OrganizationProjectModule$/;

	return rootFields(operation)
		.filter((field) => owned.test(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationProjectModuleController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file. An *empty* declaration counts as a
 * declaration here, and so does the absence of one: the count and the two lifecycle moves are inherited
 * from the CRUD base with no declaration at all, which is why they resolve to the class's.
 */
function permissionOfRoute(controller: typeof OrganizationProjectModuleController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationProjectModuleController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationProjectModuleResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('OrganizationProjectModuleResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the node query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'organizationProjectModules',
				'organizationProjectModule',
				'organizationProjectModuleCount'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationProjectModule',
				'updateOrganizationProjectModule',
				'deleteOrganizationProjectModule',
				'softDeleteOrganizationProjectModule',
				'recoverOrganizationProjectModule'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and the inherited `GET /pagination` — and the two
		// answer one question, so the surface states it once: a second root field for the paginated
		// spelling would be a second surface that could disagree with this one. The three pivot reads are
		// fields of their own for the reason the resolver states: none of them is a filter over rows.
		expect(ownedRootFields('Query')).toEqual([
			'employeeProjectModules',
			'organizationProjectModule',
			'organizationProjectModuleCount',
			'organizationProjectModules',
			'organizationProjectModulesByEmployee',
			'teamProjectModules'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOrganizationProjectModule',
			'deleteOrganizationProjectModule',
			'recoverOrganizationProjectModule',
			'softDeleteOrganizationProjectModule',
			'updateOrganizationProjectModule'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OrganizationProjectModuleConnection \{\s*nodes: \[OrganizationProjectModule!\]!\s*edges: \[OrganizationProjectModuleEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type OrganizationProjectModuleEdge \{\s*node: OrganizationProjectModule!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input OrganizationProjectModuleFilter \{/);
		expect(printed).toMatch(/input OrganizationProjectModuleSort \{/);
		expect(printed).toMatch(
			/enum OrganizationProjectModuleSortField \{\s*createdAt\s*updatedAt\s*name\s*startDate\s*endDate\s*\}/
		);
	});

	it('carries every column the delivered reads answer, and the identifiers of the relations they do not join', () => {
		const body = typeBody('OrganizationProjectModule');

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/description: String/);
		// The vocabulary of `status` is the contracts package's own `ProjectModuleStatusEnum`, which the
		// delivered routes validate against, so the member is carried as its value rather than declared
		// here as an enum this domain does not own.
		expect(body).toMatch(/status: String/);
		expect(body).toMatch(/startDate: DateTime/);
		expect(body).toMatch(/endDate: DateTime/);
		expect(body).toMatch(/public: Boolean/);
		expect(body).toMatch(/isFavorite: Boolean/);
		// The two relation columns this row itself carries travel with every read of it.
		expect(body).toMatch(/parentId: ID/);
		expect(body).toMatch(/projectId: ID/);
		expect(body).toMatch(/organizationId: ID/);
		expect(body).toMatch(/tenantId: ID/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
		expect(body).toMatch(/archivedAt: DateTime/);
		expect(body).toMatch(/createdAt: DateTime/);
		expect(body).toMatch(/updatedAt: DateTime/);
		expect(body).toMatch(/isActive: Boolean/);
		expect(body).toMatch(/isArchived: Boolean/);
	});

	it('carries no relation the delivered reads do not join, and no member of a collection they do not answer', () => {
		const body = typeBody('OrganizationProjectModule');

		// The parent and the project are read from their own domains; the pivot rows, the teams and the
		// tasks are the questions the reads of their own domains answer.
		for (const member of [
			'parent',
			'project',
			'children',
			'views',
			'members',
			'teams',
			'tasks',
			'organizationSprints'
		]) {
			expect(body).not.toMatch(new RegExp(`\\b${member}:`));
		}
		// No member of this row is money and no member of it is an estimate, so nothing here is a
		// `Decimal` and no description states a unit this surface would have to declare.
		expect(body).not.toContain('Decimal');
	});

	it('offers no argument it cannot honour', () => {
		// `withDeleted` is offered because the three delivered list routes offer it: each binds
		// `BaseQueryDTO`, which carries the member, and hands its query string straight to the same read, so
		// a REST caller can ask for withdrawn rows and a connection that could not would hide them. The
		// employee-scoped read binds `OrganizationProjectModuleFindInputDTO` rather than `BaseQueryDTO`, so
		// its connection states no such argument.
		expect(printed).toMatch(/organizationProjectModules\([^)]*withDeleted/);
		expect(printed).toMatch(/employeeProjectModules\([^)]*withDeleted/);
		expect(printed).toMatch(/teamProjectModules\([^)]*withDeleted/);
		expect(printed).not.toMatch(/organizationProjectModulesByEmployee\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/organizationProjectModuleCount\(/);
	});

	it('declares the create members the delivered write reads, and not one it discards', () => {
		const create = inputBody('CreateOrganizationProjectModuleInput');

		expect(create).toMatch(/organizationId: ID!/);
		expect(create).toMatch(/name: String!/);
		expect(create).toMatch(/description: String/);
		expect(create).toMatch(/status: String/);
		expect(create).toMatch(/startDate: DateTime/);
		expect(create).toMatch(/endDate: DateTime/);
		expect(create).toMatch(/public: Boolean/);
		expect(create).toMatch(/isFavorite: Boolean/);
		expect(create).toMatch(/isActive: Boolean/);
		expect(create).toMatch(/isArchived: Boolean/);
		expect(create).toMatch(/parentId: ID/);
		expect(create).toMatch(/projectId: ID/);
		// The two employee lists are what the write turns into the module-employee pivot.
		expect(create).toMatch(/memberIds: \[ID!\]/);
		expect(create).toMatch(/managerIds: \[ID!\]/);
		// The task list is carried as identifiers, which is what the write reads off each entry.
		expect(create).toMatch(/tasks: \[ID!\]/);
		// The delivered body validates the relation column `members` and the handler then replaces it
		// with the pivot rows it builds from the two lists above, so the member is not offered: a write
		// that is accepted and silently discarded is worse than one not offered.
		expect(create).not.toMatch(/\bmembers:/);
		// No member names the tenant, because the tenant comes from the credential on every write here.
		expect(create).not.toContain('tenantId');
		// The base body's own transport marker has no column on this row, and the two lifecycle markers
		// are what a lifecycle route writes about a row that exists rather than facts about a new one.
		expect(create).not.toContain('sentTo');
		expect(create).not.toContain('deletedAt');
		expect(create).not.toContain('archivedAt');
		for (const collection of ['children', 'views', 'organizationSprints']) {
			expect(create).not.toContain(collection);
		}
		// A create that names an existing row is the edit stated on the create route, and a caller that
		// means to change a row has the edit field for it.
		expect(create).not.toMatch(/\bid: ID/);
	});

	it('declares the edit members with the criterion stated and every fact optional', () => {
		const update = inputBody('UpdateOrganizationProjectModuleInput');

		expect(update).toMatch(/id: ID!/);
		expect(update).toMatch(/name: String\n/);
		expect(update).toMatch(/organizationId: ID\n/);
		expect(update).toMatch(/memberIds: \[ID!\]/);
		expect(update).toMatch(/tasks: \[ID!\]/);
		// A member the caller leaves out is left as it is by the delivered write, which is why nothing
		// but the criterion is required.
		expect(update).not.toContain('name: String!');
		expect(update).not.toContain('organizationId: ID!');
		expect(update).not.toContain('tenantId');
	});
});

describe('OrganizationProjectModuleResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationProjectModuleService } = surfaces();

		const connection = await resolver.organizationProjectModules(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its query string states nothing.
		expect(organizationProjectModuleService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ROLLOUT);
	});

	it('applies the order it means when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationProjectModules();

		// The delivered list method fixes no order, so the connection's own is what the answer is in:
		// newest first, which the service's own order deliberately is not.
		expect(connection.nodes.map((node) => node.id)).toEqual([ROLLOUT, ONBOARDING]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationProjectModules({ name: { ilike: 'acm%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([ONBOARDING]);

		const byStatus = await resolver.organizationProjectModules({ status: { eq: 'in-progress' } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([ROLLOUT]);

		const byProject = await resolver.organizationProjectModules({ projectId: { eq: FIRST_PROJECT } });
		expect(byProject.nodes.map((node) => node.id)).toEqual([ONBOARDING]);

		// The self-reference is a filter like any other column, which is how a caller reads the roots of
		// the module tree.
		const roots = await resolver.organizationProjectModules({ parentId: { isNull: true } });
		expect(roots.nodes.map((node) => node.id)).toEqual([ONBOARDING]);
	});

	it('refuses a filter on the pivot the list read does not join, rather than selecting nothing', async () => {
		const { resolver } = surfaces();

		const refusal = await resolver
			.organizationProjectModules({ members: { eq: EMPLOYEE } })
			.catch((thrown) => thrown);

		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationProjectModules(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([ONBOARDING, ROLLOUT]);

		const byPlan = await resolver.organizationProjectModules(undefined, [
			{ field: 'startDate', direction: 'DESC' }
		]);
		expect(byPlan.nodes.map((node) => node.id)).toEqual([ONBOARDING, ROLLOUT]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `status` is filterable and not sortable: the vocabulary is the platform's own and its
		// alphabetical order is not a lifecycle.
		const error = await resolver
			.organizationProjectModules(undefined, [{ field: 'status', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationProjectModules(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([ROLLOUT]);

		const second = await resolver.organizationProjectModules(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([ONBOARDING]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.organizationProjectModules(undefined, undefined, undefined, 20);

		const last = await resolver.organizationProjectModules(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([ROLLOUT]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationProjectModules(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('OrganizationProjectModuleResolver — one concept, two protocols, the same operations', () => {
	it('reads one module through the same service method the REST route calls', async () => {
		const { resolver, organizationProjectModuleService } = surfaces();

		expect(await resolver.organizationProjectModule(ROLLOUT)).toBe(ROWS[1]);
		expect(organizationProjectModuleService.findOneByIdString).toHaveBeenCalledWith(ROLLOUT);
	});

	it('answers null for a module that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, organizationProjectModuleService } = surfaces();
		organizationProjectModuleService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organizationProjectModule(ONBOARDING)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, organizationProjectModuleService } = surfaces();

		expect(await resolver.organizationProjectModuleCount()).toBe(2);
		expect(organizationProjectModuleService.countBy).toHaveBeenCalledWith();
	});

	it('reads the caller’s own modules through the delivered employee read', async () => {
		const { resolver, organizationProjectModuleService } = surfaces();

		const connection = await resolver.employeeProjectModules(undefined, undefined, undefined, 20);

		// The read resolves the employee from the credential, which is why the field states no employee:
		// the route answers the same read with its query string unstated. The criterion is stated as an
		// empty object rather than omitted, because the delivered read destructures `where` off it.
		expect(organizationProjectModuleService.getEmployeeProjectModules).toHaveBeenCalledWith({ where: {} });
		expect(connection.nodes.map((node) => node.id)).toEqual([ONBOARDING]);
		// The pivot read fixes a page of its own, so the total is the count of the rows it answered.
		expect(connection.totalCount).toBe(1);
	});

	it('reads the caller’s teams’ modules through the delivered team read', async () => {
		const { resolver, organizationProjectModuleService } = surfaces();

		const connection = await resolver.teamProjectModules(undefined, undefined, undefined, 20);

		expect(organizationProjectModuleService.findTeamProjectModules).toHaveBeenCalledWith({ where: {} });
		expect(connection.nodes.map((node) => node.id)).toEqual([ROLLOUT]);
		expect(connection.totalCount).toBe(1);
	});

	it('reads one employee’s modules through the read the field names the employee for', async () => {
		const { resolver, organizationProjectModuleService } = surfaces();

		const connection = await resolver.organizationProjectModulesByEmployee(
			EMPLOYEE,
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			20
		);

		// The organization is the criterion the route's own query DTO requires; the tenant is applied by
		// the read from the credential and is not stated here.
		expect(organizationProjectModuleService.findByEmployee).toHaveBeenCalledWith(EMPLOYEE, {
			organizationId: ORGANIZATION
		});
		expect(connection.nodes.map((node) => node.id)).toEqual([ONBOARDING]);
		expect(connection.totalCount).toBe(1);
	});

	it('files a module through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createOrganizationProjectModule({
			organizationId: ORGANIZATION,
			name: 'Acme Onboarding',
			status: 'backlog',
			memberIds: [EMPLOYEE],
			managerIds: [],
			tasks: [TASK]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationProjectModuleCreateCommand);
		// The task identifiers are carried as the rows the handler reads an identifier off, which is the
		// shape the delivered body has.
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			name: 'Acme Onboarding',
			status: 'backlog',
			memberIds: [EMPLOYEE],
			managerIds: [],
			tasks: [{ id: TASK }]
		});
		// The tenant is never a member of the payload: the service stamps it from the credential.
		expect(command.input).not.toHaveProperty('tenantId');
	});

	it('edits a module through the command the REST route dispatches, and answers the row read back', async () => {
		const { resolver, commandBus, organizationProjectModuleService } = surfaces();

		const answer = await resolver.updateOrganizationProjectModule({
			id: ROLLOUT,
			name: 'Zephyr Rollout',
			tasks: [TASK]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationProjectModuleUpdateCommand);
		expect(command.id).toBe(ROLLOUT);
		// The delivered route carries the identifier in the path and the facts in the body, so the
		// payload is the body and the identifier is not repeated inside it.
		expect(command.input).toEqual({ name: 'Zephyr Rollout', tasks: [{ id: TASK }] });
		// The write's own answer is a row or an update-result envelope, so the field answers the row it
		// reads back — which is what a client reads next anyway.
		expect(organizationProjectModuleService.findOneByIdString).toHaveBeenCalledWith(ROLLOUT);
		expect(answer).toBe(ROWS[1]);
	});

	it('removes a module through the same service method the REST route calls', async () => {
		const { resolver, organizationProjectModuleService } = surfaces();

		expect(await resolver.deleteOrganizationProjectModule(ROLLOUT)).toBe(true);
		expect(organizationProjectModuleService.delete).toHaveBeenCalledWith(ROLLOUT);
	});

	it('withdraws and restores a module through the same service methods the REST routes call', async () => {
		const { resolver, organizationProjectModuleService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganizationProjectModule(ROLLOUT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(organizationProjectModuleService.softRemove).toHaveBeenCalledWith(ROLLOUT);

		expect(await resolver.recoverOrganizationProjectModule(ROLLOUT)).toBe(ROWS[1]);
		expect(organizationProjectModuleService.softRecover).toHaveBeenCalledWith(ROLLOUT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, organizationProjectModuleService } = surfaces();
		const refusal = new Error('PROJECT_MODULE_STILL_REFERENCED: a task still points at this module.');

		organizationProjectModuleService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteOrganizationProjectModule(ROLLOUT)).rejects.toBe(refusal);
	});
});

describe('OrganizationProjectModuleResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationProjectModuleResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationProjectModuleController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', OrganizationProjectModuleResolver) ?? [];
		const routes = [
			'findAll',
			'findById',
			'getCount',
			'getEmployeeProjectModules',
			'findTeamProjectModules',
			'findByEmployee',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		];

		for (const handler of routes) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(OrganizationProjectModuleController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationProjectModuleResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationProjectModuleController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationProjectModuleResolver)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['organizationProjectModules', 'findAll'],
			['organizationProjectModule', 'findById'],
			['organizationProjectModuleCount', 'getCount'],
			['employeeProjectModules', 'getEmployeeProjectModules'],
			['teamProjectModules', 'findTeamProjectModules'],
			['organizationProjectModulesByEmployee', 'findByEmployee'],
			['createOrganizationProjectModule', 'create'],
			['updateOrganizationProjectModule', 'update'],
			['deleteOrganizationProjectModule', 'delete'],
			['softDeleteOrganizationProjectModule', 'softRemove'],
			['recoverOrganizationProjectModule', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [
				field,
				permissionOfRoute(OrganizationProjectModuleController, handler)
			])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the class-level edit permission on the count and the two lifecycle moves, whose routes declare none', () => {
		// The three routes are inherited from the platform's CRUD base, whose handlers carry no permission
		// declaration at all, so the permission guard falls back to the controller's class-level edit
		// permission — and the fields state that rather than the read permission their neighbours carry.
		for (const handler of ['getCount', 'softRemove', 'softRecover']) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(OrganizationProjectModuleController)[handler])
			).toBeUndefined();
			expect(permissionOfRoute(OrganizationProjectModuleController, handler)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT
			]);
		}

		expect(permissionOfField('organizationProjectModuleCount')).toEqual([PermissionsEnum.ALL_ORG_EDIT]);
		expect(permissionOfField('softDeleteOrganizationProjectModule')).toEqual([PermissionsEnum.ALL_ORG_EDIT]);
		expect(permissionOfField('recoverOrganizationProjectModule')).toEqual([PermissionsEnum.ALL_ORG_EDIT]);

		// The four reads the controller declares state the view permission beside the module's own read
		// permission, and every field that mirrors one states both.
		for (const field of [
			'organizationProjectModules',
			'organizationProjectModule',
			'employeeProjectModules',
			'teamProjectModules',
			'organizationProjectModulesByEmployee'
		]) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_VIEW,
				PermissionsEnum.PROJECT_MODULE_READ
			]);
		}

		// The three writes state the edit permission beside the verb of their own route.
		expect(permissionOfField('createOrganizationProjectModule')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.PROJECT_MODULE_CREATE
		]);
		expect(permissionOfField('updateOrganizationProjectModule')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.PROJECT_MODULE_UPDATE
		]);
		expect(permissionOfField('deleteOrganizationProjectModule')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.PROJECT_MODULE_DELETE
		]);
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
		getHandler: () => (OrganizationProjectModuleResolver.prototype as never)[field],
		getClass: () => OrganizationProjectModuleResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationProjectModuleResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationProjectModuleResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationProjectModuleResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('organizationProjectModules'))
			.catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('organizationProjectModules');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationProjectModules'))).resolves.toBe(true);
	});
});
