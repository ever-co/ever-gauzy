/**
 * The licence-key stream (`entitlementKeyChanged`), held to the subscriber's tenant and organization.
 *
 * The facts reach the field the way they do in the running API: the outbox consumer publishes each appended
 * `entitlement_key.*` event on `<event>:<tenantId>` of `GraphqlPubSub`, and the field follows those topics. The cases
 * publish envelopes on the real `GraphqlPubSub` — on another tenant's topic, mis-published onto the subscriber's
 * topic while naming another tenant, of another organization, and of the subscriber's own — and assert the
 * subscriber hears its own and nothing else.
 *
 * **The kernel is the real one where isolation lives** (`tenantScopedTopicStream`, `GraphqlPubSub`,
 * `RequestContext` over a real CLS store, the permission and feature decorators); the rest of `@gauzy/core` is
 * doubled at the module boundary. `EntitlementKeyService` is doubled with the scoping its `findOneScoped` performs:
 * the caller's tenant and organization from `RequestContext`.
 *
 * The producer half — `entitlement_key.revoked` appended inside the revocation's own transaction, once, and rolled
 * back with it — is held by `entitlement-key.service.spec.ts` ("writes one revocation event …", "is idempotent …")
 * and `entitlement-lifecycle.dual-orm.spec.ts` ("rolls a transition back with its event …", "reissues a key …").
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

jest.mock('../../entitlement-key/entitlement-key.service', () => ({ EntitlementKeyService: class EntitlementKeyService {} }));
jest.mock('../../entitlement-key/entitlement-key.entity', () => ({ EntitlementKey: class EntitlementKey {} }));

import { AsyncLocalStorage } from 'async_hooks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClsService } from 'nestjs-cls';
import { Kind, ObjectTypeExtensionNode, print } from 'graphql';
import { SUBSCRIPTION_OPTIONS_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { featureFlagsOf } from '@gauzy/common';
import { FEATURE_GRAPHQL, GraphqlPubSub, RequestContext, deliverPayloadAsIs } from '@gauzy/core';
import { EntitlementFeatures } from '../../entitlement.features';
import { EntitlementPermissions } from '../../entitlement.permissions';
import { schemaExtensions } from '../schema-extensions';
import { ENTITLEMENT_KEY_STREAM_NAMES, EntitlementKeySubscriptionResolver } from './entitlement-key-subscription.resolver';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ORG_A = 'organization-a';
const ORG_A2 = 'organization-a2';

/** The keys the doubled service holds, one per tenant and organization. */
const KEYS = [
	{ id: 'key-a', tenantId: TENANT_A, organizationId: ORG_A, entitlementId: 'right-a', status: 'REVOKED', keyPrefix: 'AAAA' },
	{ id: 'key-a-2', tenantId: TENANT_A, organizationId: ORG_A, entitlementId: 'right-a-2', status: 'REVOKED', keyPrefix: 'AAAB' },
	{ id: 'key-a2', tenantId: TENANT_A, organizationId: ORG_A2, entitlementId: 'right-a2', status: 'REVOKED', keyPrefix: 'AAAC' },
	{ id: 'key-b', tenantId: TENANT_B, organizationId: 'organization-b', entitlementId: 'right-b', status: 'REVOKED', keyPrefix: 'BBBB' }
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

/** The envelope the outbox consumer publishes for one appended key event. */
const envelope = (name: string, key: (typeof KEYS)[number], overrides: Record<string, unknown> = {}) => ({
	eventId: `${name}:${key.id}`,
	name,
	occurredAt: new Date(0),
	tenantId: key.tenantId,
	organizationId: key.organizationId,
	aggregate: { type: 'ENTITLEMENT_KEY', id: key.id },
	data: { keyId: key.id, entitlementId: key.entitlementId, keyPrefix: key.keyPrefix },
	...overrides
});

describe('the licence-key subscription, scoped to the subscriber', () => {
	const originalClsService = RequestContext['clsService'];
	let pubSub: GraphqlPubSub;
	let reads: string[];
	let resolver: EntitlementKeySubscriptionResolver;

	beforeAll(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	beforeEach(() => {
		pubSub = new GraphqlPubSub();
		reads = [];
		// `findOneScoped` reads `{ id, tenantId, organizationId }` from `RequestContext`, so the double does too: the
		// read runs as the subscriber, never as the publisher.
		const entitlementKeyService = {
			findOneScoped: jest.fn(async (id: string) => {
				const tenantId = RequestContext.currentTenantId();
				const organizationId = RequestContext.currentOrganizationId();
				reads.push(`${id}@${tenantId}/${organizationId}`);
				const row = KEYS.find(
					(candidate) =>
						candidate.id === id &&
						candidate.tenantId === tenantId &&
						(!organizationId || candidate.organizationId === organizationId)
				);
				if (!row) throw new Error('The licence key was not found.');
				return { ...row };
			})
		};
		resolver = new EntitlementKeySubscriptionResolver(entitlementKeyService as never, pubSub);
	});

	afterEach(() => pubSub.onModuleDestroy());

	/** Publishes as the outbox consumer does: on the topic of the tenant the envelope states, unless told otherwise. */
	const publish = async (event: ReturnType<typeof envelope>, topicTenant: string = String(event.tenantId)) =>
		await pubSub.publish(event.name, topicTenant, event);

	it("delivers its own tenant's withdrawn key, re-read as the subscriber, and nothing of another tenant", async () => {
		const stream = subscribe(TENANT_A, ORG_A, () => resolver.entitlementKeyChanged());

		await publish(envelope('entitlement_key.revoked', KEYS[3])); // tenant B, on B's topic
		await publish(envelope('entitlement_key.revoked', KEYS[3]), TENANT_A); // tenant B, mis-published onto A's topic
		await publish(envelope('entitlement_key.revoked', KEYS[0], { tenantId: undefined }), TENANT_A); // states no tenant
		await publish(envelope('entitlement_key.revoked', KEYS[0])); // tenant A, organization A

		expect((await delivered(stream)).map((row) => row.id)).toEqual(['key-a']);
		expect(reads).toEqual([`key-a@${TENANT_A}/${ORG_A}`]);
	});

	it('delivers nothing of another organization of the same tenant to a subscriber acting in one', async () => {
		const stream = subscribe(TENANT_A, ORG_A, () => resolver.entitlementKeyChanged());

		await publish(envelope('entitlement_key.revoked', KEYS[2])); // tenant A, organization A2
		await publish(envelope('entitlement_key.revoked', KEYS[2], { organizationId: undefined }));

		expect(await delivered(stream)).toEqual([]);
	});

	it("tenant B's subscriber does hear tenant B's withdrawal — the control for the negative cases", async () => {
		const stream = subscribe(TENANT_B, 'organization-b', () => resolver.entitlementKeyChanged());

		await publish(envelope('entitlement_key.revoked', KEYS[0]));
		await publish(envelope('entitlement_key.revoked', KEYS[3]));

		expect((await delivered(stream)).map((row) => row.id)).toEqual(['key-b']);
	});

	it('narrows by key and by right, and only narrows', async () => {
		const byKey = subscribe(TENANT_A, ORG_A, () => resolver.entitlementKeyChanged('key-a-2'));
		const byRight = subscribe(TENANT_A, ORG_A, () => resolver.entitlementKeyChanged(undefined, 'right-a'));

		await publish(envelope('entitlement_key.revoked', KEYS[0]));
		await publish(envelope('entitlement_key.revoked', KEYS[1]));

		expect((await delivered(byKey)).map((row) => row.id)).toEqual(['key-a-2']);
		expect((await delivered(byRight)).map((row) => row.id)).toEqual(['key-a']);
	});

	it('follows the streamed key facts only — never the withheld issuance, whose payload names the holder', async () => {
		expect(ENTITLEMENT_KEY_STREAM_NAMES).toEqual(['entitlement_key.revoked']);

		const stream = subscribe(TENANT_A, ORG_A, () => resolver.entitlementKeyChanged());

		await publish(envelope('entitlement_key.issued', KEYS[0], { data: { assignedToEmail: 'buyer@example.com' } }));
		await publish(envelope('entitlement.revoked', KEYS[0])); // the right's fact, not the key's
		await publish(envelope('entitlement_key.revoked', KEYS[1]));

		expect((await delivered(stream)).map((row) => row.id)).toEqual(['key-a-2']);
	});

	it('refuses to open a stream for a caller with no tenant', () => {
		expect(() =>
			RequestContext.runWithRequest({ user: undefined } as never, () => resolver.entitlementKeyChanged())
		).toThrow(/no tenant/);
	});

	it('carries the key queries’ gates and delivers its payload as is', () => {
		const handler = EntitlementKeySubscriptionResolver.prototype.entitlementKeyChanged;

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual([EntitlementPermissions.ENTITLEMENTS_VIEW]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EntitlementKeySubscriptionResolver)).toEqual([
			EntitlementPermissions.ENTITLEMENTS_VIEW
		]);
		expect(featureFlagsOf(Reflect.getMetadata(FEATURE_METADATA, EntitlementKeySubscriptionResolver)).sort()).toEqual(
			[FEATURE_GRAPHQL, EntitlementFeatures.ENTITLEMENT].sort()
		);
		expect(Reflect.getMetadata(SUBSCRIPTION_OPTIONS_METADATA, handler)).toEqual(
			expect.objectContaining({ resolve: deliverPayloadAsIs })
		);
		const guards = (Reflect.getMetadata('__guards__', EntitlementKeySubscriptionResolver) ?? []).map(
			(guard: Function) => guard.name
		);
		expect(guards).toEqual(['TenantPermissionGuard', 'PermissionGuard', 'FeatureFlagGuard']);
	});

	it('is registered with the package’s resolvers, and the schema declares the field', () => {
		// Read as source: the barrel loads every resolver of the package, and their bases are the kernel's.
		const barrel = readFileSync(join(__dirname, 'index.ts'), 'utf8');
		expect(barrel).toMatch(/export const resolvers = \[[^\]]*\bEntitlementKeySubscriptionResolver\b[^\]]*\]/);

		const field = schemaExtensions.definitions
			.filter(
				(definition): definition is ObjectTypeExtensionNode =>
					definition.kind === Kind.OBJECT_TYPE_EXTENSION && definition.name.value === 'Subscription'
			)
			.flatMap((definition) => [...(definition.fields ?? [])])
			.find((candidate) => candidate.name.value === 'entitlementKeyChanged');

		expect(field && (field.arguments ?? []).map((argument) => `${argument.name.value}: ${print(argument.type)}`)).toEqual([
			'entitlementKeyId: ID',
			'entitlementId: ID'
		]);
		expect(field && print(field.type)).toBe('EntitlementKey!');
	});
});
