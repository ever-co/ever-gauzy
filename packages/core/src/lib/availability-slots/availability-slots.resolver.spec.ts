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
import { AvailabilityMergeType } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { AvailabilitySlotsModule } from './availability-slots.module';
import { AvailabilitySlotsResolver } from './availability-slots.resolver';
import { AvailabilitySlotsService } from './availability-slots.service';
import { AvailabilitySlotsBulkCreateCommand, AvailabilitySlotsCreateCommand } from './commands';

/**
 * The hours an employee is bookable, over GraphQL.
 *
 * The delivered REST routes serve a list, one slot, a count, a filing, a bulk filing, an upsert and the
 * withdrawal and restoration of a slot. This suite pins the half of the two-protocol doctrine that is
 * easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches — including the upsert, which is the service call the `PUT /:id` route makes rather than a
 *   command;
 * - **the guard chain is the controller's** — the tenant guard and nothing else, with no permission
 *   stated on either surface — so the schema is not a second, wider or narrower door to the same rows;
 * - the vocabulary of `type` is carried as its value and no value set is redeclared, and the relation is
 *   carried as the identifier that always travels;
 * - the bulk filing answers the rows the write produced rather than a positional echo of its input.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		startTime: new Date('2026-03-02T09:00:00.000Z'),
		endTime: new Date('2026-03-02T17:00:00.000Z'),
		allDay: false,
		type: 'Default',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: null,
		startTime: new Date('2026-02-02T00:00:00.000Z'),
		endTime: new Date('2026-02-02T23:59:00.000Z'),
		allDay: true,
		type: 'Recurring',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const availabilitySlotsService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		availabilitySlotsService,
		commandBus,
		resolver: new AvailabilitySlotsResolver(availabilitySlotsService as never, commandBus as never)
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
		.filter((field) => field.toLowerCase().includes('availabilityslot'))
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
function handlersOf(controller: typeof AvailabilitySlotsController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file. For this resource both readings are
 * `undefined`, and the comparison against the fields below is what holds the resolver to that.
 */
function permissionOfRoute(controller: typeof AvailabilitySlotsController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof AvailabilitySlotsController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof AvailabilitySlotsResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(AvailabilitySlotsResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, AvailabilitySlotsResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', AvailabilitySlotsResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(AvailabilitySlotsResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('AvailabilitySlotsResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-slot query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['availabilitySlots', 'availabilitySlot', 'availabilitySlotCount'])
		);
	});

	it('declares one mutation per delivered write route, the bulk filing included', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createAvailabilitySlot',
				'createAvailabilitySlots',
				'updateAvailabilitySlot',
				'deleteAvailabilitySlot',
				'softDeleteAvailabilitySlot',
				'recoverAvailabilitySlot'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and the `GET /pagination` it inherits — and the
		// two answer one question, so the surface states it once: a second root field for the paginated
		// spelling would be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual([
			'availabilitySlot',
			'availabilitySlotCount',
			'availabilitySlots'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createAvailabilitySlot',
			'createAvailabilitySlots',
			'deleteAvailabilitySlot',
			'recoverAvailabilitySlot',
			'softDeleteAvailabilitySlot',
			'updateAvailabilitySlot'
		]);
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining(['availabilitySlotsPagination', 'availabilitySlotPagination'])
		);

		// Every field above names a handler that exists on the controller, inherited ones included.
		for (const handler of [
			'createBulkAvailabilitySlot',
			'findAll',
			'create',
			'update',
			'findById',
			'getCount',
			'delete',
			'softRemove',
			'softRecover'
		]) {
			expect(typeof handlersOf(AvailabilitySlotsController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type AvailabilitySlotConnection \{\s*nodes: \[AvailabilitySlot!\]!\s*edges: \[AvailabilitySlotEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type AvailabilitySlotEdge \{\s*node: AvailabilitySlot!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input AvailabilitySlotFilter \{/);
		expect(printed).toMatch(/input AvailabilitySlotSort \{/);
		expect(printed).toMatch(
			/enum AvailabilitySlotSortField \{\s*createdAt\s*updatedAt\s*startTime\s*endTime\s*type\s*\}/
		);
	});

	it('answers the count through a nullable field of its own and takes no argument it cannot honour', () => {
		// `GET /count` answers a bare number, which is not the connection's `totalCount`: that total is
		// the count of the rows the connection narrowed to, while the count route counts the caller's own
		// rows. Nullable, because an aggregate the resource has no answer for must not be answered as a
		// zero.
		expect(printed).toMatch(/availabilitySlotCount: Int\n/);
		expect(printed).not.toMatch(/availabilitySlotCount: Int!/);
		expect(fieldArgs('Query', 'availabilitySlotCount')).toEqual([]);

		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/availabilitySlots\([^)]*withDeleted/);
		expect(fieldArgs('Query', 'availabilitySlots')).toEqual([
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
	});

	it('offers the one-slot read as a nullable field that takes the identifier the route takes', () => {
		expect(printed).toMatch(/availabilitySlot\(id: ID!\): AvailabilitySlot\n/);
	});
});

describe('AvailabilitySlotsResolver — which members the surface exposes, and which it refuses', () => {
	it('carries the members the delivered answer carries', () => {
		const body = typeBody('AvailabilitySlot');

		for (const member of [
			'id: ID!',
			'startTime: DateTime!',
			'endTime: DateTime!',
			'allDay: Boolean!',
			'type: String!',
			'employeeId: ID',
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

		// The relation identifier is nullable and the member says so: a slot may belong to an organization
		// rather than to one person.
		expect(body).toMatch(/employeeId: ID\n/);
		expect(body).not.toMatch(/employeeId: ID!/);
	});

	it('carries the type as the vocabulary’s value rather than declaring the value set a second time', () => {
		const body = typeBody('AvailabilitySlot');

		// The column holds `AvailabilitySlotType`'s own strings — `Default` or `Recurring` — and the
		// vocabulary belongs to the contracts package, which is why no enum for it is declared here.
		expect(body).toMatch(/type: String!/);
		expect(printed).not.toMatch(/enum AvailabilitySlotType/);
		expect(printed).not.toMatch(/enum AvailabilitySlotKind/);
	});

	it('carries no relation object, and carries the identifier the relation reports instead', () => {
		const body = typeBody('AvailabilitySlot');

		// The relation is loaded only when a REST caller names it in `relations`, and none of the reads
		// this surface performs names it, so a member for it would be absent on every row answered here.
		expect(body).not.toMatch(/\bemployee\s*:/);
		expect(body).toMatch(/employeeId: ID/);

		// The relation is not filterable either: the identifier is, which is what a caller narrowing by
		// employee states.
		expect(inputBody('AvailabilitySlotFilter')).not.toMatch(/\bemployee\s*:/);
		expect(inputBody('AvailabilitySlotFilter')).toMatch(/employeeId: IDFilter/);
	});

	it('declares the write inputs the write mutations take', () => {
		const create = inputBody('CreateAvailabilitySlotInput');
		const update = inputBody('UpdateAvailabilitySlotInput');

		// The window and its kind are what make the row, so both writes state them as required.
		for (const member of ['type: String!', 'allDay: Boolean!', 'startTime: DateTime!', 'endTime: DateTime!']) {
			expect(create).toMatch(new RegExp(member.replace(/ /g, '\\s*')));
			expect(update).toMatch(new RegExp(member.replace(/ /g, '\\s*')));
		}

		// The employee is optional on both, because the column is; the tenant is a member of neither,
		// because the write stamps it from the credential.
		expect(create).toMatch(/employeeId: ID\n/);
		expect(update).toMatch(/employeeId: ID\n/);
		expect(create).not.toMatch(/\btenantId:/);
		expect(update).not.toMatch(/\btenantId:/);

		// The write is organization-scoped, so the organization is a member of both.
		expect(create).toMatch(/organizationId: ID/);
		expect(update).toMatch(/organizationId: ID/);

		// The upsert names the row it writes.
		expect(update).toMatch(/id: ID!/);
		expect(create).not.toMatch(/\bid:/);
	});

	it('declares the single filing as one that may answer nothing, and the bulk one as a list of rows', () => {
		// A window the write cannot use answers nothing at all, so the field is nullable rather than
		// non-null: a non-null field would turn the delivered handler's empty answer into an execution
		// error.
		expect(printed).toMatch(/createAvailabilitySlot\(input: CreateAvailabilitySlotInput!\): AvailabilitySlot\n/);

		// The bulk filing answers the rows the write produced, which is what the delivered command answers.
		expect(printed).toMatch(
			/createAvailabilitySlots\(input: \[CreateAvailabilitySlotInput!\]!\): \[AvailabilitySlot!\]!\n/
		);
	});
});

describe('AvailabilitySlotsResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, availabilitySlotsService } = surfaces();

		const connection = await resolver.availabilitySlots(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(availabilitySlotsService.findAll).toHaveBeenCalledWith({});
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

		const connection = await resolver.availabilitySlots();

		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares, on each field’s own scale', async () => {
		const { resolver } = surfaces();

		const recurring = await resolver.availabilitySlots({ type: { eq: 'Recurring' } });
		expect(recurring.nodes.map((node) => node.id)).toEqual([SECOND]);

		const wholeDays = await resolver.availabilitySlots({ allDay: { eq: true } });
		expect(wholeDays.nodes.map((node) => node.id)).toEqual([SECOND]);

		// The two bounds compare as instants, not as text.
		const march = await resolver.availabilitySlots({
			startTime: { between: ['2026-03-01T00:00:00.000Z', '2026-03-31T23:59:59.000Z'] }
		});
		expect(march.nodes.map((node) => node.id)).toEqual([FIRST]);

		const oneEmployee = await resolver.availabilitySlots({ employeeId: { eq: EMPLOYEE } });
		expect(oneEmployee.nodes.map((node) => node.id)).toEqual([FIRST]);

		// A slot filed for the organization rather than for a person has no employee, which is a question
		// of its own rather than a missing filter.
		const organizationWide = await resolver.availabilitySlots({ employeeId: { isNull: true } });
		expect(organizationWide.nodes.map((node) => node.id)).toEqual([SECOND]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byStart = await resolver.availabilitySlots(undefined, [{ field: 'startTime', direction: 'ASC' }]);
		expect(byStart.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const byType = await resolver.availabilitySlots(undefined, [{ field: 'type', direction: 'ASC' }]);
		expect(byType.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.availabilitySlots(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.availabilitySlots(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.availabilitySlots(undefined, undefined, undefined, 20);
		const last = await resolver.availabilitySlots(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `allDay` is filterable but not sortable: an order over a flag is not an order, and the refusal
		// names the fields the resource does offer.
		const error = await resolver
			.availabilitySlots(undefined, [{ field: 'allDay', direction: 'ASC' }])
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.availabilitySlots({ employee: { eq: EMPLOYEE } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.availabilitySlots(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('AvailabilitySlotsResolver — one concept, two protocols, the same operations', () => {
	it('reads one slot through the same service method the inherited `GET /:id` route calls', async () => {
		const { resolver, availabilitySlotsService } = surfaces();

		expect(await resolver.availabilitySlot(FIRST)).toBe(ROWS[0]);
		expect(availabilitySlotsService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a slot that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, availabilitySlotsService } = surfaces();
		availabilitySlotsService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.availabilitySlot(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, availabilitySlotsService } = surfaces();

		expect(await resolver.availabilitySlotCount()).toBe(2);
		expect(availabilitySlotsService.countBy).toHaveBeenCalledWith();
	});

	it('files one slot through the command the REST create route dispatches, with the merge mode it defaults to', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			type: 'Recurring',
			allDay: false,
			startTime: new Date('2026-03-02T09:00:00.000Z'),
			endTime: new Date('2026-03-02T17:00:00.000Z'),
			employeeId: EMPLOYEE,
			organizationId: ORGANIZATION
		};

		expect(await resolver.createAvailabilitySlot(input)).toBe(ROWS[0]);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(AvailabilitySlotsCreateCommand);
		expect(command.input).toEqual(input);
		// The route states no mode, so the command's own default is what the write runs under — and it is
		// the mode that merges a conflicting slot rather than filing a second row beside it.
		expect(command.insertType).toBe(AvailabilityMergeType.MERGE);
	});

	it('files a list of slots through the command the bulk route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const input = [
			{
				type: 'Default',
				allDay: false,
				startTime: new Date('2026-03-02T09:00:00.000Z'),
				endTime: new Date('2026-03-02T17:00:00.000Z'),
				employeeId: EMPLOYEE
			},
			{
				type: 'Recurring',
				allDay: true,
				startTime: new Date('2026-03-03T00:00:00.000Z'),
				endTime: new Date('2026-03-03T23:59:00.000Z')
			}
		];
		commandBus.execute.mockResolvedValueOnce(ROWS);

		// The answer is the list of rows the write produced, which is what the delivered command answers.
		expect(await resolver.createAvailabilitySlots(input)).toBe(ROWS);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(AvailabilitySlotsBulkCreateCommand);
		expect(command.input).toEqual(input);
	});

	it('upserts a slot through the same service call the REST update route makes', async () => {
		const { resolver, availabilitySlotsService } = surfaces();

		await resolver.updateAvailabilitySlot({
			id: FIRST,
			type: 'Recurring',
			allDay: false,
			startTime: new Date('2026-03-02T09:00:00.000Z'),
			endTime: new Date('2026-03-02T18:00:00.000Z')
		});

		// The delivered route merges the identifier from the path into the body and calls `create`; this
		// surface carries the identifier in the input and calls the same method with the same body.
		expect(availabilitySlotsService.create).toHaveBeenCalledWith(
			expect.objectContaining({ id: FIRST, type: 'Recurring', endTime: new Date('2026-03-02T18:00:00.000Z') })
		);
	});

	it('removes a slot through the same service method the inherited delete route calls', async () => {
		const { resolver, availabilitySlotsService } = surfaces();

		expect(await resolver.deleteAvailabilitySlot(FIRST)).toBe(true);
		// The delivered route answers the store's delete result, which is not a row.
		expect(availabilitySlotsService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a slot through the same two service methods the inherited routes call', async () => {
		const { resolver, availabilitySlotsService } = surfaces();

		const withdrawn = await resolver.softDeleteAvailabilitySlot(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(availabilitySlotsService.softRemove).toHaveBeenCalledWith(FIRST);

		const restored = await resolver.recoverAvailabilitySlot(FIRST);
		expect(restored.deletedAt).toBeNull();
		expect(availabilitySlotsService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('AVAILABILITY_SLOT_WINDOW_INVALID: the start time is after the end time.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(
			resolver.createAvailabilitySlot({
				type: 'Default',
				allDay: false,
				startTime: new Date('2026-03-02T17:00:00.000Z'),
				endTime: new Date('2026-03-02T09:00:00.000Z')
			})
		).rejects.toBe(refusal);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain and the permission of a field are
 * read from the field and from the route's own metadata and compared, rather than restated here: a table
 * of permission names would agree with the resolver while disagreeing with the controller, which is the
 * failure this half of the doctrine exists to catch.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'availabilitySlots', route: 'findAll' },
	{ field: 'availabilitySlot', route: 'findById' },
	{ field: 'availabilitySlotCount', route: 'getCount' },
	{ field: 'createAvailabilitySlot', route: 'create' },
	{ field: 'createAvailabilitySlots', route: 'createBulkAvailabilitySlot' },
	{ field: 'updateAvailabilitySlot', route: 'update' },
	{ field: 'deleteAvailabilitySlot', route: 'delete' },
	{ field: 'softDeleteAvailabilitySlot', route: 'softRemove' },
	{ field: 'recoverAvailabilitySlot', route: 'softRecover' }
];

describe('AvailabilitySlotsResolver — the guard stack and the permission are the controller’s', () => {
	it('states the tenant guard and no permission at class level, as the controller does', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', AvailabilitySlotsController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', AvailabilitySlotsResolver) ?? [];

		// The delivered controller carries the tenant guard and no `@Permissions` at all, so neither class
		// states a permission: the gate appended to the resolver's chain is the one difference, and it is a
		// capability rather than a scope.
		expect(controllerGuards).toEqual([TenantPermissionGuard]);
		expect(resolverGuards).toEqual([TenantPermissionGuard, FeatureFlagGuard]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, AvailabilitySlotsController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, AvailabilitySlotsResolver)).toBeUndefined();
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', AvailabilitySlotsResolver) ?? [];

		for (const { route } of ROUTE_PARITY) {
			// The controller's chain plus the gate on the endpoint itself are the same set as the
			// resolver's, which is the whole parity claim: a route that added a guard of its own would
			// narrow REST below GraphQL and is caught here.
			expect([...guardsOfRoute(AvailabilitySlotsController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(AvailabilitySlotsController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(AvailabilitySlotsController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(AvailabilitySlotsController, route));
	});

	it('states no permission on any field, because no route states one', () => {
		// The resource is scoped by the tenant guard alone: a field that demanded a permission would refuse
		// here a caller the REST route serves, and the four creates and upserts are the fields where that
		// mistake is most tempting.
		for (const field of ROUTE_PARITY.map((entry) => entry.field)) {
			expect(permissionOfField(field)).toBeUndefined();
		}
	});

	it('holds every field to the inherited routes’ own absence of a permission', () => {
		for (const [field, route] of [
			['availabilitySlot', 'findById'],
			['availabilitySlotCount', 'getCount'],
			['deleteAvailabilitySlot', 'delete'],
			['softDeleteAvailabilitySlot', 'softRemove'],
			['recoverAvailabilitySlot', 'softRecover']
		] as ReadonlyArray<[string, string]>) {
			expect(Reflect.getMetadata('__guards__', handlersOf(AvailabilitySlotsController)[route])).toBeUndefined();
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(AvailabilitySlotsController)[route])).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', fieldsOf(AvailabilitySlotsResolver)[field])).toBeUndefined();
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(AvailabilitySlotsResolver)[field])).toBeUndefined();
		}
	});
});

describe('AvailabilitySlotsModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AvailabilitySlotsModule) ??
			[]) as unknown[];

		expect(providers).toContain(AvailabilitySlotsResolver);
		expect(providers).toContain(AvailabilitySlotsService);
	});

	it('re-exports what the resolver injects, because the endpoint hosts a resolver that injects it', () => {
		// A resolver is an ordinary provider, so this class is declared here — beside the service it calls
		// — and again by whichever module the Apollo configuration names, because that module is what scans
		// for resolvers. That second instance resolves its dependencies from *its* module, so this module
		// has to hand on everything the resolver injects: the service, and the command bus its two
		// dispatches go through. `CqrsModule` is re-exported for exactly that reason, as the catalogue's
		// own module does beside this one.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, AvailabilitySlotsModule) ??
			[]) as unknown[];

		expect(exported).toContain(CqrsModule);
		expect(exported).toContain(AvailabilitySlotsService);
	});
});

/** The code the catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver declares,
 * which is the point: a spec that asserted the decorator alone would keep passing if the guard stopped
 * reading that key.
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
		getHandler: () => (AvailabilitySlotsResolver.prototype as never)[field],
		getClass: () => AvailabilitySlotsResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('AvailabilitySlotsResolver — a capability that is switched off is not served', () => {
	it('declares the capability the catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class, so
		// every field is behind it — including the ones that state no scope of their own, which here is all
		// of them.
		expect(Reflect.getMetadata(FEATURE_METADATA, AvailabilitySlotsResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', AvailabilitySlotsResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('availabilitySlots')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('availabilitySlots');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses a write field as well, which is what makes the gate carry its own scope', async () => {
		const { guard } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('createAvailabilitySlots'))
			.catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('createAvailabilitySlots');
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('availabilitySlots'))).resolves.toBe(true);
	});
});
