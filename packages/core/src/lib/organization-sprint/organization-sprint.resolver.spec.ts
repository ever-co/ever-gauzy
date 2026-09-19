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
import { OrganizationSprintController } from './organization-sprint.controller';
import { OrganizationSprintResolver } from './organization-sprint.resolver';
import { OrganizationSprintCreateCommand, OrganizationSprintUpdateCommand } from './commands';

/**
 * The organization sprint over GraphQL.
 *
 * The delivered REST routes serve a sprint list, one sprint, a count, a filing, an edit, a removal, and
 * the withdrawal and restoration of a sprint. This suite pins the half of the two-protocol doctrine that
 * is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the three inherited routes, whose count and two lifecycle moves carry no
 *   declaration of their own and therefore run under the controller's class-level edit permission;
 * - the members the delivered read can produce are what the object type carries, and the pivot rows the
 *   read does not join are identifiers or are absent rather than fields that would answer null;
 * - a sprint that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const PROJECT = '00000000-0000-4000-8000-000000000003';
const MEMBER = '00000000-0000-4000-8000-000000000004';

/** The earlier sprint, which the delivered list method returns first. */
const CLOSED_SPRINT = '00000000-0000-4000-8000-000000000010';

/** The later sprint, which the connection orders ahead of it by default. */
const OPEN_SPRINT = '00000000-0000-4000-8000-000000000011';

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them.
 */
const ROWS = [
	{
		id: CLOSED_SPRINT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		projectId: PROJECT,
		name: 'Checkout hardening',
		goal: 'Close the cart',
		length: 14,
		startDate: new Date('2026-03-01T00:00:00.000Z'),
		endDate: new Date('2026-03-15T00:00:00.000Z'),
		status: 'active',
		dayStart: 2,
		sprintProgress: { completed: 3, total: 8 },
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-05T10:00:00.000Z')
	},
	{
		id: OPEN_SPRINT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		projectId: PROJECT,
		name: 'Search revamp',
		goal: null,
		length: 7,
		startDate: new Date('2026-04-01T00:00:00.000Z'),
		endDate: new Date('2026-04-08T00:00:00.000Z'),
		status: 'draft',
		dayStart: 1,
		sprintProgress: null,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-04-01T10:00:00.000Z'),
		updatedAt: new Date('2026-04-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const organizationSprintService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		organizationSprintService,
		commandBus,
		resolver: new OrganizationSprintResolver(organizationSprintService as never, commandBus as never)
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
 * The concept's name is a **prefix** of the plural spelling — `organizationSprint` begins
 * `organizationSprints` — and of nothing else in the schema, so the match is anchored at both ends
 * rather than a substring search, which would have counted a neighbour's field as this one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned =
		operation === 'Query'
			? /^organizationSprint(s|Count)?$/
			: /^(create|update|delete|softDelete|recover)OrganizationSprint$/;

	return rootFields(operation)
		.filter((field) => owned.test(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type, so its members can be read off the schema itself. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed arguments of one root field, so the query protocol it takes can be asserted. */
function argumentList(field: string): string {
	return printed.match(new RegExp(`${field}\\(([\\s\\S]*?)\\):`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationSprintController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file. An *empty* declaration counts as a
 * declaration here, and an undeclared one does not: the three inherited routes state nothing of their
 * own and are therefore answered by the class.
 */
function permissionOfRoute(controller: typeof OrganizationSprintController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationSprintController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationSprintResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('OrganizationSprintResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['organizationSprints', 'organizationSprint', 'organizationSprintCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationSprint',
				'updateOrganizationSprint',
				'deleteOrganizationSprint',
				'softDeleteOrganizationSprint',
				'recoverOrganizationSprint'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and the `GET /pagination` it inherits from the
		// CRUD base — and the two answer one question, so the surface states it once: a second root field
		// for the paginated spelling would be a second surface that could disagree with this one.
		expect(typeof handlersOf(OrganizationSprintController).pagination).toBe('function');
		expect(ownedRootFields('Query')).toEqual([
			'organizationSprint',
			'organizationSprintCount',
			'organizationSprints'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOrganizationSprint',
			'deleteOrganizationSprint',
			'recoverOrganizationSprint',
			'softDeleteOrganizationSprint',
			'updateOrganizationSprint'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OrganizationSprintConnection \{\s*nodes: \[OrganizationSprint!\]!\s*edges: \[OrganizationSprintEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type OrganizationSprintEdge \{\s*node: OrganizationSprint!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input OrganizationSprintFilter \{/);
		expect(printed).toMatch(/input OrganizationSprintSort \{/);
		expect(printed).toMatch(
			/enum OrganizationSprintSortField \{\s*createdAt\s*updatedAt\s*name\s*startDate\s*endDate\s*status\s*length\s*\}/
		);
	});

	it('takes the query protocol on the list, with the page it performs among its arguments', () => {
		const args = argumentList('organizationSprints');

		expect(args).toMatch(/filter: OrganizationSprintFilter/);
		expect(args).toMatch(/sort: \[OrganizationSprintSort!\]/);
		expect(args).toMatch(/page: PageInput/);
		expect(args).toMatch(/first: Int/);
		expect(args).toMatch(/after: String/);
		expect(args).toMatch(/last: Int/);
		expect(args).toMatch(/before: String/);
		expect(args).toMatch(/limit: Int/);
		expect(args).toMatch(/offset: Int/);
	});

	it('carries the sprint’s own window, its two vocabularies and its relation identifier', () => {
		const body = typeBody('OrganizationSprint');

		expect(body).toMatch(/name: String!/);
		// The row states its own window: the two boundary instants and the number of days it spans.
		expect(body).toMatch(/startDate: DateTime/);
		expect(body).toMatch(/endDate: DateTime/);
		expect(body).toMatch(/length: Int!/);
		// Both vocabularies are the platform's own, so they are carried as their values rather than
		// redeclared as enums this domain does not own.
		expect(body).toMatch(/status: String/);
		expect(body).toMatch(/dayStart: Int/);
		expect(body).toMatch(/sprintProgress: JSON/);
		// The project is a relation the delivered read does not join, so the identifier is what travels.
		expect(body).toMatch(/projectId: ID/);
		// Nothing on this row is an amount, so no member of this type is a Decimal.
		expect(body).not.toContain('Decimal');
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('carries no pivot and no relation member the delivered read does not join', () => {
		const body = typeBody('OrganizationSprint');

		// The project itself is joined only when a REST caller names it in `relations`, which this
		// surface never does: `projectId` is the column and the row is read from the project surface.
		expect(body).not.toMatch(/\bproject:/);
		// The membership pivot and the task links are not columns of this row at all — the pivot points
		// at the sprint, and a task names its sprint — so neither has an identifier here to carry.
		for (const relation of [
			'members',
			'tasks',
			'taskSprints',
			'modules',
			'views',
			'fromSprintTaskHistories',
			'toSprintTaskHistories'
		]) {
			expect(body).not.toMatch(new RegExp(`\\b${relation}:`));
		}
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/organizationSprints\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour — and it answers a
		// nullable Int, because a count a resource may have no answer for is not a fabricated zero.
		expect(printed).toMatch(/^\s*organizationSprintCount: Int$/m);
	});

	it('declares only the create members the delivered body validates, and never the tenant', () => {
		const body = inputBody('CreateOrganizationSprintInput');

		expect(body).toMatch(/organizationId: ID!/);
		expect(body).toMatch(/projectId: ID!/);
		expect(body).toMatch(/name: String!/);
		// The delivered body states no optional validator behind these three, so the columns' own
		// defaults are not what a caller that leaves them out is answered with.
		expect(body).toMatch(/length: Int!/);
		expect(body).toMatch(/status: String!/);
		expect(body).toMatch(/goal: String/);
		expect(body).toMatch(/startDate: DateTime/);
		expect(body).toMatch(/endDate: DateTime/);
		expect(body).toMatch(/dayStart: Int/);
		expect(body).toMatch(/sprintProgress: JSON/);
		// The two relations the delivered write reads and stores as the sprint's membership rows.
		expect(body).toMatch(/memberIds: \[ID!\]/);
		expect(body).toMatch(/managerIds: \[ID!\]/);
		// No member names the tenant: the handler takes it from the credential on every write here.
		expect(body).not.toContain('tenantId');
		// The base row's bookkeeping is not offered either: the withdrawal marker belongs to the two
		// lifecycle routes, and the flags and timestamps are the platform's own rather than facts a
		// caller files a sprint with.
		expect(body).not.toContain('deletedAt');
		expect(body).not.toContain('isActive');
		expect(body).not.toContain('isArchived');
	});

	it('declares the edit as the create body made partial, with the identifier as the criterion', () => {
		const body = inputBody('UpdateOrganizationSprintInput');

		expect(body).toMatch(/^\s*id: ID!$/m);
		expect(body).toMatch(/^\s*organizationId: ID$/m);
		expect(body).toMatch(/^\s*projectId: ID$/m);
		expect(body).toMatch(/^\s*name: String$/m);
		expect(body).toMatch(/^\s*length: Int$/m);
		expect(body).toMatch(/^\s*status: String$/m);
		expect(body).toMatch(/memberIds: \[ID!\]/);
		expect(body).toMatch(/managerIds: \[ID!\]/);
		expect(body).not.toContain('tenantId');
	});
});

describe('OrganizationSprintResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationSprintService } = surfaces();

		const connection = await resolver.organizationSprints(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its `data` parameter names neither a
		// criterion nor a relation: the route hands the service both members, unstated.
		expect(organizationSprintService.findAll).toHaveBeenCalledWith({ where: undefined, relations: undefined });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(OPEN_SPRINT);
	});

	it('orders newest first when the caller states no order', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationSprints();

		expect(connection.nodes.map((node) => node.id)).toEqual([OPEN_SPRINT, CLOSED_SPRINT]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.organizationSprints({ status: { eq: 'draft' } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([OPEN_SPRINT]);

		const byName = await resolver.organizationSprints({ name: { ilike: 'checkout%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([CLOSED_SPRINT]);

		const byProject = await resolver.organizationSprints({ projectId: { eq: PROJECT } });
		expect(byProject.nodes.map((node) => node.id)).toEqual([OPEN_SPRINT, CLOSED_SPRINT]);

		// A sprint filed with no goal carries none, which is what `isNull` states and what an `eq` never
		// matches.
		const withoutGoal = await resolver.organizationSprints({ goal: { isNull: true } });
		expect(withoutGoal.nodes.map((node) => node.id)).toEqual([OPEN_SPRINT]);

		// A pivot the delivered read does not join is not a filter, so it is refused rather than
		// evaluated against a row that carries none of it.
		const refusal = await resolver
			.organizationSprints({ members: { eq: MEMBER } })
			.catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationSprints(undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([OPEN_SPRINT, CLOSED_SPRINT]);

		const byLength = await resolver.organizationSprints(undefined, [{ field: 'length', direction: 'ASC' }]);
		expect(byLength.nodes.map((node) => node.id)).toEqual([OPEN_SPRINT, CLOSED_SPRINT]);

		// The two window keys are what a caller reads a timeline with, which is why the enum offers them.
		const byWindow = await resolver.organizationSprints(undefined, [{ field: 'startDate', direction: 'ASC' }]);
		expect(byWindow.nodes.map((node) => node.id)).toEqual([CLOSED_SPRINT, OPEN_SPRINT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationSprints(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([OPEN_SPRINT]);

		const second = await resolver.organizationSprints(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([CLOSED_SPRINT]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.organizationSprints(undefined, undefined, undefined, 20);

		const last = await resolver.organizationSprints(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([OPEN_SPRINT]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// The project is filterable and not sortable, which is the allow-list's own statement rather than
		// a property of the column.
		const error = await resolver
			.organizationSprints(undefined, [{ field: 'projectId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationSprints(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('OrganizationSprintResolver — one concept, two protocols, the same operations', () => {
	it('reads one sprint through the same service method the REST route calls', async () => {
		const { resolver, organizationSprintService } = surfaces();

		expect(await resolver.organizationSprint(CLOSED_SPRINT)).toBe(ROWS[0]);
		expect(organizationSprintService.findOneByIdString).toHaveBeenCalledWith(CLOSED_SPRINT);
	});

	it('answers null for a sprint that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, organizationSprintService } = surfaces();
		organizationSprintService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organizationSprint(OPEN_SPRINT)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, organizationSprintService } = surfaces();

		expect(await resolver.organizationSprintCount()).toBe(2);
		expect(organizationSprintService.countBy).toHaveBeenCalledWith();
	});

	it('files a sprint through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createOrganizationSprint({
			organizationId: ORGANIZATION,
			projectId: PROJECT,
			name: 'Search revamp',
			length: 7,
			status: 'draft',
			memberIds: [MEMBER]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationSprintCreateCommand);
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			projectId: PROJECT,
			name: 'Search revamp',
			length: 7,
			status: 'draft',
			memberIds: [MEMBER]
		});
		// The tenant is never a member of the payload: the handler stamps it from the credential.
		expect(command.input).not.toHaveProperty('tenantId');
	});

	it('edits a sprint through the command the REST route dispatches, with the identifier as the criterion', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateOrganizationSprint({ id: OPEN_SPRINT, name: 'Search revamp', status: 'active' });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationSprintUpdateCommand);
		expect(command.id).toBe(OPEN_SPRINT);
		// The delivered route carries the identifier in the path and the facts in the body, so the
		// payload is the body and the identifier is not repeated inside it.
		expect(command.input).toEqual({ name: 'Search revamp', status: 'active' });
	});

	it('removes a sprint through the same service method the REST route calls', async () => {
		const { resolver, organizationSprintService } = surfaces();

		expect(await resolver.deleteOrganizationSprint(CLOSED_SPRINT)).toBe(true);
		expect(organizationSprintService.delete).toHaveBeenCalledWith(CLOSED_SPRINT);
	});

	it('withdraws and restores a sprint through the same service methods the REST routes call', async () => {
		const { resolver, organizationSprintService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganizationSprint(CLOSED_SPRINT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(organizationSprintService.softRemove).toHaveBeenCalledWith(CLOSED_SPRINT);

		expect(await resolver.recoverOrganizationSprint(CLOSED_SPRINT)).toBe(ROWS[0]);
		expect(organizationSprintService.softRecover).toHaveBeenCalledWith(CLOSED_SPRINT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, organizationSprintService } = surfaces();
		const refusal = new Error('ORGANIZATION_SPRINT_STILL_REFERENCED: a task still points at this sprint.');

		organizationSprintService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteOrganizationSprint(CLOSED_SPRINT)).rejects.toBe(refusal);
	});
});

describe('OrganizationSprintResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationSprintResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationSprintController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', OrganizationSprintResolver) ?? [];
		const routes = ['findAll', 'findById', 'getCount', 'create', 'update', 'delete', 'softRemove', 'softRecover'];

		for (const handler of routes) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(OrganizationSprintController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationSprintResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationSprintController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationSprintResolver)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['organizationSprints', 'findAll'],
			['organizationSprint', 'findById'],
			['organizationSprintCount', 'getCount'],
			['createOrganizationSprint', 'create'],
			['updateOrganizationSprint', 'update'],
			['deleteOrganizationSprint', 'delete'],
			['softDeleteOrganizationSprint', 'softRemove'],
			['recoverOrganizationSprint', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(OrganizationSprintController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the class permission on the three inherited routes, and each route’s own pair elsewhere', () => {
		// The count, the withdrawal and the recovery are inherited from the CRUD base and declare no
		// permission of their own, so the guard answers with the controller's class-level edit permission
		// — and the fields state that rather than the view permission their read siblings state. Stating
		// the view permission here would serve, over this protocol, a caller the REST route refuses.
		for (const handler of ['getCount', 'softRemove', 'softRecover']) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(OrganizationSprintController)[handler])
			).toBeUndefined();
			expect(permissionOfRoute(OrganizationSprintController, handler)).toEqual([PermissionsEnum.ALL_ORG_EDIT]);
		}
		for (const field of ['organizationSprintCount', 'softDeleteOrganizationSprint', 'recoverOrganizationSprint']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ALL_ORG_EDIT]);
		}

		// The two read routes state the same pair, and the node query is not the odd one out here: the
		// controller declares its `GET /:id` rather than inheriting it, and states the view pair on it.
		for (const field of ['organizationSprints', 'organizationSprint']) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_VIEW,
				PermissionsEnum.ORG_SPRINT_VIEW
			]);
		}

		// The three writes the controller declares each state their own pair beside the edit permission.
		expect(permissionOfField('createOrganizationSprint')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_SPRINT_ADD
		]);
		expect(permissionOfField('updateOrganizationSprint')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_SPRINT_EDIT
		]);
		expect(permissionOfField('deleteOrganizationSprint')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_SPRINT_DELETE
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
		getHandler: () => (OrganizationSprintResolver.prototype as never)[field],
		getClass: () => OrganizationSprintResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationSprintResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationSprintResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationSprintResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('organizationSprints')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('organizationSprints');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationSprints'))).resolves.toBe(true);
	});
});
