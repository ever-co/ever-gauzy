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
import { MODULE_METADATA } from '@nestjs/common/constants';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum, RolesEnum, StatusTypesEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA, ROLES_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, RoleGuard, TenantPermissionGuard } from '../shared/guards';
import { TimeOffRequestController } from './time-off-request.controller';
import { TimeOffRequestModule } from './time-off-request.module';
import { TimeOffRequestResolver } from './time-off-request.resolver';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffStatusCommand } from './commands';

/**
 * Time off requests over GraphQL.
 *
 * The delivered REST routes serve a list twice — `GET /` and `GET /pagination` — one request, a count,
 * a filing, an edit, the two review decisions, and the three lifecycle moves the controller inherits.
 * This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, the list is a
 *   connection with the platform's own cursor codec behind it, and the paginated spelling of the list is
 *   **not** a second root field;
 * - every field reaches the same `TimeOffRequestService` method, or dispatches the same command, that
 *   the REST route reaches — the two review fields dispatch one `TimeOffStatusCommand` between them,
 *   with the two different statuses their routes state;
 * - **the guard chain and the permission are the controller’s, read from its own metadata** — including
 *   the two review routes, which carry `RoleGuard` and the two administrative roles on the handler, the
 *   create route, which restates `PermissionGuard` over a class that already carries it, and the five
 *   routes the controller inherits with no permission of their own;
 * - **`PUT /:id` runs under `TIME_OFF_DELETE`**, which is the delivered route’s own grant, and the field
 *   states that rather than the edit permission the operation’s name suggests;
 * - the list is a connection whose narrowing members are the delivered read’s own, which this surface
 *   has no query string to bind;
 * - the count takes no argument and is nullable, and the three lifecycle moves are three fields.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000010';
const POLICY = '00000000-0000-4000-8000-000000000020';
const FIRST = '00000000-0000-4000-8000-000000000050';
const SECOND = '00000000-0000-4000-8000-000000000051';

/** The two ends of the range the delivered list read is bounded by. */
const RANGE_START = new Date('2026-01-01T00:00:00.000Z');
const RANGE_END = new Date('2026-12-31T23:59:59.000Z');

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them.
 *
 * They are stated oldest first on purpose, so an order asserted below is an order the connection
 * applied rather than the order the fixture happened to be written in.
 */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		policyId: POLICY,
		description: 'Summer holiday',
		start: new Date('2026-07-01T00:00:00.000Z'),
		end: new Date('2026-07-10T00:00:00.000Z'),
		requestDate: new Date('2026-06-01T00:00:00.000Z'),
		status: StatusTypesEnum.REQUESTED,
		isHoliday: false,
		isActive: true,
		isArchived: false,
		deletedAt: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		policyId: POLICY,
		description: 'Winter holiday',
		start: new Date('2026-08-01T00:00:00.000Z'),
		end: new Date('2026-08-05T00:00:00.000Z'),
		requestDate: new Date('2026-07-01T00:00:00.000Z'),
		status: StatusTypesEnum.APPROVED,
		isHoliday: false,
		isActive: true,
		isArchived: false,
		deletedAt: null,
		createdAt: new Date('2026-04-01T10:00:00.000Z'),
		updatedAt: new Date('2026-04-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const timeOffRequestService = {
		getAllTimeOffRequests: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		updateTimeOffByAdmin: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		timeOffRequestService,
		commandBus,
		resolver: new TimeOffRequestResolver(timeOffRequestService as never, commandBus as never)
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

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/**
 * The arguments one root field declares with their types, as a client states them.
 *
 * Read from the built schema rather than matched as text, because a printed field carries the
 * description of every argument between its parentheses and a text match would decide this assertion
 * from the wrong line.
 */
function fieldArgTypes(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string; type: { toString(): string } }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map(
		(argument) => `${argument.name}: ${argument.type.toString()}`
	);
}

/**
 * The type one root field answers with, as the schema states it.
 *
 * Read from the built schema rather than matched as text, because the name of a field is not the name
 * of a *place*: a member of another type may carry the same word, so a text match would decide this
 * assertion from the wrong declaration.
 */
function fieldType(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { type: { toString(): string } }> }
		| undefined;

	return root?.getFields()?.[field]?.type.toString() ?? '';
}

/**
 * The root fields this domain contributes.
 *
 * Ownership is stated by name rather than pattern-matched loosely, because the word is not this
 * domain's alone: `timeOffRequest` is also the name of the entity another domain's rows point at, and
 * three resources in this wave share the `timeOff` prefix.
 */
const OWNED_QUERY_FIELDS = ['timeOffRequest', 'timeOffRequestCount', 'timeOffRequests'];

/** The mutations this domain contributes, by the same reading. */
const OWNED_MUTATION_FIELDS = [
	'approveTimeOffRequest',
	'createTimeOffRequest',
	'deleteTimeOffRequest',
	'denyTimeOffRequest',
	'recoverTimeOffRequest',
	'softDeleteTimeOffRequest',
	'updateTimeOffRequest'
];

/** The root fields of this domain, as they are actually declared. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? OWNED_QUERY_FIELDS : OWNED_MUTATION_FIELDS;

	return rootFields(operation)
		.filter((field) => owned.includes(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type, so a member it must not carry can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof TimeOffRequestController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof TimeOffRequestController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The roles one route runs under, by the same override rule `RoleGuard` applies.
 *
 * `RoleGuard` reads `ROLES_METADATA` with `getAllAndOverride` over `[handler, class]`, so this is the
 * rule the guard itself applies rather than a second reading of the same metadata.
 */
function rolesOfRoute(controller: typeof TimeOffRequestController, handler: string): unknown {
	return (
		Reflect.getMetadata(ROLES_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(ROLES_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof TimeOffRequestController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof TimeOffRequestResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(TimeOffRequestResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TimeOffRequestResolver)
	);
}

/** The roles one resolver field runs under, by the same override rule. */
function rolesOfField(field: string): unknown {
	return (
		Reflect.getMetadata(ROLES_METADATA, fieldsOf(TimeOffRequestResolver)[field]) ??
		Reflect.getMetadata(ROLES_METADATA, TimeOffRequestResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TimeOffRequestResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(TimeOffRequestResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('TimeOffRequestResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection read, the one-row read and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['timeOffRequests', 'timeOffRequest', 'timeOffRequestCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createTimeOffRequest',
				'updateTimeOffRequest',
				'approveTimeOffRequest',
				'denyTimeOffRequest',
				'deleteTimeOffRequest',
				'softDeleteTimeOffRequest',
				'recoverTimeOffRequest'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([...OWNED_QUERY_FIELDS].sort());
		expect(ownedRootFields('Mutation')).toEqual([...OWNED_MUTATION_FIELDS].sort());

		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once.
		for (const spelling of ['timeOffRequestsPagination', 'timeOffRequestsConnection', 'timeOffRequestById']) {
			expect(rootFields('Query')).not.toContain(spelling);
		}

		// Every field above names a handler that exists on the controller, inherited ones included.
		for (const handler of [
			'pagination',
			'findAll',
			'findById',
			'getCount',
			'create',
			'update',
			'timeOffRequestApproved',
			'timeOffRequestDenied',
			'delete',
			'softRemove',
			'softRecover'
		]) {
			expect(typeof handlersOf(TimeOffRequestController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type TimeOffRequestConnection \{\s*nodes: \[TimeOffRequest!\]!\s*edges: \[TimeOffRequestEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type TimeOffRequestEdge \{\s*node: TimeOffRequest!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input TimeOffRequestFilter \{/);
		expect(printed).toMatch(/input TimeOffRequestSort \{/);
		expect(printed).toMatch(
			/enum TimeOffRequestSortField \{\s*createdAt\s*updatedAt\s*start\s*end\s*requestDate\s*status\s*isHoliday\s*\}/
		);
	});

	it('answers the count through a nullable field that takes no argument', () => {
		// The inherited `GET count` answers a bare number, which is not a connection and is not the
		// connection's `totalCount`. Nullable, because an aggregate the resource has no answer for must
		// not be answered as a fabricated zero; and argument-less, because the route passes its query
		// string through as the store's own `where`, which the connection protocol does not speak.
		expect(fieldType('Query', 'timeOffRequestCount')).toBe('Int');
		expect(fieldType('Query', 'timeOffRequestCount')).not.toBe('Int!');
		expect(fieldArgs('Query', 'timeOffRequestCount')).toEqual([]);
	});

	it('states the narrowing the delivered read needs before its own filter, in one order', () => {
		// The delivered read scopes its criterion by the organization and bounds its rows by the two
		// instants, and it has no default for any of the three that a caller could have meant.
		expect(fieldArgs('Query', 'timeOffRequests')).toEqual([
			'organizationId',
			'startDate',
			'endDate',
			'employeeId',
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset'
		]);
		expect(fieldArgTypes('Query', 'timeOffRequests').slice(0, 4)).toEqual([
			'organizationId: ID!',
			'startDate: DateTime!',
			'endDate: DateTime!',
			'employeeId: ID'
		]);
	});

	it('states the lifecycle writes as three separate fields', () => {
		// Removal, withdrawal and recovery are three operations: a client that could not tell them apart
		// could not tell whether the approval record filed beside a request survived its removal.
		expect(printed).toMatch(/deleteTimeOffRequest\(id: ID!\): Boolean!\n/);
		expect(printed).toMatch(/softDeleteTimeOffRequest\(id: ID!\): TimeOffRequest!\n/);
		expect(printed).toMatch(/recoverTimeOffRequest\(id: ID!\): TimeOffRequest!\n/);
	});

	it('states the two decisions as two fields, and the edit as a third', () => {
		expect(printed).toMatch(/approveTimeOffRequest\(id: ID!\): TimeOffRequest!\n/);
		expect(printed).toMatch(/denyTimeOffRequest\(id: ID!\): TimeOffRequest!\n/);
		expect(printed).toMatch(/updateTimeOffRequest\(input: UpdateTimeOffRequestInput!\): TimeOffRequest!\n/);
	});

	it('carries the relations the delivered list read joins, and the identifiers it does not', () => {
		const body = typeBody('TimeOffRequest');

		// The list read left-joins the policy, the employees and each employee's account beside every
		// row, so the first two are members; the asset relation is named by no read here, so what travels
		// is its identifier and its URL.
		expect(body).toMatch(/\bpolicy: TimeOffPolicy\b/);
		expect(body).toMatch(/\bpolicyId: ID\b/);
		expect(body).toMatch(/\bemployees: \[Employee!\]/);
		expect(body).toMatch(/\bdocumentId: ID\b/);
		expect(body).toMatch(/\bdocumentUrl: String\b/);
		expect(body).not.toMatch(/^\s*document:/m);
		expect(body).not.toMatch(/^\s*tenant:/m);
		expect(body).not.toMatch(/\bisDeleted:/);

		// The status is carried as its value rather than redeclared as a schema enum, which is why the
		// two decisions above state no enum of their own either.
		expect(body).toMatch(/\bstatus: String!/);
		expect(printed).not.toMatch(/enum StatusTypesEnum/);
	});

	it('declares a filter whose members are the columns the delivered read returns', () => {
		const body = inputBody('TimeOffRequestFilter');

		expect(body).toMatch(/status: StringFilter/);
		expect(body).toMatch(/start: DateTimeFilter/);
		expect(body).toMatch(/end: DateTimeFilter/);
		expect(body).toMatch(/policyId: IDFilter/);
		expect(body).toMatch(/deletedAt: DateTimeFilter/);
		// The employees are not a member: the row carries them as a collection, so there is no value for
		// the protocol to compare — the field's own `employeeId` argument is what narrows the read.
		expect(body).not.toMatch(/^\s*employees:/m);
	});

	it('declares the two write bodies, each with the members its own operation can change', () => {
		expect(printed).toMatch(/input CreateTimeOffRequestInput \{/);
		expect(printed).toMatch(/input UpdateTimeOffRequestInput \{/);

		const create = inputBody('CreateTimeOffRequestInput');
		expect(create).toMatch(/organizationId: ID!/);
		expect(create).toMatch(/start: DateTime!/);
		expect(create).toMatch(/end: DateTime!/);
		expect(create).toMatch(/requestDate: DateTime!/);
		expect(create).toMatch(/employeeIds: \[ID!\]/);
		expect(create).toMatch(/policyId: ID/);
		expect(create).not.toMatch(/tenantId/);

		// The delivered update body declares one member, so this one does too: a request's dates and its
		// employees are what the request *is*, and rewriting them would leave the approval record filed
		// beside it describing a leave nobody asked for.
		const update = inputBody('UpdateTimeOffRequestInput');
		expect(update).toMatch(/id: ID!/);
		expect(update).toMatch(/status: String/);
		expect(update).not.toMatch(/start:/);
		expect(update).not.toMatch(/employeeIds/);
	});
});

describe('TimeOffRequestResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, timeOffRequestService } = surfaces();

		const connection = await resolver.timeOffRequests(
			ORGANIZATION,
			RANGE_START,
			RANGE_END,
			EMPLOYEE,
			undefined,
			undefined,
			undefined,
			20
		);

		// The read is the one the REST list route performs, with the `findInput` that route builds from
		// its `data` query parameter — and no `relations`, which the delivered read does not take its
		// joins from.
		expect(timeOffRequestService.getAllTimeOffRequests).toHaveBeenCalledWith(undefined, {
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			startDate: RANGE_START,
			endDate: RANGE_END
		});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SECOND);
	});

	it('orders newest filed first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END);

		expect(connection.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('narrows by the fields the filter declares, and refuses the ones it does not', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END, undefined, {
			status: { eq: StatusTypesEnum.REQUESTED }
		});
		expect(byStatus.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byDescription = await resolver.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END, undefined, {
			description: { ilike: '%summer%' }
		});
		expect(byDescription.nodes.map((node) => node.id)).toEqual([FIRST]);

		// The two ends of the leave compare as instants, which is what makes "which leave overlaps this
		// fortnight" a question this input can express.
		const byStart = await resolver.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END, undefined, {
			start: { gte: '2026-07-15T00:00:00.000Z' }
		});
		expect(byStart.nodes.map((node) => node.id)).toEqual([SECOND]);

		// A relation is not filterable, because the protocol compares a value and the row carries a
		// collection there.
		const error = await resolver
			.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END, undefined, { employees: { eq: EMPLOYEE } })
			.catch((thrown) => thrown);
		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers, and refuses a column it does not', async () => {
		const { resolver } = surfaces();

		const byStart = await resolver.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END, undefined, undefined, [
			{ field: 'start', direction: 'ASC' }
		]);
		expect(byStart.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);

		// The column is filterable and is deliberately not sortable: the enum states the keys a request
		// list is read in an order for, and the refusal names what is on offer.
		const error = await resolver
			.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END, undefined, undefined, [
				{ field: 'policyId', direction: 'ASC' }
			] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END, undefined, undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SECOND]);

		const second = await resolver.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END, undefined, undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END, undefined, undefined, undefined, undefined, 20);
		const last = await resolver.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END, undefined, undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END, undefined, undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every request', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timeOffRequests(ORGANIZATION, RANGE_START, RANGE_END, undefined, undefined, undefined, undefined, 500)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('TimeOffRequestResolver — one concept, two protocols, the same operations', () => {
	it('reads one request through the same service method the inherited route calls', async () => {
		const { resolver, timeOffRequestService } = surfaces();

		expect(await resolver.timeOffRequest(FIRST)).toBe(ROWS[0]);
		expect(timeOffRequestService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a request that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, timeOffRequestService } = surfaces();
		timeOffRequestService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.timeOffRequest(SECOND)).toBeNull();
	});

	it('counts through the same service method the inherited count route calls', async () => {
		const { resolver, timeOffRequestService } = surfaces();

		expect(await resolver.timeOffRequestCount()).toBe(2);
		expect(timeOffRequestService.countBy).toHaveBeenCalledWith();
	});

	it('files a request through the same service method the create route calls', async () => {
		const { resolver, timeOffRequestService } = surfaces();

		await resolver.createTimeOffRequest({
			organizationId: ORGANIZATION,
			start: ROWS[0].start,
			end: ROWS[0].end,
			requestDate: ROWS[0].requestDate,
			description: 'Summer holiday',
			employeeIds: [EMPLOYEE],
			policyId: POLICY
		});

		const payload = timeOffRequestService.create.mock.calls[0][0];
		// The two relations are stated as the identifiers the delivered write is written from.
		expect(payload).toEqual({
			organizationId: ORGANIZATION,
			start: ROWS[0].start,
			end: ROWS[0].end,
			requestDate: ROWS[0].requestDate,
			description: 'Summer holiday',
			policy: { id: POLICY },
			employees: [{ id: EMPLOYEE }]
		});
	});

	it('edits a request through the same service method its route calls, under the same body', async () => {
		const { resolver, timeOffRequestService } = surfaces();

		await resolver.updateTimeOffRequest({ id: FIRST, status: StatusTypesEnum.DENIED });

		// The identifier is the delivered write's own first argument, which the route takes from its
		// path, and the body is the one member the delivered update body declares.
		expect(timeOffRequestService.updateTimeOffByAdmin).toHaveBeenCalledWith(FIRST, {
			status: StatusTypesEnum.DENIED
		});
	});

	it('approves through the same command the approval route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.approveTimeOffRequest(FIRST)).toBe(ROWS[0]);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TimeOffStatusCommand);
		expect(command.id).toBe(FIRST);
		expect(command.status).toBe(StatusTypesEnum.APPROVED);
	});

	it('denies through the same command the denial route dispatches, with the other status', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.denyTimeOffRequest(SECOND);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TimeOffStatusCommand);
		expect(command.id).toBe(SECOND);
		expect(command.status).toBe(StatusTypesEnum.DENIED);
	});

	it('removes a request through the same service method the inherited delete route calls', async () => {
		const { resolver, timeOffRequestService } = surfaces();

		expect(await resolver.deleteTimeOffRequest(FIRST)).toBe(true);
		expect(timeOffRequestService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws a request through the same service method the inherited soft-remove route calls', async () => {
		const { resolver, timeOffRequestService } = surfaces();

		const withdrawn = await resolver.softDeleteTimeOffRequest(FIRST);

		expect(timeOffRequestService.softRemove).toHaveBeenCalledWith(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
	});

	it('restores a request through the same service method the inherited recovery route calls', async () => {
		const { resolver, timeOffRequestService } = surfaces();

		expect(await resolver.recoverTimeOffRequest(FIRST)).toBe(ROWS[0]);
		expect(timeOffRequestService.softRecover).toHaveBeenCalledWith(FIRST);
		// Recovery is not a second spelling of the withdrawal: it names the identifier the row kept while
		// it was withdrawn — the one the approval record filed beside it still points at.
		expect(timeOffRequestService.softRemove).not.toHaveBeenCalled();
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('REQUEST_CONFLICT: this request has already been decided.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.approveTimeOffRequest(FIRST)).rejects.toBe(refusal);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain, the roles and the permission of
 * a field are read from the field and from the route's own metadata and compared, rather than restated
 * here: a table of names would agree with the resolver while disagreeing with the controller, which is
 * the failure this half of the doctrine exists to catch.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'timeOffRequests', route: 'findAll' },
	{ field: 'timeOffRequest', route: 'findById' },
	{ field: 'timeOffRequestCount', route: 'getCount' },
	{ field: 'createTimeOffRequest', route: 'create' },
	{ field: 'updateTimeOffRequest', route: 'update' },
	{ field: 'approveTimeOffRequest', route: 'timeOffRequestApproved' },
	{ field: 'denyTimeOffRequest', route: 'timeOffRequestDenied' },
	{ field: 'deleteTimeOffRequest', route: 'delete' },
	{ field: 'softDeleteTimeOffRequest', route: 'softRemove' },
	{ field: 'recoverTimeOffRequest', route: 'softRecover' }
];

describe('TimeOffRequestResolver — the guard stack, the roles and the permission are the route’s', () => {
	it('states on the class the guards and the permission the controller states on its class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', TimeOffRequestController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', TimeOffRequestResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimeOffRequestResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, TimeOffRequestController)
		);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(TimeOffRequestController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(TimeOffRequestController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(TimeOffRequestController, route));
		expect(rolesOfField(field)).toEqual(rolesOfRoute(TimeOffRequestController, route));
	});

	it('states on the two review fields the guard and the roles their own routes carry', () => {
		// `PUT /approval/:id` and `PUT /denied/:id` each add `RoleGuard` and state the two administrative
		// roles over the controller's chain. Nest applies a method-level guard and its metadata to a
		// resolver field the same way it applies them to a controller handler, so the fields state the
		// same two facts; a field that omitted either would let a caller decide leave here whom the route
		// refuses.
		for (const [field, route] of [
			['approveTimeOffRequest', 'timeOffRequestApproved'],
			['denyTimeOffRequest', 'timeOffRequestDenied']
		] as ReadonlyArray<[string, string]>) {
			expect(Reflect.getMetadata('__guards__', handlersOf(TimeOffRequestController)[route])).toEqual([
				RoleGuard
			]);
			expect(Reflect.getMetadata('__guards__', fieldsOf(TimeOffRequestResolver)[field])).toEqual([RoleGuard]);
			expect(rolesOfRoute(TimeOffRequestController, route)).toEqual([
				RolesEnum.SUPER_ADMIN,
				RolesEnum.ADMIN
			]);
			expect(rolesOfField(field)).toEqual([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]);
			expect(guardsOfField(field)).toContain(RoleGuard);
		}

		// No other field of this resolver is role-guarded, because no other route of this resource is.
		for (const field of ['timeOffRequests', 'createTimeOffRequest', 'updateTimeOffRequest']) {
			expect(guardsOfField(field)).not.toContain(RoleGuard);
			expect(rolesOfField(field)).toBeUndefined();
		}
	});

	it('runs the update field under the delete permission, which is the route’s own grant', () => {
		// The delivered `PUT /:id` handler declares `ALL_ORG_EDIT` with `TIME_OFF_DELETE`. That is the
		// route's grant and not a mistake this surface may quietly correct: rewriting a filed request is
		// not the same act as editing a policy, and a permission changed on one surface only is a
		// permission that no longer means one thing.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(TimeOffRequestController)['update'])).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.TIME_OFF_DELETE
		]);
		expect(permissionOfField('updateTimeOffRequest')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.TIME_OFF_DELETE
		]);
		expect(permissionOfField('updateTimeOffRequest')).not.toEqual([PermissionsEnum.TIME_OFF_EDIT]);
	});

	it('states on the create field the guard its own route restates', () => {
		// `POST /` adds `@UseGuards(PermissionGuard)` over a class that already carries it — a
		// restatement rather than a widening — and the field restates it too, so a reader comparing the
		// two surfaces finds the same chain written in the same place.
		expect(Reflect.getMetadata('__guards__', handlersOf(TimeOffRequestController)['create'])).toEqual([
			PermissionGuard
		]);
		expect(Reflect.getMetadata('__guards__', fieldsOf(TimeOffRequestResolver)['createTimeOffRequest'])).toEqual([
			PermissionGuard
		]);
		expect(permissionOfField('createTimeOffRequest')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.TIME_OFF_ADD
		]);
	});

	it('holds the five inherited routes to the class-level permission they run under', () => {
		for (const [field, route] of [
			['timeOffRequest', 'findById'],
			['timeOffRequestCount', 'getCount'],
			['deleteTimeOffRequest', 'delete'],
			['softDeleteTimeOffRequest', 'softRemove'],
			['recoverTimeOffRequest', 'softRecover']
		] as ReadonlyArray<[string, string]>) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(TimeOffRequestController)[route])).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', handlersOf(TimeOffRequestController)[route])).toBeUndefined();
			expect(permissionOfRoute(TimeOffRequestController, route)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.TIME_OFF_EDIT
			]);
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.TIME_OFF_EDIT
			]);
		}

		// The node read of this resource really is an edit-permission read, on both surfaces.
		expect(permissionOfField('timeOffRequest')).not.toEqual([PermissionsEnum.ALL_ORG_VIEW]);
	});
});

describe('TimeOffRequestModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TimeOffRequestModule) ?? []) as unknown[];

		expect(providers).toContain(TimeOffRequestResolver);
		expect(providers).toContain(TimeOffRequestService);
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
		getHandler: () => (TimeOffRequestResolver.prototype as never)[field],
		getClass: () => TimeOffRequestResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TimeOffRequestResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — including the two role-guarded decisions.
		expect(Reflect.getMetadata(FEATURE_METADATA, TimeOffRequestResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TimeOffRequestResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('timeOffRequests')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('timeOffRequests');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('approveTimeOffRequest'))).resolves.toBe(true);
	});
});
