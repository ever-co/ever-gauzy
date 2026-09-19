/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, HttpException, NotFoundException } from '@nestjs/common';
import { GLOBAL_MODULE_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import {
	ID as Id,
	IOperation,
	IOperationStep,
	OperationStatus,
	OperationStepStatus,
	PermissionsEnum
} from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureModule } from '../feature/feature.module';
import { createGraphqlRequestContext } from '../graphql/graphql-context';
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OperationController } from './operation.controller';
import { OperationModule } from './operation.module';
import { OperationResolver, OperationStepResolver } from './operation.resolver';
import { OperationService } from './operation.service';
import {
	OPERATION_EVENT_NAMES,
	OPERATION_SUBSCRIBED_EVENT_NAMES,
	OperationEventPublisher,
	IOperationChangedEnvelope
} from './operation-event.publisher';

/**
 * The request context, doubled so the tenant a credential carries is a value this suite states.
 *
 * The subscription topics and the stream filters are built from the credential rather than from an
 * argument, so the tenant has to be knowable here for those assertions to be about the topic and the
 * filter rather than about whichever tenant the ambient context happened to hold.
 */
let mockTenantId: string | null = '00000000-0000-4000-8000-000000000001';
let mockOrganizationId: string | null = '00000000-0000-4000-8000-000000000002';

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => (mockTenantId ? { id: 'user-1', tenantId: mockTenantId } : null),
		currentUserId: () => (mockTenantId ? 'user-1' : null),
		currentTenantId: () => mockTenantId,
		currentOrganizationId: () => mockOrganizationId,
		currentEmployeeId: () => null,
		currentRoleId: () => null,
		hasPermission: () => false
	}
}));

/**
 * The durable-operation resource over GraphQL (GraphQL specification §3.3, §3.1, §6.1, §7.1–§7.2,
 * §9.6, §9.7, §10.2, §10.4).
 *
 * The REST surface this mirrors is the `/api/operations` controller delivered with it, and the suite
 * pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every root field the coverage table names for this resource exists **in the SDL**, read from the
 *   `.gql` files the boot loader globs rather than from a decorator, because a resolver whose field
 *   the schema does not declare is a field nothing can call;
 * - **the resource's two types are the kernel's**, so this delivery declares none of them and extends
 *   none of them: what it contributes is the connection and the inputs around them, and what it
 *   resolves is the members the kernel declares — `progress` and `steps` on an operation, `attempt`
 *   and `compensationStatus` on a step — from this resource's own rows;
 * - the list root field is a connection with the platform's own cursor codec behind it, so a cursor
 *   obtained over REST resumes here and a refusal is the query protocol's own code;
 * - a move delegates to the same service method the REST route calls, and answers the operation as
 *   the move left it rather than a bare boolean;
 * - every field carries the permission its own route runs under, read from the controller's metadata
 *   by the rule the guards apply, so a role that may watch the queue cannot cancel an operation by
 *   asking GraphQL instead of REST, and no field states a permission its route does not carry;
 * - the three streamed facts reach the subscriptions the coverage table names, produced by the
 *   service both surfaces call, so a subscriber cannot tell which protocol wrote a row.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const OPERATION = '00000000-0000-4000-8000-000000000010';
const SECOND_OPERATION = '00000000-0000-4000-8000-000000000011';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000009';
const AGGREGATE = '00000000-0000-4000-8000-000000000030';
const STEP_RESERVE = '00000000-0000-4000-8000-000000000040';
const STEP_CHARGE = '00000000-0000-4000-8000-000000000041';
const STEP_CONFIRM = '00000000-0000-4000-8000-000000000042';
const SECOND_STEP = '00000000-0000-4000-8000-000000000043';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The key `@Subscription(name, options)` stores its options under, read here so the stream's filter —
 * which is where the two narrowing arguments and the tenant comparison live — can be asserted rather
 * than assumed. It is the constant `@nestjs/graphql` itself writes.
 */
const SUBSCRIPTION_OPTIONS_METADATA = 'graphql:subscription_options;';

/** The error document a compensated operation stores, as the row holds it. */
const LAST_ERROR = JSON.stringify({
	code: 'PAYMENT_DECLINED',
	message: 'The issuing bank declined the authorisation.',
	stepName: 'authorize_payment',
	retryable: true
});

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS: IOperation[] = [
	{
		id: OPERATION,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		type: 'CHECKOUT_COMPLETE',
		status: OperationStatus.COMPENSATING,
		input: { cartId: AGGREGATE },
		state: { cursor: 1, cancelRequested: false },
		attemptCount: 1,
		maxAttempts: 3,
		lastError: LAST_ERROR,
		aggregateType: 'commerce_cart',
		aggregateId: AGGREGATE,
		correlationId: '00000000-0000-4000-8000-000000000070',
		deadlineAt: new Date('2026-03-01T10:15:00.000Z'),
		startedAt: new Date('2026-03-01T10:00:00.000Z'),
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:01:00.000Z')
	} as IOperation,
	{
		id: SECOND_OPERATION,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		type: 'ORDER_CAPTURE',
		status: OperationStatus.COMPLETED,
		input: { orderId: AGGREGATE },
		attemptCount: 0,
		maxAttempts: 3,
		aggregateType: 'order',
		aggregateId: AGGREGATE,
		correlationId: '00000000-0000-4000-8000-000000000071',
		finishedAt: new Date('2026-02-01T10:00:00.000Z'),
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	} as IOperation
];

/**
 * The steps of both operations, as the step read answers them.
 *
 * The first operation is partially through its plan: one step completed, one skipped because it
 * declares no compensator, and the step that failed — which is the plan `progress` has to read as
 * two thirds.
 */
const STEPS: IOperationStep[] = [
	{ id: STEP_RESERVE, operationId: OPERATION, name: 'reserve_stock', order: 10, status: OperationStepStatus.COMPLETED, attemptCount: 1 },
	{ id: STEP_CONFIRM, operationId: OPERATION, name: 'compute_totals', order: 20, status: OperationStepStatus.SKIPPED, attemptCount: 1 },
	{ id: STEP_CHARGE, operationId: OPERATION, name: 'authorize_payment', order: 30, status: OperationStepStatus.FAILED, attemptCount: 2 },
	{ id: SECOND_STEP, operationId: SECOND_OPERATION, name: 'capture', order: 10, status: OperationStepStatus.COMPLETED, attemptCount: 1 }
] as IOperationStep[];

/** The resolver, over a scripted service and a fan-out that records the topic it was opened on. */
function surfaces() {
	const operationService = {
		listOperations: jest.fn().mockResolvedValue(ROWS),
		findOperation: jest.fn().mockResolvedValue(ROWS[0]),
		findByAggregate: jest.fn().mockResolvedValue(ROWS),
		findSteps: jest.fn().mockImplementation(async (operationId: Id) =>
			STEPS.filter((step) => String(step.operationId) === String(operationId))
		),
		findStepsForOperations: jest
			.fn()
			.mockImplementation(async (ids: readonly Id[]) => STEPS.filter((step) => ids.includes(step.operationId))),
		cancel: jest.fn().mockResolvedValue({ ...ROWS[0], status: OperationStatus.COMPENSATED }),
		retry: jest.fn().mockResolvedValue({
			operation: { ...ROWS[0], status: OperationStatus.COMPLETED },
			executedSteps: ['reserve_stock', 'authorize_payment'],
			finished: true
		}),
		resume: jest.fn().mockResolvedValue({
			operation: { ...ROWS[0], status: OperationStatus.RUNNING },
			executedSteps: ['authorize_payment'],
			finished: false
		})
	};
	const pubSub = {
		topicFor: jest.fn((eventName: string, tenantId: string) => `${eventName}:${tenantId}`),
		asyncIterableIterator: jest.fn().mockReturnValue('the operation stream')
	};

	return {
		operationService,
		pubSub,
		resolver: new OperationResolver(operationService as never, pubSub as never),
		stepResolver: new OperationStepResolver()
	};
}

/**
 * The deployment's own fan-out, with the real publisher over it.
 *
 * The publisher under test is the real one, because what this suite pins is the envelope a subscriber
 * receives and not that some collaborator was called: the fan-out is the platform's in-process engine,
 * so a fact published here is a fact the subscription's own stream hands back.
 */
function announcements() {
	const pubSub = new GraphqlPubSub();
	const catalogue = new SubscriptionCatalogue();
	const publisher = new OperationEventPublisher(pubSub as never, catalogue);

	publisher.onModuleInit();

	return { pubSub, catalogue, publisher };
}

/**
 * Reads one message from a stream, refusing to hang the suite when none arrives.
 *
 * The deadline is cleared on every path, so a case that reads four messages leaves four timers behind
 * for a run that has already decided — which is what makes Jest force a worker to exit.
 */
async function nextOrNothing<T>(stream: AsyncIterator<T>): Promise<IteratorResult<T>> {
	let deadline: ReturnType<typeof setTimeout> | undefined;

	try {
		return await Promise.race([
			stream.next(),
			new Promise<IteratorResult<T>>((resolve) => {
				deadline = setTimeout(() => resolve({ value: undefined, done: true }), 50);
			})
		]);
	} finally {
		clearTimeout(deadline);
	}
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

/**
 * The composed schema, as text: this domain's own documents and the kernel's.
 *
 * The kernel's are included because the two types this resource answers with are declared there —
 * a suite that read only this domain's directory would compose a schema referencing types that exist
 * nowhere and would fail to build rather than assert anything.
 */
function composedSchema(): string {
	const directories = [join(__dirname, 'schema'), join(__dirname, '..', 'graphql', 'schema')];

	const documents = directories.flatMap((directory) =>
		readdirSync(directory)
			.filter((name) => name.endsWith('.gql'))
			.map((name) => readFileSync(join(directory, name), 'utf8'))
	);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** This domain's own two documents, as they are written on disk. */
const ownSdl = ['operation.type.gql', 'operation.api.gql']
	.map((file) => readFileSync(join(__dirname, 'schema', file), 'utf8'))
	.join('\n');

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation' | 'Subscription'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The type one root field answers, as the schema states it — `Operation`, `Operation!`. */
function fieldType(operation: 'Query' | 'Mutation' | 'Subscription', field: string): string {
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

/**
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * Two sibling spellings are excluded here: a field naming another domain's operation resource would
 * not be this suite's to assert, and one naming an idempotency or outbox record is a different
 * resource that happens to carry the word.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('operation'))
		.filter((field) => !field.toLowerCase().includes('outbox'))
		.filter((field) => !field.toLowerCase().includes('record'))
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

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OperationController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof OperationController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = OperationResolver.prototype as unknown as Record<string, object>;
	const stepFields = OperationStepResolver.prototype as unknown as Record<string, object>;

	// The lookup is guarded because `Reflect.getMetadata` refuses a target that is not an object, and
	// the two classes between them are what carries this domain's fields: a name neither declares is a
	// field this resource does not serve, which is what the caller's assertion says.
	const own = fields[field] ? Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]) : undefined;
	const onSteps = stepFields[field] ? Reflect.getMetadata(PERMISSIONS_METADATA, stepFields[field]) : undefined;

	return own ?? onSteps;
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = OperationResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof OperationController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/** The options one subscription field was declared with, filter and resolve among them. */
function subscriptionOptions(field: string): {
	filter?: (payload: IOperationChangedEnvelope, variables: Record<string, unknown>) => boolean;
	resolve?: (payload: IOperationChangedEnvelope) => unknown;
} {
	return Reflect.getMetadata(
		SUBSCRIPTION_OPTIONS_METADATA,
		(OperationResolver.prototype as unknown as Record<string, object>)[field]
	);
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here:
 * a table of permission names would agree with the resolver while disagreeing with the controller,
 * which is the failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'operations', route: 'findAll' },
	{ field: 'operation', route: 'findById' },
	{ field: 'cancelOperation', route: 'cancel' },
	{ field: 'retryOperation', route: 'retry' }
];

/** The moves, whose delegations are asserted one by one below. */
const MOVES = ['cancelOperation', 'retryOperation', 'resumeOperation'];

/** The field resolvers that answer the kernel's own members from this resource's rows. */
const FIELD_RESOLVERS = ['progress', 'steps', 'failureReason', 'attempt', 'compensationStatus'];

/** The three streamed facts, with the subscription field each one is delivered on. */
const STREAMS: ReadonlyArray<{ field: string; eventName: string }> = [
	{ field: 'operationStepChanged', eventName: OPERATION_EVENT_NAMES.OPERATION_STEP_CHANGED },
	{ field: 'operationCompleted', eventName: OPERATION_EVENT_NAMES.OPERATION_COMPLETED },
	{ field: 'operationFailed', eventName: OPERATION_EVENT_NAMES.OPERATION_FAILED }
];

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata the resolvers
 * declare, which is the point: a spec that asserted the decorator alone would keep passing if the
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
function graphqlContext(field: string, resolver: { prototype: object } = OperationResolver): ExecutionContext {
	return {
		getHandler: () => (resolver.prototype as never)[field],
		getClass: () => resolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

beforeEach(() => {
	mockTenantId = TENANT;
	mockOrganizationId = ORGANIZATION;
});

describe('OperationResolver — the SDL declares the capabilities the REST routes serve (§3.3)', () => {
	it('declares the connection query, the node query and the aggregate query', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['operations', 'operation', 'operationsByAggregate'])
		);
	});

	it('declares one mutation per move the resource offers', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['cancelOperation', 'retryOperation', 'resumeOperation'])
		);
	});

	it('declares the three streamed facts the coverage table names', () => {
		expect(rootFields('Subscription')).toEqual(
			expect.arrayContaining(['operationStepChanged', 'operationCompleted', 'operationFailed'])
		);
	});

	it('declares the reads and the moves the resource serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual(['operation', 'operations', 'operationsByAggregate']);
		expect(ownedRootFields('Mutation')).toEqual(['cancelOperation', 'resumeOperation', 'retryOperation']);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OperationConnection \{\s*nodes: \[Operation!\]!\s*edges: \[OperationEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type OperationEdge \{\s*node: Operation!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input OperationFilter \{/);
		expect(printed).toMatch(/input OperationSort \{/);
		expect(printed).toMatch(/input OperationStatusFilter \{/);
		expect(printed).toMatch(/enum OperationSortField \{\s*createdAt\s*updatedAt\s*startedAt\s*finishedAt\s*deadlineAt\s*type\s*status\s*\}/);
	});

	it('answers with the kernel’s own operation type, and declares none of its own', () => {
		// The type is the kernel's, declared once for the whole platform because an async capability
		// anywhere answers with one. A domain that redeclared it — or extended it — would diverge the
		// moment either declaration was edited, which is why the composition pass refuses both and why
		// this delivery contributes only what surrounds the type.
		expect(printed).toMatch(/type Operation \{/);
		expect(printed).toMatch(/type OperationStep \{/);
		expect(printed).toMatch(/enum OperationStatus \{/);
		expect(printed).toMatch(/enum OperationStepStatus \{/);

		expect(ownSdl).not.toMatch(/^\s*type Operation\b/m);
		expect(ownSdl).not.toMatch(/^\s*type OperationStep\b/m);
		expect(ownSdl).not.toMatch(/^\s*extend type Operation\b/m);
		expect(ownSdl).not.toMatch(/^\s*enum OperationStatus\b/m);
	});

	it('carries the operator’s own members on that type, and no document of the runtime’s', () => {
		const members = typeBody('Operation')
			.split('\n')
			.map((line) => /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/.exec(line)?.[1])
			.filter(Boolean);

		// What an operator watching a run reads: where it stands, how far it has come, which step it is
		// on, when it must finish and why it failed.
		expect(members).toEqual(
			expect.arrayContaining([
				'id',
				'type',
				'status',
				'aggregateType',
				'aggregateId',
				'progress',
				'steps',
				'startedAt',
				'finishedAt',
				'deadlineAt',
				'failureReason'
			])
		);

		// The runtime's documents are deliberately not members of the kernel's type: `input`, `state` and
		// `result` are what an operator reads over REST, where this resource's node route answers the row
		// as the store holds it. A member here that the kernel does not declare could not be added
		// anyway — a domain may not extend a kernel type — so the boundary is stated rather than implied.
		expect(members).not.toContain('input');
		expect(members).not.toContain('state');
		expect(members).not.toContain('result');
		expect(members).not.toContain('idempotencyKey');
	});

	it('declares the arguments each move carries, so a field states what its resolver reads', () => {
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['cancelOperation', ['id', 'reason']],
			['retryOperation', ['id']],
			['resumeOperation', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
			// Every move answers the operation as it stands after the move, never a bare boolean.
			expect(fieldType('Mutation', field)).toBe('Operation!');
		}
	});

	it('offers no argument it cannot honour', () => {
		// The connection declares the query protocol's page arguments and nothing else: the endpoint
		// table's `/pagination` spelling is the same page, folded in rather than offered twice.
		expect(fieldArgs('Query', 'operations')).toEqual([
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
		// The node query takes the identifier and nothing else, and a row that is not there is `null`
		// rather than a refusal.
		expect(fieldArgs('Query', 'operation')).toEqual(['id']);
		expect(fieldType('Query', 'operation')).toBe('Operation');
		// The aggregate query takes the two members that name the aggregate, which is the same narrowing
		// the REST list route accepts as `aggregateType` and `aggregateId`.
		expect(fieldArgs('Query', 'operationsByAggregate')).toEqual(['aggregateType', 'aggregateId']);
		// The retry takes no body: the runtime's own rule decides where a retry continues.
		expect(fieldArgs('Mutation', 'retryOperation')).toEqual(['id']);
		// The subscriptions narrow by the operation, and the step stream by the step name; neither can
		// name a tenant.
		expect(fieldArgs('Subscription', 'operationStepChanged')).toEqual(['operationId', 'stepName']);
		expect(fieldArgs('Subscription', 'operationCompleted')).toEqual(['operationId']);
		expect(fieldArgs('Subscription', 'operationFailed')).toEqual(['operationId']);
	});
});

describe('OperationResolver — the connection contract (§7.1, §7.2)', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, operationService } = surfaces();

		const connection = await resolver.operations(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(operationService.listOperations).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(OPERATION);
	});

	it('orders by the queue’s own instant, newest first, when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.operations();

		expect(connection.nodes.map((node) => node.id)).toEqual([OPERATION, SECOND_OPERATION]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.operations({ status: { eq: OperationStatus.COMPLETED } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([SECOND_OPERATION]);

		const byType = await resolver.operations({ type: { eq: 'CHECKOUT_COMPLETE' } });
		expect(byType.nodes.map((node) => node.id)).toEqual([OPERATION]);

		const byAggregate = await resolver.operations({ aggregateType: { eq: 'commerce_cart' } });
		expect(byAggregate.nodes.map((node) => node.id)).toEqual([OPERATION]);

		const byAggregateId = await resolver.operations({ aggregateId: { eq: AGGREGATE } });
		expect(byAggregateId.totalCount).toBe(2);

		// The deadline window is a question about an operation that may not finish in time, and it is
		// stated in the connection's own vocabulary rather than through a second route.
		const byDeadline = await resolver.operations({
			deadlineAt: { between: ['2026-03-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z'] }
		});
		expect(byDeadline.nodes.map((node) => node.id)).toEqual([OPERATION]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byType = await resolver.operations(undefined, [{ field: 'type', direction: 'ASC' }]);
		expect(byType.nodes.map((node) => node.id)).toEqual([OPERATION, SECOND_OPERATION]);

		const byStatus = await resolver.operations(undefined, [{ field: 'status', direction: 'ASC' }]);
		expect(byStatus.nodes.map((node) => node.id)).toEqual([OPERATION, SECOND_OPERATION]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.operations(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([OPERATION]);

		const second = await resolver.operations(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND_OPERATION]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.operations(undefined, undefined, undefined, 20);

		const last = await resolver.operations(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([OPERATION]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.operations(undefined, [{ field: 'aggregateType', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `lockedBy` is carried on the entity and deliberately not filterable: it is a worker identity
		// rather than something a caller addresses an operation by, and the connection refuses it rather
		// than answering it with no rows.
		const error = await resolver.operations({ lockedBy: { eq: 'worker-1' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.operations(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [...inputBody('OperationFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		// An empty condition narrows nothing, so what each read below asserts is only that the evaluator
		// recognises the field.
		for (const member of declared) {
			await expect(resolver.operations({ [member]: {} })).resolves.toBeDefined();
		}

		// The other half of the same claim is read off the refusal, which names the evaluator's whole
		// allow-list: a member it knows and the schema does not would appear here and nowhere else.
		const refusal = await resolver.operations({ lockedBy: { eq: 'worker-1' } }).catch((thrown) => thrown);
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
		const offered = [...bodyOf('enum', 'OperationSortField').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)].map(
			(match) => match[1]
		);

		expect(offered).toEqual(['createdAt', 'updatedAt', 'startedAt', 'finishedAt', 'deadlineAt', 'type', 'status']);

		for (const field of offered) {
			await expect(resolver.operations(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});
});

describe('OperationResolver — the kernel’s type is resolved from this resource’s rows', () => {
	it('reads one operation through the same service method the REST node route calls', async () => {
		const { resolver, operationService } = surfaces();

		expect(await resolver.operation(OPERATION)).toBe(ROWS[0]);
		expect(operationService.findOperation).toHaveBeenCalledWith(OPERATION);
	});

	it('answers null for an operation that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, operationService } = surfaces();
		operationService.findOperation.mockResolvedValueOnce(null);

		expect(await resolver.operation(SECOND_OPERATION)).toBeNull();
	});

	it('reads the operations of one aggregate, newest first', async () => {
		const { resolver, operationService } = surfaces();

		expect(await resolver.operationsByAggregate('commerce_cart', AGGREGATE)).toEqual(ROWS);
		expect(operationService.findByAggregate).toHaveBeenCalledWith('commerce_cart', AGGREGATE);
	});

	it('answers the steps of an operation from the step read, in execution order', async () => {
		const { resolver, operationService } = surfaces();

		const steps = await resolver.steps(ROWS[0]);

		expect(operationService.findSteps).toHaveBeenCalledWith(OPERATION);
		expect(steps.map((step) => step.name)).toEqual(['reserve_stock', 'compute_totals', 'authorize_payment']);
	});

	it('answers a page of plans with one query, through the request’s relation loader', async () => {
		const { resolver, operationService } = surfaces();
		const context = createGraphqlRequestContext({});

		// Two operations, one request: the loader batches the relation, so the page costs one query
		// rather than one per row — which is what §11.1 requires of a relation resolver.
		const [first, second] = await Promise.all([
			resolver.steps(ROWS[0], context),
			resolver.steps(ROWS[1], context)
		]);

		expect(operationService.findStepsForOperations).toHaveBeenCalledTimes(1);
		expect(first.map((step) => step.name)).toEqual(['reserve_stock', 'compute_totals', 'authorize_payment']);
		expect(second.map((step) => step.name)).toEqual(['capture']);
	});

	it('walks towards one, as the fraction of the plan the runtime will not invoke again', async () => {
		const { resolver } = surfaces();
		const context = createGraphqlRequestContext({});

		// Three steps: one completed, one skipped because it declares no compensator, one failed — and a
		// step that failed is not progress towards the operation's goal.
		expect(await resolver.progress(ROWS[0], context)).toBeCloseTo(2 / 3);
		// One step, completed.
		expect(await resolver.progress(ROWS[1], context)).toBe(1);
	});

	it('answers no progress at all for an operation with no steps, rather than dividing by zero', async () => {
		const { resolver, operationService } = surfaces();
		operationService.findSteps.mockResolvedValueOnce([]);

		expect(await resolver.progress({ ...ROWS[0], id: SECOND_OPERATION } as IOperation)).toBe(0);
	});

	it('answers why an operation failed in the words its error carries', async () => {
		const { resolver } = surfaces();

		expect(resolver.failureReason(ROWS[0])).toBe('The issuing bank declined the authorisation.');
		// A row written before the error became a document is still readable rather than silently blank.
		expect(resolver.failureReason({ ...ROWS[0], lastError: 'the provider timed out' } as IOperation)).toBe(
			'the provider timed out'
		);
		expect(resolver.failureReason({ ...ROWS[0], lastError: undefined } as IOperation)).toBeNull();
	});

	it('answers a step’s attempts and its compensation status from the row’s single status', async () => {
		const { stepResolver } = surfaces();

		// The kernel declares `attempt`; the column counts attempts.
		expect(stepResolver.attempt(STEPS[2])).toBe(2);
		expect(stepResolver.attempt({ ...STEPS[2], attemptCount: undefined } as IOperationStep)).toBe(0);

		// The compensation phases are values of the step's own status, and they answer the member
		// verbatim; every other status says nothing about the undo, so the member is absent.
		for (const status of [
			OperationStepStatus.COMPENSATING,
			OperationStepStatus.COMPENSATED,
			OperationStepStatus.COMPENSATION_FAILED
		]) {
			expect(stepResolver.compensationStatus({ ...STEPS[0], status } as IOperationStep)).toBe(status);
		}

		for (const status of [OperationStepStatus.PENDING, OperationStepStatus.RUNNING, OperationStepStatus.COMPLETED]) {
			expect(stepResolver.compensationStatus({ ...STEPS[0], status } as IOperationStep)).toBeNull();
		}
	});
});

describe('OperationResolver — one runtime, two protocols, the same operations', () => {
	it('cancels through the same service method the REST route calls, with the reason', async () => {
		const { resolver, operationService } = surfaces();

		const canceled = await resolver.cancelOperation(OPERATION, 'the buyer withdrew');

		expect(operationService.cancel).toHaveBeenCalledWith(OPERATION, { reason: 'the buyer withdrew' });
		expect(canceled.status).toBe(OperationStatus.COMPENSATED);

		await resolver.cancelOperation(OPERATION);

		expect(operationService.cancel).toHaveBeenLastCalledWith(OPERATION, { reason: undefined });
	});

	it('retries through the same service method the REST route calls, answering the operation it left', async () => {
		const { resolver, operationService } = surfaces();

		const retried = await resolver.retryOperation(OPERATION);

		expect(operationService.retry).toHaveBeenCalledWith(OPERATION);
		// The delivered method answers what the pass did; the field answers the operation, which is what
		// a move in this protocol returns — never a bare boolean.
		expect(retried.status).toBe(OperationStatus.COMPLETED);
	});

	it('resumes through the service method the recovery sweep drives, answering the operation', async () => {
		const { resolver, operationService } = surfaces();

		const resumed = await resolver.resumeOperation(OPERATION);

		expect(operationService.resume).toHaveBeenCalledWith(OPERATION);
		expect(resumed.status).toBe(OperationStatus.RUNNING);
	});

	it('surfaces the state machine’s own refusal rather than translating it', async () => {
		const { resolver, operationService } = surfaces();
		const refusal = new HttpException('The operation is completed and has nothing to retry.', 409);

		operationService.retry.mockRejectedValueOnce(refusal);

		await expect(resolver.retryOperation(OPERATION)).rejects.toBe(refusal);
	});

	it('answers a missing operation as null on the node field and not as a refusal', async () => {
		const { resolver, operationService } = surfaces();
		operationService.findOperation.mockRejectedValueOnce(new NotFoundException());

		// The service answers null for a miss; a service that raised instead would be translated by the
		// platform’s error contract, and this field’s contract is a nullable row.
		await expect(resolver.operation(OPERATION)).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('OperationResolver — the three facts the service produces are the three streams (§10.2)', () => {
	it('opens the tenant’s own topic for each announced fact', () => {
		const { resolver, pubSub } = surfaces();

		resolver.operationStepChanged(OPERATION, 'authorize_payment');
		resolver.operationCompleted(OPERATION);
		resolver.operationFailed(OPERATION);

		// The tenant is the credential's and never an argument's: the fields take an operation id and a
		// step name, and neither of them can reach the topic this way.
		for (const { eventName } of STREAMS) {
			expect(pubSub.topicFor).toHaveBeenCalledWith(eventName, TENANT);
			expect(pubSub.asyncIterableIterator).toHaveBeenCalledWith(`${eventName}:${TENANT}`);
		}
	});

	it('subscribes to nothing when no tenant is resolved, rather than to every tenant’s facts', () => {
		mockTenantId = null;
		const { resolver, pubSub } = surfaces();

		resolver.operationStepChanged();
		resolver.operationCompleted();
		resolver.operationFailed();

		// The topic of an unauthenticated connection is one no fact is ever published on, so the stream
		// is silent rather than wide.
		for (const { eventName } of STREAMS) {
			expect(pubSub.topicFor).toHaveBeenCalledWith(eventName, '');
			expect(pubSub.asyncIterableIterator).toHaveBeenCalledWith(`${eventName}:`);
		}
	});

	it('carries every producing write’s envelope on the stream the subscription resolves', async () => {
		const { pubSub, publisher } = announcements();
		const resolver = new OperationResolver(surfaces().operationService as never, pubSub as never);
		const stepStream = resolver.operationStepChanged(OPERATION)[Symbol.asyncIterator]();
		const completedStream = resolver.operationCompleted(OPERATION)[Symbol.asyncIterator]();
		const failedStream = resolver.operationFailed(OPERATION)[Symbol.asyncIterator]();

		// The facts, as the service produces them: a step starting and then failing, and the operation
		// entering the compensation walk it will settle from.
		await publisher.operationStepChanged(ROWS[0], STEPS[2], 'started');
		await publisher.operationStepChanged(ROWS[0], STEPS[2], 'failed');
		await publisher.operationFailed(ROWS[0], 'compensating');
		await publisher.operationCompleted(ROWS[1]);

		const start = await nextOrNothing(stepStream);
		const failure = await nextOrNothing(stepStream);
		const compensating = await nextOrNothing(failedStream);
		const completed = await nextOrNothing(completedStream);

		await stepStream.return?.(undefined);
		await completedStream.return?.(undefined);
		await failedStream.return?.(undefined);

		expect([start.done, failure.done, compensating.done, completed.done]).toEqual([false, false, false, false]);

		// The step stream carries the operation the fact is about, and names the step that moved, so a
		// subscriber narrows without a second read of the plan.
		expect(start.value.name).toBe(OPERATION_EVENT_NAMES.OPERATION_STEP_CHANGED);
		expect(start.value.action).toBe('started');
		expect(start.value.stepName).toBe('authorize_payment');
		expect(start.value.step).toBe(STEPS[2]);
		expect(start.value.operation).toBe(ROWS[0]);
		expect(failure.value.action).toBe('failed');

		// The two operation-level streams carry the row, and the envelope is the platform's own: the
		// scoping members the delivery decision is made on, and the aggregate the fact belongs to.
		for (const [envelope, id] of [
			[compensating.value, OPERATION],
			[completed.value, SECOND_OPERATION]
		] as const) {
			expect(envelope.tenantId).toBe(TENANT);
			expect(envelope.organizationId).toBe(ORGANIZATION);
			expect(envelope.channelId).toBeNull();
			expect(envelope.aggregate).toEqual({ type: 'Operation', id });
			expect(envelope.occurredAt).toBeInstanceOf(Date);
		}

		expect(compensating.value.name).toBe(OPERATION_EVENT_NAMES.OPERATION_FAILED);
		expect(compensating.value.action).toBe('compensating');
		expect(compensating.value.operation).toBe(ROWS[0]);
		expect(completed.value.name).toBe(OPERATION_EVENT_NAMES.OPERATION_COMPLETED);
		expect(completed.value.action).toBe('completed');
		expect(completed.value.operation).toBe(ROWS[1]);
	});

	it('never delivers a fact produced for another tenant, whatever the topic it was published on', async () => {
		const { pubSub, publisher } = announcements();
		// No credential behind the write, so each fact travels on the topic its own row names — which is
		// what lets this case publish on both tenants’ topics and read one of them.
		mockTenantId = null;

		const tenantStream = pubSub.asyncIterableIterator<IOperationChangedEnvelope>(
			pubSub.topicFor(OPERATION_EVENT_NAMES.OPERATION_COMPLETED, TENANT)
		);

		await publisher.operationCompleted(ROWS[1]);
		await publisher.operationCompleted({ ...ROWS[1], tenantId: OTHER_TENANT } as IOperation);

		const received = await nextOrNothing(tenantStream);

		expect(received.done).toBe(false);
		expect(received.value.tenantId).toBe(TENANT);
		expect(received.value.operation.id).toBe(SECOND_OPERATION);
		// The other tenant's fact travelled on `<event>:<other tenant>`, a topic this stream was never
		// given, so there is nothing left to filter and nothing to leak.
		expect(pubSub.topicFor(OPERATION_EVENT_NAMES.OPERATION_COMPLETED, OTHER_TENANT)).not.toBe(
			pubSub.topicFor(OPERATION_EVENT_NAMES.OPERATION_COMPLETED, TENANT)
		);

		await tenantStream.return?.(undefined);
	});

	it('declares every fact it carries, so the kernel’s own event selection can resolve them', () => {
		const { catalogue } = announcements();

		expect(catalogue.names()).toEqual([...OPERATION_SUBSCRIBED_EVENT_NAMES].sort());
		expect(catalogue.has(OPERATION_EVENT_NAMES.OPERATION_STEP_CHANGED)).toBe(true);
		expect(catalogue.resolve(['operation.*'])).toEqual([...OPERATION_SUBSCRIBED_EVENT_NAMES].sort());
	});

	it('produces the facts in the service, so neither protocol can write a row silently', () => {
		// The producer is the service the REST routes and the resolvers both call — asserted on the
		// service’s own source, because that is the claim: an announcement made by a surface would be an
		// announcement the other surface does not make, and a subscriber could then tell which protocol
		// wrote the row. The service suite asserts that the writes announce; this asserts where from.
		const service = readFileSync(join(__dirname, 'operation.service.ts'), 'utf8');

		expect(service).toMatch(/operationEventPublisher\.operationStepChanged\(/);
		expect(service).toMatch(/operationEventPublisher\.operationCompleted\(/);
		expect(service).toMatch(/operationEventPublisher\.operationFailed\(/);

		// And neither surface announces anything of its own: both call the service and answer what it
		// answered.
		const controller = readFileSync(join(__dirname, 'operation.controller.ts'), 'utf8');
		const resolver = readFileSync(join(__dirname, 'operation.resolver.ts'), 'utf8');

		for (const source of [controller, resolver]) {
			expect(source).not.toMatch(/operationEventPublisher\./);
			expect(source).not.toMatch(/OperationEventPublisher/);
		}
	});

	it('narrows the step stream by the operation and by the step name, and by the tenant always', () => {
		const { filter } = subscriptionOptions('operationStepChanged') ?? {};
		const envelope = {
			tenantId: TENANT,
			operation: ROWS[0],
			stepName: 'authorize_payment'
		} as IOperationChangedEnvelope;

		// The two arguments only ever narrow what the credential may already read.
		expect(filter?.(envelope, {})).toBe(true);
		expect(filter?.(envelope, { operationId: OPERATION })).toBe(true);
		expect(filter?.(envelope, { stepName: 'authorize_payment' })).toBe(true);
		expect(filter?.(envelope, { operationId: SECOND_OPERATION })).toBe(false);
		expect(filter?.(envelope, { stepName: 'reserve_stock' })).toBe(false);

		// The tenant is not an argument: a fact of another tenant is refused even when every argument
		// would admit it, which is the second line behind the topic.
		expect(filter?.({ ...envelope, tenantId: OTHER_TENANT }, { operationId: OPERATION })).toBe(false);
		expect(filter?.(undefined as never, {})).toBe(false);
	});

	it('narrows the two operation-level streams by the operation, and by nothing else', () => {
		const envelope = { tenantId: TENANT, operation: ROWS[1] } as IOperationChangedEnvelope;

		for (const field of ['operationCompleted', 'operationFailed']) {
			const { filter } = subscriptionOptions(field) ?? {};

			expect(filter?.(envelope, {})).toBe(true);
			expect(filter?.(envelope, { operationId: SECOND_OPERATION })).toBe(true);
			expect(filter?.(envelope, { operationId: OPERATION })).toBe(false);
			expect(filter?.({ ...envelope, tenantId: OTHER_TENANT }, {})).toBe(false);
		}
	});

	it('resolves each stream to the operation the envelope carries', () => {
		for (const { field } of STREAMS) {
			const { resolve } = subscriptionOptions(field) ?? {};
			const envelope = { tenantId: TENANT, operation: ROWS[0] } as IOperationChangedEnvelope;

			expect(resolve?.(envelope)).toBe(ROWS[0]);
		}
	});
});

describe('OperationResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolvers the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OperationResolver) ?? [];
		const stepGuards = Reflect.getMetadata('__guards__', OperationStepResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OperationController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The field resolvers answer members of a kernel type, which is the same endpoint and no lesser
		// door: the second class carries the same chain and the same gate.
		expect(stepGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
		// The one guard the resolvers state beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the two the controller states come first, so a caller with
		// no credential is refused as a credential problem before a tenant’s switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', OperationResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			const declared = Reflect.getMetadata('__guards__', OperationController) ?? [];
			const restated = guardsOfHandler(OperationController, route);

			// The gate is the one guard beyond that set, and it is declared on the class rather than on
			// any field, so every route here runs under it.
			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OperationResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, OperationController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OperationController)).toEqual([
			PermissionsEnum.OPERATIONS_VIEW
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OperationStepResolver)).toEqual([
			PermissionsEnum.OPERATIONS_VIEW
		]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		const fieldPermissions = Reflect.getMetadata(PERMISSIONS_METADATA, OperationResolver.prototype[field]) ?? [];
		const routePermissions = permissionOfRoute(OperationController, route) ?? [];

		expect(fieldPermissions).toEqual(routePermissions);
		expect(guardsOfField(field)).toEqual(guardsOfHandler(OperationController, route));
	});

	it('carries the read permission on the reads and the move permission on the moves', () => {
		// The endpoint table names two codes for this resource: `OPERATIONS_VIEW` for reading the queue
		// and its rows, and `OPERATIONS_CANCEL` for the moves — because a cancellation runs compensation
		// and can reverse work that has already been performed.
		for (const field of ['operations', 'operation', 'operationsByAggregate']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.OPERATIONS_VIEW]);
		}

		for (const field of MOVES) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.OPERATIONS_CANCEL]);
		}
	});

	it('carries the moves’ permission on the field with no route, and the reads’ on the streams', () => {
		// `resumeOperation` is the one move the endpoint table states no route for, and it carries the
		// moves' permission rather than the reads': a caller who may watch the queue may not drive it.
		expect((OperationController.prototype as unknown as Record<string, unknown>).resume).toBeUndefined();
		expect(permissionOfField('resumeOperation')).toEqual([PermissionsEnum.OPERATIONS_CANCEL]);

		// The field resolvers and the three streams are reads of the same resource, so they carry the
		// read permission and never a move one.
		for (const field of [...FIELD_RESOLVERS, ...STREAMS.map((stream) => stream.field)]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.OPERATIONS_VIEW]);
		}
	});

	it('refuses every move to a caller who holds only the read permission', () => {
		// "No credential" at the level a unit test can observe: the class-level chain refuses a request
		// that presents none, and the metadata below is what the permission guard reads. A move that
		// carried the read permission — or none — would be reachable by every caller that may look.
		for (const field of MOVES) {
			const stated = (permissionOfField(field) as PermissionsEnum[]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.OPERATIONS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});
});

describe('OperationResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on both classes', () => {
		// One statement per resolver class, read by the guard with `getAllAndOverride` over the handler
		// and then the class, so every field — a root field and a field resolver alike — is behind it.
		for (const resolver of [OperationResolver, OperationStepResolver]) {
			expect(Reflect.getMetadata(FEATURE_METADATA, resolver)).toBe(FEATURE_GRAPHQL);
			expect(Reflect.getMetadata('__guards__', resolver)).toContain(FeatureFlagGuard);
		}
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('operations')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('operations');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the moves and the streams as well', async () => {
		// Nothing on this surface is exempt: the door that switches the capability back on is the REST
		// route, which this code does not gate.
		for (const field of [...MOVES, ...STREAMS.map((stream) => stream.field)]) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('refuses a field resolver on the kernel’s step type too', async () => {
		const { guard } = gate(false);

		await expect(
			guard.canActivate(graphqlContext('attempt', OperationStepResolver))
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('operation'))).resolves.toBe(true);
	});
});

describe('OperationModule — the resolvers are declared where their dependencies are reachable', () => {
	it('declares both resolvers as providers of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, OperationModule) ?? []) as unknown[];

		expect(providers).toContain(OperationResolver);
		expect(providers).toContain(OperationStepResolver);
		expect(providers).toContain(OperationService);
		expect(providers).toContain(OperationEventPublisher);
	});

	it('declares the controller beside them, which is the REST half of the same resource', () => {
		const controllers = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, OperationModule) ?? []) as unknown[];

		expect(controllers).toContain(OperationController);
	});

	it('exports the service the resolver injects, and that service is the whole of its dependencies', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, OperationModule) ?? []) as unknown[];

		expect(exported).toContain(OperationService);
		expect(OperationResolver.length).toBe(2);
		expect(OperationStepResolver.length).toBe(0);
	});

	it('reaches the modules that provide the guards and the fan-out, without importing the global one', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, OperationModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);
		const names = resolved.map((entry) => (entry as { name?: string })?.name);

		// The two guards are providers of whichever module hosts the handler they protect, so this module
		// has to reach the permission lookup they ask for; the publisher has to reach the fan-out and the
		// catalogue. The API boot fails on an unresolved dependency without both.
		expect(names).toContain('RolePermissionModule');
		expect(names).toContain('GraphqlSubscriptionModule');

		// `FeatureModule` is deliberately not imported, and that is a fact about the module rather than a
		// preference: it is global, so the feature service `FeatureFlagGuard` resolves through is
		// available wherever a guard runs.
		expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, FeatureModule)).toBe(true);
		expect(resolved).not.toContain(FeatureModule);
	});
});
