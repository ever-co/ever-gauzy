import '../core/entities/internal';

import { AsyncLocalStorage } from 'async_hooks';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { buildSchema, GraphQLObjectType, printType } from 'graphql';
import { SUBSCRIPTION_OPTIONS_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { featureFlagsOf } from '@gauzy/common';
import { RequestContext } from '../core/context/request-context';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { deliverPayloadAsIs } from '../graphql/subscriptions/plugin-subscription';
import { IntegrationTenantSyncResolver } from './integration-tenant-sync.resolver';
import { INTEGRATION_TENANT_SYNCED } from './integration-tenant-sync.service';

/**
 * The integration stream (`integrationSyncCompleted`), held to the subscriber's tenant and organization.
 *
 * The fact reaches the field the way it does in the running API: the outbox consumer publishes each appended
 * `integration_tenant.synced` event on `integration_tenant.synced:<tenantId>` of `GraphqlPubSub`, and the field
 * follows that topic. The cases publish envelopes on the real `GraphqlPubSub` — on another tenant's topic,
 * mis-published onto the subscriber's topic while naming another tenant, of another organization, and of the
 * subscriber's own — and assert the subscriber hears its own and nothing else. `IntegrationTenantService` is doubled
 * with the scoping its tenant-aware read performs: the criteria it is handed, and the caller's tenant.
 *
 * The producer half — the stamp and the fact in one transaction — is held by `integration-tenant-sync.service.spec.ts`.
 */

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ORG_A = 'organization-a';
const ORG_A2 = 'organization-a2';

const CONNECTIONS = [
	{ id: 'connection-a', name: 'GITHUB', tenantId: TENANT_A, organizationId: ORG_A, lastSyncedAt: new Date(1) },
	{ id: 'connection-a-hubstaff', name: 'HUBSTAFF', tenantId: TENANT_A, organizationId: ORG_A, lastSyncedAt: new Date(2) },
	{ id: 'connection-a2', name: 'GITHUB', tenantId: TENANT_A, organizationId: ORG_A2, lastSyncedAt: new Date(3) },
	{ id: 'connection-b', name: 'GITHUB', tenantId: TENANT_B, organizationId: 'organization-b', lastSyncedAt: new Date(4) }
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
const delivered = async (iterator: AsyncIterator<unknown>, quietMs = 100): Promise<any[]> => {
	const values: any[] = [];
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

/** The envelope the outbox consumer publishes for one appended sync fact. */
const envelope = (connection: (typeof CONNECTIONS)[number], overrides: Record<string, unknown> = {}) => ({
	eventId: `${INTEGRATION_TENANT_SYNCED}:${connection.id}`,
	name: INTEGRATION_TENANT_SYNCED,
	occurredAt: new Date(0),
	tenantId: connection.tenantId,
	organizationId: connection.organizationId,
	aggregate: { type: 'INTEGRATION_TENANT', id: connection.id },
	data: { integrationTenantId: connection.id, name: connection.name, syncedAt: connection.lastSyncedAt, counts: { issue: 3 } },
	...overrides
});

describe('the integration sync subscription, scoped to the subscriber', () => {
	const originalClsService = RequestContext['clsService'];
	let pubSub: GraphqlPubSub;
	let reads: string[];
	let resolver: IntegrationTenantSyncResolver;

	beforeAll(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	beforeEach(() => {
		pubSub = new GraphqlPubSub();
		reads = [];
		const integrationTenantService = {
			findOneOrFailByWhereOptions: jest.fn(async (where: Record<string, string>) => {
				const tenantId = RequestContext.currentTenantId();
				reads.push(`${where.id}@${tenantId}/${where.organizationId}`);
				const row = CONNECTIONS.find(
					(candidate) =>
						candidate.id === where.id &&
						candidate.tenantId === tenantId &&
						candidate.tenantId === where.tenantId &&
						(!where.organizationId || candidate.organizationId === where.organizationId)
				);
				if (!row) return { success: false, error: new NotFoundException('The requested record was not found') };
				return { success: true, record: { ...row } };
			})
		};
		resolver = new IntegrationTenantSyncResolver(integrationTenantService as never, pubSub);
	});

	afterEach(() => pubSub.onModuleDestroy());

	/** Publishes as the outbox consumer does: on the topic of the tenant the envelope states, unless told otherwise. */
	const publish = async (event: ReturnType<typeof envelope>, topicTenant: string = String(event.tenantId)) =>
		await pubSub.publish(event.name, topicTenant, event);

	it("delivers its own tenant's finished run with the connection re-read as the subscriber, and nothing of another tenant", async () => {
		const stream = subscribe(TENANT_A, ORG_A, () => resolver.integrationSyncCompleted());

		await publish(envelope(CONNECTIONS[3])); // tenant B, on B's topic
		await publish(envelope(CONNECTIONS[3]), TENANT_A); // tenant B, mis-published onto A's topic
		await publish(envelope(CONNECTIONS[0], { tenantId: undefined }), TENANT_A); // states no tenant
		await publish(envelope(CONNECTIONS[0])); // tenant A, organization A

		const values = await delivered(stream);
		expect(values).toEqual([
			expect.objectContaining({
				integrationTenant: expect.objectContaining({ id: 'connection-a' }),
				name: 'GITHUB',
				syncedAt: CONNECTIONS[0].lastSyncedAt,
				counts: { issue: 3 }
			})
		]);
		expect(reads).toEqual([`connection-a@${TENANT_A}/${ORG_A}`]);
	});

	it('delivers nothing of another organization of the same tenant to a subscriber acting in one', async () => {
		const stream = subscribe(TENANT_A, ORG_A, () => resolver.integrationSyncCompleted());

		await publish(envelope(CONNECTIONS[2]));
		await publish(envelope(CONNECTIONS[2], { organizationId: undefined }));

		expect(await delivered(stream)).toEqual([]);
	});

	it("tenant B's subscriber does hear tenant B's run — the control for the negative cases", async () => {
		const stream = subscribe(TENANT_B, 'organization-b', () => resolver.integrationSyncCompleted());

		await publish(envelope(CONNECTIONS[0]));
		await publish(envelope(CONNECTIONS[3]));

		expect((await delivered(stream)).map((value) => value.integrationTenant.id)).toEqual(['connection-b']);
	});

	it('narrows by connection and by provider, the provider compared on the re-read row', async () => {
		const byConnection = subscribe(TENANT_A, ORG_A, () => resolver.integrationSyncCompleted('connection-a-hubstaff'));
		const byProvider = subscribe(TENANT_A, ORG_A, () => resolver.integrationSyncCompleted(undefined, 'GITHUB'));

		await publish(envelope(CONNECTIONS[0]));
		// The payload claims GitHub; the connection is Hubstaff's, and the connection is what is compared.
		await publish(envelope(CONNECTIONS[1], { data: { name: 'GITHUB', counts: {} } }));

		expect((await delivered(byConnection)).map((value) => value.integrationTenant.id)).toEqual(['connection-a-hubstaff']);
		expect((await delivered(byProvider)).map((value) => value.integrationTenant.id)).toEqual(['connection-a']);
	});

	it('refuses to open a stream for a caller with no tenant', () => {
		expect(() =>
			RequestContext.runWithRequest({ user: undefined } as never, () => resolver.integrationSyncCompleted())
		).toThrow(/no tenant/);
	});

	it('carries the connection queries’ gates and delivers its payload as is', () => {
		const handler = IntegrationTenantSyncResolver.prototype.integrationSyncCompleted;

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual([PermissionsEnum.INTEGRATION_VIEW]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationTenantSyncResolver)).toEqual([PermissionsEnum.INTEGRATION_VIEW]);
		expect(featureFlagsOf(Reflect.getMetadata(FEATURE_METADATA, IntegrationTenantSyncResolver))).toEqual([FEATURE_GRAPHQL]);
		expect(Reflect.getMetadata(SUBSCRIPTION_OPTIONS_METADATA, handler)).toEqual(
			expect.objectContaining({ resolve: deliverPayloadAsIs })
		);
		const guards = (Reflect.getMetadata('__guards__', IntegrationTenantSyncResolver) ?? []).map(
			(guard: Function) => guard.name
		);
		expect(guards).toEqual(['TenantPermissionGuard', 'PermissionGuard', 'FeatureFlagGuard']);
	});

	it('is a provider of the connection module, and the kernel schema declares the field and its type', () => {
		const module = readFileSync(join(__dirname, 'integration-tenant.module.ts'), 'utf8');
		expect(module).toMatch(/providers:\s*\[[^\]]*\bIntegrationTenantSyncResolver\b[^\]]*\]/);

		// Every kernel document the loader globs, composed the way the boot composes them.
		const documents: string[] = [];
		const walk = (directory: string): void => {
			for (const entry of readdirSync(directory, { withFileTypes: true })) {
				const path = join(directory, entry.name);
				if (entry.isDirectory()) walk(path);
				else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) documents.push(readFileSync(path, 'utf8'));
			}
		};
		walk(join(__dirname, '..'));
		const schema = buildSchema(documents.join('\n'));

		const field = schema.getSubscriptionType()?.getFields()['integrationSyncCompleted'];
		expect(field && field.args.map((argument) => `${argument.name}: ${argument.type}`)).toEqual([
			'integrationTenantId: ID',
			'name: String'
		]);
		expect(field && String(field.type)).toBe('IntegrationSyncCompleted!');
		expect(printType(schema.getType('IntegrationSyncCompleted') as GraphQLObjectType)).toContain(
			'integrationTenant: IntegrationTenant!'
		);
	});
});
