/**
 * The recurring-billing stream (`customerSubscriptionChanged`), held to the subscriber's tenant and organization.
 *
 * The facts reach the field the way they do in the running API: the outbox consumer publishes each appended
 * `subscription.*` event on `<event>:<tenantId>` of `GraphqlPubSub`, and the field follows those topics. The cases
 * publish envelopes on the real `GraphqlPubSub` — on another tenant's topic, mis-published onto the subscriber's
 * topic while naming another tenant, of another organization, and of the subscriber's own — and assert the
 * subscriber hears its own and nothing else.
 *
 * **The kernel is the real one where isolation lives** (`tenantScopedTopicStream`, `GraphqlPubSub`,
 * `RequestContext` over a real CLS store, the permission and feature decorators); the rest of `@gauzy/core` is
 * doubled at the module boundary. `SubscriptionService` is doubled with the scoping its `findOneDetailed` performs:
 * the caller's tenant and organization from `RequestContext` (`subscription.scope.ts`).
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

jest.mock('../../subscription/subscription.service', () => ({ SubscriptionService: class SubscriptionService {} }));
jest.mock('../../subscription/subscription.entity', () => ({ Subscription: class Subscription {} }));

import { AsyncLocalStorage } from 'async_hooks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClsService } from 'nestjs-cls';
import { Kind, ObjectTypeExtensionNode, print } from 'graphql';
import { SUBSCRIPTION_OPTIONS_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { featureFlagsOf } from '@gauzy/common';
import { FEATURE_GRAPHQL, GraphqlPubSub, RequestContext, deliverPayloadAsIs } from '@gauzy/core';
import { SubscriptionFeatures } from '../../subscription.features';
import { SubscriptionPermissions } from '../../subscription.permissions';
import { SUBSCRIPTION_STREAMED_EVENTS } from '../../subscription-streamed-events';
import { schemaExtensions } from '../schema-extensions';
import { CustomerSubscriptionStreamResolver } from './customer-subscription-stream.resolver';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ORG_A = 'organization-a';
const ORG_A2 = 'organization-a2';

/** The subscriptions the doubled service holds, one per tenant and organization. */
const SUBSCRIPTIONS = [
	{ id: 'sub-a', tenantId: TENANT_A, organizationId: ORG_A, customerId: 'customer-a', status: 'ACTIVE' },
	{ id: 'sub-a-2', tenantId: TENANT_A, organizationId: ORG_A, customerId: 'customer-a-2', status: 'ACTIVE' },
	{ id: 'sub-a2', tenantId: TENANT_A, organizationId: ORG_A2, customerId: 'customer-a2', status: 'ACTIVE' },
	{ id: 'sub-b', tenantId: TENANT_B, organizationId: 'organization-b', customerId: 'customer-b', status: 'ACTIVE' }
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
const delivered = async (iterator: AsyncIterator<unknown>, quietMs = 100): Promise<{ id: string }[]> => {
	const values: { id: string }[] = [];
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

/** The envelope the outbox consumer publishes for one appended subscription event. */
const envelope = (name: string, row: (typeof SUBSCRIPTIONS)[number], overrides: Record<string, unknown> = {}) => ({
	eventId: `${name}:${row.id}`,
	name,
	occurredAt: new Date(0),
	tenantId: row.tenantId,
	organizationId: row.organizationId,
	aggregate: { type: 'SUBSCRIPTION', id: row.id },
	data: { subscriptionId: row.id },
	...overrides
});

describe('the recurring-billing subscription, scoped to the subscriber', () => {
	const originalClsService = RequestContext['clsService'];
	let pubSub: GraphqlPubSub;
	let reads: string[];
	let resolver: CustomerSubscriptionStreamResolver;

	beforeAll(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	beforeEach(() => {
		pubSub = new GraphqlPubSub();
		reads = [];
		// `findOneDetailed` reads `{ id, ...currentScope() }`, so the double does too: the read runs as the subscriber,
		// never as the publisher.
		const subscriptionService = {
			findOneDetailed: jest.fn(async (id: string) => {
				const tenantId = RequestContext.currentTenantId();
				const organizationId = RequestContext.currentOrganizationId();
				reads.push(`${id}@${tenantId}/${organizationId}`);
				const row = SUBSCRIPTIONS.find(
					(candidate) =>
						candidate.id === id &&
						(!tenantId || candidate.tenantId === tenantId) &&
						(!organizationId || candidate.organizationId === organizationId)
				);
				if (!row) throw new Error('The subscription was not found.');
				return { ...row, items: [], billings: [] };
			})
		};
		resolver = new CustomerSubscriptionStreamResolver(subscriptionService as never, pubSub);
	});

	afterEach(() => pubSub.onModuleDestroy());

	/** Publishes as the outbox consumer does: on the topic of the tenant the envelope states, unless told otherwise. */
	const publish = async (event: ReturnType<typeof envelope>, topicTenant: string = String(event.tenantId)) =>
		await pubSub.publish(event.name, topicTenant, event);

	it("delivers its own tenant's move, re-read as the subscriber, and nothing of another tenant", async () => {
		const stream = subscribe(TENANT_A, ORG_A, () => resolver.customerSubscriptionChanged());

		await publish(envelope('subscription.paused', SUBSCRIPTIONS[3])); // tenant B, on B's topic
		await publish(envelope('subscription.paused', SUBSCRIPTIONS[3]), TENANT_A); // tenant B, mis-published onto A's topic
		await publish(envelope('subscription.paused', SUBSCRIPTIONS[0], { tenantId: undefined }), TENANT_A); // states no tenant
		await publish(envelope('subscription.renewed', SUBSCRIPTIONS[0])); // tenant A, organization A

		expect((await delivered(stream)).map((row) => row.id)).toEqual(['sub-a']);
		expect(reads).toEqual([`sub-a@${TENANT_A}/${ORG_A}`]);
	});

	it('delivers nothing of another organization of the same tenant to a subscriber acting in one', async () => {
		const stream = subscribe(TENANT_A, ORG_A, () => resolver.customerSubscriptionChanged());

		await publish(envelope('subscription.canceled', SUBSCRIPTIONS[2])); // tenant A, organization A2
		await publish(envelope('subscription.canceled', SUBSCRIPTIONS[2], { organizationId: undefined }));

		expect(await delivered(stream)).toEqual([]);
	});

	it("tenant B's subscriber does hear tenant B's move — the control for the negative cases", async () => {
		const stream = subscribe(TENANT_B, 'organization-b', () => resolver.customerSubscriptionChanged());

		await publish(envelope('subscription.expired', SUBSCRIPTIONS[0]));
		await publish(envelope('subscription.expired', SUBSCRIPTIONS[3]));

		expect((await delivered(stream)).map((row) => row.id)).toEqual(['sub-b']);
	});

	it('narrows by subscription, by customer and by action — a kebab-case one included — and only narrows', async () => {
		const bySubscription = subscribe(TENANT_A, ORG_A, () => resolver.customerSubscriptionChanged('sub-a-2'));
		const byCustomer = subscribe(TENANT_A, ORG_A, () => resolver.customerSubscriptionChanged(undefined, 'customer-a'));
		const byAction = subscribe(TENANT_A, ORG_A, () =>
			resolver.customerSubscriptionChanged(undefined, undefined, 'payment-failed')
		);

		await publish(envelope('subscription.activated', SUBSCRIPTIONS[0]));
		await publish(envelope('subscription.activated', SUBSCRIPTIONS[1]));
		await publish(envelope('subscription.payment-failed', SUBSCRIPTIONS[1]));

		expect((await delivered(bySubscription)).map((row) => row.id)).toEqual(['sub-a-2', 'sub-a-2']);
		expect((await delivered(byCustomer)).map((row) => row.id)).toEqual(['sub-a']);
		expect((await delivered(byAction)).map((row) => row.id)).toEqual(['sub-a-2']);
	});

	it('follows every recurring-billing fact the package streams, and no other', async () => {
		const stream = subscribe(TENANT_A, ORG_A, () => resolver.customerSubscriptionChanged());

		for (const name of SUBSCRIPTION_STREAMED_EVENTS) await publish(envelope(name, SUBSCRIPTIONS[0]));
		await publish(envelope('subscription.updated', SUBSCRIPTIONS[0])); // not a streamed fact

		expect(await delivered(stream)).toHaveLength(SUBSCRIPTION_STREAMED_EVENTS.length);
	});

	it('refuses to open a stream for a caller with no tenant', () => {
		expect(() =>
			RequestContext.runWithRequest({ user: undefined } as never, () => resolver.customerSubscriptionChanged())
		).toThrow(/no tenant/);
	});

	it('carries the subscription queries’ gates and delivers its payload as is', () => {
		const handler = CustomerSubscriptionStreamResolver.prototype.customerSubscriptionChanged;

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual([SubscriptionPermissions.SUBSCRIPTIONS_VIEW]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CustomerSubscriptionStreamResolver)).toEqual([
			SubscriptionPermissions.SUBSCRIPTIONS_VIEW
		]);
		expect(featureFlagsOf(Reflect.getMetadata(FEATURE_METADATA, CustomerSubscriptionStreamResolver)).sort()).toEqual(
			[FEATURE_GRAPHQL, SubscriptionFeatures.SUBSCRIPTION].sort()
		);
		expect(Reflect.getMetadata(SUBSCRIPTION_OPTIONS_METADATA, handler)).toEqual(
			expect.objectContaining({ resolve: deliverPayloadAsIs })
		);
		const guards = (Reflect.getMetadata('__guards__', CustomerSubscriptionStreamResolver) ?? []).map(
			(guard: Function) => guard.name
		);
		expect(guards).toEqual(['TenantPermissionGuard', 'PermissionGuard', 'FeatureFlagGuard']);
	});

	it('is registered with the package’s resolvers, and the schema declares the field', () => {
		// Read as source: the barrel loads every resolver of the package, and their bases are the kernel's.
		const barrel = readFileSync(join(__dirname, 'index.ts'), 'utf8');
		expect(barrel).toMatch(/export const resolvers = \[[^\]]*\bCustomerSubscriptionStreamResolver\b[^\]]*\]/);

		const field = schemaExtensions.definitions
			.filter(
				(definition): definition is ObjectTypeExtensionNode =>
					definition.kind === Kind.OBJECT_TYPE_EXTENSION && definition.name.value === 'Subscription'
			)
			.flatMap((definition) => [...(definition.fields ?? [])])
			.find((candidate) => candidate.name.value === 'customerSubscriptionChanged');

		expect(field && (field.arguments ?? []).map((argument) => `${argument.name.value}: ${print(argument.type)}`)).toEqual([
			'subscriptionId: ID',
			'customerId: ID',
			'action: String'
		]);
		expect(field && print(field.type)).toBe('CustomerSubscription!');
	});
});
