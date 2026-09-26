/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { TimeSheetController } from './timesheet.controller';
import { TimesheetResolver } from './timesheet.resolver';
import { TimesheetSubmitCommand, TimesheetUpdateStatusCommand } from './commands';

/**
 * The timesheet over GraphQL.
 *
 * The delivered REST routes serve a list, one timesheet, a count, a status change and a submission.
 * This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — here that is the class-level approval permission, because none of the controller's
 *   handlers states one of its own;
 * - the selectors the delivered read narrows the store by are arguments of the list field, because a
 *   connection filter is applied to the rows a read has already returned;
 * - a timesheet that is not there is `null` on the one-row field rather than a refusal, and the count
 *   is the count route's own answer rather than the connection's `totalCount`.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const APPROVER = '00000000-0000-4000-8000-000000000004';
const OLDER = '00000000-0000-4000-8000-000000000010';
const NEWER = '00000000-0000-4000-8000-000000000011';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them — which
 * is no order of its own, so the connection's default is what puts them in one.
 */
const ROWS = [
	{
		id: OLDER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		approvedById: null,
		duration: 3600,
		keyboard: 120,
		mouse: 80,
		overall: 300,
		startedAt: new Date('2026-02-01T00:00:00.000Z'),
		stoppedAt: new Date('2026-02-01T01:00:00.000Z'),
		approvedAt: null,
		submittedAt: null,
		lockedAt: null,
		editedAt: null,
		isBilled: false,
		status: 'DRAFT',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	},
	{
		id: NEWER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		approvedById: APPROVER,
		duration: 7200,
		keyboard: 240,
		mouse: 160,
		overall: 420,
		startedAt: new Date('2026-03-01T00:00:00.000Z'),
		stoppedAt: new Date('2026-03-01T02:00:00.000Z'),
		approvedAt: new Date('2026-03-02T10:00:00.000Z'),
		submittedAt: new Date('2026-03-02T09:00:00.000Z'),
		lockedAt: null,
		editedAt: new Date('2026-03-02T08:00:00.000Z'),
		isBilled: true,
		status: 'APPROVED',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-02T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const timeSheetService = {
		getTimeSheets: jest.fn().mockResolvedValue(ROWS),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[1]),
		getTimeSheetCount: jest.fn().mockResolvedValue(ROWS.length)
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS) };

	return {
		timeSheetService,
		commandBus,
		resolver: new TimesheetResolver(timeSheetService as never, commandBus as never)
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
	const root = join(__dirname, '..', '..');
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
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * The project change request is the other concept this directory serves and has a surface of its own,
 * so its fields are excluded: a suite that claimed them here would be asserting the neighbour's
 * delivery rather than this one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => {
			const name = field.toLowerCase();

			return name.includes('timesheet') && !name.includes('projectchange');
		})
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of the controller, inherited ones included. */
function handlersOf(controller: typeof TimeSheetController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof TimeSheetController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof TimeSheetController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = TimesheetResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('TimesheetResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['timesheets', 'timesheet', 'timesheetCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['updateTimesheetStatus', 'submitTimesheet'])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves no `/pagination` route, so there is no second spelling of the list to
		// fold in — and the connection's own `limit`/`offset` are the page.
		expect(ownedRootFields('Query')).toEqual(['timesheet', 'timesheetCount', 'timesheets']);
		expect(ownedRootFields('Mutation')).toEqual(['submitTimesheet', 'updateTimesheetStatus']);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type TimesheetConnection \{\s*nodes: \[Timesheet!\]!\s*edges: \[TimesheetEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type TimesheetEdge \{\s*node: Timesheet!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input TimesheetFilter \{/);
		expect(printed).toMatch(/input TimesheetSort \{/);
		expect(printed).toMatch(
			/enum TimesheetSortField \{\s*createdAt\s*updatedAt\s*startedAt\s*stoppedAt\s*approvedAt\s*submittedAt\s*lockedAt\s*duration\s*status\s*isBilled\s*\}/
		);
	});

	it('carries the columns of the row, and no member the delivered reads leave empty', () => {
		const body = typeBody('Timesheet');

		// The tracked totals are the recalculation's own columns, and each states its unit.
		expect(body).toMatch(/in seconds/);
		expect(body).toMatch(/duration: Int!/);
		expect(body).toMatch(/keyboard: Int!/);
		expect(body).toMatch(/mouse: Int!/);
		expect(body).toMatch(/overall: Int!/);
		// The lifecycle columns, without which the answer to the write that settled a period would not
		// say what it settled it to.
		expect(body).toMatch(/status: String!/);
		expect(body).toMatch(/submittedAt: DateTime/);
		expect(body).toMatch(/approvedAt: DateTime/);
		expect(body).toMatch(/lockedAt: DateTime/);
		expect(body).toMatch(/isBilled: Boolean/);
		expect(body).toMatch(/deletedAt: DateTime/);

		// The delivered reads load a relation only when the caller names it, and this surface names
		// none: the two relations travel as identifiers, so no relation object may be declared.
		expect(body).toMatch(/employeeId: ID/);
		expect(body).toMatch(/approvedById: ID/);
		expect(body).not.toMatch(/employee: Employee/);
		expect(body).not.toMatch(/approvedBy: User/);
		expect(body).not.toMatch(/organization: Organization/);
		expect(body).not.toMatch(/timeLogs/);

		// Nothing on this resource is money, so no member of it is a decimal.
		expect(body).not.toMatch(/:\s*Decimal/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read loads a relation only when the caller names it, and no member of the
		// type could carry one, so `relations` is not an argument here.
		expect(printed).not.toMatch(/timesheets\([^)]*relations/);
		// The count route binds its query string to the store's own narrowing, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/timesheetCount\(/);
	});
});

describe('TimesheetResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, timeSheetService } = surfaces();

		const connection = await resolver.timesheets(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the selectors that route binds.
		expect(timeSheetService.getTimeSheets).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: undefined,
			endDate: undefined,
			status: undefined,
			employeeIds: undefined
		});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(NEWER);
	});

	it('orders newest first when the caller states no order of its own', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.timesheets();

		expect(connection.nodes.map((node) => node.id)).toEqual([NEWER, OLDER]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.timesheets(undefined, undefined, undefined, undefined, undefined, {
			status: { eq: 'DRAFT' }
		});
		expect(byStatus.nodes.map((node) => node.id)).toEqual([OLDER]);

		const byBilled = await resolver.timesheets(undefined, undefined, undefined, undefined, undefined, {
			isBilled: { eq: true }
		});
		expect(byBilled.nodes.map((node) => node.id)).toEqual([NEWER]);

		// A period the platform recomputed as untouched carries no edit instant, which is what
		// `isNull` states and what an `eq` never matches.
		const neverEdited = await resolver.timesheets(undefined, undefined, undefined, undefined, undefined, {
			editedAt: { isNull: true }
		});
		expect(neverEdited.nodes.map((node) => node.id)).toEqual([OLDER]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byDuration = await resolver.timesheets(undefined, undefined, undefined, undefined, undefined, undefined, [
			{ field: 'duration', direction: 'ASC' }
		]);

		expect(byDuration.nodes.map((node) => node.id)).toEqual([OLDER, NEWER]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.timesheets(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([NEWER]);

		const second = await resolver.timesheets(undefined, undefined, undefined, undefined, undefined, undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OLDER]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.timesheets();

		const last = await resolver.timesheets(undefined, undefined, undefined, undefined, undefined, undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([NEWER]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timesheets(undefined, undefined, undefined, undefined, undefined, undefined, [
				{ field: 'employeeId', direction: 'ASC' }
			] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timesheets(undefined, undefined, undefined, undefined, undefined, { timeLogs: { eq: OLDER } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timesheets(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('TimesheetResolver — one concept, two protocols, the same operations', () => {
	it('reads one timesheet through the same service method the REST route calls', async () => {
		const { resolver, timeSheetService } = surfaces();

		expect(await resolver.timesheet(NEWER)).toBe(ROWS[1]);
		expect(timeSheetService.findOneByIdString).toHaveBeenCalledWith(NEWER);
	});

	it('answers null for a timesheet that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, timeSheetService } = surfaces();
		timeSheetService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.timesheet(OLDER)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own empty request', async () => {
		const { resolver, timeSheetService } = surfaces();

		expect(await resolver.timesheetCount()).toBe(2);
		expect(timeSheetService.getTimeSheetCount).toHaveBeenCalledWith({});
	});

	it('moves periods to a new status through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateTimesheetStatus({
			ids: [NEWER, OLDER],
			status: 'APPROVED' as never,
			organizationId: ORGANIZATION
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TimesheetUpdateStatusCommand);
		expect(command.input).toEqual({
			ids: [NEWER, OLDER],
			status: 'APPROVED',
			organizationId: ORGANIZATION
		});
	});

	it('submits periods through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.submitTimesheet({ ids: [NEWER], status: 'submit', organizationId: ORGANIZATION });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TimesheetSubmitCommand);
		expect(command.input).toEqual({ ids: [NEWER], status: 'submit', organizationId: ORGANIZATION });
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('TIMESHEET_NOT_SUBMITTABLE: a locked period cannot be submitted.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.submitTimesheet({ ids: [NEWER], status: 'submit' })).rejects.toBe(refusal);
	});
});

describe('TimesheetResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', TimesheetResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', TimeSheetController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', TimesheetResolver) ?? [];
		const routes = ['get', 'getTimesheetCount', 'updateTimesheetStatus', 'submitTimeSheet', 'findById'];

		for (const handler of routes) {
			// The controller's class chain plus the gate on the endpoint itself and the resolver's are
			// the same set, which is the whole parity claim: a route that added a guard of its own would
			// narrow REST below GraphQL and is caught here. No route here restates one, so the two lists
			// are equal as they stand.
			expect([...guardsOfRoute(TimeSheetController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimesheetResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, TimeSheetController)
		);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['timesheets', 'get'],
			['timesheet', 'findById'],
			['timesheetCount', 'getTimesheetCount'],
			['updateTimesheetStatus', 'updateTimesheetStatus'],
			['submitTimesheet', 'submitTimeSheet']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(TimeSheetController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the approval permission on the reads, because the routes they mirror do', () => {
		// No handler of this controller states a permission of its own, so every route — the reads
		// included — runs under the class-level approval grant. Reading one period and listing them
		// requiring the same grant is the controller's own symmetry; widening it here, on one surface
		// only, is exactly what the two-protocol rule forbids.
		for (const field of ['timesheets', 'timesheet', 'timesheetCount']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.CAN_APPROVE_TIMESHEET]);
		}
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimeSheetController.prototype.get)).toBeUndefined();
		expect(permissionOfRoute(TimeSheetController, 'get')).toEqual([PermissionsEnum.CAN_APPROVE_TIMESHEET]);
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
		getHandler: () => (TimesheetResolver.prototype as never)[field],
		getClass: () => TimesheetResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TimesheetResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, TimesheetResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TimesheetResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('timesheets')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('timesheets');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('submitTimesheet'))).resolves.toBe(true);
	});
});
