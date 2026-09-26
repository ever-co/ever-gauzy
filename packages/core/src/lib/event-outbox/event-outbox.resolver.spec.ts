/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { GLOBAL_MODULE_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { EventOutboxStatus, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { RequestContext } from '../core/context';
import { FeatureModule } from '../feature/feature.module';
import { GraphqlSubscriptionModule } from '../graphql/subscriptions/graphql-subscription.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EventDeliveryController } from './event-delivery.controller';
import { EVENT_DELIVERY_ACTIONS, EVENT_DELIVERY_EVENT_NAMES, EventDeliveryEventPublisher } from './event-delivery.publisher';
import { EventOutboxController } from './event-outbox.controller';
import { EventOutboxModule } from './event-outbox.module';
import { EventOutboxResolver } from './event-outbox.resolver';
import { EventOutboxService } from './event-outbox.service';

/**
 * The reliability kernel over GraphQL (GraphQL specification §3.3, §7.1–§7.2, §9.7, §10).
 *
 * The programme's API doctrine is one capability reachable over both protocols with the same scope,
 * and this suite pins the half of it that is easy to get quietly wrong:
 *
 * - every root field `17-graphql-api-specification.md` §3.3 names for the event outbox exists **in the
 *   SDL**, read from the `.gql` files the boot loader globs rather than from a decorator, because a
 *   resolver whose field the schema does not declare is a field nothing can call — and the set is
 *   complete, so a field the design does not name is caught rather than tolerated;
 * - **the payload is a document and the delivery record is not**: the event's body and its headers
 *   are `JSON`, because their members are fixed per event name by the catalogue, while every member
 *   of a delivery is typed and its attempts are the row's own members — the entity declares no
 *   attempt table, so no attempt type exists;
 * - the two lists are connections with the platform's own cursor codec behind them, so a cursor
 *   obtained over REST resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same `EventOutboxService` method the REST route reaches, with the same
 *   scope, and the two moves answer the record as it stands after the move;
 * - **the guard stack and the permission are the controllers', field by field** — read from the
 *   controllers' own metadata rather than restated here, so a field that demanded more or less than
 *   its route is caught;
 * - **the producers are in the service**: the resolver's moves delegate and publish nothing
 *   themselves, which is what makes the stream a statement about the machinery rather than about one
 *   protocol;
 * - the whole surface is behind the capability the catalogue declares for GraphQL.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EVENT_ID = '00000000-0000-4000-8000-0000000000e1';
const OUTBOX_ROW = '00000000-0000-4000-8000-000000000010';
const DELIVERY = '00000000-0000-4000-8000-000000000020';
const DEAD_DELIVERY = '00000000-0000-4000-8000-000000000021';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with, in the order the delivered reads return them.
 */
const OUTBOX_ROWS = [
	{
		id: OUTBOX_ROW,
		eventId: EVENT_ID,
		eventName: 'order.placed',
		aggregateType: 'order',
		aggregateId: '00000000-0000-4000-8000-0000000000a1',
		payload: { orderId: '00000000-0000-4000-8000-0000000000a1', grandTotal: '100.50' },
		headers: { correlationId: '00000000-0000-4000-8000-0000000000c1' },
		status: EventOutboxStatus.PENDING,
		attemptCount: 2,
		availableAt: new Date('2026-03-01T10:00:00.000Z'),
		publishedAt: null,
		lastError: null,
		partitionKey: 'order:00000000-0000-4000-8000-0000000000a1',
		sequence: 3,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		createdAt: new Date('2026-03-01T09:59:00.000Z'),
		updatedAt: new Date('2026-03-01T09:59:00.000Z')
	},
	{
		id: '00000000-0000-4000-8000-000000000011',
		eventId: '00000000-0000-4000-8000-0000000000e2',
		eventName: 'payment.captured',
		aggregateType: 'payment',
		aggregateId: '00000000-0000-4000-8000-0000000000a2',
		payload: {},
		headers: null,
		status: EventOutboxStatus.DEAD,
		attemptCount: 10,
		availableAt: new Date('2026-03-02T10:00:00.000Z'),
		publishedAt: null,
		lastError: 'the queue is unavailable',
		partitionKey: 'payment:00000000-0000-4000-8000-0000000000a2',
		sequence: 1,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		createdAt: new Date('2026-03-02T09:00:00.000Z'),
		updatedAt: new Date('2026-03-02T09:00:00.000Z')
	}
];

const DELIVERY_ROWS = [
	{
		id: DELIVERY,
		eventId: EVENT_ID,
		consumerKey: 'subscriber:notification.order-confirmation',
		status: EventOutboxStatus.FAILED,
		attemptCount: 3,
		deliveredAt: null,
		lastError: 'the mail relay refused the message',
		partitionKey: 'order:00000000-0000-4000-8000-0000000000a1',
		sequence: 3,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:01:00.000Z')
	},
	{
		id: DEAD_DELIVERY,
		eventId: EVENT_ID,
		consumerKey: 'job:search-index',
		status: EventOutboxStatus.DEAD,
		attemptCount: 8,
		deliveredAt: null,
		lastError: 'the index refused the document',
		partitionKey: 'order:00000000-0000-4000-8000-0000000000a1',
		sequence: 3,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		createdAt: new Date('2026-03-01T09:00:00.000Z'),
		updatedAt: new Date('2026-03-01T09:30:00.000Z')
	}
];

/**
 * The resolver, over a scripted service and a fan-out that records what was subscribed to.
 */
function surfaces() {
	const eventOutboxService = {
		listOutboxRows: jest.fn().mockResolvedValue(OUTBOX_ROWS),
		findOutboxRow: jest.fn().mockResolvedValue(OUTBOX_ROWS[0]),
		listDeliveryRows: jest.fn().mockResolvedValue(DELIVERY_ROWS),
		findDeliveryRow: jest.fn().mockResolvedValue(DELIVERY_ROWS[0]),
		replayDelivery: jest
			.fn()
			.mockResolvedValue({ ...DELIVERY_ROWS[0], status: EventOutboxStatus.PENDING, attemptCount: 0, lastError: null }),
		deadLetterDelivery: jest
			.fn()
			.mockResolvedValue({ ...DELIVERY_ROWS[0], status: EventOutboxStatus.DEAD, lastError: 'stopped by hand' })
	};
	const pubSub = {
		topicFor: jest.fn((eventName: string, tenantId: string) => `${eventName}:${tenantId}`),
		asyncIterableIterator: jest.fn().mockReturnValue('the delivery stream'),
		publish: jest.fn().mockResolvedValue(true)
	};

	return {
		eventOutboxService,
		pubSub,
		resolver: new EventOutboxResolver(eventOutboxService as never, pubSub as never)
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

/** This domain's own two documents, as they are written on disk. */
const ownSdl = ['event-outbox.type.gql', 'event-outbox.api.gql']
	.map((file) => readFileSync(join(__dirname, 'schema', file), 'utf8'))
	.join('\n');

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation' | 'Subscription'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/**
 * Which root fields this domain owns, per operation type.
 *
 * A read is named for the resource and a move is named for what it does, so the same concept is
 * spelled two ways in one schema and one pattern cannot cover both. The patterns are deliberately
 * narrow: a sibling domain's `eventTypes` is not this resource, and a suite that claimed it would
 * fail on somebody else's delivery.
 */
const OWNED_FIELD_PATTERNS: Readonly<Record<'Query' | 'Mutation' | 'Subscription', RegExp>> = {
	Query: /^event(Outbox|Deliver)/,
	Mutation: /Event(Outbox|Deliver)/,
	Subscription: /^event(Outbox|Deliver)/
};

/** The type one root field answers, as the schema states it — `Int`, `EventDelivery!`. */
function fieldType(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as { getFields(): Record<string, { type: unknown }> } | undefined;

	return String(root?.getFields()?.[field]?.type);
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation' | 'Subscription', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
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
 * comment is part of the printed type, so a member is asserted absent by its name and never by the
 * words a description happens to use.
 */
function memberNames(name: string): string[] {
	return [...typeBody(name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EventOutboxController | typeof EventDeliveryController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controllers' own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(
	controller: typeof EventOutboxController | typeof EventDeliveryController,
	handler: string
): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = EventOutboxResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = EventOutboxResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(
	controller: typeof EventOutboxController | typeof EventDeliveryController,
	handler: string
): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here:
 * a table of permission names would agree with the resolver while disagreeing with the controller,
 * which is the failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{
	field: string;
	controller: typeof EventOutboxController | typeof EventDeliveryController;
	route: string;
}> = [
	{ field: 'eventOutbox', controller: EventOutboxController, route: 'findAll' },
	{ field: 'eventOutboxRecord', controller: EventOutboxController, route: 'findById' },
	{ field: 'eventDeliveries', controller: EventDeliveryController, route: 'findAll' },
	{ field: 'eventDelivery', controller: EventDeliveryController, route: 'findById' },
	{ field: 'replayEventDelivery', controller: EventDeliveryController, route: 'replay' },
	{ field: 'markEventDeliveryDead', controller: EventDeliveryController, route: 'markDead' }
];

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
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
		getHandler: () => (EventOutboxResolver.prototype as never)[field],
		getClass: () => EventOutboxResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EventOutboxResolver — the SDL declares the capabilities the design names (§3.3)', () => {
	it('declares the four reads', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['eventOutbox', 'eventOutboxRecord', 'eventDeliveries', 'eventDelivery'])
		);
	});

	it('declares the two moves and the one streamed fact', () => {
		expect(rootFields('Mutation')).toEqual(expect.arrayContaining(['replayEventDelivery', 'markEventDeliveryDead']));
		expect(rootFields('Subscription')).toEqual(expect.arrayContaining(['eventDeliveryChanged']));
	});

	it('declares the reads and the moves the design names, and no more', () => {
		// §3.2 states that the names it lists are the complete set for a domain, so the surface is
		// asserted as a set rather than as a subset: a field the design does not name is a promise this
		// delivery did not make. The pattern is this domain's own two concepts — a sibling domain's
		// event types are not this resource — so the assertion is about the outbox and nothing else.
		const owned = (operation: 'Query' | 'Mutation' | 'Subscription'): string[] =>
			rootFields(operation).filter((field) => OWNED_FIELD_PATTERNS[operation].test(field)).sort();

		expect(owned('Query')).toEqual(['eventDeliveries', 'eventDelivery', 'eventOutbox', 'eventOutboxRecord']);
		expect(owned('Mutation')).toEqual(['markEventDeliveryDead', 'replayEventDelivery']);
		expect(owned('Subscription')).toEqual(['eventDeliveryChanged']);
	});

	it('declares no count field, because neither resource serves a count route', () => {
		// A count field exists where the REST route answers a bare number. These two resources report
		// their total in the connection envelope, which is the same figure, so a second field would be a
		// second evaluation path that could disagree with it.
		for (const field of rootFields('Query').filter((name) => OWNED_FIELD_PATTERNS.Query.test(name))) {
			expect(field).not.toMatch(/Count$/);
		}
	});

	it('declares both connections, their edges, their filters and their sorts', () => {
		expect(printed).toMatch(
			/type EventOutboxRecordConnection \{\s*nodes: \[EventOutboxRecord!\]!\s*edges: \[EventOutboxRecordEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EventOutboxRecordEdge \{\s*node: EventOutboxRecord!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(
			/type EventDeliveryConnection \{\s*nodes: \[EventDelivery!\]!\s*edges: \[EventDeliveryEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EventDeliveryEdge \{\s*node: EventDelivery!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EventOutboxRecordFilter \{/);
		expect(printed).toMatch(/input EventOutboxRecordSort \{/);
		expect(printed).toMatch(/enum EventOutboxRecordSortField \{/);
		expect(printed).toMatch(/input EventDeliveryFilter \{/);
		expect(printed).toMatch(/input EventDeliverySort \{/);
		expect(printed).toMatch(/enum EventDeliverySortField \{/);
		// The kernel's page info is referenced, never redeclared: the schema builds rather than fails
		// when the same name is declared twice, and the composition check is what refuses it.
		expect(printed).toMatch(/type PageInfo \{/);
	});

	it('declares the write input the dead-letter move takes, and no input the replay needs', () => {
		expect(printed).toMatch(/input MarkEventDeliveryDeadInput \{/);
		expect(inputBody('MarkEventDeliveryDeadInput')).toMatch(/id: ID!/);
		expect(inputBody('MarkEventDeliveryDeadInput')).toMatch(/reason: String!/);
		// The replay states one identifier and no choice: a body with no members is not a body.
		expect(fieldArgs('Mutation', 'replayEventDelivery')).toEqual(['id']);
		expect(fieldArgs('Mutation', 'markEventDeliveryDead')).toEqual(['input']);
	});

	it('declares the read arguments each field carries, so a field states what its resolver reads', () => {
		const CONNECTION_ARGS = ['filter', 'sort', 'page', 'first', 'after', 'last', 'before', 'limit', 'offset'];

		expect(fieldArgs('Query', 'eventOutbox')).toEqual(CONNECTION_ARGS);
		expect(fieldArgs('Query', 'eventDeliveries')).toEqual(CONNECTION_ARGS);
		expect(fieldArgs('Query', 'eventOutboxRecord')).toEqual(['id']);
		expect(fieldArgs('Query', 'eventDelivery')).toEqual(['id']);
		// `withDeleted` is absent because the delivered reads answer live rows only.
		expect(fieldArgs('Query', 'eventOutbox')).not.toContain('withDeleted');
		expect(fieldArgs('Query', 'eventDeliveries')).not.toContain('withDeleted');
	});

	it('answers the node reads nullably and the moves with the record', () => {
		expect(fieldType('Query', 'eventOutboxRecord')).toBe('EventOutboxRecord');
		expect(fieldType('Query', 'eventDelivery')).toBe('EventDelivery');
		expect(fieldType('Mutation', 'replayEventDelivery')).toBe('EventDelivery!');
		expect(fieldType('Mutation', 'markEventDeliveryDead')).toBe('EventDelivery!');
	});
});

describe('EventOutboxResolver — the payload is a document and the record of the attempts is the row', () => {
	it('carries the event body and its headers as documents, and says why', () => {
		const body = typeBody('EventOutboxRecord');

		// The body's members are fixed **per event name** by the catalogue, so a schema type would have
		// to enumerate every catalogued payload and would make a producer's new member a schema change.
		// The body is non-null because the column is; the headers are nullable because a row written
		// outside a request has none.
		expect(body).toMatch(/payload: JSON!\n/);
		expect(body).toMatch(/headers: JSON\n/);
		expect(body).not.toMatch(/payload: (String|EventPayload|JSON!?Payload)/);
	});

	it('carries every other outbox member as its own type', () => {
		const body = typeBody('EventOutboxRecord');

		expect(body).toMatch(/eventId: ID!\n/);
		expect(body).toMatch(/eventName: String!\n/);
		expect(body).toMatch(/aggregateType: String!\n/);
		expect(body).toMatch(/aggregateId: ID!\n/);
		expect(body).toMatch(/attemptCount: Int!\n/);
		expect(body).toMatch(/availableAt: DateTime!\n/);
		expect(body).toMatch(/publishedAt: DateTime\n/);
		expect(body).toMatch(/lastError: String\n/);
		expect(body).toMatch(/partitionKey: String\n/);
		expect(body).toMatch(/sequence: Int!\n/);
	});

	it('carries no document on the delivery record at all', () => {
		// Every member of a delivery is a column with a type of its own, which is the difference the
		// entities state: the outbox row stores a projection, the delivery row stores a fact per column.
		expect(typeBody('EventDelivery')).not.toMatch(/\bJSON\b/);
	});

	it('carries the attempts as the record’s own members and declares no attempt type', () => {
		const members = memberNames('EventDelivery');

		// The entity declares no attempt table: the status, the count, the last error and the instant
		// the consumer acknowledged the event *are* the projection of the attempts made on this
		// `(event, consumer)` pair. A second type would be a second resource for a fact the kernel keeps
		// in one row.
		expect(members).toEqual(
			expect.arrayContaining(['status', 'attemptCount', 'deliveredAt', 'lastError', 'partitionKey', 'sequence'])
		);
		expect(members).not.toContain('attempts');
		expect(members).not.toContain('attempt');
		expect(ownSdl).not.toMatch(/type EventDeliveryAttempt\b/);
		expect(printed).not.toMatch(/type EventDeliveryAttempt\b/);
	});

	it('carries the status vocabulary as its value and never as a schema enum', () => {
		// `EventOutboxStatus` is the contracts' own vocabulary, shared by both tables so that one scan
		// and one retry policy cover an event and a consumer alike, and the column stores four of the
		// states the design names. Declaring the enumeration here would close a value set this domain
		// does not own: a kernel that adds a state would be a schema change.
		expect(typeBody('EventOutboxRecord')).toMatch(/status: String!\n/);
		expect(typeBody('EventDelivery')).toMatch(/status: String!\n/);
		expect(ownSdl).not.toMatch(/enum EventOutboxStatus\b/);
		expect(printed).not.toMatch(/enum EventOutboxStatus\b/);
	});

	it('narrows the documents and the columns through the families their types imply', () => {
		const outbox = inputBody('EventOutboxRecordFilter');
		const delivery = inputBody('EventDeliveryFilter');

		expect(outbox).toMatch(/payload: JSONFilter/);
		expect(outbox).toMatch(/headers: JSONFilter/);
		expect(outbox).toMatch(/status: StringFilter/);
		expect(outbox).toMatch(/attemptCount: NumberFilter/);
		expect(outbox).toMatch(/availableAt: DateTimeFilter/);
		expect(outbox).toMatch(/sequence: NumberFilter/);
		expect(delivery).toMatch(/consumerKey: StringFilter/);
		expect(delivery).toMatch(/deliveredAt: DateTimeFilter/);
		expect(delivery).toMatch(/eventId: IDFilter/);
		// The tenant and the organization are applied from the credential, so neither is filterable; a
		// soft-deleted row is not answered at all, so a condition on that column could only match the
		// empty set.
		expect(outbox).not.toMatch(/tenantId/);
		expect(outbox).not.toMatch(/organizationId/);
		expect(outbox).not.toMatch(/deletedAt/);
		expect(delivery).not.toMatch(/tenantId/);
		expect(delivery).not.toMatch(/organizationId/);
		expect(delivery).not.toMatch(/deletedAt/);
	});
});

describe('EventOutboxResolver — the connection contract (§7.1, §7.2)', () => {
	it('answers the outbox list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, eventOutboxService } = surfaces();

		const connection = await resolver.eventOutbox(undefined, undefined, undefined, 20);

		expect(eventOutboxService.listOutboxRows).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(OUTBOX_ROW);
	});

	it('answers the delivery list with the newest record first, which is the order the read fixes', async () => {
		const { resolver, eventOutboxService } = surfaces();

		const connection = await resolver.eventDeliveries();

		expect(eventOutboxService.listDeliveryRows).toHaveBeenCalledWith();
		expect(connection.nodes.map((node) => node.id)).toEqual([DELIVERY, DEAD_DELIVERY]);
	});

	it('narrows by the fields the outbox filter declares', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.eventOutbox({ status: { eq: EventOutboxStatus.DEAD } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([OUTBOX_ROWS[1].id]);

		const byName = await resolver.eventOutbox({ eventName: { eq: 'order.placed' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([OUTBOX_ROW]);

		// The document column is compared through the JSON family, which is what `contains` is for: an
		// operator asks which events mention an aggregate without the surface knowing the body's shape.
		const byPayload = await resolver.eventOutbox({ payload: { contains: ['orderId'] } });
		expect(byPayload.nodes.map((node) => node.id)).toEqual([OUTBOX_ROW]);

		const byWindow = await resolver.eventOutbox({
			availableAt: { between: ['2026-03-01T00:00:00.000Z', '2026-03-01T23:59:59.000Z'] }
		});
		expect(byWindow.nodes.map((node) => node.id)).toEqual([OUTBOX_ROW]);

		const byAttempts = await resolver.eventOutbox({ attemptCount: { gte: 10 } });
		expect(byAttempts.nodes.map((node) => node.id)).toEqual([OUTBOX_ROWS[1].id]);
	});

	it('narrows by the fields the delivery filter declares', async () => {
		const { resolver } = surfaces();

		const byConsumer = await resolver.eventDeliveries({ consumerKey: { eq: 'job:search-index' } });
		expect(byConsumer.nodes.map((node) => node.id)).toEqual([DEAD_DELIVERY]);

		const byEvent = await resolver.eventDeliveries({ eventId: { eq: EVENT_ID } });
		expect(byEvent.totalCount).toBe(2);

		const byStatus = await resolver.eventDeliveries({ status: { eq: EventOutboxStatus.DEAD } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([DEAD_DELIVERY]);

		const byError = await resolver.eventDeliveries({ lastError: { ilike: '%relay%' } });
		expect(byError.nodes.map((node) => node.id)).toEqual([DELIVERY]);
	});

	it('orders by the keys the sort enums offer', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.eventOutbox(undefined, [{ field: 'attemptCount', direction: 'DESC' }]);
		expect(byName.nodes.map((node) => node.attemptCount)).toEqual([10, 2]);

		const byCreated = await resolver.eventDeliveries(undefined, [{ field: 'createdAt', direction: 'ASC' }]);
		expect(byCreated.nodes.map((node) => node.id)).toEqual([DEAD_DELIVERY, DELIVERY]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.eventOutbox(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([OUTBOX_ROW]);

		const second = await resolver.eventOutbox(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OUTBOX_ROWS[1].id]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.eventDeliveries(undefined, undefined, undefined, 20);

		const last = await resolver.eventDeliveries(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([DELIVERY]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.eventOutbox(undefined, [{ field: 'status', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// The tenant is applied from the credential rather than from the caller's filter, so a caller
		// that states one is refused instead of being silently ignored.
		const error = await resolver.eventOutbox({ tenantId: { eq: TENANT } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.eventDeliveries(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every row', async () => {
		const { resolver } = surfaces();

		const error = await resolver.eventOutbox(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});

	it('keeps each evaluator’s allow-list and its schema filter in step, member for member', async () => {
		const { resolver } = surfaces();

		for (const [filter, read] of [
			['EventOutboxRecordFilter', (member: string) => resolver.eventOutbox({ [member]: {} })],
			['EventDeliveryFilter', (member: string) => resolver.eventDeliveries({ [member]: {} })]
		] as const) {
			const declared = [...inputBody(filter).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
				.map((match) => match[1])
				.filter((member) => !['and', 'or', 'not'].includes(member));

			// An empty condition narrows nothing, so what each read asserts is only that the evaluator
			// recognises the member the schema declares.
			for (const member of declared) {
				await expect(read(member)).resolves.toBeDefined();
			}

			// The other half of the same claim is read off the refusal, which names the evaluator's
			// whole allow-list: a member it knows and the schema does not would appear there and nowhere
			// else.
			const refusal = await read('tenantId').catch((thrown) => thrown);
			const allowed = String((refusal as Error).message)
				.split('Allowed: ')[1]
				// The message closes the list with a sentence, so the full stop comes off before the
				// members are read: it is punctuation rather than part of the last name.
				.replace(/\.\s*$/, '')
				.split(',')
				.map((member) => member.trim())
				.sort();

			expect(allowed).toEqual([...declared].sort());
		}
	});

	it('accepts every key each sort enum offers, and only those', async () => {
		const { resolver } = surfaces();

		for (const [enumName, read] of [
			['EventOutboxRecordSortField', (field: string) => resolver.eventOutbox(undefined, [{ field, direction: 'ASC' }])],
			['EventDeliverySortField', (field: string) => resolver.eventDeliveries(undefined, [{ field, direction: 'ASC' }])]
		] as const) {
			const offered = [...bodyOf('enum', enumName).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)].map(
				(match) => match[1]
			);

			expect(offered.length).toBeGreaterThan(0);

			for (const field of offered) {
				await expect(read(field)).resolves.toBeDefined();
			}
		}
	});
});

describe('EventOutboxResolver — one kernel, two protocols, the same operations', () => {
	it('reads one row of each resource through the same service methods the node routes call', async () => {
		const { resolver, eventOutboxService } = surfaces();

		expect(await resolver.eventOutboxRecord(OUTBOX_ROW)).toBe(OUTBOX_ROWS[0]);
		expect(eventOutboxService.findOutboxRow).toHaveBeenCalledWith(OUTBOX_ROW);

		expect(await resolver.eventDelivery(DELIVERY)).toBe(DELIVERY_ROWS[0]);
		expect(eventOutboxService.findDeliveryRow).toHaveBeenCalledWith(DELIVERY);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, eventOutboxService } = surfaces();
		eventOutboxService.findOutboxRow.mockResolvedValueOnce(null);
		eventOutboxService.findDeliveryRow.mockResolvedValueOnce(null);

		expect(await resolver.eventOutboxRecord('00000000-0000-4000-8000-0000000000ff')).toBeNull();
		expect(await resolver.eventDelivery(DELIVERY)).toBeNull();
	});

	it('replays through the same service method the REST route calls, and answers the record', async () => {
		const { resolver, eventOutboxService, pubSub } = surfaces();

		const replayed = await resolver.replayEventDelivery(DELIVERY);

		expect(eventOutboxService.replayDelivery).toHaveBeenCalledWith(DELIVERY);
		expect(replayed.status).toBe(EventOutboxStatus.PENDING);
		expect(replayed.attemptCount).toBe(0);
		// The producer is the service: the field publishes nothing itself, so a subscriber cannot tell
		// which protocol made the move.
		expect(pubSub.publish).not.toHaveBeenCalled();
	});

	it('dead-letters through the same service method the REST route calls, with the reason', async () => {
		const { resolver, eventOutboxService, pubSub } = surfaces();

		const dead = await resolver.markEventDeliveryDead({ id: DELIVERY, reason: 'stopped by hand' });

		expect(eventOutboxService.deadLetterDelivery).toHaveBeenCalledWith(DELIVERY, 'stopped by hand');
		expect(dead.status).toBe(EventOutboxStatus.DEAD);
		expect(dead.lastError).toBe('stopped by hand');
		expect(pubSub.publish).not.toHaveBeenCalled();
	});

	it('surfaces a refusal rather than a row when the record is not the caller’s', async () => {
		const { resolver, eventOutboxService } = surfaces();
		const refusal = new NotFoundException('RESOURCE_NOT_FOUND: delivery could not be found.');

		eventOutboxService.replayDelivery.mockRejectedValueOnce(refusal);

		await expect(resolver.replayEventDelivery(DELIVERY)).rejects.toBe(refusal);
	});
});

describe('EventOutboxResolver — the guard stack and the permission are the controllers’', () => {
	it('guards the resolver the way the controllers are guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EventOutboxResolver) ?? [];

		for (const controller of [EventOutboxController, EventDeliveryController]) {
			const controllerGuards = Reflect.getMetadata('__guards__', controller) ?? [];

			expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
			// The one guard the resolver states beyond the controllers' chain is the gate, and it is an
			// addition rather than a substitution: the two come first, so a caller with no credential is
			// refused as a credential problem before a tenant's switches are read.
			expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
		}
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', EventOutboxResolver) ?? []) as unknown[];

		for (const { controller, route } of PERMISSION_PARITY) {
			const declared = Reflect.getMetadata('__guards__', controller) ?? [];
			const restated = guardsOfHandler(controller, route);

			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission both controllers state on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EventOutboxResolver)).toEqual([
			PermissionsEnum.EVENT_OUTBOX_VIEW
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EventOutboxController)).toEqual([
			PermissionsEnum.EVENT_OUTBOX_VIEW
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EventDeliveryController)).toEqual([
			PermissionsEnum.EVENT_OUTBOX_VIEW
		]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, controller, route }) => {
		const fieldPermissions = Reflect.getMetadata(PERMISSIONS_METADATA, EventOutboxResolver.prototype[field]) ?? [];
		const routePermissions = permissionOfRoute(controller, route) ?? [];

		expect(fieldPermissions).toEqual(routePermissions);
		// The guard a field states of its own is the guard its route's handler states of its own: the
		// class-level chains are compared above, and a handler that added one is caught here.
		expect(guardsOfField(field)).toEqual(guardsOfHandler(controller, route));
	});

	it('carries the inspect permission on the reads and the retry permission on the two moves', () => {
		// The split is the catalogue's own: `EVENT_OUTBOX_VIEW` is "inspect the transactional outbox and
		// its per-consumer deliveries" and is granted to any role, while `EVENT_OUTBOX_RETRY` is
		// "re-publish a failed event or redeliver it to one consumer" and is granted to an administrator.
		// `appendix-b-permissions-and-features.md` §2.1 assigns them to exactly these operations.
		expect(permissionOfField('eventOutbox')).toEqual([PermissionsEnum.EVENT_OUTBOX_VIEW]);
		expect(permissionOfField('eventOutboxRecord')).toEqual([PermissionsEnum.EVENT_OUTBOX_VIEW]);
		expect(permissionOfField('eventDeliveries')).toEqual([PermissionsEnum.EVENT_OUTBOX_VIEW]);
		expect(permissionOfField('eventDelivery')).toEqual([PermissionsEnum.EVENT_OUTBOX_VIEW]);
		expect(permissionOfField('replayEventDelivery')).toEqual([PermissionsEnum.EVENT_OUTBOX_RETRY]);
		expect(permissionOfField('markEventDeliveryDead')).toEqual([PermissionsEnum.EVENT_OUTBOX_RETRY]);
	});

	it('refuses each move to a caller who holds only the inspect permission', () => {
		for (const field of ['replayEventDelivery', 'markEventDeliveryDead']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, EventOutboxResolver.prototype[field]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.EVENT_OUTBOX_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});
});

describe('EventOutboxResolver — the streamed fact (§10.2, §10.4, §10.6)', () => {
	it('declares the event name and both moves once, where the producer can read them', () => {
		// `event_delivery` is the table's own name in snake_case, which is the rule the catalogue states
		// for a multi-word aggregate, and the moves are values of one fact rather than a name each.
		expect(EVENT_DELIVERY_EVENT_NAMES.EVENT_DELIVERY_CHANGED).toBe('event_delivery.changed');
		expect(EVENT_DELIVERY_ACTIONS.REPLAYED).toBe('replayed');
		expect(EVENT_DELIVERY_ACTIONS.MARKED_DEAD).toBe('marked-dead');
	});

	it('declares the name in the catalogue at bootstrap, so a client may select it', () => {
		const catalogue = { declare: jest.fn(), size: 0, names: () => [] };
		const publisher = new EventDeliveryEventPublisher({} as never, catalogue as never);

		publisher.onModuleInit();

		// The catalogue is what the subscription surface offers: an event a domain publishes but never
		// declares is an event no client can ask for.
		expect(catalogue.declare).toHaveBeenCalledWith(EVENT_DELIVERY_EVENT_NAMES.EVENT_DELIVERY_CHANGED);
	});

	it('publishes the record on the topic its event and tenant name', async () => {
		const pubSub = { publish: jest.fn().mockResolvedValue(true) };
		const publisher = new EventDeliveryEventPublisher(pubSub as never, { declare: jest.fn() } as never);
		const spy = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);

		try {
			const published = await publisher.deliveryChanged(DELIVERY_ROWS[0], EVENT_DELIVERY_ACTIONS.REPLAYED);

			expect(published).toBe(true);
			expect(pubSub.publish).toHaveBeenCalledWith(
				'event_delivery.changed',
				TENANT,
				expect.objectContaining({
					name: 'event_delivery.changed',
					tenantId: TENANT,
					action: 'replayed',
					delivery: DELIVERY_ROWS[0],
					aggregate: { type: 'EventDelivery', id: DELIVERY }
				})
			);
		} finally {
			spy.mockRestore();
		}
	});

	it('publishes nothing when no tenant can be resolved, rather than broadcasting', async () => {
		const pubSub = { publish: jest.fn().mockResolvedValue(true) };
		const publisher = new EventDeliveryEventPublisher(pubSub as never, { declare: jest.fn() } as never);
		const spy = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(undefined);

		try {
			const published = await publisher.deliveryChanged({ ...DELIVERY_ROWS[0], tenantId: undefined }, 'replayed');

			expect(published).toBe(false);
			expect(pubSub.publish).not.toHaveBeenCalled();
		} finally {
			spy.mockRestore();
		}
	});

	it('subscribes to the tenant’s own topic for the catalogued event', () => {
		const { resolver, pubSub } = surfaces();
		const spy = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);

		try {
			const stream = resolver.eventDeliveryChanged(DELIVERY, 'replayed');

			expect(pubSub.topicFor).toHaveBeenCalledWith(EVENT_DELIVERY_EVENT_NAMES.EVENT_DELIVERY_CHANGED, TENANT);
			expect(stream).toBe('the delivery stream');
		} finally {
			spy.mockRestore();
		}
	});

	it('carries the read permission and never a write one', () => {
		// The subscription's authorisation is the subscribed resource's own view permission and nothing
		// weaker: a caller who may not read the delivery ledger may not stream it either.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EventOutboxResolver.prototype.eventDeliveryChanged)).toEqual([
			PermissionsEnum.EVENT_OUTBOX_VIEW
		]);
	});

	it('declares the two narrowing arguments the filter applies', () => {
		expect(fieldArgs('Subscription', 'eventDeliveryChanged')).toEqual(['deliveryId', 'action']);
	});
});

describe('EventOutboxResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, EventOutboxResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EventOutboxResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('eventOutbox')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('eventOutbox');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the moves as well', async () => {
		// Nothing on this surface is exempt: the door that switches the capability back on is the REST
		// route, which this code does not gate.
		for (const field of ['replayEventDelivery', 'markEventDeliveryDead', 'eventDeliveryChanged']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('eventDeliveries'))).resolves.toBe(true);
	});
});

describe('EventOutboxModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver, the publisher and the service as providers of this module', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EventOutboxModule) ?? []) as unknown[];

		expect(providers).toContain(EventOutboxResolver);
		expect(providers).toContain(EventOutboxService);
		expect(providers).toContain(EventDeliveryEventPublisher);
	});

	it('declares both controllers', () => {
		const controllers = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, EventOutboxModule) ?? []) as unknown[];

		expect(controllers).toEqual(expect.arrayContaining([EventOutboxController, EventDeliveryController]));
	});

	it('reaches the subscription surface through a forward reference, because that module imports this one', () => {
		// The edge is a cycle, and it is deferred for that reason: `GraphqlSubscriptionModule` imports
		// this module for the consumer registry it registers, so a module-scope import here would be read
		// from inside that module's own evaluation and would be `undefined` at decoration time whenever
		// this module happens to be evaluated first — which `app.module.ts` makes the ordinary case.
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, EventOutboxModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const deferred = imports.filter((entry) => entry && typeof entry.forwardRef === 'function');

		expect(deferred.map((entry) => entry.forwardRef?.())).toContain(GraphqlSubscriptionModule);
	});

	it('defers it far enough that the cycle leaves no undefined import, in the order the app evaluates', () => {
		// The deferral is load-bearing, and this is the assertion that says so. `app.module.ts` evaluates
		// this module *before* the subscription module that imports it; a module-scope import of the
		// subscription surface would therefore be read while this module is still being defined, and the
		// other module's `imports` array would hold `undefined` — which Nest refuses at boot with a
		// message about a module rather than about a cycle. Both are required in a registry of their own
		// here, so the order under test is the order written down rather than the order this file
		// happened to import them in.
		jest.isolateModules(() => {
			// The registry is fresh, so the rule this file states at the top applies here too: the entity
			// barrel is loaded before anything that reaches the crud layer, or an entity decorator is
			// undefined when the entity applies it.
			require('../core/entities/internal');

			const outbox = require('./event-outbox.module') as typeof import('./event-outbox.module');
			const subscriptions =
				require('../graphql/subscriptions/graphql-subscription.module') as typeof import('../graphql/subscriptions/graphql-subscription.module');

			expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, subscriptions.GraphqlSubscriptionModule)).toContain(
				outbox.EventOutboxModule
			);
			expect(
				(Reflect.getMetadata(MODULE_METADATA.IMPORTS, outbox.EventOutboxModule) ?? []).filter(
					(entry) => entry === undefined
				)
			).toEqual([]);
		});
	});

	it('reaches the module that provides the guards, without importing the one the gate resolves through', () => {
		// The two guards the resolver shares with the controllers are providers of whichever module
		// declares the handler they protect, so this module has to reach the permission service they look
		// the caller's grants up in — the API boot fails on an unresolved dependency without it.
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, EventOutboxModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved.map((entry) => (entry as { name?: string })?.name)).toContain('RolePermissionModule');

		// `FeatureModule` is deliberately not imported, and that is a fact about the module rather than a
		// preference: it is global, so the feature service `FeatureFlagGuard` resolves through is
		// available wherever a guard runs, and an import here would be one edge in every module that
		// declares a resolver.
		expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, FeatureModule)).toBe(true);
		expect(resolved).not.toContain(FeatureModule);
	});

	it('exports what a hosting module receives, so a resolver declared there resolves the same instances', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EventOutboxModule) ?? []) as unknown[];

		expect(exported).toEqual(
			expect.arrayContaining([EventOutboxService, EventOutboxResolver, EventDeliveryEventPublisher])
		);
	});
});
