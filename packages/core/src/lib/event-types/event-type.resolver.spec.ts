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
import { buildSchema, printSchema } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { EventTypeController } from './event-type.controller';
import { EventTypeModule } from './event-type.module';
import { EventTypeResolver } from './event-type.resolver';
import { EventTypeService } from './event-type.service';
import { EventTypeCreateCommand } from './commands';

/**
 * The organization's vocabulary of meeting lengths over GraphQL.
 *
 * The delivered REST routes serve a list, the paginated spelling of the same list, one row, a count, a
 * filing, an edit and the two removals of the CRUD base. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same `EventTypeService` method, or dispatches the same command, that the REST
 *   route reaches — including the create, which goes through the command because the handler resolves the
 *   organization and the employee before it writes;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under**, which for this resource is none on either side;
 * - the length is an exact decimal and never a floating-point number, on the object type, on the filter
 *   and on the way into a write;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant that
 *   switched that capability off is refused the way a disabled capability's routes are.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000030';
const TAG = '00000000-0000-4000-8000-000000000050';
const STANDUP = '00000000-0000-4000-8000-000000000010';
const REVIEW = '00000000-0000-4000-8000-000000000011';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with, in an order the default sort can be told apart from: the read
 * returns the standup first and the connection's own default is the title ascending.
 */
const ROWS = [
	{
		id: STANDUP,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Standup',
		description: 'Daily sync',
		duration: 0.25,
		durationUnit: 'hours',
		isActive: true,
		employeeId: EMPLOYEE,
		createdAt: new Date('2026-01-10T10:00:00.000Z'),
		updatedAt: new Date('2026-01-10T10:00:00.000Z')
	},
	{
		id: REVIEW,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Review',
		description: null,
		duration: 90,
		durationUnit: 'minutes',
		isActive: true,
		employeeId: null,
		createdAt: new Date('2026-02-10T10:00:00.000Z'),
		updatedAt: new Date('2026-02-10T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const eventTypeService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-06-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		eventTypeService,
		commandBus,
		resolver: new EventTypeResolver(eventTypeService as never, commandBus as never)
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
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the boot
 * loader globs, which is what makes a reference from this domain to another one resolvable.
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

/** This domain's own two documents, as they are written on disk. */
const ownSdl = ['event-types.type.gql', 'event-types.api.gql']
	.map((file) => readFileSync(join(__dirname, 'schema', file), 'utf8'))
	.join('\n');

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The type one root field answers, as the schema states it. */
function fieldType(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { type: unknown }> }
		| undefined;

	return String(root?.getFields()?.[field]?.type);
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('eventtype'))
		.sort();
}

/** The printed body of one declaration, whatever kind it is. */
function bodyOf(kind: 'type' | 'input' | 'enum', name: string): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return bodyOf('type', name);
}

/** The printed body of one input type. */
function inputBody(name: string): string {
	return bodyOf('input', name);
}

/**
 * The member names one type declares, read off its printed body rather than off a description: a doc
 * comment is part of the printed type, so a member is asserted absent by its name and never by the words a
 * description happens to use.
 */
function memberNames(name: string): string[] {
	return [...typeBody(name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EventTypeController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather than
 * to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EventTypeController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = EventTypeResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler states
 * of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EventTypeController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field are
 * read from the field and from the route's own metadata and compared, rather than restated here: a table
 * of permission names would agree with the resolver while disagreeing with the controller, which is the
 * failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'eventTypes', route: 'findAll' },
	{ field: 'eventType', route: 'findById' },
	{ field: 'eventTypeCount', route: 'getCount' },
	{ field: 'createEventType', route: 'create' },
	{ field: 'updateEventType', route: 'update' },
	{ field: 'deleteEventType', route: 'delete' },
	{ field: 'softDeleteEventType', route: 'softRemove' },
	{ field: 'recoverEventType', route: 'softRecover' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = [
	'createEventType',
	'updateEventType',
	'deleteEventType',
	'softDeleteEventType',
	'recoverEventType'
];

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver declares,
 * which is the point: a spec that asserted the decorator alone would keep passing if the guard stopped
 * reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller's scope.
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
		getHandler: () => (EventTypeResolver.prototype as never)[field],
		getClass: () => EventTypeResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EventTypeResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['eventTypes', 'eventType', 'eventTypeCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(expect.arrayContaining(WRITES));
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once. It serves no sub-route of its own beyond that spelling,
		// which is why nothing else appears here.
		expect(ownedRootFields('Query')).toEqual(['eventType', 'eventTypeCount', 'eventTypes']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEventType',
			'deleteEventType',
			'recoverEventType',
			'softDeleteEventType',
			'updateEventType'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EventTypeConnection \{\s*nodes: \[EventType!\]!\s*edges: \[EventTypeEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EventTypeEdge \{\s*node: EventType!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EventTypeFilter \{/);
		expect(printed).toMatch(/input EventTypeSort \{/);
		expect(printed).toMatch(
			/enum EventTypeSortField \{\s*createdAt\s*updatedAt\s*title\s*duration\s*durationUnit\s*\}/
		);
	});

	it('declares the two write inputs', () => {
		expect(printed).toMatch(/input CreateEventTypeInput \{/);
		expect(printed).toMatch(/input UpdateEventTypeInput \{/);
	});

	it('carries the columns the delivered reads answer, and not the relations they never join', () => {
		const members = memberNames('EventType');

		// No read behind this surface names a relation, so a member carrying a related row would be absent
		// from exactly the rows this surface answers. The employee is carried as its identifier, which is a
		// column every read answers.
		expect(members).not.toContain('employee');
		expect(members).not.toContain('tags');
		expect(members).toEqual(
			expect.arrayContaining([
				'title',
				'description',
				'duration',
				'durationUnit',
				'employeeId',
				'deletedAt',
				'organizationId'
			])
		);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'eventTypes')).not.toContain('withDeleted');
		expect(fieldArgs('Query', 'eventTypes')).toEqual([
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
		// The count route binds its query string to the store's own `where`, which is a shape no schema can
		// state, so the field states no narrowing of its own — and it is nullable, because a count is an
		// aggregate the resource may have no answer for and a non-null field would fabricate a zero.
		expect(fieldArgs('Query', 'eventTypeCount')).toEqual([]);
		expect(fieldType('Query', 'eventTypeCount')).toBe('Int');
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createEventType', ['input']],
			['updateEventType', ['input']],
			['deleteEventType', ['id']],
			['softDeleteEventType', ['id']],
			['recoverEventType', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('EventTypeResolver — the length is exact, on the type, in the filter and into a write', () => {
	it('carries the length as Decimal and never as Float', () => {
		const body = typeBody('EventType');

		// The column is `numeric` and the vocabulary states fractions of an hour in it: a length a client
		// reads as a `Float` is a length that will not compare.
		expect(body).toMatch(/duration: Decimal!\n/);
		expect(body).not.toMatch(/\bFloat\b/);
	});

	it('narrows the length through the decimal family, never through a whole-number one', () => {
		const filter = inputBody('EventTypeFilter');

		expect(filter).toMatch(/duration: DecimalFilter/);
		expect(filter).not.toMatch(/duration: (FloatFilter|NumberFilter)/);
		expect(filter).not.toMatch(/\bFloat\b/);
	});

	it('states the length in both write inputs as the exact decimal', () => {
		expect(inputBody('CreateEventTypeInput')).toMatch(/duration: Decimal!\n/);
		expect(inputBody('UpdateEventTypeInput')).toMatch(/duration: Decimal\n/);
	});

	it('states no Float in any member this domain declares', () => {
		const declared = [
			'EventType',
			'EventTypeEdge',
			'EventTypeConnection',
			'EventTypeFilter',
			'EventTypeSort',
			'EventTypeSortField',
			'CreateEventTypeInput',
			'UpdateEventTypeInput'
		]
			.map((name) => `${typeBody(name)}\n${inputBody(name)}\n${bodyOf('enum', name)}`)
			.join('\n');

		expect(declared).not.toMatch(/\bFloat\b/);
		expect(ownSdl).not.toMatch(/:\s*\[?Float\b/);
	});

	it('hands a write the exact digits the caller stated rather than a binary fraction', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createEventType({
			title: 'Standup',
			duration: '0.25',
			durationUnit: 'hours',
			isActive: true,
			organizationId: ORGANIZATION
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command.input).toEqual(
			expect.objectContaining({ duration: '0.25', durationUnit: 'hours' })
		);
	});
});

describe('EventTypeResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, eventTypeService } = surfaces();

		const connection = await resolver.eventTypes(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(eventTypeService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(REVIEW);
	});

	it('orders by the vocabulary’s own title order when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.eventTypes();

		// The read returns the standup first; the connection's own default is the title ascending.
		expect(connection.nodes.map((node) => node.id)).toEqual([REVIEW, STANDUP]);
	});

	it('narrows by the fields the filter declares, the length’s own window among them', async () => {
		const { resolver } = surfaces();

		const byTitle = await resolver.eventTypes({ title: { ilike: 'stand%' } });
		expect(byTitle.nodes.map((node) => node.id)).toEqual([STANDUP]);

		// A window on the length, which is the question a scheduling screen asks — and one a whole-number
		// comparison could not answer, because the half-hour row is not a whole number of hours.
		const byLength = await resolver.eventTypes({ duration: { between: ['0.1', '1'] } });
		expect(byLength.nodes.map((node) => node.id)).toEqual([STANDUP]);

		const byUnit = await resolver.eventTypes({ durationUnit: { eq: 'minutes' } });
		expect(byUnit.nodes.map((node) => node.id)).toEqual([REVIEW]);

		const byEmployee = await resolver.eventTypes({ employeeId: { isNull: true } });
		expect(byEmployee.nodes.map((node) => node.id)).toEqual([REVIEW]);

		const byOrganization = await resolver.eventTypes({ organizationId: { eq: ORGANIZATION } });
		expect(byOrganization.totalCount).toBe(2);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byTitle = await resolver.eventTypes(undefined, [{ field: 'title', direction: 'DESC' }]);
		expect(byTitle.nodes.map((node) => node.id)).toEqual([STANDUP, REVIEW]);

		const byDuration = await resolver.eventTypes(undefined, [{ field: 'duration', direction: 'ASC' }]);
		expect(byDuration.nodes.map((node) => node.id)).toEqual([STANDUP, REVIEW]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.eventTypes(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([REVIEW]);

		const second = await resolver.eventTypes(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([STANDUP]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.eventTypes(undefined, undefined, undefined, 20);

		const last = await resolver.eventTypes(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([REVIEW]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.eventTypes(undefined, [{ field: 'description', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `tags` is a pivot the delivered list read loads only when a REST caller names it in `relations`,
		// so the condition could only ever match the empty set, and the connection refuses it rather than
		// answering it with no rows.
		const error = await resolver.eventTypes({ tags: { eq: TAG } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.eventTypes(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [...inputBody('EventTypeFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		for (const member of declared) {
			await expect(resolver.eventTypes({ [member]: {} })).resolves.toBeDefined();
		}

		const refusal = await resolver.eventTypes({ tags: { eq: TAG } }).catch((thrown) => thrown);
		const allowed = String((refusal as Error).message)
			.split('Allowed: ')[1]
			.replace(/\.\s*$/, '')
			.split(',')
			.map((member) => member.trim())
			.sort();

		expect(allowed).toEqual([...declared].sort());
	});

	it('accepts every key the sort enum offers, and only those', async () => {
		const { resolver } = surfaces();
		const offered = [...bodyOf('enum', 'EventTypeSortField').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)].map(
			(match) => match[1]
		);

		expect(offered).toEqual(['createdAt', 'updatedAt', 'title', 'duration', 'durationUnit']);

		for (const field of offered) {
			await expect(resolver.eventTypes(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});
});

describe('EventTypeResolver — one resource, two protocols, the same operations', () => {
	it('reads one row through the same service method the REST node route calls', async () => {
		const { resolver, eventTypeService } = surfaces();

		expect(await resolver.eventType(STANDUP)).toBe(ROWS[0]);
		expect(eventTypeService.findOneByIdString).toHaveBeenCalledWith(STANDUP);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, eventTypeService } = surfaces();
		eventTypeService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.eventType(REVIEW)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, eventTypeService } = surfaces();

		expect(await resolver.eventTypeCount()).toBe(2);
		expect(eventTypeService.countBy).toHaveBeenCalledWith();
	});

	it('files a row through the command the REST create route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(
			await resolver.createEventType({
				title: 'Standup',
				description: 'Daily sync',
				duration: '0.25',
				durationUnit: 'hours',
				isActive: true,
				employeeId: EMPLOYEE,
				organizationId: ORGANIZATION,
				tagIds: [TAG]
			})
		).toBe(ROWS[0]);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EventTypeCreateCommand);
		// The delivered create is handed the members the caller stated, the facets as the identifiers the
		// pivot row is written from, and the tenant only from the credential.
		expect(command.input).toEqual({
			title: 'Standup',
			description: 'Daily sync',
			duration: '0.25',
			durationUnit: 'hours',
			isActive: true,
			employeeId: EMPLOYEE,
			organizationId: ORGANIZATION,
			tags: [{ id: TAG }]
		});
	});

	it('changes a row through the service call the REST edit route makes, and not through the create command', async () => {
		const { resolver, eventTypeService, commandBus } = surfaces();

		await resolver.updateEventType({
			id: STANDUP,
			title: 'Daily standup',
			duration: '0.5'
		});

		// The delivered edit reaches the service directly and merges the stated members onto the row the
		// store holds; routing it through the create command would resolve the organization and the employee
		// a second time and write a row the REST route would not.
		expect(eventTypeService.create).toHaveBeenCalledWith({
			title: 'Daily standup',
			duration: '0.5',
			id: STANDUP
		});
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('removes a row through the same service method the REST removal route calls', async () => {
		const { resolver, eventTypeService } = surfaces();

		expect(await resolver.deleteEventType(STANDUP)).toBe(true);
		expect(eventTypeService.delete).toHaveBeenCalledWith(STANDUP);
	});

	it('withdraws and restores a row through the service methods the inherited routes call', async () => {
		const { resolver, eventTypeService } = surfaces();

		const withdrawn = await resolver.softDeleteEventType(STANDUP);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(eventTypeService.softRemove).toHaveBeenCalledWith(STANDUP);

		expect(await resolver.recoverEventType(STANDUP)).toBe(ROWS[0]);
		expect(eventTypeService.softRecover).toHaveBeenCalledWith(STANDUP);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, eventTypeService } = surfaces();
		const refusal = new Error('EVENT_TYPE_STILL_REFERENCED: a booking still names this meeting length.');

		eventTypeService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteEventType(STANDUP)).rejects.toBe(refusal);
	});
});

describe('EventTypeResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EventTypeResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', EventTypeController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', EventTypeResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			expect([...guardsOfRoute(EventTypeController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EventTypeController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EventTypeResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under — none, and never a grant', () => {
		for (const { field, route } of PERMISSION_PARITY) {
			expect(permissionOfField(field)).toBe(permissionOfRoute(EventTypeController, route));
			expect(permissionOfField(field)).toBeUndefined();
		}
	});

	it('declares no handler-level guard the resolver does not run under', () => {
		for (const { route } of PERMISSION_PARITY) {
			expect(Reflect.getMetadata('__guards__', handlersOf(EventTypeController)[route])).toBeUndefined();
		}
	});
});

describe('EventTypeResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, EventTypeResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EventTypeResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('eventTypes')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('eventTypes');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the create and the removals among them', async () => {
		for (const field of ['createEventType', 'updateEventType', 'deleteEventType']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('eventType'))).resolves.toBe(true);
	});
});

describe('EventTypeModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EventTypeModule) ?? []) as unknown[];

		expect(providers).toContain(EventTypeResolver);
		expect(providers).toContain(EventTypeService);
	});

	it('exports the service the resolver injects and the bus the create dispatches through', () => {
		// The resolver is a provider of whichever module the endpoint scans, so a module that imports this
		// one receives what this one hands on and nothing else: the create reaches a command, which is why
		// the bus is exported beside the service.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EventTypeModule) ?? []) as Array<{
			name?: string;
		}>;

		expect(exported).toContain(EventTypeService);
		expect(exported.map((entry) => entry?.name)).toContain('CqrsModule');
		expect(EventTypeResolver.length).toBe(2);
	});

	it('reaches the module that provides the guards, without importing the one the gate resolves through', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, EventTypeModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);
		const names = resolved.map((entry) => (entry as { name?: string })?.name);

		expect(names).toContain('RolePermissionModule');
		expect(names).not.toContain('FeatureModule');
	});
});
