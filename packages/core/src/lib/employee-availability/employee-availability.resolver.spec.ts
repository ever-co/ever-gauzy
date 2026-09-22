/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmployeeAvailabilityController } from './employee-availability.controller';
import { EmployeeAvailabilityModule } from './employee-availability.module';
import { EmployeeAvailabilityResolver } from './employee-availability.resolver';
import { EmployeeAvailabilityService } from './employee-availability.service';
import { EmployeeAvailabilityBulkCreateCommand, EmployeeAvailabilityCreateCommand } from './commands';

/**
 * Where an employee's availability lives, over GraphQL.
 *
 * The delivered REST routes serve a list, one row, a count, a filing, a bulk filing, an edit, a removal
 * and the withdrawal and restoration of a row. This suite pins the half of the two-protocol doctrine
 * that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the five fields whose routes are inherited from the CRUD base without a
 *   permission of their own, which therefore carry the controller's class-level pair;
 * - the vocabulary of `availabilityStatus` is carried as its value and the mapping stays where it lives,
 *   so the schema neither redeclares a value set nor hides which column it comes from;
 * - the relation is carried as the identifier that always travels rather than as a field no read here
 *   could answer.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE_A = '00000000-0000-4000-8000-000000000003';
const EMPLOYEE_B = '00000000-0000-4000-8000-000000000004';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE_A,
		startDate: new Date('2026-03-02T09:00:00.000Z'),
		endDate: new Date('2026-03-31T17:00:00.000Z'),
		dayOfWeek: 1,
		availabilityStatus: 'Available',
		availabilityNotes: 'Mornings only',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE_B,
		startDate: new Date('2026-02-02T09:00:00.000Z'),
		endDate: new Date('2026-02-28T17:00:00.000Z'),
		dayOfWeek: 5,
		availabilityStatus: 'Unavailable',
		availabilityNotes: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const employeeAvailabilityService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		employeeAvailabilityService,
		commandBus,
		resolver: new EmployeeAvailabilityResolver(employeeAvailabilityService as never, commandBus as never)
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('employeeavailabilit'))
		.sort();
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
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
function handlersOf(controller: typeof EmployeeAvailabilityController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EmployeeAvailabilityController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmployeeAvailabilityController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof EmployeeAvailabilityResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeAvailabilityResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeAvailabilityResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', EmployeeAvailabilityResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(EmployeeAvailabilityResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EmployeeAvailabilityResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['employeeAvailabilities', 'employeeAvailability', 'employeeAvailabilityCount'])
		);
	});

	it('declares one mutation per delivered write route, the bulk filing included', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createEmployeeAvailability',
				'createEmployeeAvailabilities',
				'updateEmployeeAvailability',
				'deleteEmployeeAvailability',
				'softDeleteEmployeeAvailability',
				'recoverEmployeeAvailability'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and the `GET /pagination` it inherits — and the
		// two answer one question, so the surface states it once: a second root field for the paginated
		// spelling would be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual([
			'employeeAvailabilities',
			'employeeAvailability',
			'employeeAvailabilityCount'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEmployeeAvailabilities',
			'createEmployeeAvailability',
			'deleteEmployeeAvailability',
			'recoverEmployeeAvailability',
			'softDeleteEmployeeAvailability',
			'updateEmployeeAvailability'
		]);
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining(['employeeAvailabilitiesPagination', 'employeeAvailabilityPagination'])
		);

		// Every field above names a handler that exists on the controller, inherited ones included.
		for (const handler of ['createBulk', 'findAll', 'create', 'update', 'findById', 'getCount', 'delete', 'softRemove', 'softRecover']) {
			expect(typeof handlersOf(EmployeeAvailabilityController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EmployeeAvailabilityConnection \{\s*nodes: \[EmployeeAvailability!\]!\s*edges: \[EmployeeAvailabilityEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type EmployeeAvailabilityEdge \{\s*node: EmployeeAvailability!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input EmployeeAvailabilityFilter \{/);
		expect(printed).toMatch(/input EmployeeAvailabilitySort \{/);
		expect(printed).toMatch(
			/enum EmployeeAvailabilitySortField \{\s*createdAt\s*updatedAt\s*startDate\s*endDate\s*dayOfWeek\s*availabilityStatus\s*\}/
		);
	});

	it('answers the count through a nullable field of its own and takes no argument it cannot honour', () => {
		// `GET /count` answers a bare number, which is not the connection's `totalCount`: that total is
		// the count of the rows the connection narrowed to, while the count route counts the caller's own
		// rows. Nullable, because an aggregate the resource has no answer for must not be answered as a
		// zero.
		expect(printed).toMatch(/employeeAvailabilityCount: Int\n/);
		expect(printed).not.toMatch(/employeeAvailabilityCount: Int!/);
		expect(fieldArgs('Query', 'employeeAvailabilityCount')).toEqual([]);

		// The read hands its options to `findAll`, which carries `withDeleted` to the store on both dialects, so the connection offers it — the same visibility the REST list route inherits from `BaseQueryDTO`.
		expect(printed).toMatch(/employeeAvailabilities\([^)]*withDeleted/);
		expect(fieldArgs('Query', 'employeeAvailabilities')).toEqual([
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset'
			'withDeleted',
		]);
	});

	it('offers the one-row read as a nullable field that takes the identifier the route takes', () => {
		expect(printed).toMatch(/employeeAvailability\(id: ID!\): EmployeeAvailability\n/);
	});
});

describe('EmployeeAvailabilityResolver — which members the surface exposes, and which it refuses', () => {
	it('carries the members the delivered answer carries', () => {
		const body = typeBody('EmployeeAvailability');

		for (const member of [
			'id: ID!',
			'startDate: DateTime!',
			'endDate: DateTime!',
			'dayOfWeek: Int!',
			'availabilityStatus: String!',
			'availabilityNotes: String',
			'employeeId: ID!',
			'tenantId: ID',
			'organizationId: ID',
			'isActive: Boolean',
			'isArchived: Boolean',
			'archivedAt: DateTime',
			'deletedAt: DateTime',
			'createdAt: DateTime',
			'updatedAt: DateTime'
		]) {
			expect(body).toMatch(new RegExp(member.replace(/ /g, '\\s*')));
		}
	});

	it('carries the status as the vocabulary’s label rather than declaring the value set a second time', () => {
		const body = typeBody('EmployeeAvailability');

		// The column is an `int` mapped through `AvailabilityStatusTransformer`, so the label is what a
		// row carries by the time this surface answers it — and the vocabulary belongs to the contracts
		// package, which is why no enum for it is declared here.
		expect(body).toMatch(/availabilityStatus: String!/);
		expect(printed).not.toMatch(/enum AvailabilityStatusEnum/);
		expect(printed).not.toMatch(/enum EmployeeAvailabilityStatus/);
	});

	it('carries the day of the week as the whole number the delivered validation bounds', () => {
		const body = typeBody('EmployeeAvailability');

		// `0` is Sunday and `6` is Saturday; the column is an integer and the delivered validation is a
		// range check on it, so the member is the number rather than an enum invented for the schema.
		expect(body).toMatch(/dayOfWeek: Int!/);
		expect(inputBody('EmployeeAvailabilityFilter')).toMatch(/dayOfWeek: NumberFilter/);
	});

	it('carries no relation object, and carries the identifier the relation reports instead', () => {
		const body = typeBody('EmployeeAvailability');

		// The relation is loaded only when a REST caller names it in `relations`, and none of the reads
		// this surface performs names it, so a member for it would be absent on every row answered here.
		expect(body).not.toMatch(/\bemployee\s*:/);
		expect(body).toMatch(/employeeId: ID!/);

		// The relation is not filterable either: the identifier is, which is what a caller narrowing by
		// employee states.
		expect(inputBody('EmployeeAvailabilityFilter')).not.toMatch(/\bemployee\s*:/);
	});

	it('declares the write inputs the write mutations take', () => {
		const create = inputBody('CreateEmployeeAvailabilityInput');
		const update = inputBody('UpdateEmployeeAvailabilityInput');

		// The window and the state are what make the row meaningful, so the create requires them.
		expect(create).toMatch(/dayOfWeek: Int!/);
		expect(create).toMatch(/startDate: DateTime!/);
		expect(create).toMatch(/endDate: DateTime!/);
		expect(create).toMatch(/availabilityStatus: String!/);
		expect(create).toMatch(/employeeId: ID!/);
		expect(create).toMatch(/availabilityNotes: String/);
		expect(create).toMatch(/organizationId: ID/);
		// The tenant is never a member: the write stamps it from the credential.
		expect(create).not.toMatch(/\btenantId:/);

		// The edit is the create with every member made optional — a member that is absent is left as it
		// is — and the identifier is what says which row is being written.
		expect(update).toMatch(/id: ID!/);
		expect(update).toMatch(/dayOfWeek: Int\n/);
		expect(update).toMatch(/availabilityStatus: String\n/);
		expect(update).not.toMatch(/dayOfWeek: Int!/);
		// The two writes take the same vocabulary, so every member of one is a member of the other.
		for (const member of ['dayOfWeek', 'startDate', 'endDate', 'availabilityStatus', 'employeeId', 'availabilityNotes', 'organizationId']) {
			expect(update).toMatch(new RegExp(`\\b${member}:`));
		}
	});

	it('declares the bulk filing as a list of rows rather than a statement about the write', () => {
		expect(printed).toMatch(
			/createEmployeeAvailabilities\(input: \[CreateEmployeeAvailabilityInput!\]!\): \[EmployeeAvailability!\]!/
		);
	});
});

describe('EmployeeAvailabilityResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, employeeAvailabilityService } = surfaces();

		const connection = await resolver.employeeAvailabilities(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(employeeAvailabilityService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders newest first when the caller states none, because the delivered read states no order', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.employeeAvailabilities();

		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares, on each field’s own scale', async () => {
		const { resolver } = surfaces();

		// The label is the value the row carries, which is what makes a status filter answer anything.
		const unavailable = await resolver.employeeAvailabilities({ availabilityStatus: { eq: 'Unavailable' } });
		expect(unavailable.nodes.map((node) => node.id)).toEqual([SECOND]);

		// The day of the week compares as a whole number.
		const lateWeek = await resolver.employeeAvailabilities({ dayOfWeek: { gte: 5 } });
		expect(lateWeek.nodes.map((node) => node.id)).toEqual([SECOND]);

		// The two window bounds compare as instants, not as text.
		const march = await resolver.employeeAvailabilities({
			startDate: { between: ['2026-03-01T00:00:00.000Z', '2026-03-31T23:59:59.000Z'] }
		});
		expect(march.nodes.map((node) => node.id)).toEqual([FIRST]);

		// The identifiers follow their columns, so narrowing by employee is a read this surface answers.
		const oneEmployee = await resolver.employeeAvailabilities({ employeeId: { eq: EMPLOYEE_A } });
		expect(oneEmployee.nodes.map((node) => node.id)).toEqual([FIRST]);

		// An absent note is a question of its own rather than an empty string.
		const withoutNotes = await resolver.employeeAvailabilities({ availabilityNotes: { isNull: true } });
		expect(withoutNotes.nodes.map((node) => node.id)).toEqual([SECOND]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byStart = await resolver.employeeAvailabilities(undefined, [{ field: 'startDate', direction: 'ASC' }]);
		expect(byStart.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const byDay = await resolver.employeeAvailabilities(undefined, [{ field: 'dayOfWeek', direction: 'DESC' }]);
		expect(byDay.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.employeeAvailabilities(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.employeeAvailabilities(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.employeeAvailabilities(undefined, undefined, undefined, 20);
		const last = await resolver.employeeAvailabilities(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `availabilityNotes` is filterable but not sortable: an order over free-form notes is not an
		// order, and the refusal names the fields the resource does offer.
		const error = await resolver
			.employeeAvailabilities(undefined, [{ field: 'availabilityNotes', direction: 'ASC' }])
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeAvailabilities({ employee: { eq: EMPLOYEE_A } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeAvailabilities(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('EmployeeAvailabilityResolver — one concept, two protocols, the same operations', () => {
	it('reads one row through the same service method the inherited `GET /:id` route calls', async () => {
		const { resolver, employeeAvailabilityService } = surfaces();

		expect(await resolver.employeeAvailability(FIRST)).toBe(ROWS[0]);
		expect(employeeAvailabilityService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, employeeAvailabilityService } = surfaces();
		employeeAvailabilityService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.employeeAvailability(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, employeeAvailabilityService } = surfaces();

		expect(await resolver.employeeAvailabilityCount()).toBe(2);
		expect(employeeAvailabilityService.countBy).toHaveBeenCalledWith();
	});

	it('files one row through the command the REST create route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			dayOfWeek: 1,
			startDate: new Date('2026-03-02T09:00:00.000Z'),
			endDate: new Date('2026-03-31T17:00:00.000Z'),
			availabilityStatus: 'Available',
			employeeId: EMPLOYEE_A,
			organizationId: ORGANIZATION
		};

		await resolver.createEmployeeAvailability(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeAvailabilityCreateCommand);
		expect(command.input).toEqual(input);
	});

	it('files a list of rows through the command the bulk route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const input = [
			{
				dayOfWeek: 1,
				startDate: new Date('2026-03-02T09:00:00.000Z'),
				endDate: new Date('2026-03-31T17:00:00.000Z'),
				availabilityStatus: 'Available',
				employeeId: EMPLOYEE_A
			},
			{
				dayOfWeek: 5,
				startDate: new Date('2026-03-06T09:00:00.000Z'),
				endDate: new Date('2026-03-27T17:00:00.000Z'),
				availabilityStatus: 'Partial',
				employeeId: EMPLOYEE_B
			}
		];
		commandBus.execute.mockResolvedValueOnce(ROWS);

		// The answer is the list of rows the write created, which is what the delivered command answers.
		expect(await resolver.createEmployeeAvailabilities(input)).toBe(ROWS);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeAvailabilityBulkCreateCommand);
		expect(command.input).toEqual(input);
	});

	it('changes a row through the same service method the REST update route calls, and reads it back', async () => {
		const { resolver, employeeAvailabilityService } = surfaces();

		expect(await resolver.updateEmployeeAvailability({ id: FIRST, availabilityStatus: 'Partial' })).toBe(ROWS[0]);

		// The identifier travels in both places the delivered route carries it: the path and the body.
		expect(employeeAvailabilityService.update).toHaveBeenCalledWith(
			FIRST,
			expect.objectContaining({ id: FIRST, availabilityStatus: 'Partial' })
		);
		// The delivered call answers the store's result rather than a row, so the row is read back through
		// the read the node field performs.
		expect(employeeAvailabilityService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('removes a row through the same service method the inherited delete route calls', async () => {
		const { resolver, employeeAvailabilityService } = surfaces();

		expect(await resolver.deleteEmployeeAvailability(FIRST)).toBe(true);
		// The delivered route answers the store's delete result, which is not a row.
		expect(employeeAvailabilityService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a row through the same two service methods the inherited routes call', async () => {
		const { resolver, employeeAvailabilityService } = surfaces();

		const withdrawn = await resolver.softDeleteEmployeeAvailability(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(employeeAvailabilityService.softRemove).toHaveBeenCalledWith(FIRST);

		const restored = await resolver.recoverEmployeeAvailability(FIRST);
		expect(restored.deletedAt).toBeNull();
		expect(employeeAvailabilityService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('EMPLOYEE_AVAILABILITY_WINDOW_INVALID: the start date is after the end date.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(
			resolver.createEmployeeAvailability({
				dayOfWeek: 1,
				startDate: new Date('2026-03-31T09:00:00.000Z'),
				endDate: new Date('2026-03-02T17:00:00.000Z'),
				availabilityStatus: 'Available',
				employeeId: EMPLOYEE_A
			})
		).rejects.toBe(refusal);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here: a
 * table of permission names would agree with the resolver while disagreeing with the controller, which
 * is the failure this half of the doctrine exists to catch.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'employeeAvailabilities', route: 'findAll' },
	{ field: 'employeeAvailability', route: 'findById' },
	{ field: 'employeeAvailabilityCount', route: 'getCount' },
	{ field: 'createEmployeeAvailability', route: 'create' },
	{ field: 'createEmployeeAvailabilities', route: 'createBulk' },
	{ field: 'updateEmployeeAvailability', route: 'update' },
	{ field: 'deleteEmployeeAvailability', route: 'delete' },
	{ field: 'softDeleteEmployeeAvailability', route: 'softRemove' },
	{ field: 'recoverEmployeeAvailability', route: 'softRecover' }
];

/** The routes whose handlers are inherited from the CRUD base and state no permission of their own. */
const INHERITED_ROUTES = ['getCount', 'findById', 'delete', 'softRemove', 'softRecover'] as const;

describe('EmployeeAvailabilityResolver — the guard stack and the permission are the controller’s', () => {
	it('states on the class the guard chain the controller states on the class', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EmployeeAvailabilityResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', EmployeeAvailabilityController) ?? [];

		// The controller's chain is the class-level pair of protocol guards, and the resolver's is that
		// chain with the gate appended — the one addition, because the gate is a capability rather than a
		// scope.
		expect(controllerGuards).toEqual([TenantPermissionGuard, PermissionGuard]);
		expect(resolverGuards).toEqual([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard]);
	});

	it('states on the class the permission pair the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeAvailabilityController)).toEqual([
			PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE,
			PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeAvailabilityResolver)).toEqual([
			PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE,
			PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE
		]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', EmployeeAvailabilityResolver) ?? [];

		for (const { route } of ROUTE_PARITY) {
			// The controller's chain plus the gate on the endpoint itself are the same set as the
			// resolver's, which is the whole parity claim: a route that added a guard of its own would
			// narrow REST below GraphQL and is caught here.
			expect([...guardsOfRoute(EmployeeAvailabilityController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(EmployeeAvailabilityController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(EmployeeAvailabilityController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(EmployeeAvailabilityController, route));
	});

	it('carries the class pair on the fields whose routes state no permission of their own', () => {
		// The node query, the count and the three lifecycle moves are inherited from the CRUD base, where
		// the controller's class-level pair is the whole of what they run under — so the fields state
		// nothing of their own and are answered by the class pair, which the round above compares against
		// the same metadata.
		for (const route of INHERITED_ROUTES) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmployeeAvailabilityController)[route])
			).toBeUndefined();
			expect(permissionOfRoute(EmployeeAvailabilityController, route)).toEqual([
				PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE,
				PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE
			]);
		}

		for (const field of [
			'employeeAvailability',
			'employeeAvailabilityCount',
			'deleteEmployeeAvailability',
			'softDeleteEmployeeAvailability',
			'recoverEmployeeAvailability'
		]) {
			// No field-level statement, so the class pair is the field's permission.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeAvailabilityResolver)[field])).toBeUndefined();
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE,
				PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE
			]);
		}
	});

	it('states on each field that does have a permission of its own exactly what its route states', () => {
		expect(permissionOfField('employeeAvailabilities')).toEqual([PermissionsEnum.EMPLOYEE_AVAILABILITY_READ]);
		expect(permissionOfField('createEmployeeAvailability')).toEqual([
			PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE
		]);
		expect(permissionOfField('createEmployeeAvailabilities')).toEqual([
			PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE
		]);
		expect(permissionOfField('updateEmployeeAvailability')).toEqual([
			PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE
		]);

		// The list is the read permission and never the class pair, which is the asymmetry the controller
		// states and this surface reproduces rather than resolves on one side only.
		expect(permissionOfField('employeeAvailabilities')).not.toEqual(permissionOfField('employeeAvailability'));
	});
});

describe('EmployeeAvailabilityModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmployeeAvailabilityModule) ??
			[]) as unknown[];

		expect(providers).toContain(EmployeeAvailabilityResolver);
		expect(providers).toContain(EmployeeAvailabilityService);
	});

	it('re-exports what the resolver injects, because the endpoint hosts a resolver that injects it', () => {
		// A resolver is an ordinary provider, so this class is declared here — beside the service it
		// calls — and again by whichever module the Apollo configuration names, because that module is
		// what scans for resolvers. That second instance resolves its dependencies from *its* module, so
		// this module has to hand on everything the resolver injects: the service, and the command bus its
		// two dispatches go through. `CqrsModule` is re-exported for exactly that reason, as the
		// catalogue's own module does beside this one.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmployeeAvailabilityModule) ??
			[]) as unknown[];

		expect(exported).toContain(CqrsModule);
		expect(exported).toContain(EmployeeAvailabilityService);
	});
});

/** The code the catalogue declares for this surface, as the guard’s metadata carries it. */
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
		getHandler: () => (EmployeeAvailabilityResolver.prototype as never)[field],
		getClass: () => EmployeeAvailabilityResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmployeeAvailabilityResolver — a capability that is switched off is not served', () => {
	it('declares the capability the catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — including the five that state no permission of their own.
		expect(Reflect.getMetadata(FEATURE_METADATA, EmployeeAvailabilityResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmployeeAvailabilityResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('employeeAvailabilities')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('employeeAvailabilities');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses an inherited-permission field as well, which is what makes the gate carry its own scope', async () => {
		const { guard } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('softDeleteEmployeeAvailability')).catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('softDeleteEmployeeAvailability');
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('employeeAvailabilities'))).resolves.toBe(true);
	});
});
