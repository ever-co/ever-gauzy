/**
 * The order streams (`orderChanged`, `checkoutCompleted`), held to the subscriber's tenant and organization.
 *
 * The facts reach these fields the way they do in the running API: the outbox consumer publishes each appended
 * `order.*` event on `<event>:<tenantId>` of `GraphqlPubSub`, and the field follows those topics. So the cases
 * publish envelopes on the real `GraphqlPubSub` — on another tenant's topic, mis-published onto the subscriber's
 * topic while naming another tenant, of another organization, and of the subscriber's own — and assert the
 * subscriber hears its own and nothing else.
 *
 * **The kernel is the real one where isolation lives**: `tenantScopedTopicStream`, `GraphqlPubSub`,
 * `RequestContext` over a real CLS store and the permission decorator are required from the kernel's sources;
 * the rest of `@gauzy/core` is doubled at the module boundary, as this package's other suites do, because its
 * barrel boots the application graph. `OrderService` is doubled: the read is asserted to be stated in the
 * subscriber's scope.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	const subscription = jest.requireActual('@gauzy/core/src/lib/graphql/subscriptions/plugin-subscription');

	return {
		FEATURE_GRAPHQL: jest.requireActual('@gauzy/core/src/lib/feature/graphql-feature.code').FEATURE_GRAPHQL,
		FeatureFlagGuard: class FeatureFlagGuard {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		GraphqlPubSub: jest.requireActual('@gauzy/core/src/lib/graphql/subscriptions/graphql-pubsub.service').GraphqlPubSub,
		RequestContext: jest.requireActual('@gauzy/core/src/lib/core/context/request-context').RequestContext,
		deliverPayloadAsIs: subscription.deliverPayloadAsIs,
		tenantScopedTopicStream: subscription.tenantScopedTopicStream,
		declareStreamedEvents: subscription.declareStreamedEvents,
		SubscriptionCatalogue: class SubscriptionCatalogue {},
		GraphqlSubscriptionConsumer: class GraphqlSubscriptionConsumer {},
		GraphqlConnection: class GraphqlConnection {},
		TenantOrganizationBaseEntity: class TenantOrganizationBaseEntity {},
		versionExpectationOf: () => undefined
	};
});

jest.mock('../order/order.service', () => ({ OrderService: class OrderService {} }));

import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import { Kind, ObjectTypeExtensionNode, print } from 'graphql';
import { SUBSCRIPTION_OPTIONS_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { FEATURE_GRAPHQL, GraphqlPubSub, RequestContext, deliverPayloadAsIs } from '@gauzy/core';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { ORDER_STREAMED_EVENTS } from '../order-streamed-events';
import { orderSchemaExtensions } from './schema-extensions';
import { OrderSubscriptionResolver } from './order-subscription.resolver';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ORG_A = 'organization-a';
const ORG_A2 = 'organization-a2';

/** The rows the doubled service holds, one per tenant and organization. */
const ORDERS = [
	{ id: 'order-a', tenantId: TENANT_A, organizationId: ORG_A, cartId: 'cart-a', channelId: 'web', status: 'PENDING' },
	{ id: 'order-a-2', tenantId: TENANT_A, organizationId: ORG_A, cartId: 'cart-a-2', channelId: 'pos', status: 'PENDING' },
	{ id: 'order-a2', tenantId: TENANT_A, organizationId: ORG_A2, cartId: 'cart-a2', channelId: 'web', status: 'PENDING' },
	{ id: 'order-b', tenantId: TENANT_B, organizationId: 'organization-b', cartId: 'cart-b', channelId: 'web', status: 'PENDING' }
];

/** Runs work as a signed-in user of one tenant and organization. */
const as = <T>(tenantId: string, organizationId: string, work: () => T): T =>
	RequestContext.runWithRequest(
		{ user: { id: `user-${tenantId}`, tenantId, lastOrganizationId: organizationId } } as never,
		work
	);

/** Opens a stream as graphql-js does: resolved as the subscriber, iterator taken before anything is published. */
const subscribe = (tenantId: string, organizationId: string, open: () => unknown): AsyncIterator<unknown> =>
	as(tenantId, organizationId, () => (open() as AsyncIterable<unknown>)[Symbol.asyncIterator]());

/** Everything an opened stream delivers until it has been quiet for a moment. */
const delivered = async (iterator: AsyncIterator<unknown>, quietMs = 100): Promise<unknown[]> => {
	const values: unknown[] = [];
	for (;;) {
		let timer: NodeJS.Timeout | undefined;
		const quiet = new Promise<'quiet'>((resolve) => (timer = setTimeout(() => resolve('quiet'), quietMs)));
		const next = await Promise.race([iterator.next(), quiet]);
		clearTimeout(timer);
		if (next === 'quiet' || next.done) break;
		values.push(next.value);
	}
	await iterator.return?.();
	return values;
};

/** The envelope the outbox consumer publishes for one appended order event. */
const envelope = (name: string, order: (typeof ORDERS)[number], overrides: Record<string, unknown> = {}) => ({
	eventId: `${name}:${order.id}`,
	name,
	occurredAt: new Date(0),
	tenantId: order.tenantId,
	organizationId: order.organizationId,
	aggregate: { type: 'order', id: order.id },
	data: { orderId: order.id, status: order.status },
	...overrides
});

describe('the order subscriptions, scoped to the subscriber', () => {
	const originalClsService = RequestContext['clsService'];
	let pubSub: GraphqlPubSub;
	let reads: unknown[];
	let resolver: OrderSubscriptionResolver;

	beforeAll(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	beforeEach(() => {
		pubSub = new GraphqlPubSub();
		reads = [];
		// The service's own read is scoped to the caller's tenant; the double answers only a row that matches
		// every condition it was handed, which is what a scoped `findOneByWhereOptions` does.
		const orderService = {
			findOneByWhereOptions: jest.fn(async (where: Record<string, unknown>) => {
				reads.push(where);
				const row = ORDERS.find((order) =>
					Object.entries(where).every(([key, value]) => (order as Record<string, unknown>)[key] === value)
				);
				if (!row) throw new Error('Record not found');
				return { ...row };
			})
		};
		resolver = new OrderSubscriptionResolver(orderService as never, pubSub);
	});

	afterEach(() => pubSub.onModuleDestroy());

	/** Publishes as the outbox consumer does: on the topic of the tenant the envelope states, unless told otherwise. */
	const publish = async (event: ReturnType<typeof envelope>, topicTenant: string = String(event.tenantId)) =>
		await pubSub.publish(event.name, topicTenant, event);

	describe('orderChanged', () => {
		it("delivers its own tenant's move, re-read as the subscriber, and nothing of another tenant", async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.orderChanged());

			await publish(envelope('order.placed', ORDERS[3])); // tenant B, on B's topic
			await publish(envelope('order.placed', ORDERS[3]), TENANT_A); // tenant B, mis-published onto A's topic
			await publish(envelope('order.placed', ORDERS[0], { tenantId: undefined }), TENANT_A); // states no tenant
			await publish(envelope('order.confirmed', ORDERS[0])); // tenant A, organization A

			expect(await delivered(stream)).toEqual([expect.objectContaining({ id: 'order-a', tenantId: TENANT_A })]);
			// Read once, for the one envelope admitted, in the subscriber's own scope.
			expect(reads).toEqual([{ id: 'order-a', tenantId: TENANT_A, organizationId: ORG_A }]);
		});

		it('delivers nothing of another organization of the same tenant to a subscriber acting in one', async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.orderChanged());

			await publish(envelope('order.confirmed', ORDERS[2])); // tenant A, organization A2

			expect(await delivered(stream)).toEqual([]);
			expect(reads).toEqual([]);
		});

		it("tenant B's subscriber does hear tenant B's move — the control for the negative cases", async () => {
			const stream = subscribe(TENANT_B, 'organization-b', () => resolver.orderChanged());

			await publish(envelope('order.canceled', ORDERS[0])); // tenant A
			await publish(envelope('order.canceled', ORDERS[3])); // tenant B

			expect(await delivered(stream)).toEqual([expect.objectContaining({ id: 'order-b', tenantId: TENANT_B })]);
		});

		it('narrows by order and by action, and only narrows', async () => {
			const byOrder = subscribe(TENANT_A, ORG_A, () => resolver.orderChanged('order-a-2'));
			const byAction = subscribe(TENANT_A, ORG_A, () => resolver.orderChanged(undefined, 'canceled'));

			await publish(envelope('order.placed', ORDERS[0]));
			await publish(envelope('order.placed', ORDERS[1]));
			await publish(envelope('order.canceled', ORDERS[0]));

			expect(((await delivered(byOrder)) as { id: string }[]).map((order) => order.id)).toEqual(['order-a-2']);
			expect(((await delivered(byAction)) as { id: string }[]).map((order) => order.id)).toEqual(['order-a']);
		});

		it('follows every order fact the package streams, and no other', async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.orderChanged());

			for (const name of ORDER_STREAMED_EVENTS) await publish(envelope(name, ORDERS[0]));
			await publish(envelope('order.updated', ORDERS[0])); // not a streamed order fact

			expect(await delivered(stream)).toHaveLength(ORDER_STREAMED_EVENTS.length);
		});

		it('drops an envelope whose order the subscriber cannot read (deleted, or never there)', async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.orderChanged());

			await publish(envelope('order.archived', { ...ORDERS[0], id: 'order-gone' }));

			expect(await delivered(stream)).toEqual([]);
		});
	});

	describe('checkoutCompleted', () => {
		it('rides order.placed only, for the subscriber’s own tenant and organization', async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.checkoutCompleted());

			await publish(envelope('order.confirmed', ORDERS[0])); // a later move, not a checkout
			await publish(envelope('order.placed', ORDERS[3])); // tenant B
			await publish(envelope('order.placed', ORDERS[3]), TENANT_A); // tenant B, mis-published
			await publish(envelope('order.placed', ORDERS[2])); // tenant A, organization A2
			await publish(envelope('order.placed', ORDERS[0]));

			expect(((await delivered(stream)) as { id: string }[]).map((order) => order.id)).toEqual(['order-a']);
		});

		it('narrows by the cart the order was checked out from and by its channel, on the re-read row', async () => {
			const byCart = subscribe(TENANT_A, ORG_A, () => resolver.checkoutCompleted('cart-a-2'));
			const byChannel = subscribe(TENANT_A, ORG_A, () => resolver.checkoutCompleted(undefined, 'web'));

			await publish(envelope('order.placed', ORDERS[0]));
			await publish(envelope('order.placed', ORDERS[1]));

			expect(((await delivered(byCart)) as { id: string }[]).map((order) => order.id)).toEqual(['order-a-2']);
			expect(((await delivered(byChannel)) as { id: string }[]).map((order) => order.id)).toEqual(['order-a']);
		});

		it("tenant B's subscriber hears tenant B's checkout — the control", async () => {
			const stream = subscribe(TENANT_B, 'organization-b', () => resolver.checkoutCompleted());

			await publish(envelope('order.placed', ORDERS[0]));
			await publish(envelope('order.placed', ORDERS[3]));

			expect(((await delivered(stream)) as { id: string }[]).map((order) => order.id)).toEqual(['order-b']);
		});
	});

	it('refuses to open a stream for a caller with no tenant', () => {
		expect(() => RequestContext.runWithRequest({ user: undefined } as never, () => resolver.orderChanged())).toThrow(
			/no tenant/
		);
	});

	describe('the gates and the schema', () => {
		it.each(['orderChanged', 'checkoutCompleted'])('%s carries the order queries’ gates and delivers its payload as is', (field) => {
			const handler = (OrderSubscriptionResolver.prototype as never)[field];

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual([ORDER_PERMISSIONS.ORDERS_VIEW]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrderSubscriptionResolver)).toEqual([ORDER_PERMISSIONS.ORDERS_VIEW]);
			expect(Reflect.getMetadata(SUBSCRIPTION_OPTIONS_METADATA, handler)).toEqual(
				expect.objectContaining({ resolve: deliverPayloadAsIs })
			);
			const guards = (Reflect.getMetadata('__guards__', OrderSubscriptionResolver) ?? []).map((guard: Function) => guard.name);
			expect(guards).toEqual(['TenantPermissionGuard', 'PermissionGuard', 'FeatureFlagGuard']);
			expect(FEATURE_GRAPHQL).toBeDefined();
		});

		it('is registered with the package’s resolvers', () => {
			// Read as source: the barrel loads every resolver of the package, and their bases are the kernel's.
			const barrel = readFileSync(join(__dirname, 'index.ts'), 'utf8');
			expect(barrel).toMatch(/export const orderResolvers = \[[^\]]*\bOrderSubscriptionResolver\b[^\]]*\]/);
		});

		it('declares both fields on the Subscription root, with their narrowing arguments, answering an Order', () => {
			const fields = orderSchemaExtensions.definitions
				.filter(
					(definition): definition is ObjectTypeExtensionNode =>
						definition.kind === Kind.OBJECT_TYPE_EXTENSION && definition.name.value === 'Subscription'
				)
				.flatMap((definition) => [...(definition.fields ?? [])]);
			const signature = (name: string) => {
				const field = fields.find((candidate) => candidate.name.value === name);
				return field ? `${(field.arguments ?? []).map((argument) => `${argument.name.value}: ${print(argument.type)}`).join(', ')} -> ${print(field.type)}` : undefined;
			};

			expect(signature('orderChanged')).toBe('orderId: ID, action: String -> Order!');
			expect(signature('checkoutCompleted')).toBe('cartId: ID, channelId: ID -> Order!');
		});
	});
});
