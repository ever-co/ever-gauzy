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
import { buildSchema, GraphQLEnumType, GraphQLInputObjectType, GraphQLObjectType, parse, printSchema } from 'graphql';
import { PermissionsEnum, WebhookDeliveryStatus } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { EncryptionService } from '../common/encryption/encryption.service';
import { RequestContext } from '../core/context';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import { WebhookDeliveryController } from './webhook-delivery.controller';
import { WebhookSubscriptionController } from './webhook-subscription.controller';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookEventPublisher, WEBHOOK_EVENT_NAMES } from './webhook-event.publisher';
import { WebhookModule } from './webhook.module';
import { WebhookResolver } from './webhook.resolver';
import { WebhookSubscriptionService } from './webhook-subscription.service';

/**
 * The webhook kernel over GraphQL.
 *
 * The delivered REST routes serve a subscription list, one subscription, a create that generates a
 * signing secret, an edit, a removal, the three lifecycle operations and a redelivery; and a delivery
 * log with one row and one operation. This suite pins the half of the two-protocol doctrine that is
 * easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, the two lists are
 *   connections with the platform's own cursor codec behind them, and the two facts this domain
 *   streams are subscription fields;
 * - every field reaches the same service method the REST route reaches, with the same payload and the
 *   same request facts, so a client does not choose a better surface by choosing a protocol;
 * - **the guard stack and the permission are the controllers', field by field** — read from the
 *   controllers' own metadata rather than restated here, which is what makes the assertion about the
 *   decision instead of about a second copy of the list;
 * - **the secret is a member of no type, of no filter, of no sort and of no input**: it is answered
 *   only by the two operations that generate one, as a mutation answer rather than a field, and the
 *   projection both services produce replaces it with a fingerprint. The delivery log's stored body is
 *   withheld by the same projection;
 * - **the two streamed facts are produced by the services both protocols call**, on the tenant-scoped
 *   topic, and the stream the resolver opens is the one the producer publishes on.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CHANNEL = '00000000-0000-4000-8000-000000000010';
const SUBSCRIPTION = '00000000-0000-4000-8000-000000000020';
const OTHER_SUBSCRIPTION = '00000000-0000-4000-8000-000000000021';
const DELIVERY = '00000000-0000-4000-8000-000000000030';
const EVENT = '00000000-0000-4000-8000-000000000040';

/** A signing secret as the fixture holds it: never a member of anything the surface answers. */
const SECRET = 'whsec_test_fixture_2f8c1d9a4b6e8f0a1c3d5e7f9a2b4c6d';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The subscription projections a scripted service answers with, as the delivered read produces them:
 * no `secret`, a fingerprint in its place, and the counters the delivery path keeps.
 */
const SUBSCRIPTIONS = [
	{
		id: SUBSCRIPTION,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Order notifications',
		url: 'https://receiver.example.test/hooks/orders',
		events: ['order.placed'],
		channelId: CHANNEL,
		apiVersion: '1',
		failureCount: 3,
		isActive: true,
		secretFingerprint: '6f1c2a9d',
		lastFailureAt: new Date('2026-03-02T10:00:00.000Z'),
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-02T10:00:00.000Z')
	},
	{
		id: OTHER_SUBSCRIPTION,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Inventory mirror',
		url: 'https://mirror.example.test/hooks/stock',
		events: ['stock.*'],
		channelId: null,
		apiVersion: '1',
		failureCount: 0,
		isActive: false,
		secretFingerprint: '1a3b5c7d',
		disabledAt: new Date('2026-02-01T10:00:00.000Z'),
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/**
 * The delivery projections a scripted service answers with. Each carries `lastAttempt` — the attempt
 * the row records, derived from the row's own counter and outcome — and none carries the stored body.
 */
const DELIVERIES = [
	{
		id: DELIVERY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		subscriptionId: SUBSCRIPTION,
		eventId: EVENT,
		eventName: 'order.placed',
		status: WebhookDeliveryStatus.FAILED,
		attemptCount: 3,
		responseStatus: 500,
		responseBody: 'upstream unavailable',
		durationMs: 412,
		nextAttemptAt: new Date('2026-03-03T10:00:00.000Z'),
		lastError: 'The endpoint answered 500.',
		lastAttempt: {
			id: `${DELIVERY}.3`,
			deliveryId: DELIVERY,
			attempt: 3,
			delivered: false,
			responseStatus: 500,
			responseBody: 'upstream unavailable',
			durationMs: 412,
			lastError: 'The endpoint answered 500.'
		},
		createdAt: new Date('2026-03-02T10:00:00.000Z'),
		updatedAt: new Date('2026-03-03T10:00:00.000Z')
	},
	{
		id: '00000000-0000-4000-8000-000000000031',
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		subscriptionId: SUBSCRIPTION,
		eventId: '00000000-0000-4000-8000-000000000041',
		eventName: 'order.shipped',
		status: WebhookDeliveryStatus.DELIVERED,
		attemptCount: 1,
		responseStatus: 202,
		durationMs: 88,
		deliveredAt: new Date('2026-03-01T10:00:00.000Z'),
		lastAttempt: {
			id: `${DELIVERY.replace(/0$/, '1')}.1`,
			deliveryId: '00000000-0000-4000-8000-000000000031',
			attempt: 1,
			delivered: true,
			responseStatus: 202,
			durationMs: 88
		},
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	}
];

/** The credential the two secret-generating operations answer with. */
const CREDENTIAL = {
	subscription: { ...SUBSCRIPTIONS[0], secretFingerprint: WebhookSubscriptionService.fingerprint(SECRET) },
	secret: SECRET
};

/**
 * The two scripted services and the fan-out, which is the real one.
 *
 * The publisher is the domain's own and the fan-out is the in-process broker, so the streaming cases
 * below drive the whole path a fact travels: a service announces it, the publisher puts it on a
 * tenant-scoped topic, and the stream the resolver opened is where it arrives.
 */
function surfaces() {
	const webhookSubscriptionService = {
		listSubscriptions: jest.fn().mockResolvedValue(SUBSCRIPTIONS),
		getRedactedSubscription: jest.fn().mockResolvedValue(SUBSCRIPTIONS[0]),
		createSubscription: jest.fn().mockResolvedValue(CREDENTIAL),
		updateSubscription: jest.fn().mockResolvedValue(SUBSCRIPTIONS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		redact: jest.fn((row: unknown) => row),
		rotateSecret: jest.fn().mockResolvedValue({
			...CREDENTIAL,
			previousSecretValidUntil: '2026-03-04T10:00:00.000Z'
		}),
		enable: jest.fn().mockResolvedValue({ ...SUBSCRIPTIONS[1], isActive: true, disabledAt: null }),
		disable: jest.fn().mockResolvedValue({ ...SUBSCRIPTIONS[0], isActive: false })
	};
	const webhookDeliveryService = {
		listDeliveries: jest.fn().mockResolvedValue(DELIVERIES),
		getRedactedDelivery: jest.fn().mockResolvedValue(DELIVERIES[0]),
		requeue: jest.fn().mockResolvedValue({
			...DELIVERIES[0],
			status: WebhookDeliveryStatus.PENDING,
			attemptCount: 0,
			nextAttemptAt: new Date('2026-03-05T10:00:00.000Z')
		}),
		redact: jest.fn((row: Record<string, unknown>) => ({ ...row, lastAttempt: null }))
	};
	const pubSub = new GraphqlPubSub();

	return {
		webhookSubscriptionService,
		webhookDeliveryService,
		pubSub,
		resolver: new WebhookResolver(
			webhookSubscriptionService as never,
			webhookDeliveryService as never,
			pubSub
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
 * The composed schema, as text: this domain's two documents plus every kernel and domain document the
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
const ownSdl = ['webhook.type.gql', 'webhook.api.gql']
	.map((file) => readFileSync(join(__dirname, 'schema', file), 'utf8'))
	.join('\n');

/** This domain's own two documents, parsed: the declarations are read from the AST, not from prose. */
const ownDocument = parse(ownSdl);

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation' | 'Subscription'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The type one root field answers, as the schema states it — `Int`, `Int!`, `WebhookDelivery!`. */
function fieldType(operation: 'Query' | 'Mutation' | 'Subscription', field: string): string {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { type: unknown }> }
		| undefined;

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
 * The root fields this domain contributes, which are the ones that name its resource.
 *
 * Both spellings of the resource name are matched, because the two subscriptions spell it in full:
 * a field named `webhookDeliveryFailed` belongs to this domain as much as `webhookDeliveries` does.
 */
function ownedRootFields(operation: 'Query' | 'Mutation' | 'Subscription'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('webhook'))
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
 * The member names one schema type declares, read off the type rather than off its printed body.
 *
 * A description is part of the print, so a claim about which members a type declares is made against
 * the type itself: a member that must be absent is asserted absent because the type does not declare
 * it, never because the words of a description happen not to spell it.
 *
 * @param name The type name.
 * @returns The member names, or an empty list when the type declares none.
 */
function membersOf(name: string): string[] {
	const type = schema.getType(name);

	if (type instanceof GraphQLObjectType || type instanceof GraphQLInputObjectType) {
		return Object.keys(type.getFields());
	}

	if (type instanceof GraphQLEnumType) {
		return (type as GraphQLEnumType).getValues().map((value) => value.name);
	}

	return [];
}

/** The member names one object type declares, so a member it must not carry can be asserted absent. */
function memberNames(name: string): string[] {
	return membersOf(name);
}

/**
 * The declarations in this domain's own documents that carry a member of one name.
 *
 * Read from this domain's parsed document rather than from the whole composed schema, because the
 * claim is about what *this* domain declares: a plaintext secret belongs to the two operations that
 * generate one and to nothing else here, and another domain's own answer is that domain's business.
 *
 * @param member The member name.
 * @returns The declaration names, sorted.
 */
function ownDeclarationsCarrying(member: string): string[] {
	const carrying = new Set<string>();

	for (const definition of ownDocument.definitions) {
		const node = definition as unknown as {
			name?: { value: string };
			fields?: readonly { name: { value: string } }[];
			values?: readonly { name: { value: string } }[];
		};

		if (!node.name) {
			continue;
		}

		const declared = [
			...(node.fields ?? []).map((field) => field.name.value),
			...(node.values ?? []).map((value) => value.name.value)
		];

		if (declared.includes(member)) {
			carrying.add(node.name.value);
		}
	}

	return [...carrying].sort();
}

/** The handlers of one controller, as functions. */
function handlersOf(controller: typeof WebhookSubscriptionController | typeof WebhookDeliveryController) {
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
	controller: typeof WebhookSubscriptionController | typeof WebhookDeliveryController,
	handler: string
): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = WebhookResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = WebhookResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(
	controller: typeof WebhookSubscriptionController | typeof WebhookDeliveryController,
	handler: string
): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/** The class-level guard chain of one controller or of the resolver. */
function classGuards(target: unknown): unknown[] {
	return Reflect.getMetadata('__guards__', target) ?? [];
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here:
 * a table of permission names would agree with the resolver while disagreeing with the controller,
 * which is the failure this half of the doctrine exists to catch.
 *
 * The two subscription fields are absent from this table on purpose and are asserted separately: a
 * stream has no route of its own, and its authorisation is the subscribed resource's read permission
 * — read from the controller's own metadata there too.
 */
const PERMISSION_PARITY: ReadonlyArray<{
	field: string;
	controller: typeof WebhookSubscriptionController | typeof WebhookDeliveryController;
	route: string;
}> = [
	{ field: 'webhookSubscriptions', controller: WebhookSubscriptionController, route: 'findAll' },
	{ field: 'webhookSubscription', controller: WebhookSubscriptionController, route: 'findById' },
	{ field: 'createWebhookSubscription', controller: WebhookSubscriptionController, route: 'create' },
	{ field: 'updateWebhookSubscription', controller: WebhookSubscriptionController, route: 'update' },
	{ field: 'deleteWebhookSubscription', controller: WebhookSubscriptionController, route: 'delete' },
	{ field: 'rotateWebhookSecret', controller: WebhookSubscriptionController, route: 'rotateSecret' },
	{ field: 'enableWebhookSubscription', controller: WebhookSubscriptionController, route: 'enable' },
	{ field: 'disableWebhookSubscription', controller: WebhookSubscriptionController, route: 'disable' },
	{ field: 'webhookDeliveries', controller: WebhookDeliveryController, route: 'findAll' },
	{ field: 'webhookDelivery', controller: WebhookDeliveryController, route: 'findById' },
	{ field: 'redeliverWebhook', controller: WebhookDeliveryController, route: 'redeliver' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = [
	'createWebhookSubscription',
	'updateWebhookSubscription',
	'deleteWebhookSubscription',
	'rotateWebhookSecret',
	'enableWebhookSubscription',
	'disableWebhookSubscription',
	'redeliverWebhook'
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
		getHandler: () => (WebhookResolver.prototype as never)[field],
		getClass: () => WebhookResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('WebhookResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the four queries: the two connections and the two node reads', () => {
		expect(ownedRootFields('Query')).toEqual([
			'webhookDeliveries',
			'webhookDelivery',
			'webhookSubscription',
			'webhookSubscriptions'
		]);
	});

	it('declares one mutation per delivered write route', () => {
		expect(ownedRootFields('Mutation')).toEqual([
			'createWebhookSubscription',
			'deleteWebhookSubscription',
			'disableWebhookSubscription',
			'enableWebhookSubscription',
			'redeliverWebhook',
			'rotateWebhookSecret',
			'updateWebhookSubscription'
		]);
	});

	it('declares both streamed facts', () => {
		expect(ownedRootFields('Subscription')).toEqual(['webhookDeliveryFailed', 'webhookSubscriptionDisabled']);
	});

	it('declares the two connections, their edges, their filters and their sorts', () => {
		expect(printed).toMatch(
			/type WebhookSubscriptionConnection \{\s*nodes: \[WebhookSubscription!\]!\s*edges: \[WebhookSubscriptionEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type WebhookSubscriptionEdge \{\s*node: WebhookSubscription!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(
			/type WebhookDeliveryConnection \{\s*nodes: \[WebhookDelivery!\]!\s*edges: \[WebhookDeliveryEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type WebhookDeliveryEdge \{\s*node: WebhookDelivery!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input WebhookSubscriptionFilter \{/);
		expect(printed).toMatch(/input WebhookSubscriptionSort \{/);
		expect(printed).toMatch(/input WebhookDeliveryFilter \{/);
		expect(printed).toMatch(/input WebhookDeliverySort \{/);
		expect(printed).toMatch(/enum WebhookDeliveryStatus \{/);
		expect(printed).toMatch(/input WebhookDeliveryStatusFilter \{/);
	});

	it('declares the write inputs the mutations take, and the attempt and credential types beside them', () => {
		expect(printed).toMatch(/input CreateWebhookSubscriptionInput \{/);
		expect(printed).toMatch(/input UpdateWebhookSubscriptionInput \{/);
		expect(printed).toMatch(/type WebhookSubscriptionCredential \{/);
		expect(printed).toMatch(/type WebhookAttempt \{/);
		// The attempt is reached from the delivery it belongs to, which is what makes it a rendered
		// type rather than an orphan: a type nothing references is a promise with no reader.
		expect(typeBody('WebhookDelivery')).toMatch(/lastAttempt: WebhookAttempt\n/);
	});

	it('offers no argument it cannot honour', () => {
		// The connection declares the query protocol's page arguments and nothing else: both delivered
		// list reads answer live rows only, so neither offers `withDeleted`.
		const CONNECTION_ARGS = [
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset'
		];

		expect(fieldArgs('Query', 'webhookSubscriptions')).toEqual(CONNECTION_ARGS);
		expect(fieldArgs('Query', 'webhookDeliveries')).toEqual(CONNECTION_ARGS);
		// There is no count route on either resource and therefore no count field: a field REST does
		// not serve would be a capability this surface invented.
		expect(ownedRootFields('Query')).not.toEqual(expect.arrayContaining([expect.stringContaining('Count')]));
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		// A field that declared one argument while its resolver read two would resolve the argument it
		// does not declare as undefined — and for the redelivery and the switch operations that
		// identifier is the whole of the request. This table is the schema's half of that agreement;
		// the delegation tests below call each field with the arguments listed here.
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createWebhookSubscription', ['input']],
			['updateWebhookSubscription', ['input']],
			['deleteWebhookSubscription', ['id']],
			['rotateWebhookSecret', ['id']],
			['enableWebhookSubscription', ['id']],
			['disableWebhookSubscription', ['id', 'reason']],
			['redeliverWebhook', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}

		expect(fieldArgs('Query', 'webhookSubscription')).toEqual(['id']);
		expect(fieldArgs('Query', 'webhookDelivery')).toEqual(['id']);
		// Each stream is narrowed by the subscription it watches, and by nothing else: an argument that
		// could widen a stream is an argument this surface does not offer.
		expect(fieldArgs('Subscription', 'webhookDeliveryFailed')).toEqual(['subscriptionId']);
		expect(fieldArgs('Subscription', 'webhookSubscriptionDisabled')).toEqual(['subscriptionId']);
	});

	it('answers the requeued row from the redelivery and the boolean from the removal', () => {
		expect(fieldType('Mutation', 'redeliverWebhook')).toBe('WebhookDelivery!');
		expect(fieldType('Mutation', 'deleteWebhookSubscription')).toBe('Boolean!');
		expect(fieldType('Mutation', 'createWebhookSubscription')).toBe('WebhookSubscriptionCredential!');
		expect(fieldType('Mutation', 'rotateWebhookSecret')).toBe('WebhookSubscriptionCredential!');
	});
});

describe('WebhookResolver — the secret is a member of no type, and the stored body of none either', () => {
	it('carries a fingerprint on the subscription and never the material', () => {
		const members = memberNames('WebhookSubscription');

		expect(members).not.toContain('secret');
		expect(members).toContain('secretFingerprint');
		expect(typeBody('WebhookSubscription')).toMatch(/secretFingerprint: String!\n/);
		// The delivered projection's own members are the ones carried: nothing here is a name this
		// domain invented for a column.
		expect(members).toEqual(
			expect.arrayContaining([
				'id',
				'name',
				'url',
				'events',
				'channelId',
				'failureCount',
				'lastSuccessAt',
				'lastFailureAt',
				'disabledAt',
				'isActive',
				'metadata',
				'createdAt',
				'updatedAt'
			])
		);
	});

	it('offers no way to narrow, order or write the secret', () => {
		expect(inputBody('WebhookSubscriptionFilter')).not.toMatch(/\bsecret\b/);
		expect(bodyOf('enum', 'WebhookSubscriptionSortField')).not.toMatch(/\bsecret\b/);
		expect(inputBody('CreateWebhookSubscriptionInput')).not.toMatch(/\bsecret\b/);
		expect(inputBody('UpdateWebhookSubscriptionInput')).not.toMatch(/\bsecret\b/);
		// The fingerprint identifies a secret rather than describing a subscription, so it is not a
		// filter or a sort key either.
		expect(inputBody('WebhookSubscriptionFilter')).not.toMatch(/secretFingerprint/);
	});

	it('states the plaintext secret on the two operations that generate one, and nowhere else', () => {
		// `secret` belongs to the credential answer and to nothing else this domain declares: a type
		// member would be selectable by any read, which is the one thing a secret may not be.
		expect(ownDeclarationsCarrying('secret')).toEqual(['WebhookSubscriptionCredential']);
		expect(typeBody('WebhookSubscriptionCredential')).toMatch(/secret: String!\n/);
		expect(typeBody('WebhookSubscriptionCredential')).toMatch(/previousSecretValidUntil: DateTime/);
		// And the rotation answer carries the expiry, because an operator handing a partner a new
		// secret has to be able to say how long the old one still works.
		expect(fieldType('Mutation', 'rotateWebhookSecret')).toBe('WebhookSubscriptionCredential!');
	});

	it('withholds the delivery log’s stored body from the type, the filter and the sort', () => {
		const members = memberNames('WebhookDelivery');

		expect(members).not.toContain('payload');
		expect(inputBody('WebhookDeliveryFilter')).not.toMatch(/\bpayload\b/);
		expect(bodyOf('enum', 'WebhookDeliverySortField')).not.toMatch(/\bpayload\b/);
		expect(ownSdl).not.toMatch(/\bpayload\s*:/);
	});

	it('carries what triage reads on the delivery and the attempt instead', () => {
		expect(typeBody('WebhookDelivery')).toMatch(/status: WebhookDeliveryStatus!\n/);
		expect(typeBody('WebhookDelivery')).toMatch(/responseStatus: Int\n/);
		expect(typeBody('WebhookDelivery')).toMatch(/responseBody: String\n/);
		expect(typeBody('WebhookDelivery')).toMatch(/durationMs: Int\n/);
		expect(typeBody('WebhookDelivery')).toMatch(/lastError: String\n/);
		// The attempt is the identity a receiver deduplicated on, joined from the row's own counter.
		expect(typeBody('WebhookAttempt')).toMatch(/attempt: Int!\n/);
		expect(typeBody('WebhookAttempt')).toMatch(/delivered: Boolean!\n/);
	});

	it('replaces the secret with a digest, on the subscription projection', () => {
		// The projection is the service's, so the assertion is about the real one rather than about a
		// scripted stand-in: a row that carries the encrypted secret is handed in and what comes back
		// has no such member and a fingerprint in its place.
		const service = new WebhookSubscriptionService(
			{} as never,
			{} as never,
			new EncryptionService(),
			{} as never
		);

		const stored = {
			id: SUBSCRIPTION,
			name: 'Order notifications',
			secret: `deadbeef:${SECRET}`,
			events: ['order.placed']
		} as never;
		const projected = service.redact(stored);

		expect(projected).not.toHaveProperty('secret');
		expect((projected as { secretFingerprint: string }).secretFingerprint).toMatch(/^[0-9a-f]{8}$/);
		expect((projected as { secretFingerprint: string }).secretFingerprint).not.toBe(SECRET);
	});

	it('withholds the stored body, and derives the attempt, on the delivery projection', () => {
		const service = new WebhookDeliveryService({} as never, {} as never, {} as never, {} as never);

		const stored = {
			id: DELIVERY,
			subscriptionId: SUBSCRIPTION,
			eventId: EVENT,
			eventName: 'order.placed',
			payload: { id: EVENT, name: 'order.placed', data: { customerId: 'customer-1' } },
			status: WebhookDeliveryStatus.FAILED,
			attemptCount: 3,
			responseStatus: 500,
			durationMs: 412,
			lastError: 'The endpoint answered 500.'
		} as never;
		const projected = service.redact(stored) as unknown as Record<string, unknown>;

		expect(projected).not.toHaveProperty('payload');
		// The attempt the receiver saw in `X-Delivery` is the row's id and counter joined, which is what
		// `buildHeaders` writes into that header on every attempt.
		expect(projected.lastAttempt).toEqual(
			expect.objectContaining({ id: `${DELIVERY}.3`, deliveryId: DELIVERY, attempt: 3, delivered: false })
		);
		// A row that has not been attempted has no attempt to describe, and says so rather than
		// fabricating one.
		expect((service.redact({ ...(stored as object), attemptCount: 0 } as never) as never as {
			lastAttempt: unknown;
		}).lastAttempt).toBeNull();
	});
});

describe('WebhookResolver — the connection contract', () => {
	it('answers the subscription list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, webhookSubscriptionService } = surfaces();

		const connection = await resolver.webhookSubscriptions(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with no narrowing of its own.
		expect(webhookSubscriptionService.listSubscriptions).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SUBSCRIPTION);
	});

	it('answers the delivery log the same way, and carries the attempt each row records', async () => {
		const { resolver, webhookDeliveryService } = surfaces();

		const connection = await resolver.webhookDeliveries(undefined, undefined, undefined, 20);

		expect(webhookDeliveryService.listDeliveries).toHaveBeenCalledWith();
		expect(connection.nodes.map((node) => node.id)).toEqual([DELIVERY, DELIVERIES[1].id]);
		expect(connection.nodes[0].lastAttempt).toEqual(expect.objectContaining({ attempt: 3, delivered: false }));
		expect(connection.nodes[1].lastAttempt).toEqual(expect.objectContaining({ attempt: 1, delivered: true }));
		expect(connection.totalCount).toBe(2);
	});

	it('orders both logs newest first when the caller states no order', async () => {
		const { resolver } = surfaces();

		const subscriptions = await resolver.webhookSubscriptions();
		const deliveries = await resolver.webhookDeliveries();

		expect(subscriptions.nodes.map((node) => node.id)).toEqual([SUBSCRIPTION, OTHER_SUBSCRIPTION]);
		expect(deliveries.nodes.map((node) => node.id)).toEqual([DELIVERY, DELIVERIES[1].id]);
	});

	it('narrows by the fields the subscription filter declares', async () => {
		const { resolver } = surfaces();

		expect((await resolver.webhookSubscriptions({ isActive: { eq: false } })).nodes.map((node) => node.id)).toEqual([
			OTHER_SUBSCRIPTION
		]);
		expect((await resolver.webhookSubscriptions({ channelId: { eq: CHANNEL } })).totalCount).toBe(1);
		// The event selection is a JSON column, so a condition on it is stated as one.
		expect(
			(await resolver.webhookSubscriptions({ events: { contains: ['stock.*'] } })).nodes.map((node) => node.id)
		).toEqual([OTHER_SUBSCRIPTION]);
		// A date is compared as an instant rather than as its spelling.
		expect(
			(
				await resolver.webhookSubscriptions({
					createdAt: { between: ['2026-02-15T00:00:00.000Z', '2026-03-15T00:00:00.000Z'] }
				})
			).nodes.map((node) => node.id)
		).toEqual([SUBSCRIPTION]);
		expect((await resolver.webhookSubscriptions({ failureCount: { gte: 1 } })).nodes.map((node) => node.id)).toEqual([
			SUBSCRIPTION
		]);
	});

	it('narrows the delivery log by the four members a work list is taken by', async () => {
		const { resolver } = surfaces();

		// A subscription's own deliveries, which is how the sub-read the design names is expressed.
		expect((await resolver.webhookDeliveries({ subscriptionId: { eq: SUBSCRIPTION } })).totalCount).toBe(2);
		expect((await resolver.webhookDeliveries({ eventId: { eq: EVENT } })).nodes.map((node) => node.id)).toEqual([
			DELIVERY
		]);
		expect((await resolver.webhookDeliveries({ eventName: { eq: 'order.shipped' } })).nodes.map((n) => n.id)).toEqual(
			[DELIVERIES[1].id]
		);
		expect(
			(await resolver.webhookDeliveries({ status: { in: [WebhookDeliveryStatus.DEAD, WebhookDeliveryStatus.FAILED] } }))
				.nodes.map((node) => node.id)
		).toEqual([DELIVERY]);
	});

	it('orders by the keys the sort enums offer', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.webhookSubscriptions(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.name)).toEqual(['Inventory mirror', 'Order notifications']);

		// The work-list order the runbook names: what is due first stands first, and the rows already
		// settled carry no instant and trail it.
		const byDue = await resolver.webhookDeliveries(undefined, [{ field: 'nextAttemptAt', direction: 'ASC' }]);
		expect(byDue.nodes.map((node) => node.id)).toEqual([DELIVERY, DELIVERIES[1].id]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.webhookSubscriptions(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SUBSCRIPTION]);

		const second = await resolver.webhookSubscriptions(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_SUBSCRIPTION]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.webhookDeliveries(undefined, undefined, undefined, 20);

		const last = await resolver.webhookDeliveries(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([DELIVERY]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.webhookDeliveries(undefined, [{ field: 'payload', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `secret` is carried on the row and deliberately not filterable: it is a value no read of this
		// surface produces, so a condition on it could only ever be one a client cannot verify.
		const onTheSecret = await resolver.webhookSubscriptions({ secret: { eq: SECRET } }).catch((thrown) => thrown);
		expect(isRefusal(onTheSecret)).toBe(true);
		expect((onTheSecret as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');

		// And the delivery log's stored body, for the same reason.
		const onTheBody = await resolver.webhookDeliveries({ payload: { eq: {} } }).catch((thrown) => thrown);
		expect(isRefusal(onTheBody)).toBe(true);
		expect((onTheBody as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.webhookDeliveries(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();

		const pairs: ReadonlyArray<[string, string, string]> = [
			['WebhookSubscriptionFilter', 'webhookSubscriptions', 'secret'],
			['WebhookDeliveryFilter', 'webhookDeliveries', 'payload']
		];

		for (const [input, field, undeclared] of pairs) {
			const declared = [...inputBody(input).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
				.map((match) => match[1])
				.filter((member) => !['and', 'or', 'not'].includes(member));

			// The declaration in the resolver and the input in the SDL are two renderings of one list,
			// and a member that is filterable in the schema but unknown to the evaluator is a field a
			// client can state and be refused for. An empty condition narrows nothing, so what each read
			// below asserts is only that the evaluator recognises the field.
			for (const member of declared) {
				await expect(
					(resolver[field as 'webhookSubscriptions' | 'webhookDeliveries'] as never as (
						filter: unknown
					) => Promise<unknown>)({ [member]: {} })
				).resolves.toBeDefined();
			}

			// The other half of the same claim is read off the refusal, which names the evaluator's whole
			// allow-list: a member it knows and the schema does not would appear here and nowhere else.
			const refusal = await (
				resolver[field as 'webhookSubscriptions' | 'webhookDeliveries'] as never as (
					filter: unknown
				) => Promise<unknown>
			)({ [undeclared]: { eq: 'x' } }).catch((thrown) => thrown);
			const allowed = String((refusal as Error).message)
				.split('Allowed: ')[1]
				// The message closes the list with a sentence, so the full stop is taken off before the
				// members are read: it is punctuation rather than part of the last name.
				.replace(/\.\s*$/, '')
				.split(',')
				.map((member) => member.trim())
				.sort();

			expect(allowed).toEqual([...declared].sort());
		}
	});

	it('accepts every key the sort enums offer, and only those', async () => {
		const { resolver } = surfaces();
		const offered = (name: string): string[] => membersOf(name);

		expect(offered('WebhookSubscriptionSortField')).toEqual([
			'createdAt',
			'updatedAt',
			'name',
			'failureCount',
			'lastSuccessAt',
			'lastFailureAt',
			'isActive'
		]);
		expect(offered('WebhookDeliverySortField')).toEqual([
			'createdAt',
			'updatedAt',
			'nextAttemptAt',
			'deliveredAt',
			'attemptCount',
			'responseStatus',
			'eventName',
			'status'
		]);

		// Every key each enum offers is a key the evaluator accepts, so neither schema promises an order
		// the connection would refuse; the refusal of everything else is asserted above.
		for (const field of offered('WebhookSubscriptionSortField')) {
			await expect(resolver.webhookSubscriptions(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
		for (const field of offered('WebhookDeliverySortField')) {
			await expect(resolver.webhookDeliveries(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});
});

describe('WebhookResolver — one resource, two protocols, the same operations', () => {
	it('reads one subscription through the same service method the REST node route calls', async () => {
		const { resolver, webhookSubscriptionService } = surfaces();

		expect(await resolver.webhookSubscription(SUBSCRIPTION)).toBe(SUBSCRIPTIONS[0]);
		expect(webhookSubscriptionService.getRedactedSubscription).toHaveBeenCalledWith(SUBSCRIPTION);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, webhookSubscriptionService, webhookDeliveryService } = surfaces();
		webhookSubscriptionService.getRedactedSubscription.mockRejectedValueOnce(new NotFoundException());
		webhookDeliveryService.getRedactedDelivery.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.webhookSubscription(OTHER_SUBSCRIPTION)).toBeNull();
		expect(await resolver.webhookDelivery(DELIVERY)).toBeNull();
	});

	it('reads one delivery through the same service method the REST node route calls', async () => {
		const { resolver, webhookDeliveryService } = surfaces();

		expect(await resolver.webhookDelivery(DELIVERY)).toBe(DELIVERIES[0]);
		expect(webhookDeliveryService.getRedactedDelivery).toHaveBeenCalledWith(DELIVERY);
	});

	it('subscribes an endpoint through the same service method the REST create route calls', async () => {
		const { resolver, webhookSubscriptionService } = surfaces();

		const answer = await resolver.createWebhookSubscription({
			name: 'Order notifications',
			url: 'https://receiver.example.test/hooks/orders',
			events: ['order.placed'],
			channelId: CHANNEL,
			apiVersion: '1',
			headers: { 'X-Route': 'orders' }
		});

		// The delivered create is handed the members the caller stated and nothing else: the tenant and
		// the organization are stamped from the credential, and the secret is generated by the service.
		expect(webhookSubscriptionService.createSubscription).toHaveBeenCalledWith({
			name: 'Order notifications',
			url: 'https://receiver.example.test/hooks/orders',
			events: ['order.placed'],
			channelId: CHANNEL,
			apiVersion: '1',
			headers: { 'X-Route': 'orders' }
		});
		// The answer is the service's own credential: the subscription with a fingerprint, and the
		// secret that no later read can produce again.
		expect(answer).toBe(CREDENTIAL);
		expect(answer.secret).toBe(SECRET);
		expect(answer.subscription).not.toHaveProperty('secret');
	});

	it('changes a subscription through the same service method the REST edit route reaches', async () => {
		const { resolver, webhookSubscriptionService } = surfaces();

		await resolver.updateWebhookSubscription({ id: SUBSCRIPTION, name: 'Renamed', channelId: null });

		// The path identifier and the body travel together, as they do on the delivered route, and a
		// member the caller omits is not among what the write receives.
		expect(webhookSubscriptionService.updateSubscription).toHaveBeenCalledWith(SUBSCRIPTION, {
			name: 'Renamed',
			channelId: null
		});
	});

	it('removes a subscription through the same service method the REST removal route calls', async () => {
		const { resolver, webhookSubscriptionService } = surfaces();

		// The delivered store answers its delete result, which is not a row: the field answers the one
		// fact the removal establishes.
		expect(await resolver.deleteWebhookSubscription(SUBSCRIPTION)).toBe(true);
		expect(webhookSubscriptionService.delete).toHaveBeenCalledWith(SUBSCRIPTION);
	});

	it('rotates the signing secret through the same service method the REST route calls', async () => {
		const { resolver, webhookSubscriptionService } = surfaces();

		const answer = await resolver.rotateWebhookSecret(SUBSCRIPTION);

		expect(webhookSubscriptionService.rotateSecret).toHaveBeenCalledWith(SUBSCRIPTION);
		expect(answer.secret).toBe(SECRET);
		// The grace window's end travels with the new secret, because the endpoint has to be told how
		// long the old one still verifies.
		expect(answer.previousSecretValidUntil).toBe('2026-03-04T10:00:00.000Z');
	});

	it('switches a subscription off and on through the same service methods the REST routes call', async () => {
		const { resolver, webhookSubscriptionService } = surfaces();

		const enabled = await resolver.enableWebhookSubscription(OTHER_SUBSCRIPTION);
		expect(webhookSubscriptionService.enable).toHaveBeenCalledWith(OTHER_SUBSCRIPTION);
		expect(enabled.isActive).toBe(true);
		expect(enabled.disabledAt).toBeNull();

		await resolver.disableWebhookSubscription(SUBSCRIPTION, 'The receiver is being migrated.');
		expect(webhookSubscriptionService.disable).toHaveBeenCalledWith(
			SUBSCRIPTION,
			'The receiver is being migrated.'
		);

		// A switch thrown with no reason states none, which is the same call the delivered route makes
		// when its body carries no reason.
		await resolver.disableWebhookSubscription(SUBSCRIPTION);
		expect(webhookSubscriptionService.disable).toHaveBeenLastCalledWith(SUBSCRIPTION, undefined);
	});

	it('requeues a delivery through the same service method the REST route calls', async () => {
		const { resolver, webhookDeliveryService } = surfaces();

		const requeued = await resolver.redeliverWebhook(DELIVERY);

		expect(webhookDeliveryService.requeue).toHaveBeenCalledWith(DELIVERY);
		// The answer is the requeued row, and the projection is applied to it: the field does not hand
		// back the stored row, which would carry the body the projection withholds.
		expect(webhookDeliveryService.redact).toHaveBeenCalled();
		expect(requeued.status).toBe(WebhookDeliveryStatus.PENDING);
		expect(requeued.attemptCount).toBe(0);
		expect(requeued).not.toHaveProperty('payload');
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, webhookSubscriptionService } = surfaces();
		const refusal = new Error('WEBHOOK_URL_NOT_ALLOWED: the endpoint must use HTTPS.');

		webhookSubscriptionService.createSubscription.mockRejectedValueOnce(refusal);

		await expect(
			resolver.createWebhookSubscription({ name: 'x', url: 'http://receiver.example.test', events: ['*'] })
		).rejects.toBe(refusal);
	});
});

describe('WebhookResolver — the streamed facts are produced by the services both protocols call', () => {
	/** The process's own client, so a stubbed one never leaks out of this suite. */
	const originalFetch = globalThis.fetch;
	let tenant: jest.SpyInstance;

	beforeEach(() => {
		tenant = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		tenant.mockRestore();
		jest.restoreAllMocks();
	});

	/**
	 * The real publisher over the real in-process fan-out, declared once.
	 *
	 * The two facts this domain streams are declared to the catalogue, which is what makes them
	 * selectable at all — an event a domain publishes but never declares is an event no client can ask
	 * for.
	 */
	function streaming() {
		const pubSub = new GraphqlPubSub();
		const catalogue = new SubscriptionCatalogue();
		const publisher = new WebhookEventPublisher(pubSub, catalogue);

		publisher.onModuleInit();

		return { pubSub, catalogue, publisher };
	}

	/** Reads one message from a stream, or answers null when nothing arrives. */
	async function first(stream: AsyncIterable<unknown>): Promise<Record<string, any> | null> {
		for await (const message of stream) {
			return message as Record<string, any>;
		}

		return null;
	}

	it('declares exactly the two facts it streams, and not the delivered one', () => {
		const { catalogue } = streaming();

		// `webhook.delivered` is not declared: a stream that fires on every accepted attempt is a load
		// generator, and the delivery query already answers what happened.
		expect(catalogue.names()).toEqual([WEBHOOK_EVENT_NAMES.WEBHOOK_DISABLED, WEBHOOK_EVENT_NAMES.WEBHOOK_FAILED]);
	});

	it('streams a refused attempt that the delivery service recorded', async () => {
		const { pubSub, publisher } = streaming();
		const subscriptions = {
			getSubscription: jest.fn().mockResolvedValue({
				id: SUBSCRIPTION,
				url: 'https://receiver.example.test/hooks/orders',
				isActive: true,
				apiVersion: '1'
			}),
			revealSecret: jest.fn().mockResolvedValue(SECRET),
			previousSecretOf: jest.fn().mockReturnValue(undefined),
			recordAttempt: jest.fn().mockResolvedValue({ id: SUBSCRIPTION })
		};
		const table = {
			findOne: jest.fn().mockResolvedValue({
				id: DELIVERY,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				subscriptionId: SUBSCRIPTION,
				eventId: EVENT,
				eventName: 'order.placed',
				payload: { id: EVENT, data: { customerId: 'customer-1' } },
				status: WebhookDeliveryStatus.PENDING,
				attemptCount: 0
			}),
			save: jest.fn(async (row: unknown) => row)
		};
		const deliveries = new WebhookDeliveryService(
			table as never,
			{} as never,
			subscriptions as never,
			publisher as never
		);
		const resolver = new WebhookResolver({} as never, { listDeliveries: jest.fn() } as never, pubSub);

		// The stream is opened through the resolver — the same `@Subscription` field a client selects —
		// and the attempt is made through the service the REST route and the mutation both reach.
		const stream = resolver.webhookDeliveryFailed(SUBSCRIPTION);
		globalThis.fetch = (async () => ({ ok: false, status: 500, text: async () => 'upstream down' })) as never;

		await deliveries.deliver(DELIVERY);

		const message = await first(stream);

		// The fact arrived on the topic the resolver opened, carries the tenant from the credential, and
		// answers the delivery in the projection the API uses — a stream is a broadcast within a tenant,
		// so the stored body, which carries the event's own data, is not on it.
		expect(message?.name).toBe(WEBHOOK_EVENT_NAMES.WEBHOOK_FAILED);
		expect(message?.tenantId).toBe(TENANT);
		expect(message?.data).toEqual(
			expect.objectContaining({ subscriptionId: SUBSCRIPTION, eventId: EVENT, attempt: 1, responseStatus: 500 })
		);
		expect(message?.delivery).not.toHaveProperty('payload');
		expect(message?.delivery).toEqual(expect.objectContaining({ id: DELIVERY, status: WebhookDeliveryStatus.FAILED }));
		// The subscription's own counters were updated first, as they are on every attempt.
		expect(subscriptions.recordAttempt).toHaveBeenCalledWith(SUBSCRIPTION, { delivered: false, status: 500 });
	});

	it('streams a switch-off that the subscription service performed', async () => {
		const { pubSub, publisher } = streaming();
		const table = {
			findOne: jest.fn().mockResolvedValue({
				id: SUBSCRIPTION,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				name: 'Order notifications',
				url: 'https://receiver.example.test/hooks/orders',
				secret: 'deadbeef:cafe',
				events: ['order.placed'],
				failureCount: 100,
				isActive: true
			}),
			save: jest.fn(async (row: unknown) => row)
		};
		const subscriptions = new WebhookSubscriptionService(
			table as never,
			{} as never,
			new EncryptionService(),
			publisher as never
		);
		const resolver = new WebhookResolver({} as never, {} as never, pubSub);

		const stream = resolver.webhookSubscriptionDisabled(SUBSCRIPTION);

		await subscriptions.disable(SUBSCRIPTION, 'The receiver is being migrated.');

		const message = await first(stream);

		expect(message?.name).toBe(WEBHOOK_EVENT_NAMES.WEBHOOK_DISABLED);
		expect(message?.tenantId).toBe(TENANT);
		expect(message?.data).toEqual(
			expect.objectContaining({ subscriptionId: SUBSCRIPTION, consecutiveFailures: 100 })
		);
		expect(message?.reason).toBe('The receiver is being migrated.');
		// The row a subscriber receives is the same projection every read answers with: no secret, and
		// a fingerprint in its place.
		expect(message?.subscription).not.toHaveProperty('secret');
		expect(message?.subscription?.secretFingerprint).toMatch(/^[0-9a-f]{8}$/);
	});

	it('carries the read permission on both streams, and never a write one', () => {
		// A stream's authorisation is the subscribed resource's read permission and nothing weaker: a
		// caller that may not read a delivery log may not watch one either.
		const readPermission = Reflect.getMetadata(PERMISSIONS_METADATA, WebhookSubscriptionController);

		for (const field of ['webhookDeliveryFailed', 'webhookSubscriptionDisabled']) {
			expect(permissionOfField(field)).toEqual(readPermission);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, WebhookResolver.prototype[field])).toEqual([
				PermissionsEnum.WEBHOOKS_VIEW
			]);
		}
	});

	it('subscribes to the tenant’s own topic for the catalogued event', () => {
		const { resolver, pubSub } = surfaces();
		const topicFor = jest.spyOn(pubSub, 'topicFor');

		resolver.webhookDeliveryFailed(SUBSCRIPTION);
		resolver.webhookSubscriptionDisabled(SUBSCRIPTION);

		expect(topicFor).toHaveBeenCalledWith(WEBHOOK_EVENT_NAMES.WEBHOOK_FAILED, TENANT);
		expect(topicFor).toHaveBeenCalledWith(WEBHOOK_EVENT_NAMES.WEBHOOK_DISABLED, TENANT);
	});

	it('subscribes to a topic no fact travels on when there is no credential', () => {
		const { resolver, pubSub } = surfaces();
		const topicFor = jest.spyOn(pubSub, 'topicFor');
		tenant.mockReturnValue(null);

		resolver.webhookDeliveryFailed(SUBSCRIPTION);

		// The silent topic rather than a wide one: a broadcast channel is the one thing this design
		// must not have.
		expect(topicFor).toHaveBeenCalledWith(WEBHOOK_EVENT_NAMES.WEBHOOK_FAILED, '');
	});
});

describe('WebhookResolver — the guard stack and the permission are the controllers’', () => {
	it('guards the resolver the way both controllers are guarded, plus the gate', () => {
		const resolverGuards = classGuards(WebhookResolver);
		const subscriptionGuards = classGuards(WebhookSubscriptionController);
		const deliveryGuards = classGuards(WebhookDeliveryController);

		expect(subscriptionGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(deliveryGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The one guard the resolver states beyond the controllers' chain is the gate, and it is the
		// addition rather than a substitution: the two they state come first, so a caller with no
		// credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...subscriptionGuards, FeatureFlagGuard]);
		expect(resolverGuards).toEqual([...deliveryGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = classGuards(WebhookResolver);

		for (const { controller, route } of PERMISSION_PARITY) {
			// The controller's chain and the resolver's are the same set, which is the whole parity
			// claim: a route that added a guard of its own would narrow REST below GraphQL and is caught
			// here.
			const declared = classGuards(controller);
			const restated = guardsOfHandler(controller, route);

			// The gate is the one guard beyond that set, and it is declared on the class rather than on
			// any field, so every route here runs under it.
			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission both controllers state on theirs', () => {
		const stated = Reflect.getMetadata(PERMISSIONS_METADATA, WebhookResolver);

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, WebhookSubscriptionController)).toEqual([
			PermissionsEnum.WEBHOOKS_VIEW
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, WebhookDeliveryController)).toEqual([
			PermissionsEnum.WEBHOOKS_VIEW
		]);
		expect(stated).toEqual([PermissionsEnum.WEBHOOKS_VIEW]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, controller, route }) => {
		const fieldPermissions = Reflect.getMetadata(PERMISSIONS_METADATA, WebhookResolver.prototype[field]) ?? [];
		const routePermissions = permissionOfRoute(controller, route) ?? [];

		expect(fieldPermissions).toEqual(routePermissions);
		// The guard a field states of its own is the guard its route's handler states of its own: the
		// class-level chains are compared above, and a handler that added one is caught here.
		expect(guardsOfField(field)).toEqual(guardsOfHandler(controller, route));
	});

	it('carries the retry permission on the redelivery and the edit permission on the switch', () => {
		// The two neighbouring writes do not share a permission, and they must not: the catalogue gives
		// the redelivery one of its own, so watching a log and re-firing it are separable decisions.
		// This is the parity rather than an inconsistency — it is what the routes carry.
		expect(permissionOfField('redeliverWebhook')).toEqual([PermissionsEnum.WEBHOOK_DELIVERIES_RETRY]);
		expect(permissionOfRoute(WebhookDeliveryController, 'redeliver')).toEqual([
			PermissionsEnum.WEBHOOK_DELIVERIES_RETRY
		]);

		for (const field of ['rotateWebhookSecret', 'enableWebhookSubscription', 'disableWebhookSubscription']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.WEBHOOKS_EDIT]);
		}
	});

	it('carries the create, delete and read permissions the routes of this resource carry', () => {
		expect(permissionOfField('createWebhookSubscription')).toEqual([PermissionsEnum.WEBHOOKS_CREATE]);
		expect(permissionOfField('deleteWebhookSubscription')).toEqual([PermissionsEnum.WEBHOOKS_DELETE]);
		expect(permissionOfField('webhookSubscriptions')).toEqual([PermissionsEnum.WEBHOOKS_VIEW]);
		expect(permissionOfField('webhookDeliveries')).toEqual([PermissionsEnum.WEBHOOKS_VIEW]);
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		// "No credential" at the level a unit test can observe: the class-level chain refuses a request
		// that presents none, and the metadata below is what the permission guard reads. A write field
		// that carried the read permission — or none — would be reachable by every caller that may look.
		for (const field of WRITES) {
			const stated = (permissionOfField(field) ?? []) as PermissionsEnum[];

			expect(stated).not.toContain(PermissionsEnum.WEBHOOKS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});
});

describe('WebhookResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, WebhookResolver)).toBe(FEATURE_GRAPHQL);
		expect(classGuards(WebhookResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('webhookSubscriptions')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('webhookSubscriptions');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the two secret operations among them', async () => {
		// Nothing on this surface is exempt: the door that switches the capability back on is the REST
		// route, which this code does not gate.
		for (const field of ['createWebhookSubscription', 'rotateWebhookSecret', 'redeliverWebhook']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('refuses the streams as well', async () => {
		// A stream is served through the same endpoint, so it is behind the same switch: a capability
		// that is off must not be observable through a subscription either.
		for (const field of ['webhookDeliveryFailed', 'webhookSubscriptionDisabled']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('webhookSubscription'))).resolves.toBe(true);
	});
});

describe('WebhookModule — the two surfaces are declared where their dependencies are reachable', () => {
	it('declares both controllers and the resolver as providers of the module that owns the services', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, WebhookModule) ?? []) as unknown[];
		const controllers = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, WebhookModule) ?? []) as unknown[];

		expect(controllers).toContain(WebhookSubscriptionController);
		expect(controllers).toContain(WebhookDeliveryController);
		expect(providers).toContain(WebhookResolver);
		expect(providers).toContain(WebhookSubscriptionService);
		expect(providers).toContain(WebhookDeliveryService);
		// The two producers are declared beside the services that call them, because a subscription is
		// fed from one place or it is fed inconsistently.
		expect(providers).toContain(WebhookEventPublisher);
	});

	it('exports the resolver and the publisher, so the host that scans the module reaches both', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// hands on what it declares is what makes the resolver discoverable without a second instance.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, WebhookModule) ?? []) as unknown[];

		expect(exported).toContain(WebhookResolver);
		expect(exported).toContain(WebhookEventPublisher);
		expect(exported).toContain(WebhookSubscriptionService);
		expect(exported).toContain(WebhookDeliveryService);
		expect(WebhookResolver.length).toBe(3);
	});

	it('reaches the module that provides the guards and the one that provides the fan-out', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, WebhookModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);
		const names = resolved.map((entry) => (entry as { name?: string })?.name);

		// A guard is a provider of whichever module hosts the handler it protects, so this module has to
		// reach the permission service the two guards look the caller's grants up in — the API boot fails
		// on an unresolved dependency without it.
		expect(names).toContain('RolePermissionModule');
		// And the publisher resolves the fan-out and the catalogue from here, which is why the
		// subscription module is imported by the module that owns the writers rather than by the host.
		expect(names).toContain('GraphqlSubscriptionModule');
	});
});
