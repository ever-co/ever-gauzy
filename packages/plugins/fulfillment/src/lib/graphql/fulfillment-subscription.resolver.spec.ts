/**
 * The shipment streams (`fulfillmentCreated`, `fulfillmentChanged`), held to the subscriber's tenant and organization.
 *
 * The facts reach the fields the way they do in the running API: the outbox consumer publishes each appended
 * `fulfillment.*` event on `<event>:<tenantId>` of `GraphqlPubSub`, and the fields follow those topics. The cases
 * publish envelopes on the real `GraphqlPubSub` — on another tenant's topic, mis-published onto the subscriber's
 * topic while naming another tenant, of another organization, and of the subscriber's own — and assert the
 * subscriber hears its own and nothing else.
 *
 * **The kernel is the real one where isolation lives** (`tenantScopedTopicStream`, `GraphqlPubSub`,
 * `RequestContext` over a real CLS store, the permission and feature decorators); the rest of `@gauzy/core` is
 * doubled at the module boundary, as this package's other suites do. `FulfillmentService` is doubled with the
 * scoping its tenant-aware read performs: the criteria it is handed, and the caller's tenant from `RequestContext`.
 *
 * The producer half — every move appended to the outbox through the write's own manager, and nothing for a move
 * that did not happen — is held by `fulfillment.service.spec.ts` ("announces every lifecycle move into the
 * outbox …", "announces nothing for a move that did not happen", and the rollback of a cancellation whose order cannot be
 * re-derived).
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
		GraphqlSubscriptionConsumer: class GraphqlSubscriptionConsumer {}
	};
});

jest.mock('../fulfillment/fulfillment.service', () => ({ FulfillmentService: class FulfillmentService {} }));
jest.mock('../fulfillment/fulfillment.entity', () => ({ Fulfillment: class Fulfillment {} }));

import { AsyncLocalStorage } from 'async_hooks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClsService } from 'nestjs-cls';
import { Kind, ObjectTypeExtensionNode, print } from 'graphql';
import { SUBSCRIPTION_OPTIONS_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { featureFlagsOf } from '@gauzy/common';
import { FEATURE_GRAPHQL, GraphqlPubSub, RequestContext, deliverPayloadAsIs } from '@gauzy/core';
import { FULFILLMENT_STREAMED_EVENTS } from '../fulfillment-streamed-events';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';
import { fulfillmentSchemaExtensions } from './schema-extensions';
import { FulfillmentSubscriptionResolver } from './fulfillment-subscription.resolver';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ORG_A = 'organization-a';
const ORG_A2 = 'organization-a2';

/** The shipments the doubled service holds, one per tenant and organization. */
const SHIPMENTS = [
	{ id: 'shipment-a', tenantId: TENANT_A, organizationId: ORG_A, orderId: 'order-a', warehouseId: 'wh-1', status: 'PENDING' },
	{ id: 'shipment-a-2', tenantId: TENANT_A, organizationId: ORG_A, orderId: 'order-a-2', warehouseId: 'wh-2', status: 'PENDING' },
	{ id: 'shipment-a2', tenantId: TENANT_A, organizationId: ORG_A2, orderId: 'order-a2', warehouseId: 'wh-1', status: 'PENDING' },
	{ id: 'shipment-b', tenantId: TENANT_B, organizationId: 'organization-b', orderId: 'order-b', warehouseId: 'wh-b', status: 'PENDING' }
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
const delivered = async (iterator: AsyncIterator<unknown>, quietMs = 100): Promise<{ id: string; lines?: unknown[] }[]> => {
	const values: { id: string; lines?: unknown[] }[] = [];
	for (;;) {
		let timer: NodeJS.Timeout | undefined;
		const quiet = new Promise<'quiet'>((resolve) => (timer = setTimeout(() => resolve('quiet'), quietMs)));
		const next = await Promise.race([iterator.next(), quiet]);
		clearTimeout(timer);
		if (next === 'quiet' || next.done) break;
		values.push(next.value as { id: string });
	}
	await iterator.return?.();
	return values;
};

/** The envelope the outbox consumer publishes for one appended fulfillment event. */
const envelope = (name: string, shipment: (typeof SHIPMENTS)[number], overrides: Record<string, unknown> = {}) => ({
	eventId: `${name}:${shipment.id}`,
	name,
	occurredAt: new Date(0),
	tenantId: shipment.tenantId,
	organizationId: shipment.organizationId,
	aggregate: { type: 'FULFILLMENT', id: shipment.id },
	data: { fulfillmentId: shipment.id, orderId: shipment.orderId, status: shipment.status },
	...overrides
});

describe('the shipment subscriptions, scoped to the subscriber', () => {
	const originalClsService = RequestContext['clsService'];
	let pubSub: GraphqlPubSub;
	let reads: string[];
	let resolver: FulfillmentSubscriptionResolver;

	beforeAll(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	beforeEach(() => {
		pubSub = new GraphqlPubSub();
		reads = [];
		// The tenant-aware `findOneOrFailByOptions` adds the caller's tenant from `RequestContext` to the criteria it
		// is handed, so the double applies both: the read runs as the subscriber, never as the publisher.
		const fulfillmentService = {
			findOneOrFailByOptions: jest.fn(async ({ where, relations }: { where: Record<string, string>; relations: string[] }) => {
				const tenantId = RequestContext.currentTenantId();
				reads.push(`${where.id}@${tenantId}/${where.organizationId}`);
				const row = SHIPMENTS.find(
					(candidate) =>
						candidate.id === where.id &&
						candidate.tenantId === tenantId &&
						candidate.tenantId === where.tenantId &&
						(!where.organizationId || candidate.organizationId === where.organizationId)
				);
				if (!row) return { success: false, error: new Error('The fulfilment was not found.') };
				return {
					success: true,
					record: { ...row, ...(relations?.includes('lines') ? { lines: [{ id: `${row.id}-line` }] } : {}) }
				};
			})
		};
		resolver = new FulfillmentSubscriptionResolver(fulfillmentService as never, pubSub);
	});

	afterEach(() => pubSub.onModuleDestroy());

	/** Publishes as the outbox consumer does: on the topic of the tenant the envelope states, unless told otherwise. */
	const publish = async (event: ReturnType<typeof envelope>, topicTenant: string = String(event.tenantId)) =>
		await pubSub.publish(event.name, topicTenant, event);

	describe('fulfillmentChanged', () => {
		it("delivers its own tenant's move, re-read as the subscriber with its lines, and nothing of another tenant", async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.fulfillmentChanged());

			await publish(envelope('fulfillment.shipped', SHIPMENTS[3])); // tenant B, on B's topic
			await publish(envelope('fulfillment.shipped', SHIPMENTS[3]), TENANT_A); // tenant B, mis-published onto A's topic
			await publish(envelope('fulfillment.shipped', SHIPMENTS[0], { tenantId: undefined }), TENANT_A); // states no tenant
			await publish(envelope('fulfillment.delivered', SHIPMENTS[0])); // tenant A, organization A

			const values = await delivered(stream);
			expect(values.map((row) => row.id)).toEqual(['shipment-a']);
			expect(values[0].lines).toEqual([{ id: 'shipment-a-line' }]);
			expect(reads).toEqual([`shipment-a@${TENANT_A}/${ORG_A}`]);
		});

		it('delivers nothing of another organization of the same tenant to a subscriber acting in one', async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.fulfillmentChanged());

			await publish(envelope('fulfillment.shipped', SHIPMENTS[2])); // tenant A, organization A2
			// Even an envelope that hides its organization is re-read as the subscriber, and the row is not theirs.
			await publish(envelope('fulfillment.shipped', SHIPMENTS[2], { organizationId: undefined }));

			expect(await delivered(stream)).toEqual([]);
		});

		it("tenant B's subscriber does hear tenant B's move — the control for the negative cases", async () => {
			const stream = subscribe(TENANT_B, 'organization-b', () => resolver.fulfillmentChanged());

			await publish(envelope('fulfillment.canceled', SHIPMENTS[0]));
			await publish(envelope('fulfillment.canceled', SHIPMENTS[3]));

			expect((await delivered(stream)).map((row) => row.id)).toEqual(['shipment-b']);
		});

		it('narrows by shipment, by order and by action, and only narrows', async () => {
			const byShipment = subscribe(TENANT_A, ORG_A, () => resolver.fulfillmentChanged('shipment-a-2'));
			const byOrder = subscribe(TENANT_A, ORG_A, () => resolver.fulfillmentChanged(undefined, 'order-a'));
			const byAction = subscribe(TENANT_A, ORG_A, () => resolver.fulfillmentChanged(undefined, undefined, 'delivered'));

			await publish(envelope('fulfillment.shipped', SHIPMENTS[0]));
			await publish(envelope('fulfillment.shipped', SHIPMENTS[1]));
			await publish(envelope('fulfillment.delivered', SHIPMENTS[1]));

			expect((await delivered(byShipment)).map((row) => row.id)).toEqual(['shipment-a-2', 'shipment-a-2']);
			expect((await delivered(byOrder)).map((row) => row.id)).toEqual(['shipment-a']);
			expect((await delivered(byAction)).map((row) => row.id)).toEqual(['shipment-a-2']);
		});

		it('follows every shipment fact the package streams, and no other', async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.fulfillmentChanged());

			for (const name of FULFILLMENT_STREAMED_EVENTS) await publish(envelope(name, SHIPMENTS[0]));
			await publish(envelope('fulfillment.updated', SHIPMENTS[0])); // not a streamed shipment fact

			expect(await delivered(stream)).toHaveLength(FULFILLMENT_STREAMED_EVENTS.length);
		});
	});

	describe('fulfillmentCreated', () => {
		it("delivers its own tenant's new shipment and nothing of another tenant or organization", async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.fulfillmentCreated());

			await publish(envelope('fulfillment.created', SHIPMENTS[3])); // tenant B
			await publish(envelope('fulfillment.created', SHIPMENTS[3]), TENANT_A); // tenant B, mis-published onto A's topic
			await publish(envelope('fulfillment.created', SHIPMENTS[2])); // tenant A, organization A2
			await publish(envelope('fulfillment.created', SHIPMENTS[0])); // tenant A, organization A

			expect((await delivered(stream)).map((row) => row.id)).toEqual(['shipment-a']);
		});

		it('rides `fulfillment.created` only: a later move is not a creation', async () => {
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.fulfillmentCreated());

			await publish(envelope('fulfillment.shipped', SHIPMENTS[0]));
			await publish(envelope('fulfillment.delivered', SHIPMENTS[0]));
			await publish(envelope('fulfillment.created', SHIPMENTS[1]));

			expect((await delivered(stream)).map((row) => row.id)).toEqual(['shipment-a-2']);
		});

		it('narrows by order and by location, compared on the re-read row', async () => {
			const byOrder = subscribe(TENANT_A, ORG_A, () => resolver.fulfillmentCreated('order-a-2'));
			const byLocation = subscribe(TENANT_A, ORG_A, () => resolver.fulfillmentCreated(undefined, 'wh-1'));

			await publish(envelope('fulfillment.created', SHIPMENTS[0]));
			// The payload claims another order; the row says otherwise, and the row is what is compared.
			await publish(envelope('fulfillment.created', SHIPMENTS[1], { data: { orderId: 'order-a' } }));

			expect((await delivered(byOrder)).map((row) => row.id)).toEqual(['shipment-a-2']);
			expect((await delivered(byLocation)).map((row) => row.id)).toEqual(['shipment-a']);
		});
	});

	it('refuses to open either stream for a caller with no tenant', () => {
		expect(() => RequestContext.runWithRequest({ user: undefined } as never, () => resolver.fulfillmentChanged())).toThrow(
			/no tenant/
		);
		expect(() => RequestContext.runWithRequest({ user: undefined } as never, () => resolver.fulfillmentCreated())).toThrow(
			/no tenant/
		);
	});

	it('carries the fulfilment queries’ gates and delivers its payload as is', () => {
		for (const handler of [
			FulfillmentSubscriptionResolver.prototype.fulfillmentChanged,
			FulfillmentSubscriptionResolver.prototype.fulfillmentCreated
		]) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual([FULFILLMENT_PERMISSIONS.FULFILLMENTS_VIEW]);
			expect(Reflect.getMetadata(SUBSCRIPTION_OPTIONS_METADATA, handler)).toEqual(
				expect.objectContaining({ resolve: deliverPayloadAsIs })
			);
		}
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, FulfillmentSubscriptionResolver)).toEqual([
			FULFILLMENT_PERMISSIONS.FULFILLMENTS_VIEW
		]);
		expect(featureFlagsOf(Reflect.getMetadata(FEATURE_METADATA, FulfillmentSubscriptionResolver))).toEqual([FEATURE_GRAPHQL]);
		const guards = (Reflect.getMetadata('__guards__', FulfillmentSubscriptionResolver) ?? []).map(
			(guard: Function) => guard.name
		);
		expect(guards).toEqual(['TenantPermissionGuard', 'PermissionGuard', 'FeatureFlagGuard']);
	});

	it('is registered with the package’s resolvers, and the schema declares both fields', () => {
		// Read as source: the barrel loads every resolver of the package, and their bases are the kernel's.
		const barrel = readFileSync(join(__dirname, 'index.ts'), 'utf8');
		expect(barrel).toMatch(/export const fulfillmentResolvers = \[[^\]]*\bFulfillmentSubscriptionResolver\b[^\]]*\]/);

		const fields = fulfillmentSchemaExtensions.definitions
			.filter(
				(definition): definition is ObjectTypeExtensionNode =>
					definition.kind === Kind.OBJECT_TYPE_EXTENSION && definition.name.value === 'Subscription'
			)
			.flatMap((definition) => [...(definition.fields ?? [])]);
		const signature = (name: string) => {
			const field = fields.find((candidate) => candidate.name.value === name);
			return field && [
				...(field.arguments ?? []).map((argument) => `${argument.name.value}: ${print(argument.type)}`),
				`=> ${print(field.type)}`
			];
		};

		expect(signature('fulfillmentCreated')).toEqual(['orderId: ID', 'warehouseId: ID', '=> Fulfillment!']);
		expect(signature('fulfillmentChanged')).toEqual(['fulfillmentId: ID', 'orderId: ID', 'action: String', '=> Fulfillment!']);
	});
});
