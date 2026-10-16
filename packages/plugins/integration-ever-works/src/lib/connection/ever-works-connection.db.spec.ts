/**
 * The connection (G-P1-3) on a real database (better-sqlite3), against the mock Ever Works: the
 * migration (up, up again, down, up), connect / validate / rotate / pause / resume / health / webhook /
 * disconnect, tenant and organization isolation, the key stored only encrypted, `needs_reauth` with its
 * notice, and the daily health check's one-claim-per-day lease.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application), as the
 * other plugin database suites do: its entities are mapped below by fixture schemas over the same
 * table names, and the request context answers with the caller each case states. The plugin's own
 * table is created by the plugin's migration, not by the fixture.
 */
const mockCaller: { tenantId: string | null; userId: string | null; organizationId: string | null } = {
	tenantId: null,
	userId: null,
	organizationId: null
};

jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	class BaseEntity {}
	const entity = (name: string) => ({ [name]: class {} })[name];
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: BaseEntity,
		MikroOrmBaseEntityRepository: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		Tenant: entity('Tenant'),
		Organization: entity('Organization'),
		UserOrganization: entity('UserOrganization'),
		Employee: entity('Employee'),
		EmployeeNotification: entity('EmployeeNotification'),
		IntegrationTenant: entity('IntegrationTenant'),
		IntegrationSetting: entity('IntegrationSetting'),
		RequestContext: {
			currentTenantId: () => mockCaller.tenantId,
			currentUserId: () => mockCaller.userId,
			currentOrganizationId: () => mockCaller.organizationId
		}
	};
});

import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { Employee, EmployeeNotification, IntegrationSetting, IntegrationTenant, Organization, Tenant, UserOrganization } from '@gauzy/core';
import { TestEverWorksClientFactory } from '../client/ever-works-client.factory';
import { EverWorksConfig } from '../ever-works-config';
import { EverWorksScopeService } from '../ever-works-scope.service';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import { CreateEverWorksConnection1791000001100 } from '../database/migrations/1791000001100-CreateEverWorksConnection';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';
import { EverWorksConnection, EverWorksConnectionStatus } from './ever-works-connection.entity';
import { EverWorksConnectionService } from './ever-works-connection.service';
import { EverWorksHealthScheduler } from './ever-works-health.scheduler';
import { EverWorksNotifier } from './ever-works-notifier.service';

jest.setTimeout(60_000);

const base = {
	id: { type: String, primary: true },
	tenantId: { type: String, nullable: true },
	organizationId: { type: String, nullable: true },
	isActive: { type: Boolean, nullable: true, default: true },
	isArchived: { type: Boolean, nullable: true, default: false },
	createdAt: { type: Date, createDate: true },
	updatedAt: { type: Date, updateDate: true }
} as const;

/** The core tables the plugin reads and writes, with the columns it uses. */
const coreSchemas = [
	new EntitySchema({ name: 'Tenant', target: Tenant, tableName: 'tenant', columns: { id: base.id, name: { type: String, nullable: true } } }),
	new EntitySchema({ name: 'Organization', target: Organization, tableName: 'organization', columns: { ...base, name: { type: String, nullable: true } } }),
	new EntitySchema({ name: 'UserOrganization', target: UserOrganization, tableName: 'user_organization', columns: { ...base, userId: { type: String } } }),
	new EntitySchema({ name: 'Employee', target: Employee, tableName: 'employee', columns: { ...base, userId: { type: String } } }),
	new EntitySchema({
		name: 'EmployeeNotification',
		target: EmployeeNotification,
		tableName: 'employee_notification',
		columns: {
			...base,
			entity: { type: String },
			entityId: { type: String },
			title: { type: String, nullable: true },
			message: { type: String, nullable: true },
			type: { type: String, nullable: true },
			isRead: { type: Boolean, default: false },
			receiverEmployeeId: { type: String, nullable: true }
		}
	}),
	new EntitySchema({
		name: 'IntegrationTenant',
		target: IntegrationTenant,
		tableName: 'integration_tenant',
		columns: { ...base, name: { type: String } },
		relations: { settings: { type: 'one-to-many', target: 'IntegrationSetting', inverseSide: 'integration', cascade: true } }
	}),
	new EntitySchema({
		name: 'IntegrationSetting',
		target: IntegrationSetting,
		tableName: 'integration_setting',
		columns: { ...base, settingsName: { type: String }, settingsValue: { type: String, nullable: true } },
		relations: { integration: { type: 'many-to-one', target: 'IntegrationTenant', joinColumn: { name: 'integrationId' } } }
	})
];

/** The plugin's entity over the table its migration creates. */
const connectionSchema = new EntitySchema({
	name: 'EverWorksConnection',
	target: EverWorksConnection,
	tableName: 'ever_works_connection',
	columns: {
		...base,
		deletedAt: { type: Date, nullable: true },
		archivedAt: { type: Date, nullable: true },
		authMode: { type: String },
		status: { type: String },
		apiBaseUrl: { type: String },
		ewTenantId: { type: String },
		ewTenantSlug: { type: String, nullable: true },
		keyId: { type: String, nullable: true },
		keyName: { type: String, nullable: true },
		keyPrefix: { type: String, nullable: true },
		apiKeyEncrypted: { type: 'text' },
		scopes: { type: 'text', nullable: true },
		pinnedOrganizations: { type: 'text', nullable: true },
		apiVersion: { type: String, nullable: true },
		webhookSubscriptionId: { type: String, nullable: true },
		webhookSecretEncrypted: { type: 'text', nullable: true },
		webhookUrl: { type: String, nullable: true },
		feedCursor: { type: String, nullable: true },
		lastError: { type: 'text', nullable: true },
		lastErrorAt: { type: Date, nullable: true },
		lastHealthyAt: { type: Date, nullable: true },
		lastCheckedAt: { type: Date, nullable: true },
		connectedByUserId: { type: String, nullable: true },
		disconnectedAt: { type: Date, nullable: true }
	}
});

const CONFIG: EverWorksConfig = { defaultApiUrl: null, appUrl: null, gauzyApiUrl: 'https://api.gauzy.example' };

describe('Ever Works connection on SQLite', () => {
	let dir: string;
	let dataSource: DataSource;
	let mock: MockEverWorksServer;
	let service: EverWorksConnectionService;
	const savedEnv = { ENCRYPTION_KEY: process.env['ENCRYPTION_KEY'], JWT_SECRET: process.env['JWT_SECRET'] };

	// Two tenants, each with an organization, an admin who is a member and an employee there.
	const A = { tenantId: randomUUID(), organizationId: randomUUID(), userId: randomUUID(), employeeId: randomUUID() };
	const B = { tenantId: randomUUID(), organizationId: randomUUID(), userId: randomUUID(), employeeId: randomUUID() };
	const as = (who: typeof A | null, organizationId?: string) => {
		mockCaller.tenantId = who?.tenantId ?? null;
		mockCaller.userId = who?.userId ?? null;
		mockCaller.organizationId = organizationId ?? who?.organizationId ?? null;
	};
	const raw = () => dataSource.getRepository(EverWorksConnection);
	const build = (env: NodeJS.ProcessEnv = process.env) => {
		const saved = { ...process.env };
		Object.assign(process.env, env);
		try {
			return new EverWorksConnectionService(
				dataSource,
				new TestEverWorksClientFactory(mock.transport()),
				new EverWorksScopeService(dataSource),
				new EverWorksNotifier(dataSource),
				CONFIG
			);
		} finally {
			process.env = saved;
		}
	};
	const connectDto = (apiKey: string) => ({ apiBaseUrl: 'https://ew.example.test/api', apiKey });

	beforeAll(async () => {
		process.env['ENCRYPTION_KEY'] = randomBytes(32).toString('base64');
		dir = mkdtempSync(join(tmpdir(), 'ever-works-db-'));
		const file = join(dir, 'gauzy.sqlite');
		const core = new DataSource({ type: 'better-sqlite3', database: file, entities: coreSchemas, synchronize: true });
		await core.initialize();
		await core.destroy();
		dataSource = new DataSource({ type: 'better-sqlite3', database: file, entities: [...coreSchemas, connectionSchema] });
		await dataSource.initialize();
		const runner = dataSource.createQueryRunner();
		try {
			await new CreateEverWorksConnection1791000001100().up(runner);
		} finally {
			await runner.release();
		}
		for (const who of [A, B]) {
			await dataSource.getRepository(Tenant).save({ id: who.tenantId, name: 't' });
			await dataSource.getRepository(Organization).save({ id: who.organizationId, tenantId: who.tenantId, name: 'o' });
			await dataSource.getRepository(UserOrganization).save({ id: randomUUID(), tenantId: who.tenantId, organizationId: who.organizationId, userId: who.userId });
			await dataSource.getRepository(Employee).save({ id: who.employeeId, tenantId: who.tenantId, organizationId: who.organizationId, userId: who.userId });
		}
	});

	afterAll(async () => {
		await dataSource?.destroy();
		rmSync(dir, { recursive: true, force: true });
		process.env['ENCRYPTION_KEY'] = savedEnv.ENCRYPTION_KEY;
		if (savedEnv.ENCRYPTION_KEY === undefined) delete process.env['ENCRYPTION_KEY'];
	});

	beforeEach(async () => {
		await raw().clear();
		await dataSource.getRepository(EmployeeNotification).clear();
		mock = new MockEverWorksServer();
		service = build();
		as(A);
	});

	describe('the migration', () => {
		it('is idempotent and reversible', async () => {
			const runner = dataSource.createQueryRunner();
			try {
				const migration = new CreateEverWorksConnection1791000001100();
				await migration.up(runner); // again: no DDL error
				expect(await runner.hasTable('ever_works_connection')).toBe(true);
				await migration.down(runner);
				expect(await runner.hasTable('ever_works_connection')).toBe(false);
				await migration.down(runner); // again: nothing to drop
				await migration.up(runner);
				const indexes = await runner.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ever_works_connection'`);
				expect(indexes.map((row: { name: string }) => row.name)).toEqual(
					expect.arrayContaining(['IDX_ever_works_connection_tenant', 'IDX_ever_works_connection_status', 'UQ_ever_works_connection_active_tenant'])
				);
			} finally {
				await runner.release();
			}
		});

		it('allows one active connection per tenant at the database level, and any number of archived ones', async () => {
			const row = (isActive: boolean) => ({
				id: randomUUID(),
				tenantId: A.tenantId,
				apiBaseUrl: 'https://x',
				ewTenantId: 'e',
				apiKeyEncrypted: 'x',
				authMode: 'api_key',
				status: 'active',
				isActive
			});
			await raw().insert(row(false));
			await raw().insert(row(false));
			await raw().insert(row(true));
			await expect(raw().insert(row(true))).rejects.toThrow(/UNIQUE/);
		});
	});

	describe('validate and connect', () => {
		it('describes a key without storing anything', async () => {
			const key = mock.addKey({ scopes: ['events:read', 'tasks:read'] });
			const result = await service.validate(connectDto(key));
			expect(result.tenant).toEqual(mock.tenant);
			expect(result.compatible).toBe(true);
			expect(result.missingScopes).toContain('tasks:write');
			expect(result.missingRequiredScopes).toEqual(['webhooks:manage']);
			expect(result.keyPrefix).toBe(`${key.slice(0, 11)}…`);
			expect(JSON.stringify(result)).not.toContain(key);
			expect(await raw().count()).toBe(0);
		});

		it('connects, storing the key only encrypted and returning no secret', async () => {
			const key = mock.addKey();
			const view = await service.connect(connectDto(key));
			expect(view.status).toBe(EverWorksConnectionStatus.ACTIVE);
			expect(view.ewTenant.id).toBe(mock.tenant.id);
			expect(JSON.stringify(view)).not.toContain(key);
			expect(Object.keys(view)).not.toEqual(expect.arrayContaining(['apiKeyEncrypted', 'webhookSecretEncrypted']));
			const stored = await raw().findOneByOrFail({ id: view.id });
			expect(stored.apiKeyEncrypted.startsWith('ew1:k:')).toBe(true);
			expect(JSON.stringify(stored)).not.toContain(key);
			expect(stored.connectedByUserId).toBe(A.userId);
			expect(stored.organizationId).toBe(A.organizationId);
		});

		it('refuses a second active connection of the same tenant (409)', async () => {
			await service.connect(connectDto(mock.addKey()));
			await expect(service.connect(connectDto(mock.addKey()))).rejects.toBeInstanceOf(ConflictException);
		});

		it('refuses a key Ever Works rejects, an incompatible API version and an unsafe URL; stores nothing', async () => {
			await expect(service.connect(connectDto('ew_int_unknownunknownunknown'))).rejects.toBeInstanceOf(BadRequestException);
			const key = mock.addKey();
			mock.apiVersion = '2';
			await expect(service.connect(connectDto(key))).rejects.toThrow(/v2/);
			mock.apiVersion = '1';
			await expect(service.connect({ apiBaseUrl: 'http://ew.example.test/api', apiKey: key })).rejects.toBeInstanceOf(BadRequestException);
			await expect(service.connect({ apiBaseUrl: 'https://10.0.0.1/api', apiKey: key })).rejects.toBeInstanceOf(BadRequestException);
			expect(mock.requests.filter((r) => r.path === '/whoami')).toHaveLength(2);
			expect(await raw().count()).toBe(0);
		});

		it('stores nothing when ENCRYPTION_KEY is malformed (503), before calling Ever Works', async () => {
			const broken = build({ ENCRYPTION_KEY: 'not-a-32-byte-key' });
			await expect(broken.connect(connectDto(mock.addKey()))).rejects.toBeInstanceOf(ServiceUnavailableException);
			expect(mock.requests).toHaveLength(0);
			expect(await raw().count()).toBe(0);
		});
	});

	describe('isolation', () => {
		it('requires an active membership of the organization, and never shows another tenant its connection', async () => {
			const view = await service.connect(connectDto(mock.addKey()));
			as(A, B.organizationId); // a user of tenant A naming tenant B's organization
			await expect(service.current()).rejects.toBeInstanceOf(ForbiddenException);
			as(B);
			expect(await service.current()).toBeNull();
			await expect(service.get(view.id)).rejects.toBeInstanceOf(NotFoundException);
			await expect(service.pause(view.id)).rejects.toBeInstanceOf(NotFoundException);
			await expect(service.rotateKey(view.id, { apiKey: mock.addKey() })).rejects.toBeInstanceOf(NotFoundException);
			await expect(service.disconnect(view.id)).rejects.toBeInstanceOf(NotFoundException);
			as(null);
			await expect(service.current()).rejects.toBeInstanceOf(ForbiddenException);
			as(A);
			expect((await service.current())?.status).toBe(EverWorksConnectionStatus.ACTIVE);
		});
	});

	describe('health, needs_reauth and rotation', () => {
		it('a revoked key → needs_reauth, paused, the connecting admin notified once; a new key restores it', async () => {
			const key = mock.addKey();
			const view = await service.connect(connectDto(key));
			mock.revokeKey(key);
			const first = await service.health(view.id);
			expect(first).toMatchObject({ status: EverWorksConnectionStatus.NEEDS_REAUTH, healthy: false });
			await service.health(view.id);
			const notices = await dataSource.getRepository(EmployeeNotification).find();
			expect(notices).toHaveLength(1);
			expect(notices[0]).toMatchObject({ receiverEmployeeId: A.employeeId, tenantId: A.tenantId, organizationId: A.organizationId });
			// The pinned organizations of the new key belong to the same Ever Works tenant.
			const rotated = await service.rotateKey(view.id, { apiKey: mock.addKey() });
			expect(rotated.status).toBe(EverWorksConnectionStatus.ACTIVE);
			expect(rotated.lastError).toBeNull();
		});

		it('refuses a new key of another Ever Works tenant', async () => {
			const view = await service.connect(connectDto(mock.addKey()));
			// The same host now answers whoami for another Ever Works tenant.
			const tenant = mock.tenant.id;
			(mock.tenant as { id: string }).id = randomUUID();
			await expect(service.rotateKey(view.id, { apiKey: mock.addKey() })).rejects.toThrow(/another Ever Works tenant/);
			(mock.tenant as { id: string }).id = tenant;
			expect((await raw().findOneByOrFail({ id: view.id })).ewTenantId).toBe(tenant);
		});

		it('another failure → error with a safe reason; an admin pause survives the check', async () => {
			const view = await service.connect(connectDto(mock.addKey()));
			mock.fail({ path: '/whoami', status: 503, times: 3 });
			expect(await service.health(view.id)).toMatchObject({ status: EverWorksConnectionStatus.ERROR, healthy: false });
			expect((await raw().findOneByOrFail({ id: view.id })).lastError).toMatch(/^internal_error/);
			await service.pause(view.id);
			mock.fail({ path: '/whoami', status: 503, times: 3 });
			expect((await service.health(view.id)).status).toBe(EverWorksConnectionStatus.PAUSED);
			const resumed = await service.resume(view.id);
			expect(resumed.status).toBe(EverWorksConnectionStatus.ACTIVE);
		});

		it('the daily check runs once per connection per day, whichever process wins the claim', async () => {
			const view = await service.connect(connectDto(mock.addKey()));
			await raw().update({ id: view.id }, { lastCheckedAt: new Date(Date.now() - 25 * 3600 * 1000) });
			const one = new EverWorksHealthScheduler(dataSource, service, { EVER_WORKS_ENABLED: 'true' });
			const two = new EverWorksHealthScheduler(dataSource, service, { EVER_WORKS_ENABLED: 'true' });
			const before = mock.requests.length;
			const [a, b] = await Promise.all([one.tick(), two.tick()]);
			expect(a + b).toBe(1);
			expect(mock.requests.length - before).toBe(1);
			expect(await one.tick()).toBe(0); // not due again
		});
	});

	describe('webhook and disconnect', () => {
		it('registers the subscription (our origin excluded, pinned organizations), stores its secret encrypted and replaces it', async () => {
			const view = await service.connect(connectDto(mock.addKey()));
			const registered = await service.registerWebhook(view.id);
			expect(registered.webhook).toMatchObject({ registered: true, url: `https://api.gauzy.example/api/integration/ever-works/webhooks/${view.id}` });
			const [subscription] = [...mock.webhooks.values()];
			expect(subscription.excludeOriginTags).toEqual([`gauzy:${view.id}`]);
			expect(subscription.organizationIds).toEqual(view.pinnedOrganizations.map((org) => org.id));
			const stored = await raw().findOneByOrFail({ id: view.id });
			expect(stored.webhookSecretEncrypted).not.toContain(subscription.secret);
			expect(service.webhookSecret(stored)).toBe(subscription.secret);
			await service.registerWebhook(view.id);
			expect(mock.webhooks.size).toBe(1);
			expect([...mock.webhooks.values()][0].id).not.toBe(subscription.id);
		});

		it('needs a public HTTPS API address for the webhook', async () => {
			const local = new EverWorksConnectionService(
				dataSource,
				new TestEverWorksClientFactory(mock.transport()),
				new EverWorksScopeService(dataSource),
				new EverWorksNotifier(dataSource),
				{ ...CONFIG, gauzyApiUrl: null }
			);
			const view = await local.connect(connectDto(mock.addKey()));
			await expect(local.registerWebhook(view.id)).rejects.toThrow(/API_BASE_URL/);
		});

		it('disconnect archives the connection and its organization mappings, deletes the webhook, and a reconnect resumes the same connection', async () => {
			const view = await service.connect(connectDto(mock.addKey()));
			await service.registerWebhook(view.id);
			const mapping = await dataSource.getRepository(IntegrationTenant).save({
				id: randomUUID(),
				tenantId: A.tenantId,
				organizationId: A.organizationId,
				name: 'Ever_Works',
				isActive: true,
				isArchived: false,
				settings: [
					{ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, settingsName: EverWorksSettingName.CONNECTION_ID, settingsValue: view.id },
					{ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, settingsName: EverWorksSettingName.IS_ENABLED, settingsValue: 'true' }
				]
			} as never);
			expect(await service.disconnect(view.id)).toEqual({ success: true, webhookDeleted: true });
			expect(mock.webhooks.size).toBe(0);
			const stored = await raw().findOneByOrFail({ id: view.id });
			expect(stored).toMatchObject({ status: EverWorksConnectionStatus.DISCONNECTED, isActive: false, isArchived: true, webhookSecretEncrypted: null });
			const archived = await dataSource.getRepository(IntegrationTenant).findOneOrFail({ where: { id: (mapping as { id: string }).id }, relations: { settings: true } } as never);
			expect(archived).toMatchObject({ isActive: false, isArchived: true });
			expect((archived as { settings: Array<{ settingsName: string; settingsValue: string }> }).settings.find((s) => s.settingsName === 'IS_ENABLED')?.settingsValue).toBe('false');
			expect(await service.current()).toBeNull();
			const again = await service.connect(connectDto(mock.addKey()));
			expect(again.id).toBe(view.id);
			expect(again.status).toBe(EverWorksConnectionStatus.ACTIVE);
		});
	});
});
