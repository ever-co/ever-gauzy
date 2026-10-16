/**
 * The engine core (G-P1-5) on a real database (better-sqlite3) with the mock Ever Works: the sync
 * tables' migration (up, up again, down, up), webhook intake (signature, tenant from the stored
 * connection, dedupe, 202), the change feed (cursor, dedupe with webhooks, 410), the applier (order per
 * aggregate, own origin skipped, unmapped organization skipped, no handler → deferred, failures → dead,
 * loop guard level 1), the outbound queue (coalescing) and pusher (no handler → deferred, dead letters),
 * and the loop's one-process-per-connection lease.
 */
const mockCaller: { tenantId: string | null; userId: string | null; organizationId: string | null } = {
	tenantId: null,
	userId: null,
	organizationId: null
};

jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const entity = (name: string) => ({ [name]: class {} })[name];
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		verifyWebhookSignature: jest.requireActual('../../../../../core/src/lib/webhook/webhook-signature').verifyWebhookSignature,
		...Object.fromEntries(
			['Tenant', 'Organization', 'UserOrganization', 'Employee', 'EmployeeNotification', 'IntegrationTenant', 'IntegrationSetting'].map((name) => [
				name,
				entity(name)
			])
		),
		RequestContext: {
			currentTenantId: () => mockCaller.tenantId,
			currentUserId: () => mockCaller.userId,
			currentOrganizationId: () => mockCaller.organizationId
		}
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { IntegrationSetting, IntegrationTenant, Organization, Tenant, UserOrganization, Employee, EmployeeNotification } from '@gauzy/core';
import { TestEverWorksClientFactory } from '../client/ever-works-client.factory';
import { EverWorksConnection, EverWorksConnectionStatus } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksNotifier } from '../connection/ever-works-notifier.service';
import { CreateEverWorksConnection1791000001100 } from '../database/migrations/1791000001100-CreateEverWorksConnection';
import { CreateEverWorksSyncTables1791000001300 } from '../database/migrations/1791000001300-CreateEverWorksSyncTables';
import { EverWorksScopeService } from '../ever-works-scope.service';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';
import {
	EverWorksEntityLink,
	EverWorksInboundEvent,
	EverWorksInboundStatus,
	EverWorksLinkType,
	EverWorksOutboundChange,
	EverWorksOutboundStatus,
	EverWorksSyncLog
} from './entities/ever-works-sync.entities';
import { EverWorksSyncContext } from './ever-works-sync.context';
import { EverWorksSyncLogService } from './ever-works-sync-log.service';
import { EverWorksSyncLoop } from './ever-works-sync.loop';
import { EverWorksFeedPoller } from './inbound/ever-works-feed.poller';
import { EverWorksInboundApplier } from './inbound/ever-works-inbound.applier';
import { EverWorksInboundStore } from './inbound/ever-works-inbound.store';
import { EverWorksOutboundPusher } from './outbound/ever-works-outbound.pusher';
import { EverWorksOutboundQueue } from './outbound/ever-works-outbound.queue';
import { EverWorksWebhookController } from './webhook/ever-works-webhook.controller';

jest.setTimeout(60_000);

const base = {
	id: { type: String, primary: true },
	tenantId: { type: String, nullable: true },
	organizationId: { type: String, nullable: true },
	isActive: { type: Boolean, nullable: true, default: true },
	isArchived: { type: Boolean, nullable: true, default: false },
	archivedAt: { type: Date, nullable: true },
	createdAt: { type: Date, createDate: true },
	updatedAt: { type: Date, updateDate: true }
} as const;
const s = (name: string, target: Function, tableName: string, columns: Record<string, unknown>, relations?: Record<string, unknown>) =>
	new EntitySchema({ name, target, tableName, columns: { ...base, ...columns } as never, relations: relations as never });
const str = (nullable = true) => ({ type: String, nullable });
const txt = (nullable = true) => ({ type: 'text', nullable });
const date = { type: Date, nullable: true };
const int = (nullable = true) => ({ type: Number, nullable });

const coreSchemas = [
	s('Tenant', Tenant, 'tenant', { name: str() }),
	s('Organization', Organization, 'organization', { name: str() }),
	s('UserOrganization', UserOrganization, 'user_organization', { userId: str(false) }),
	s('Employee', Employee, 'employee', { userId: str(false) }),
	s('EmployeeNotification', EmployeeNotification, 'employee_notification', { receiverEmployeeId: str() }),
	s('IntegrationTenant', IntegrationTenant, 'integration_tenant', { name: str(false) }, {
		settings: { type: 'one-to-many', target: 'IntegrationSetting', inverseSide: 'integration', cascade: true }
	}),
	s('IntegrationSetting', IntegrationSetting, 'integration_setting', { settingsName: str(false), settingsValue: str() }, {
		integration: { type: 'many-to-one', target: 'IntegrationTenant', joinColumn: { name: 'integrationId' } }
	})
];
const pluginSchemas = [
	s('EverWorksConnection', EverWorksConnection, 'ever_works_connection', {
		authMode: str(false), status: str(false), apiBaseUrl: str(false), ewTenantId: str(false), ewTenantSlug: str(), keyId: str(), keyName: str(), keyPrefix: str(),
		apiKeyEncrypted: txt(false), scopes: txt(), pinnedOrganizations: txt(), apiVersion: str(), webhookSubscriptionId: str(), webhookSecretEncrypted: txt(),
		webhookUrl: str(), feedCursor: str(), lastError: txt(), lastErrorAt: date, lastHealthyAt: date, lastCheckedAt: date, connectedByUserId: str(),
		disconnectedAt: date, leaseOwner: str(), leaseUntil: date, lastFeedPollAt: date, lastWebhookAt: date, resyncRequestedAt: date
	}),
	s('EverWorksEntityLink', EverWorksEntityLink, 'ever_works_entity_link', {
		integrationTenantId: str(false), entityType: str(false), gauzyId: str(false), ewId: str(false), ewVersion: int(), ewUpdatedAt: date, gauzyUpdatedAt: date,
		snapshot: txt(), ewOnly: txt(), lastDirection: str(), lastSyncedAt: date, state: str(false), lastError: txt()
	}),
	s('EverWorksInboundEvent', EverWorksInboundEvent, 'ever_works_inbound_event', {
		connectionId: str(false), eventId: str(false), seq: { type: 'bigint' }, type: str(false), aggregateType: str(false), aggregateId: str(false),
		aggregateVersion: int(), ewOrganizationId: str(), payload: txt(false), receivedVia: str(false), status: str(false), attempts: int(false), availableAt: date,
		error: txt(), appliedAt: date
	}),
	s('EverWorksOutboundChange', EverWorksOutboundChange, 'ever_works_outbound_change', {
		integrationTenantId: str(false), entityType: str(false), gauzyId: str(false), op: str(false), changedFieldsHint: txt(), actorUserId: str(), status: str(false),
		attempts: int(false), availableAt: date, lastError: txt()
	}),
	s('EverWorksSyncLog', EverWorksSyncLog, 'ever_works_sync_log', {
		integrationTenantId: str(), connectionId: str(), direction: str(false), entityType: str(), gauzyId: str(), ewId: str(), action: str(false), status: str(false),
		message: txt(), details: txt(), resolvedByUserId: str(), resolvedAt: date
	})
];

describe('Ever Works sync engine on SQLite', () => {
	let dir: string;
	let dataSource: DataSource;
	let mock: MockEverWorksServer;
	let connections: EverWorksConnectionService;
	let store: EverWorksInboundStore;
	let log: EverWorksSyncLogService;
	let webhook: EverWorksWebhookController;
	let connection: EverWorksConnection;
	let secret: string;
	let ewOrgId: string;
	let integrationTenantId: string;
	const savedKey = process.env['ENCRYPTION_KEY'];
	const A = { tenantId: randomUUID(), organizationId: randomUUID(), userId: randomUUID() };

	const sign = (body: string, key = secret, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac('sha256', key).update(`${t}.${body}`).digest('hex')}`;
	const envelope = (over: Record<string, unknown> = {}) => ({
		id: `evt_${randomUUID()}`,
		seq: '1',
		type: 'task.updated',
		version: 1,
		occurredAt: new Date().toISOString(),
		tenantId: mock.tenant.id,
		organizationId: ewOrgId,
		aggregate: { type: 'task', id: 'task-1', version: 2 },
		actor: { type: 'user', id: 'u1', label: 'U' },
		data: { id: 'task-1' },
		...over
	});
	const deliver = (body: unknown, header?: string, eventId?: string) => {
		const raw = JSON.stringify(body);
		return webhook.receive(connection.id as string, { rawBody: Buffer.from(raw, 'utf8') } as never, header ?? sign(raw), eventId);
	};
	const events = () => dataSource.getRepository(EverWorksInboundEvent);
	const reload = async () => (connection = await dataSource.getRepository(EverWorksConnection).findOneByOrFail({ id: connection.id as string }));

	beforeAll(async () => {
		process.env['ENCRYPTION_KEY'] = randomBytes(32).toString('base64');
		dir = mkdtempSync(join(tmpdir(), 'ever-works-sync-'));
		const file = join(dir, 'gauzy.sqlite');
		const core = new DataSource({ type: 'better-sqlite3', database: file, entities: coreSchemas, synchronize: true });
		await core.initialize();
		await core.destroy();
		dataSource = new DataSource({ type: 'better-sqlite3', database: file, entities: [...coreSchemas, ...pluginSchemas] });
		await dataSource.initialize();
		const runner = dataSource.createQueryRunner();
		await new CreateEverWorksConnection1791000001100().up(runner);
		await new CreateEverWorksSyncTables1791000001300().up(runner);
		await runner.release();
		await dataSource.getRepository(Tenant).save({ id: A.tenantId, name: 't' });
		await dataSource.getRepository(Organization).save({ id: A.organizationId, tenantId: A.tenantId, name: 'o' });
		await dataSource.getRepository(UserOrganization).save({ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, userId: A.userId });
	});

	afterAll(async () => {
		await dataSource?.destroy();
		rmSync(dir, { recursive: true, force: true });
		if (savedKey === undefined) delete process.env['ENCRYPTION_KEY'];
		else process.env['ENCRYPTION_KEY'] = savedKey;
	});

	beforeEach(async () => {
		for (const table of ['ever_works_inbound_event', 'ever_works_outbound_change', 'ever_works_sync_log', 'ever_works_entity_link', 'integration_setting', 'integration_tenant', 'ever_works_connection']) {
			await dataSource.query(`DELETE FROM "${table}"`);
		}
		mockCaller.tenantId = A.tenantId;
		mockCaller.userId = A.userId;
		mockCaller.organizationId = A.organizationId;
		mock = new MockEverWorksServer();
		ewOrgId = randomUUID();
		connections = new EverWorksConnectionService(
			dataSource,
			new TestEverWorksClientFactory(mock.transport()),
			new EverWorksScopeService(dataSource),
			new EverWorksNotifier(dataSource),
			{ defaultApiUrl: null, appUrl: null, gauzyApiUrl: 'https://api.gauzy.example' }
		);
		store = new EverWorksInboundStore(dataSource);
		log = new EverWorksSyncLogService(dataSource);
		webhook = new EverWorksWebhookController(dataSource, connections, store);
		const view = await connections.connect({ apiBaseUrl: 'https://ew.example.test/api', apiKey: mock.addKey({ organizations: [{ id: ewOrgId, slug: 'acme', displayName: 'Acme' }] }) });
		await connections.registerWebhook(view.id);
		secret = [...mock.webhooks.values()][0].secret;
		// The organization mapping (G-P1-4) the events resolve their Gauzy organization through.
		integrationTenantId = randomUUID();
		await dataSource.getRepository(IntegrationTenant).save({
			id: integrationTenantId,
			tenantId: A.tenantId,
			organizationId: A.organizationId,
			name: 'Ever_Works',
			isActive: true,
			isArchived: false,
			settings: [
				[EverWorksSettingName.CONNECTION_ID, view.id],
				[EverWorksSettingName.EVER_WORKS_ORGANIZATION_ID, ewOrgId],
				[EverWorksSettingName.IS_ENABLED, 'true']
			].map(([settingsName, settingsValue]) => ({ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, settingsName, settingsValue }))
		} as never);
		connection = await dataSource.getRepository(EverWorksConnection).findOneByOrFail({ id: view.id });
	});

	it('the sync tables migration is idempotent and reversible, keeping the connection table', async () => {
		const runner = dataSource.createQueryRunner();
		try {
			const migration = new CreateEverWorksSyncTables1791000001300();
			await migration.up(runner);
			await migration.down(runner);
			expect(await runner.hasTable('ever_works_inbound_event')).toBe(false);
			expect(await runner.hasTable('ever_works_connection')).toBe(true);
			expect(await runner.hasColumn('ever_works_connection', 'leaseOwner')).toBe(false);
			await migration.up(runner);
			expect(await runner.hasColumn('ever_works_connection', 'leaseOwner')).toBe(true);
			expect(await runner.hasTable('ever_works_entity_link')).toBe(true);
		} finally {
			await runner.release();
		}
	});

	describe('webhook intake', () => {
		it('stores a signed event once, for the stored connection and its mapped organization (202, then duplicate)', async () => {
			const event = envelope();
			expect(await deliver(event, undefined, event.id)).toEqual({ accepted: true, duplicate: false });
			expect(await deliver(event)).toEqual({ accepted: true, duplicate: true });
			const rows = await events().find();
			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({ tenantId: A.tenantId, organizationId: A.organizationId, connectionId: connection.id, receivedVia: 'webhook', status: 'pending' });
		});

		it('refuses a bad, missing or foreign-secret signature, an unknown connection, another tenant and a mismatched event id', async () => {
			const event = envelope();
			const raw = JSON.stringify(event);
			await expect(deliver(event, sign(raw, 'another-secret-of-at-least-32-chars!!'))).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(webhook.receive(connection.id as string, { rawBody: Buffer.from(raw) } as never, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(deliver(event, sign(raw, secret, Math.floor(Date.now() / 1000) - 3600))).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(webhook.receive(randomUUID(), { rawBody: Buffer.from(raw) } as never, sign(raw))).rejects.toBeInstanceOf(NotFoundException);
			await expect(webhook.receive('not-a-uuid', { rawBody: Buffer.from(raw) } as never, sign(raw))).rejects.toBeInstanceOf(NotFoundException);
			await expect(deliver(envelope({ tenantId: randomUUID() }))).rejects.toBeInstanceOf(BadRequestException);
			await expect(deliver(event, undefined, 'evt_other')).rejects.toBeInstanceOf(BadRequestException);
			await expect(deliver({ not: 'an envelope' })).rejects.toBeInstanceOf(BadRequestException);
			expect(await events().count()).toBe(0);
		});

		it('a disconnected connection receives nothing', async () => {
			await connections.disconnect(connection.id as string);
			await expect(deliver(envelope())).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe('change feed', () => {
		it('follows from the head on the first poll, then stores new events once, deduplicated with webhooks, excluding our origin', async () => {
			const poller = new EverWorksFeedPoller(dataSource, connections, store);
			await mock.emit(envelope({ seq: undefined, id: undefined }) as never); // before the first poll: history, not followed
			await reload();
			connection.feedCursor = null;
			await dataSource.getRepository(EverWorksConnection).update({ id: connection.id as string }, { feedCursor: null } as never);
			await reload();
			expect((await poller.poll(connection)).stored).toBe(0);
			await reload();
			// From now on the mock delivers its webhooks to the real route.
			mock.deliver = async (_url, headers, body) => {
				await webhook.receive(connection.id as string, { rawBody: Buffer.from(body, 'utf8') } as never, headers['x-ever-works-signature'], headers['x-ever-works-event-id']);
				return 202;
			};
			const delivered = await mock.emit(envelope({ seq: undefined, id: undefined }) as never);
			await mock.emit(envelope({ seq: undefined, id: undefined, origin: { tag: `gauzy:${connection.id}` } }) as never);
			// Not in the webhook's event list: only the feed carries it.
			await mock.emit(envelope({ seq: undefined, id: undefined, type: 'email.message.received', aggregate: { type: 'email', id: 'm1', version: 1 } }) as never);
			expect((await events().find()).map((e) => e.eventId)).toEqual([delivered.id]);
			const result = await poller.poll(connection);
			expect(result).toMatchObject({ polled: true, stored: 1, duplicates: 1 });
			await reload();
			expect(connection.feedCursor).toBe(mock.head);
			expect(mock.requests.filter((r) => r.path === '/events').every((r) => r.query['excludeOrigin'] === `gauzy:${connection.id}`)).toBe(true);
			expect(await events().count()).toBe(2);
		});

		it('410 cursor_expired → restart from the head and request a resync', async () => {
			const poller = new EverWorksFeedPoller(dataSource, connections, store);
			mock.fail({ path: '/events', status: 410, body: { error: { code: 'cursor_expired', message: 'Too old.' } } });
			await reload();
			const result = await poller.poll(connection);
			expect(result.expired).toBe(true);
			await reload();
			expect((connection as unknown as { resyncRequestedAt: Date | null }).resyncRequestedAt).not.toBeNull();
		});
	});

	describe('inbound applier', () => {
		const record = async (over: Record<string, unknown>) => store.record(connection, envelope(over) as never, 'webhook');

		it('applies per aggregate in seq order, skips our own origin and unmapped organizations, defers what no handler covers', async () => {
			const applier = new EverWorksInboundApplier(dataSource, log);
			const seen: string[] = [];
			applier.register({
				aggregateTypes: ['task'],
				apply: async (env) => {
					expect(EverWorksSyncContext.isApplying(connection.id as string)).toBe(true);
					seen.push(env.seq);
					return { status: 'applied' };
				}
			});
			await record({ seq: '30' });
			await record({ seq: '10' });
			await record({ seq: '20' });
			await record({ seq: '40', origin: { tag: `gauzy:${connection.id}` } });
			await record({ seq: '50', organizationId: randomUUID() });
			await record({ seq: '60', aggregate: { type: 'goal', id: 'g1', version: 1 } });
			await applier.drain(connection);
			expect(seen).toEqual(['10', '20', '30']);
			const bySeq = Object.fromEntries((await events().find()).map((e) => [String(e.seq), e]));
			expect(bySeq['40']).toMatchObject({ status: EverWorksInboundStatus.SKIPPED, error: 'own origin' });
			expect(bySeq['50']).toMatchObject({ status: EverWorksInboundStatus.SKIPPED, error: 'no mapped Gauzy organization' });
			expect(bySeq['60']).toMatchObject({ status: EverWorksInboundStatus.DEFERRED, error: 'no handler for goal yet' });
			expect(EverWorksSyncContext.isApplying()).toBe(false);
		});

		it('a failing event is retried and stops its aggregate; after 10 attempts it is dead and logged', async () => {
			const applier = new EverWorksInboundApplier(dataSource, log);
			const seen: string[] = [];
			applier.register({
				aggregateTypes: ['task'],
				apply: async (env) => {
					seen.push(env.seq);
					if (env.seq === '1') throw new Error('boom');
					return { status: 'applied' };
				}
			});
			await record({ seq: '1' });
			await record({ seq: '2' });
			await applier.drain(connection);
			expect(seen).toEqual(['1']);
			const failing = (await events().findOneByOrFail({ seq: '1' } as never)) as EverWorksInboundEvent;
			expect(failing).toMatchObject({ status: EverWorksInboundStatus.FAILED, attempts: 1 });
			await events().update({ id: failing.id }, { attempts: 9, availableAt: new Date(0) });
			await applier.drain(connection);
			expect(await events().findOneByOrFail({ id: failing.id })).toMatchObject({ status: EverWorksInboundStatus.DEAD, attempts: 10 });
			expect(await dataSource.getRepository(EverWorksSyncLog).count({ where: { action: 'dead_letter' } })).toBe(1);
		});
	});

	describe('outbound queue and pusher', () => {
		it('coalesces triggers into one pending change (a delete wins), and drops unmapped organizations', async () => {
			const queue = new EverWorksOutboundQueue(dataSource);
			const gauzyId = randomUUID();
			expect(await queue.enqueue({ tenantId: A.tenantId, organizationId: A.organizationId, entityType: EverWorksLinkType.TASK, gauzyId, changedFields: ['title'] })).toBe(true);
			await queue.enqueue({ tenantId: A.tenantId, organizationId: A.organizationId, entityType: EverWorksLinkType.TASK, gauzyId, changedFields: ['status'] });
			await queue.enqueue({ tenantId: A.tenantId, organizationId: A.organizationId, entityType: EverWorksLinkType.TASK, gauzyId, op: 'delete' });
			const rows = await dataSource.getRepository(EverWorksOutboundChange).find();
			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({ op: 'delete', integrationTenantId, status: 'pending' });
			expect(JSON.parse(rows[0].changedFieldsHint as string).sort()).toEqual(['status', 'title']);
			expect(await queue.enqueue({ tenantId: A.tenantId, organizationId: randomUUID(), entityType: EverWorksLinkType.TASK, gauzyId })).toBe(false);
		});

		it('pushes through the handler of the type, defers types without one, and dead-letters after retryable failures', async () => {
			const queue = new EverWorksOutboundQueue(dataSource);
			const pusher = new EverWorksOutboundPusher(dataSource, log);
			const pushed: string[] = [];
			let failures = 0;
			pusher.register({
				entityTypes: [EverWorksLinkType.TASK],
				push: async (change) => {
					if (change.gauzyId === 'fails') {
						failures++;
						const { EverWorksApiError } = await import('../client/ever-works-client');
						throw new EverWorksApiError(503, 'internal_error', 'down');
					}
					pushed.push(change.gauzyId);
					return { status: 'pushed' };
				}
			});
			const t = new Date(Date.now() + 10_000);
			await queue.enqueue({ tenantId: A.tenantId, organizationId: A.organizationId, entityType: EverWorksLinkType.TASK, gauzyId: 'ok' });
			await queue.enqueue({ tenantId: A.tenantId, organizationId: A.organizationId, entityType: EverWorksLinkType.TASK, gauzyId: 'fails' });
			await queue.enqueue({ tenantId: A.tenantId, organizationId: A.organizationId, entityType: EverWorksLinkType.TEAM, gauzyId: 'team' });
			await pusher.drain(connection, 100, t);
			expect(pushed).toEqual(['ok']);
			const repo = dataSource.getRepository(EverWorksOutboundChange);
			expect(await repo.findOneByOrFail({ gauzyId: 'team' })).toMatchObject({ status: EverWorksOutboundStatus.DEFERRED });
			const failing = await repo.findOneByOrFail({ gauzyId: 'fails' });
			expect(failing).toMatchObject({ status: EverWorksOutboundStatus.FAILED, attempts: 1 });
			await repo.update({ id: failing.id }, { attempts: 7, availableAt: new Date(0) });
			await pusher.drain(connection, 100, t);
			expect(await repo.findOneByOrFail({ id: failing.id })).toMatchObject({ status: EverWorksOutboundStatus.DEAD, attempts: 8 });
			expect(failures).toBe(2);
		});
	});

	it('the loop lease: one process works a connection; the other takes over once the lease expires', async () => {
		const applier = new EverWorksInboundApplier(dataSource, log);
		const pusher = new EverWorksOutboundPusher(dataSource, log);
		const poller = new EverWorksFeedPoller(dataSource, connections, store);
		const one = new EverWorksSyncLoop(dataSource, poller, applier, pusher, log, { EVER_WORKS_ENABLED: 'true' });
		const two = new EverWorksSyncLoop(dataSource, poller, applier, pusher, log, { EVER_WORKS_ENABLED: 'true' });
		const now = new Date();
		expect(await one.claim(connection.id as string, now)).toBe(true);
		expect(await two.claim(connection.id as string, now)).toBe(false);
		expect(await one.claim(connection.id as string, now)).toBe(true); // renewal
		expect(await two.claim(connection.id as string, new Date(now.getTime() + 61_000))).toBe(true);
		const worked = await two.tick(new Date(now.getTime() + 62_000));
		expect(worked).toEqual([connection.id]);
		expect(await one.tick(new Date(now.getTime() + 62_000))).toEqual([]);
		await connections.pause(connection.id as string);
		expect(await two.tick(new Date(now.getTime() + 63_000))).toEqual([]); // paused: not worked
		await reload();
		expect(connection.status).toBe(EverWorksConnectionStatus.PAUSED);
	});
});
