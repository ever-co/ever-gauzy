// cspell:ignore evit
/**
 * Test-only harness for the counterparty check and discoverability: the plugin's services on an
 * in-memory SQLite database (with the real migrations), talking through the real SDK client (which
 * checks every request body against the SDK's request schemas before it is sent) to the recording
 * stand-in for Ever Platform of the identity harness. Excluded from the library build.
 */
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverConnectAuditService } from '../ever-connect-audit.service';
import { readEverConnectConfig } from '../ever-connect-config';
import { EverConnectDiscoverableService } from '../ever-connect-discoverable.service';
import { EverConnectIntegrationStateService } from '../ever-connect-integration-state.service';
import { EverConnectLookupService } from '../ever-connect-lookup.service';
import { EverConnectSignals } from '../ever-connect-signals';
import { EverConnectStore, LinkRecord } from '../ever-connect.store';
import { IntegrationHandlerRegistry } from '../integrations/integration-handler.registry';
import { createEverPlatformClient } from '../sdk';
import { FakePlatform, INSTANCE_ID, testSigner } from './identity-harness';
import { createCoreTables, insert, migrateUp, openTestDataSource, seedTenant, SeededTenant } from './test-db';

export const LINK_ID = '01JNE7V9J03J6XQ2WN8H0Z8XYZ';
export const LOOKUP_ENV = { ENCRYPTION_KEY: 'lookup-spec-encryption-key-0123456789abcdef' };

/** The two salts the stand-in publishes: version 1 (active), and version 2 once a rotation starts. */
export const SALT_V1 = createHash('sha256').update('lookup-spec-salt-1').digest().toString('base64url');
export const SALT_V2 = createHash('sha256').update('lookup-spec-salt-2').digest().toString('base64url');

export const SALT_PATH = 'GET /v1/lookup/salt';
export const LOOKUP_PATH = 'POST /v1/lookup';
export const IDENTIFIERS_PUT = `PUT /v1/instances/me/tenant-links/${LINK_ID}/identifiers`;
export const IDENTIFIERS_DELETE = `DELETE /v1/instances/me/tenant-links/${LINK_ID}/identifiers`;
export const INTEGRATIONS_GET = 'GET /v1/instances/me/integrations';
export const INTEGRATION_PUT = (key: string) => `PUT /v1/instances/me/integrations/${key}`;

export interface LookupHarness {
	dataSource: DataSource;
	clock: { t: number; now(): number };
	platform: FakePlatform;
	store: EverConnectStore;
	audit: EverConnectAuditService;
	signals: EverConnectSignals;
	handlers: IntegrationHandlerRegistry;
	states: EverConnectIntegrationStateService;
	lookup: EverConnectLookupService;
	discoverable: EverConnectDiscoverableService;
	/** The features the organization's entitlement document grants (the harness stands in for it). */
	features: Record<string, boolean>;
	acme: SeededTenant;
	link: LinkRecord;
	scope: { tenantId: string; organizationId: string; userId: string; isOperator: boolean };
	/** Publishes these salts (`GET /v1/lookup/salt`). */
	publishSalts(salts: Array<{ version: number; salt: string; active_from?: string }>): void;
	/** Marks one integration of the link as Ever Platform reads it (enabled by a consent, or not). */
	setIntegration(key: string, enabled: boolean, state?: string): Promise<void>;
	auditRows(): Promise<Array<{ action: string; details: Record<string, unknown> }>>;
	close(): Promise<void>;
}

/**
 * The harness on a fresh in-memory database: connected, Acme's organization linked (`LINK_ID`), no
 * integration enabled; `options.register` false leaves the handlers unregistered (the release
 * before this one).
 */
export async function lookupHarness(
	options: { env?: Record<string, string>; register?: boolean } = {}
): Promise<LookupHarness> {
	const env = options.env ?? LOOKUP_ENV;
	const dataSource = await openTestDataSource({ name: 'better-sqlite3' });
	await createCoreTables(dataSource, 'better-sqlite3');
	await migrateUp(dataSource);
	const clock: { t: number; now(): number } = { t: Date.parse('2026-11-07T10:00:00.000Z'), now: () => clock.t };
	const platform = new FakePlatform();
	const client = createEverPlatformClient({
		baseUrl: 'https://api.ever.co',
		userAgentProduct: { product: 'gauzy', version: '0.0.0' },
		signer: testSigner(),
		registryInstanceId: () => INSTANCE_ID,
		fetch: platform.fetch as never,
		now: () => Math.floor(clock.now() / 1000)
	});
	const platformService = { getClient: async () => client };
	const store = new EverConnectStore(dataSource, clock);
	const audit = new EverConnectAuditService(dataSource, clock);
	const signals = new EverConnectSignals();
	const config = readEverConnectConfig(env);
	const handlers = new IntegrationHandlerRegistry();
	const features: Record<string, boolean> = { lookup: true, discoverability: true };
	const entitlements = { features: async () => ({ ladder: 'valid', features: { ...features } }) };
	const states = new EverConnectIntegrationStateService(
		platformService as never,
		store,
		audit,
		signals,
		{} as never,
		config,
		clock,
		undefined,
		undefined,
		handlers,
		entitlements as never
	);
	const lookup = new EverConnectLookupService(
		platformService as never,
		store,
		states,
		entitlements as never,
		audit,
		signals,
		handlers,
		clock
	);
	const discoverable = new EverConnectDiscoverableService(
		platformService as never,
		store,
		states,
		entitlements as never,
		lookup,
		audit,
		signals,
		handlers,
		env
	);
	if (options.register !== false) {
		lookup.onModuleInit();
		discoverable.onModuleInit();
	}

	const acme = await seedTenant(dataSource, 'better-sqlite3', 'Acme', '2026-01-01 00:00:00', 'ops@acme.example');
	await store.updateConnection({ status: 'connected', platformInstanceId: INSTANCE_ID, connectedAt: clock.now() });
	const integrationTenantId = await store.createLinkRecord(
		{ tenantId: acme.tenantId, organizationId: acme.organizationId },
		{ link_id: LINK_ID, ever_org_id: '01JNE7V9J03J6XQ2WN8H0Z8RGX', handle: 'acme' }
	);
	const link = await store.insertLink({
		tenantId: acme.tenantId,
		organizationId: acme.organizationId,
		integrationTenantId,
		linkId: LINK_ID,
		everOrgId: '01JNE7V9J03J6XQ2WN8H0Z8RGX',
		everHandle: 'acme',
		status: 'linked',
		entitlementJwsEncrypted: null,
		entitlementSeq: null,
		entitlementIat: null,
		entitlementExp: null,
		entitlementFetchedAt: null
	});

	const harness: LookupHarness = {
		dataSource,
		clock,
		platform,
		store,
		audit,
		signals,
		handlers,
		states,
		lookup,
		discoverable,
		features,
		acme,
		link,
		scope: {
			tenantId: acme.tenantId,
			organizationId: acme.organizationId,
			userId: acme.superAdminId,
			isOperator: true
		},
		publishSalts(salts) {
			platform.on(SALT_PATH, {
				status: 200,
				body: {
					active: salts.map((salt) => ({
						version: salt.version,
						salt: salt.salt,
						active_from: salt.active_from ?? '2026-11-01T00:00:00Z',
						retire_after: null
					})),
					normalization_version: 1,
					test_vectors_url: 'https://api.ever.co/v1/lookup/test-vectors'
				}
			});
		},
		async setIntegration(key, enabled, state) {
			await store.saveIntegration(
				LINK_ID,
				key,
				{
					state: state ?? (enabled ? 'enabled' : 'disabled'),
					enabled,
					consentId: enabled ? '01JD0000000000000000000CNS' : null
				},
				{ tenantId: acme.tenantId, organizationId: acme.organizationId, integrationTenantId }
			);
		},
		async auditRows() {
			const rows = (await dataSource.query(
				'SELECT "action", "details" FROM "ever_connect_audit" ORDER BY "at" ASC, rowid ASC'
			)) as Array<{ action: string; details: string | null }>;
			return rows.map((row) => ({ action: row.action, details: row.details ? JSON.parse(row.details) : {} }));
		},
		async close() {
			discoverable.onModuleDestroy();
			await dataSource.destroy();
		}
	};
	harness.publishSalts([{ version: 1, salt: SALT_V1 }]);
	return harness;
}

/** Sets the tax id of Acme's organization, and the country of its address. */
export async function setOrganizationIdentifiers(
	h: LookupHarness,
	values: { taxId: string | null; country?: string | null }
): Promise<void> {
	const contactId = 'contact-of-acme';
	await h.dataSource.query('DELETE FROM "contact" WHERE "id" = ?', [contactId]);
	if (values.country !== undefined) {
		await insert(h.dataSource, 'better-sqlite3', 'contact', {
			id: contactId,
			tenantId: h.acme.tenantId,
			organizationId: h.acme.organizationId,
			country: values.country
		});
	}
	await h.dataSource.query('UPDATE "organization" SET "taxId" = ?, "contactId" = ? WHERE "id" = ?', [
		values.taxId,
		values.country !== undefined ? contactId : null,
		h.acme.organizationId
	]);
}
