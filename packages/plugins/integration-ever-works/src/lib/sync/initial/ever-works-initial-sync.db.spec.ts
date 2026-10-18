/**
 * G-P1-10 on a real database (better-sqlite3) with the mock Ever Works: the runs table's migration (up,
 * up again, down, up), the dry run, the initial sync's phases (initial events parents first, a phase
 * waits for its records, export of paired teams and tasks in scope, skipped phases), resuming a run,
 * the replay of skipped feed events after the head, the resync a 410 asks for, the status, the sync
 * log and the conflicts ("keep" and "use the other value").
 */
const mockCaller: { tenantId: string | null; userId: string | null; organizationId: string | null } = {
	tenantId: null,
	userId: null,
	organizationId: null
};

jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const entity = (name: string) => ({ [name]: class {} })[name];
	class TaskUpdateCommand {
		constructor(
			public readonly id: string,
			public readonly input: Record<string, unknown>,
			public readonly triggeredEvent = true
		) {}
	}
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		ExportRedacted: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		verifyWebhookSignature: () => true,
		TaskUpdateCommand,
		...Object.fromEntries(
			[
				'Tenant',
				'Organization',
				'UserOrganization',
				'Employee',
				'EmployeeNotification',
				'IntegrationTenant',
				'IntegrationSetting',
				'OrganizationTeam',
				'OrganizationProject',
				'Task'
			].map((name) => [name, entity(name)])
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
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, EntitySchema, MoreThan } from 'typeorm';
import {
	IntegrationSetting,
	IntegrationTenant,
	Organization,
	OrganizationProject,
	OrganizationTeam,
	Task,
	Tenant,
	UserOrganization,
	Employee,
	EmployeeNotification
} from '@gauzy/core';
import { TestEverWorksClientFactory } from '../../client/ever-works-client.factory';
import type { EverWorksHttpRequest } from '../../client/ever-works-transport';
import { EverWorksConnection } from '../../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../../connection/ever-works-connection.service';
import { EverWorksNotifier } from '../../connection/ever-works-notifier.service';
import { CreateEverWorksConnection1791000001100 } from '../../database/migrations/1791000001100-CreateEverWorksConnection';
import { CreateEverWorksSyncTables1791000001300 } from '../../database/migrations/1791000001300-CreateEverWorksSyncTables';
import { CreateEverWorksSyncRun1791000001550 } from '../../database/migrations/1791000001550-CreateEverWorksSyncRun';
import { hasIndex } from '../../database/migration-helpers';
import { EverWorksScopeService } from '../../ever-works-scope.service';
import { EverWorksSettingName } from '../../ever-works-setting.enum';
import { EverWorksMappingContextService } from '../../mapping/ever-works-mapping-context.service';
import { MockEverWorksServer } from '../../testing/mock-ever-works.server';
import { EverWorksSyncStatusService } from '../admin/ever-works-sync-status.service';
import { EverWorksConflictsService } from '../conflicts/ever-works-conflicts.service';
import {
	EverWorksEntityLink,
	EverWorksInboundEvent,
	EverWorksInboundStatus,
	EverWorksLinkType,
	EverWorksOutboundChange,
	EverWorksSyncLog
} from '../entities/ever-works-sync.entities';
import { EverWorksSyncLogService } from '../ever-works-sync-log.service';
import { EverWorksInboundApplier } from '../inbound/ever-works-inbound.applier';
import { EverWorksInboundStore } from '../inbound/ever-works-inbound.store';
import { EverWorksOutboundPusher } from '../outbound/ever-works-outbound.pusher';
import { EverWorksOutboundQueue } from '../outbound/ever-works-outbound.queue';
import { EverWorksInitialSyncService, EverWorksSyncPhaseState } from './ever-works-initial-sync.service';
import { EverWorksSyncRun } from './ever-works-sync-run.entity';

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
const s = (name: string, target: new (...args: never[]) => object, tableName: string, columns: Record<string, unknown>, relations?: Record<string, unknown>) =>
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
	s('OrganizationTeam', OrganizationTeam, 'organization_team', { name: str(false), emoji: str() }),
	s('OrganizationProject', OrganizationProject, 'organization_project', { name: str(false), description: txt() }),
	s('Task', Task, 'task', { title: str(false), projectId: str(), issueType: str(), taskTypeId: str() }),
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
	}),
	s('EverWorksSyncRun', EverWorksSyncRun, 'ever_works_sync_run', {
		integrationTenantId: str(false), connectionId: str(false), mode: str(false), reason: str(), status: str(false), feedHead: str(), currentPhase: str(),
		phases: txt(), requestedByUserId: str(), startedAt: date, finishedAt: date, lastProgressAt: date, lastError: txt()
	})
];

describe('Ever Works initial sync, resync and observability on SQLite', () => {
	let dir: string;
	let dataSource: DataSource;
	let mock: MockEverWorksServer;
	let lists: Map<string, Array<Record<string, unknown>>>;
	/** The list page size the transport serves (tests read several pages with a small one). */
	let pageSize: number;
	/** A list route answers 404 after this many requests (a route Ever Works stops serving part-way). */
	let failListAfter: Record<string, number>;
	/** Runs before a list request is answered (its path and how many times it was requested). */
	let onList: ((path: string, call: number) => Promise<void>) | null;
	let listCalls: Record<string, number>;
	let connections: EverWorksConnectionService;
	let store: EverWorksInboundStore;
	let log: EverWorksSyncLogService;
	let applier: EverWorksInboundApplier;
	let pusher: EverWorksOutboundPusher;
	let queue: EverWorksOutboundQueue;
	let contexts: EverWorksMappingContextService;
	let initial: EverWorksInitialSyncService;
	let conflicts: EverWorksConflictsService;
	let status: EverWorksSyncStatusService;
	let commandBus: { execute: jest.Mock };
	let connection: EverWorksConnection;
	let ewOrgId: string;
	let integrationTenantId: string;
	let applied: string[];
	const savedKey = process.env['ENCRYPTION_KEY'];
	const A = { tenantId: randomUUID(), organizationId: randomUUID(), userId: randomUUID() };

	const reload = async () => (connection = await dataSource.getRepository(EverWorksConnection).findOneByOrFail({ id: connection.id as string }));
	const runs = () => dataSource.getRepository(EverWorksSyncRun);
	const phase = (run: EverWorksSyncRun, name: string) => (JSON.parse(run.phases ?? '[]') as EverWorksSyncPhaseState[]).find((p) => p.name === name);
	/** The loop's work for one connection: sweep (advance runs), then apply what is pending; until no run is running. */
	const runToEnd = async (max = 40) => {
		for (let i = 0; i < max; i++) {
			await reload();
			await initial.sweep(connection);
			await applier.drain(connection, 500);
			if (!(await runs().count({ where: { integrationTenantId, status: 'running' } as never }))) return;
		}
		throw new Error('the run did not finish');
	};

	beforeAll(async () => {
		process.env['ENCRYPTION_KEY'] = randomBytes(32).toString('base64');
		dir = mkdtempSync(join(tmpdir(), 'ever-works-initial-'));
		const file = join(dir, 'gauzy.sqlite');
		const core = new DataSource({ type: 'better-sqlite3', database: file, entities: coreSchemas, synchronize: true });
		await core.initialize();
		await core.destroy();
		dataSource = new DataSource({ type: 'better-sqlite3', database: file, entities: [...coreSchemas, ...pluginSchemas] });
		await dataSource.initialize();
		const runner = dataSource.createQueryRunner();
		await new CreateEverWorksConnection1791000001100().up(runner);
		await new CreateEverWorksSyncTables1791000001300().up(runner);
		await new CreateEverWorksSyncRun1791000001550().up(runner);
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
		for (const table of [
			'ever_works_sync_run',
			'ever_works_inbound_event',
			'ever_works_outbound_change',
			'ever_works_sync_log',
			'ever_works_entity_link',
			'integration_setting',
			'integration_tenant',
			'ever_works_connection',
			'organization_team',
			'organization_project',
			'task'
		]) {
			await dataSource.query(`DELETE FROM "${table}"`);
		}
		mockCaller.tenantId = A.tenantId;
		mockCaller.userId = A.userId;
		mockCaller.organizationId = A.organizationId;
		mock = new MockEverWorksServer();
		lists = new Map();
		pageSize = 500;
		failListAfter = {};
		onList = null;
		listCalls = {};
		// The mock answers whoami, the feed and webhooks; list routes the engine items have not added to it yet are served here.
		const transport = {
			send: async (request: EverWorksHttpRequest) => {
				const url = new URL(request.url);
				const marker = '/integrations/v1';
				const path = url.pathname.slice(url.pathname.indexOf(marker) + marker.length);
				const rows = request.method === 'GET' ? lists.get(path) : undefined;
				if (rows) {
					listCalls[path] = (listCalls[path] ?? 0) + 1;
					if (onList) await onList(path, listCalls[path]);
					if (failListAfter[path] !== undefined && listCalls[path] > failListAfter[path]) {
						return { status: 404, headers: {}, data: { error: { code: 'not_found', message: 'No such route.' } } };
					}
					const query = Object.fromEntries(url.searchParams.entries());
					return { status: 200, headers: {}, data: MockEverWorksServer.page(rows, { ...query, limit: String(Math.min(Number(query['limit'] || 200), pageSize)) }) };
				}
				return mock.handle(request);
			}
		};
		ewOrgId = randomUUID();
		connections = new EverWorksConnectionService(
			dataSource,
			new TestEverWorksClientFactory(transport),
			new EverWorksScopeService(dataSource),
			new EverWorksNotifier(dataSource),
			{ defaultApiUrl: null, appUrl: null, gauzyApiUrl: 'https://api.gauzy.example' }
		);
		store = new EverWorksInboundStore(dataSource);
		log = new EverWorksSyncLogService(dataSource);
		applier = new EverWorksInboundApplier(dataSource, log);
		pusher = new EverWorksOutboundPusher(dataSource, log);
		queue = new EverWorksOutboundQueue(dataSource);
		contexts = new EverWorksMappingContextService(dataSource, new EverWorksScopeService(dataSource));
		initial = new EverWorksInitialSyncService(dataSource, contexts, connections, store, applier, pusher, queue, log);
		commandBus = { execute: jest.fn(async () => undefined) };
		conflicts = new EverWorksConflictsService(dataSource, contexts, log, queue, commandBus as never);
		status = new EverWorksSyncStatusService(dataSource, contexts, connections, conflicts, initial);
		// Stand-ins for the per-type handlers (G-P1-6/7): agents are applied, a team only when it is paired.
		applied = [];
		applier.register({
			aggregateTypes: ['agent'],
			apply: async (envelope) => {
				applied.push(`agent:${envelope.aggregate.id}`);
				return { status: 'applied' };
			}
		});
		applier.register({
			aggregateTypes: ['team'],
			apply: async (envelope) => {
				const link = await dataSource.getRepository(EverWorksEntityLink).findOne({ where: { integrationTenantId, entityType: EverWorksLinkType.TEAM, ewId: envelope.aggregate.id } });
				if (!link) return { status: 'skipped', message: 'not linked yet: pair it on the Teams tab' };
				applied.push(`team:${envelope.aggregate.id}`);
				return { status: 'applied' };
			}
		});
		pusher.register({ entityTypes: [EverWorksLinkType.TEAM, EverWorksLinkType.TASK], push: async () => ({ status: 'skipped', message: 'test' }) });
		const view = await connections.connect({ apiBaseUrl: 'https://ew.example.test/api', apiKey: mock.addKey({ organizations: [{ id: ewOrgId, slug: 'acme', displayName: 'Acme' }] }) });
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
				[EverWorksSettingName.EVER_WORKS_ORGANIZATION_SLUG, 'acme'],
				[EverWorksSettingName.IS_ENABLED, 'true']
			].map(([settingsName, settingsValue]) => ({ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, settingsName, settingsValue }))
		} as never);
		connection = await dataSource.getRepository(EverWorksConnection).findOneByOrFail({ id: view.id });
		// Ever Works: a manager agent listed after the agent reporting to it, two teams (one paired), one task.
		lists.set('/agents', [
			{ id: 'agent-report', organizationId: ewOrgId, version: 3, name: 'Report', reportsToAgentId: 'agent-manager' },
			{ id: 'agent-manager', organizationId: ewOrgId, version: 1, name: 'Manager', reportsToAgentId: null },
			{ id: 'agent-private', organizationId: ewOrgId, version: 1, name: 'Private', visibility: 'private' }
		]);
		lists.set('/teams', [
			{ id: 'ew-team-paired', organizationId: ewOrgId, version: 4, name: 'Platform' },
			{ id: 'ew-team-new', organizationId: ewOrgId, version: 1, name: 'Design' }
		]);
		lists.set('/members', [{ userId: 'ew-user-1', organizationId: ewOrgId, email: 'a@example.com', emailVerified: true }]);
		lists.set('/tasks', [{ id: 'ew-task-1', organizationId: ewOrgId, version: 1, title: 'A task' }]);
		const team = { id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, name: 'Platform', isArchived: false };
		await dataSource.getRepository(OrganizationTeam).save(team as never);
		await dataSource.getRepository(OrganizationTeam).save({ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, name: 'Unpaired', isArchived: false } as never);
		await dataSource.getRepository(EverWorksEntityLink).save({
			id: randomUUID(),
			tenantId: A.tenantId,
			organizationId: A.organizationId,
			integrationTenantId,
			entityType: EverWorksLinkType.TEAM,
			gauzyId: team.id,
			ewId: 'ew-team-paired',
			ewVersion: 2,
			state: 'ok'
		} as never);
		await dataSource.getRepository(Task).save([
			{ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, title: 'G task 1' },
			{ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, title: 'G task 2' }
		] as never);
	});

	it('the runs migration is idempotent and reversible, with one running run per mapping', async () => {
		const runner = dataSource.createQueryRunner();
		try {
			const migration = new CreateEverWorksSyncRun1791000001550();
			await migration.up(runner);
			expect(await hasIndex(runner, 'ever_works_sync_run', 'UQ_ever_works_sync_run_running')).toBe(true);
			await migration.down(runner);
			expect(await runner.hasTable('ever_works_sync_run')).toBe(false);
			expect(await runner.hasTable('ever_works_sync_log')).toBe(true);
			await migration.up(runner);
			expect(await runner.hasColumn('ever_works_sync_run', 'phases')).toBe(true);
		} finally {
			await runner.release();
		}
	});

	it('the dry run counts each side, the pairs and the creates, and writes nothing', async () => {
		const preview = await initial.preview(integrationTenantId);
		const byPhase = Object.fromEntries(preview.phases.map((p) => [p.phase, p]));
		expect(byPhase['members']).toMatchObject({ supported: true, everWorks: { total: 1, linked: 0 }, toPair: { everWorks: 1 } });
		// The private agent is never counted (nor imported).
		expect(byPhase['agents']).toMatchObject({ supported: true, everWorks: { total: 2, linked: 0 }, creates: { inGauzy: 2, inEverWorks: 0 } });
		expect(byPhase['teams']).toMatchObject({ supported: true, everWorks: { total: 2, linked: 1 }, gauzy: { total: 2, linked: 1 }, toPair: { everWorks: 1, gauzy: 1 } });
		expect(byPhase['teams'].creates).toEqual({ inGauzy: 0, inEverWorks: 0 });
		// No task inbound handler in this test: tasks are only queued for Ever Works (both directions by default).
		expect(byPhase['tasks']).toMatchObject({ supported: true, gauzy: { total: 2, linked: 0 }, creates: { inGauzy: 0, inEverWorks: 2 } });
		expect(byPhase['works']).toMatchObject({ supported: false });
		expect(byPhase['goals']).toMatchObject({ supported: false });
		expect(await dataSource.getRepository(EverWorksInboundEvent).count()).toBe(0);
		expect(await dataSource.getRepository(EverWorksOutboundChange).count()).toBe(0);
		expect(await runs().count()).toBe(0);
	});

	it('the dry run counts as creates only what a run creates (local e2e: idea tasks, stopped links)', async () => {
		// An Idea task syncs as an Ever Works idea, never as a task; a record whose link stopped syncing (the Gauzy task
		// was deleted, so Ever Works cancelled it) is known and is not created again.
		// Every form the push treats as an idea (review on #11047): the name in any case, and the seeded type's id.
		const ideaTypeId = randomUUID();
		await dataSource.getRepository(IntegrationSetting).save({
			id: randomUUID(),
			tenantId: A.tenantId,
			organizationId: A.organizationId,
			integration: { id: integrationTenantId },
			settingsName: EverWorksSettingName.IDEA_ISSUE_TYPE_ID,
			settingsValue: ideaTypeId
		} as never);
		await dataSource.getRepository(Task).save([
			{ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, title: 'An idea', issueType: 'Idea' },
			{ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, title: 'another idea', issueType: 'idea' },
			{ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, title: 'a typed idea', taskTypeId: ideaTypeId }
		] as never);
		await dataSource.getRepository(EverWorksEntityLink).save({
			id: randomUUID(),
			tenantId: A.tenantId,
			organizationId: A.organizationId,
			integrationTenantId,
			entityType: EverWorksLinkType.AGENT,
			gauzyId: randomUUID(),
			ewId: 'agent-report',
			ewVersion: 3,
			state: 'unlinked'
		} as never);
		const preview = await initial.preview(integrationTenantId);
		const byPhase = Object.fromEntries(preview.phases.map((p) => [p.phase, p]));
		// Two agents listed, none active-linked, one known through a stopped link: one is created.
		expect(byPhase['agents']).toMatchObject({ everWorks: { total: 2, linked: 0 }, creates: { inGauzy: 1, inEverWorks: 0 } });
		// Five Gauzy tasks, three of them ideas: two go to Ever Works as tasks.
		expect(byPhase['tasks']).toMatchObject({ gauzy: { total: 2, linked: 0 }, creates: { inGauzy: 0, inEverWorks: 2 } });

		// A Gauzy task whose link stopped syncing is not created again either (review on #11047).
		const [stopped] = await dataSource.getRepository(Task).find({ where: { title: 'G task 1' } as never });
		await dataSource.getRepository(EverWorksEntityLink).save({
			id: randomUUID(),
			tenantId: A.tenantId,
			organizationId: A.organizationId,
			integrationTenantId,
			entityType: EverWorksLinkType.TASK,
			gauzyId: stopped.id,
			ewId: 'ew-task-gone',
			ewVersion: 2,
			state: 'unlinked'
		} as never);
		const again = (await initial.preview(integrationTenantId)).phases.find((p) => p.phase === 'tasks');
		expect(again).toMatchObject({ gauzy: { total: 2, linked: 0 }, creates: { inEverWorks: 1 } });
	});

	it('runs the phases in order: agents parents first, paired teams refreshed and pushed, tasks queued, unsupported phases skipped', async () => {
		await mock.emit({ type: 'task.updated', organizationId: ewOrgId, aggregate: { type: 'task', id: 't0', version: 1 }, actor: { type: 'user', id: 'u' }, data: {} } as never);
		const run = await initial.start(integrationTenantId, 'initial');
		expect(run).toMatchObject({ mode: 'initial', status: 'running', feedHead: mock.head, reason: 'admin', requestedByUserId: A.userId });
		await expect(initial.start(integrationTenantId, 'resync')).rejects.toBeInstanceOf(ConflictException);
		await runToEnd();
		const done = await runs().findOneByOrFail({ id: run.id });
		expect(done.status).toBe('done');
		expect(phase(done, 'members')).toMatchObject({ status: 'done', queued: 0 });
		expect(phase(done, 'agents')).toMatchObject({ status: 'done', queued: 2 });
		expect(phase(done, 'teams')).toMatchObject({ status: 'done', queued: 2, exported: 1 });
		expect(phase(done, 'tasks')).toMatchObject({ status: 'done', queued: 0, exported: 2 });
		expect(phase(done, 'task_edges')).toMatchObject({ status: 'done' });
		for (const name of ['works', 'missions', 'goals', 'ideas', 'comments', 'inbox', 'docs']) expect(phase(done, name)?.status).toBe('skipped');
		// The manager is applied before the agent that reports to it; only the paired team is applied.
		expect(applied).toEqual(['agent:agent-manager', 'agent:agent-report', 'team:ew-team-paired']);
		const initialEvents = await dataSource.getRepository(EverWorksInboundEvent).find({ where: { receivedVia: 'initial' } as never });
		expect(initialEvents.map((e) => e.aggregateId).sort()).toEqual(['agent-manager', 'agent-report', 'ew-team-new', 'ew-team-paired']);
		expect(initialEvents.every((e) => e.organizationId === A.organizationId && e.type.endsWith('.updated'))).toBe(true);
		expect(initialEvents.find((e) => e.aggregateId === 'ew-team-new')).toMatchObject({ status: EverWorksInboundStatus.SKIPPED });
		const outbound = await dataSource.getRepository(EverWorksOutboundChange).find();
		expect(outbound.filter((c) => c.entityType === EverWorksLinkType.TEAM)).toHaveLength(1);
		expect(outbound.filter((c) => c.entityType === EverWorksLinkType.TASK)).toHaveLength(2);
		const actions = (await dataSource.getRepository(EverWorksSyncLog).find({ where: { integrationTenantId } as never })).map((row) => row.action);
		expect(actions).toEqual(expect.arrayContaining(['initial_sync_started', 'initial_sync_done']));
	});

	it('a resync of unchanged records stores nothing again (same snapshot, same event id)', async () => {
		await initial.start(integrationTenantId, 'initial');
		await runToEnd();
		const resync = await initial.start(integrationTenantId, 'resync');
		await runToEnd();
		const done = await runs().findOneByOrFail({ id: resync.id });
		expect(done.status).toBe('done');
		expect(phase(done, 'agents')).toMatchObject({ queued: 0, duplicates: 2, status: 'done' });
		expect(await dataSource.getRepository(EverWorksInboundEvent).count({ where: { aggregateType: 'agent' } as never })).toBe(2);
	});

	it('parents first across pages: an agent read before its manager is applied after it', async () => {
		pageSize = 1; // one agent per page: the report is read on page 1, its manager on page 2
		await initial.start(integrationTenantId, 'initial');
		await runToEnd();
		expect(applied.filter((entry) => entry.startsWith('agent:'))).toEqual(['agent:agent-manager', 'agent:agent-report']);
		// Nothing stays held back once the run is over.
		expect(await dataSource.getRepository(EverWorksInboundEvent).count({ where: { status: EverWorksInboundStatus.PENDING } as never })).toBe(0);
	});

	it('a list Ever Works stops serving part-way skips its phase and releases what it held back', async () => {
		pageSize = 1;
		// The depth pass reads the 3 agent pages, the import reads page 1, then the route answers 404.
		failListAfter['/agents'] = 4;
		await initial.start(integrationTenantId, 'initial');
		await reload();
		await initial.sweep(connection);
		const run = await runs().findOneOrFail({ where: { integrationTenantId } as never });
		expect(phase(run, 'agents')?.status).toBe('skipped');
		expect(await dataSource.getRepository(EverWorksInboundEvent).count({ where: { receivedVia: 'initial', aggregateType: 'agent' } as never })).toBe(1);
		expect(await dataSource.getRepository(EverWorksInboundEvent).count({ where: { receivedVia: 'initial', availableAt: MoreThan(new Date('9000-01-01')) } as never })).toBe(0);
	});

	it('a run that ends early releases what its phase held back', async () => {
		await initial.start(integrationTenantId, 'initial');
		// A record stored held, as an import cut short by the cancel leaves it.
		const envelope = {
			id: 'initial:agent:held:v1',
			seq: '0',
			type: 'agent.updated',
			version: 1,
			occurredAt: new Date().toISOString(),
			tenantId: mock.tenant.id,
			organizationId: ewOrgId,
			aggregate: { type: 'agent', id: 'held', version: 1 },
			actor: { type: 'system', id: 'initial-sync' },
			data: { id: 'held' }
		};
		await store.record(connection, envelope as never, 'initial', { availableAt: new Date('9999-01-01T00:00:00.000Z') });
		const held = () => dataSource.getRepository(EverWorksInboundEvent).count({ where: { receivedVia: 'initial', availableAt: MoreThan(new Date('9000-01-01')) } as never });
		expect(await held()).toBe(1);
		await initial.cancel(integrationTenantId);
		expect(await held()).toBe(0);
	});

	it('a cancel during a list import leaves nothing held: the rest of the page is released too (review F18)', async () => {
		pageSize = 1;
		const held = () => dataSource.getRepository(EverWorksInboundEvent).count({ where: { receivedVia: 'initial', availableAt: MoreThan(new Date('9000-01-01')) } as never });
		// The depth pass reads the 3 agent pages, the import reads page 1; the admin cancels while page 2 is read.
		onList = async (path, call) => {
			if (path === '/agents' && call === 5) await initial.cancel(integrationTenantId);
		};
		await initial.start(integrationTenantId, 'initial');
		await reload();
		await initial.sweep(connection);
		expect((await runs().findOneOrFail({ where: { integrationTenantId } as never })).status).toBe('cancelled');
		// Page 2 was stored after the cancel released page 1: it is due too, not held until 9999.
		expect(await dataSource.getRepository(EverWorksInboundEvent).count({ where: { receivedVia: 'initial', aggregateType: 'agent' } as never })).toBe(2);
		expect(await held()).toBe(0);
	});

	it('records a run that ended left held are released by the next sweep (review F18)', async () => {
		const envelope = {
			id: 'initial:agent:orphan:v1',
			seq: '0',
			type: 'agent.updated',
			version: 1,
			occurredAt: new Date().toISOString(),
			tenantId: mock.tenant.id,
			organizationId: ewOrgId,
			aggregate: { type: 'agent', id: 'orphan', version: 1 },
			actor: { type: 'system', id: 'initial-sync' },
			data: { id: 'orphan' }
		};
		await reload();
		await store.record(connection, envelope as never, 'initial', { availableAt: new Date('9999-01-01T00:00:00.000Z') });
		const held = () => dataSource.getRepository(EverWorksInboundEvent).count({ where: { receivedVia: 'initial', availableAt: MoreThan(new Date('9000-01-01')) } as never });
		expect(await held()).toBe(1);
		// No run is running for the mapping: nothing will release it otherwise, and it would hold back its agent's live events.
		await initial.sweep(connection);
		expect(await held()).toBe(0);
	});

	it('a phase waits for its records: the next phase starts only once they are applied', async () => {
		await initial.start(integrationTenantId, 'initial');
		await reload();
		await initial.sweep(connection); // agents queued, not applied yet
		let run = await runs().findOneOrFail({ where: { integrationTenantId } as never });
		expect(phase(run, 'agents')?.status).toBe('applying');
		expect(phase(run, 'teams')?.status).toBe('pending');
		await initial.sweep(connection); // still waiting: nothing applied in between
		run = await runs().findOneOrFail({ where: { integrationTenantId } as never });
		expect(phase(run, 'teams')?.status).toBe('pending');
		await applier.drain(connection, 500);
		await initial.sweep(connection);
		run = await runs().findOneOrFail({ where: { integrationTenantId } as never });
		expect(phase(run, 'agents')?.status).toBe('done');
		expect(phase(run, 'teams')?.status).toBe('applying');
	});

	it('Ever Works failing on a list: the phase backs off and the run resumes from its checkpoint', async () => {
		await initial.start(integrationTenantId, 'initial');
		lists.delete('/agents');
		mock.fail({ method: 'GET', path: '/agents', status: 503, times: 5 });
		await reload();
		await initial.sweep(connection);
		let run = await runs().findOneOrFail({ where: { integrationTenantId } as never });
		expect(phase(run, 'agents')).toMatchObject({ status: 'importing', attempts: 1 });
		expect(phase(run, 'agents')?.retryAt).toBeTruthy();
		// Ever Works answers again and the back-off is over: the same phase carries on.
		mock.failures.splice(0);
		lists.set('/agents', [{ id: 'agent-x', organizationId: ewOrgId, version: 1, name: 'X' }]);
		const phases = JSON.parse(run.phases as string) as EverWorksSyncPhaseState[];
		(phases.find((p) => p.name === 'agents') as EverWorksSyncPhaseState).retryAt = new Date(Date.now() - 1000).toISOString();
		await runs().update({ id: run.id }, { phases: JSON.stringify(phases) } as never);
		await runToEnd();
		run = await runs().findOneOrFail({ where: { integrationTenantId } as never });
		expect(run.status).toBe('done');
		expect(phase(run, 'agents')).toMatchObject({ status: 'done', queued: 1, attempts: 0 });
	});

	it('replays feed events after the head that were skipped meanwhile, never our own origin', async () => {
		const run = await initial.start(integrationTenantId, 'initial');
		const after = String(BigInt(run.feedHead as string) + 5n);
		const event = (id: string, seq: string) => ({
			id,
			seq,
			type: 'team.member.added',
			version: 1,
			occurredAt: new Date().toISOString(),
			tenantId: mock.tenant.id,
			organizationId: ewOrgId,
			aggregate: { type: 'team', id: 'ew-team-new', version: 2 },
			actor: { type: 'user', id: 'u' },
			data: {}
		});
		await store.record(connection, event('evt-skipped', after) as never, 'feed');
		await store.record(connection, event('evt-own', String(BigInt(after) + 1n)) as never, 'feed');
		await store.record(connection, event('evt-before-head', run.feedHead as string) as never, 'feed');
		const rows = dataSource.getRepository(EverWorksInboundEvent);
		await rows.update({ eventId: 'evt-skipped' } as never, { status: EverWorksInboundStatus.SKIPPED, error: 'not linked yet: pair it on the Teams tab' } as never);
		await rows.update({ eventId: 'evt-own' } as never, { status: EverWorksInboundStatus.SKIPPED, error: 'own origin' } as never);
		await rows.update({ eventId: 'evt-before-head' } as never, { status: EverWorksInboundStatus.SKIPPED, error: 'not linked yet: pair it on the Teams tab' } as never);
		for (let i = 0; i < 40; i++) {
			await reload();
			await initial.sweep(connection);
			if (!(await runs().count({ where: { integrationTenantId, status: 'running' } as never }))) break;
			// Apply only the initial events, so the replay's own effect stays visible below.
			for (const pending of await rows.find({ where: { receivedVia: 'initial', status: EverWorksInboundStatus.PENDING } as never })) {
				await rows.update({ id: pending.id }, { status: EverWorksInboundStatus.APPLIED } as never);
			}
		}
		expect((await runs().findOneByOrFail({ id: run.id })).status).toBe('done');
		expect((await rows.findOneByOrFail({ eventId: 'evt-skipped' } as never)).status).toBe(EverWorksInboundStatus.PENDING);
		expect((await rows.findOneByOrFail({ eventId: 'evt-own' } as never)).status).toBe(EverWorksInboundStatus.SKIPPED);
		expect((await rows.findOneByOrFail({ eventId: 'evt-before-head' } as never)).status).toBe(EverWorksInboundStatus.SKIPPED);
		const finished = await dataSource.getRepository(EverWorksSyncLog).findOneOrFail({ where: { action: 'initial_sync_done' } as never });
		expect(JSON.parse(finished.details as string)).toMatchObject({ replayed: 1 });
	});

	it('an expired feed cursor (410) starts a resync of every mapping on its own, once', async () => {
		const requestedAt = new Date();
		await dataSource.getRepository(EverWorksConnection).update({ id: connection.id as string }, { resyncRequestedAt: requestedAt } as never);
		await reload();
		await initial.sweep(connection);
		const started = await runs().find({ where: { integrationTenantId } as never });
		expect(started).toHaveLength(1);
		expect(started[0]).toMatchObject({ mode: 'resync', reason: 'cursor_expired', requestedByUserId: null });
		await reload();
		expect(connection.resyncRequestedAt ?? null).toBeNull();
		await initial.sweep(connection);
		expect(await runs().count({ where: { integrationTenantId } as never })).toBe(1);
	});

	it('a cancelled run is not advanced: nothing more is read or queued', async () => {
		await initial.start(integrationTenantId, 'initial');
		await reload();
		await initial.sweep(connection); // members done, agents queued
		await applier.drain(connection, 500);
		await initial.cancel(integrationTenantId);
		await initial.sweep(connection);
		const run = await runs().findOneOrFail({ where: { integrationTenantId } as never });
		expect(run.status).toBe('cancelled');
		// Nothing after the cancel: the teams phase never read its list.
		expect(await dataSource.getRepository(EverWorksInboundEvent).count({ where: { aggregateType: 'team' } as never })).toBe(0);
	});

	it('a restart after storing but before the checkpoint still waits for the records to apply', async () => {
		const run = await initial.start(integrationTenantId, 'initial');
		await reload();
		await initial.sweep(connection); // members done, agents stored + applying
		// As if the process stopped before its checkpoint: the agents phase is back to pending, its events stored.
		const phases = JSON.parse((await runs().findOneByOrFail({ id: run.id })).phases as string) as EverWorksSyncPhaseState[];
		Object.assign(phases.find((p) => p.name === 'agents') as EverWorksSyncPhaseState, { status: 'pending', queued: 0, duplicates: 0, imported: false, pass: 0, pages: 0, cursor: null });
		await runs().update({ id: run.id }, { phases: JSON.stringify(phases) } as never);
		await initial.sweep(connection);
		const after = await runs().findOneByOrFail({ id: run.id });
		expect(phase(after, 'agents')).toMatchObject({ status: 'applying', queued: 0, duplicates: 2 });
		expect(phase(after, 'teams')?.status).toBe('pending');
	});

	it('a 410 during a run that started earlier stays pending, and a resync follows that run', async () => {
		const first = await initial.start(integrationTenantId, 'initial');
		await dataSource.getRepository(EverWorksConnection).update({ id: connection.id as string }, { resyncRequestedAt: new Date(Date.now() + 1000) } as never);
		await reload();
		await initial.sweep(connection);
		await reload();
		expect(connection.resyncRequestedAt ?? null).not.toBeNull(); // kept: the running run may have missed the gap
		await initial.cancel(integrationTenantId);
		expect((await runs().findOneByOrFail({ id: first.id })).status).toBe('cancelled');
		await reload();
		await initial.sweep(connection);
		const followUp = await runs().findOneOrFail({ where: { integrationTenantId, status: 'running' } as never });
		expect(followUp).toMatchObject({ mode: 'resync', reason: 'cursor_expired' });
		await reload();
		expect(connection.resyncRequestedAt ?? null).toBeNull();
	});

	it('the replay goes through every skipped event after the head, in batches, each once', async () => {
		const run = await initial.start(integrationTenantId, 'initial');
		const rows = dataSource.getRepository(EverWorksInboundEvent);
		const head = BigInt(run.feedHead as string);
		for (let i = 1; i <= 1205; i++) {
			const envelope = {
				id: `evt-r-${i}`,
				seq: String(head + BigInt(i)),
				type: 'team.member.added',
				version: 1,
				occurredAt: new Date().toISOString(),
				tenantId: mock.tenant.id,
				organizationId: ewOrgId,
				aggregate: { type: 'team', id: `ew-team-r-${i % 7}`, version: 1 },
				actor: { type: 'user', id: 'u' },
				data: {}
			};
			await store.record(connection, envelope as never, 'feed');
		}
		await rows.update({ receivedVia: 'feed' } as never, { status: EverWorksInboundStatus.SKIPPED, error: 'not linked yet: pair it on the Teams tab' } as never);
		for (let i = 0; i < 40; i++) {
			await reload();
			await initial.sweep(connection);
			if (!(await runs().count({ where: { integrationTenantId, status: 'running' } as never }))) break;
			for (const pending of await rows.find({ where: { receivedVia: 'initial', status: EverWorksInboundStatus.PENDING } as never })) {
				await rows.update({ id: pending.id }, { status: EverWorksInboundStatus.APPLIED } as never);
			}
		}
		expect((await runs().findOneByOrFail({ id: run.id })).status).toBe('done');
		expect(await rows.count({ where: { receivedVia: 'feed', status: EverWorksInboundStatus.PENDING } as never })).toBe(1205);
		const finished = await dataSource.getRepository(EverWorksSyncLog).findOneOrFail({ where: { action: 'initial_sync_done' } as never });
		expect(JSON.parse(finished.details as string)).toMatchObject({ replayed: 1205 });
	});

	it('a disabled mapping cancels its running run; cancel stops one by hand', async () => {
		const first = await initial.start(integrationTenantId, 'initial');
		await expect(initial.cancel(integrationTenantId)).resolves.toMatchObject({ id: first.id, status: 'cancelled' });
		await initial.start(integrationTenantId, 'resync');
		await dataSource
			.getRepository(IntegrationSetting)
			.update({ settingsName: EverWorksSettingName.IS_ENABLED } as never, { settingsValue: 'false' } as never);
		await reload();
		await initial.sweep(connection);
		expect(await runs().count({ where: { integrationTenantId, status: 'running' } as never })).toBe(0);
		await expect(initial.start(integrationTenantId, 'initial')).rejects.toBeInstanceOf(BadRequestException);
	});

	it('status: lag against the feed head, queue counts, link totals, open conflicts and the latest runs', async () => {
		await mock.emit({ type: 'team.updated', organizationId: ewOrgId, aggregate: { type: 'team', id: 'x', version: 1 }, actor: { type: 'user', id: 'u' }, data: {} } as never);
		await mock.emit({ type: 'team.updated', organizationId: ewOrgId, aggregate: { type: 'team', id: 'x', version: 2 }, actor: { type: 'user', id: 'u' }, data: {} } as never);
		const env = (id: string, seq: string) => ({ ...mock.events[0], id, seq });
		await store.record(connection, env('e1', '1') as never, 'feed');
		await store.record(connection, env('e2', '2') as never, 'feed');
		await dataSource.getRepository(EverWorksInboundEvent).update({ eventId: 'e1' } as never, { status: EverWorksInboundStatus.APPLIED } as never);
		await dataSource.getRepository(EverWorksInboundEvent).update({ eventId: 'e2' } as never, { status: EverWorksInboundStatus.DEAD } as never);
		await queue.enqueue({ tenantId: A.tenantId, organizationId: A.organizationId, entityType: EverWorksLinkType.TEAM, gauzyId: randomUUID() });
		await conflicts.record({
			tenantId: A.tenantId,
			organizationId: A.organizationId,
			integrationTenantId,
			direction: 'inbound',
			entityType: EverWorksLinkType.TEAM,
			gauzyId: randomUUID(),
			ewId: 'ew-team-paired',
			field: 'name',
			gauzyValue: 'Platform',
			everWorksValue: 'Platform team',
			winner: 'ever_works'
		});
		await initial.start(integrationTenantId, 'initial');
		const view = await status.status(integrationTenantId);
		expect(view.lag).toMatchObject({ head: '2', lastApplied: '1', behind: '1', headError: null });
		expect(view.inbound).toMatchObject({ dead: 1, pending: 0 });
		expect(view.outbound).toMatchObject({ pending: 1 });
		expect(view.conflicts.open).toBe(1);
		expect(view.entities).toEqual([expect.objectContaining({ entityType: 'TEAM', total: 1, ok: 1 })]);
		expect(view.run).toMatchObject({ status: 'running', mode: 'initial' });
		expect(view.runs).toHaveLength(1);
		expect(view.connection).toMatchObject({ id: connection.id, status: 'active', resyncRequested: false });
	});

	it('the sync log: newest first, filtered, paged, and only this mapping', async () => {
		const write = (status: 'ok' | 'error', action: string, integration: string | null = integrationTenantId) =>
			log.write({ tenantId: A.tenantId, organizationId: A.organizationId, integrationTenantId: integration, connectionId: connection.id as string, direction: 'outbound', action, status });
		await write('ok', 'a1');
		await write('error', 'a2');
		await write('ok', 'other-mapping', randomUUID());
		// The applier logs dead letters with the connection and organization instead of the mapping.
		await write('error', 'dead_letter', null);
		const all = await status.log(integrationTenantId, {});
		expect(all.items.map((item) => item.action).sort()).toEqual(['a1', 'a2', 'dead_letter']);
		const errors = await status.log(integrationTenantId, { status: 'error' });
		expect(errors.items.map((item) => item.action).sort()).toEqual(['a2', 'dead_letter']);
		const first = await status.log(integrationTenantId, { limit: '2' });
		expect(first.items).toHaveLength(2);
		expect(first.nextCursor).toBeTruthy();
		// Rows written in the same second are not skipped between pages.
		const second = await status.log(integrationTenantId, { limit: '2', cursor: first.nextCursor as string });
		expect(second.items).toHaveLength(1);
		expect(second.nextCursor).toBeNull();
		expect([...first.items, ...second.items].map((item) => item.action).sort()).toEqual(['a1', 'a2', 'dead_letter']);
		expect((await status.log(integrationTenantId, { status: 'not-a-status' })).items).toHaveLength(3);
	});

	describe('conflicts', () => {
		const teamConflict = async (gauzyId: string) =>
			conflicts.record({
				tenantId: A.tenantId,
				organizationId: A.organizationId,
				integrationTenantId,
				direction: 'inbound',
				entityType: EverWorksLinkType.TEAM,
				gauzyId,
				ewId: 'ew-team-paired',
				field: 'name',
				gauzyValue: 'Platform',
				everWorksValue: 'Platform team',
				winner: 'ever_works'
			});

		it('lists open ones with both values; keep resolves once', async () => {
			await teamConflict(randomUUID());
			const open = await conflicts.list(integrationTenantId, {});
			expect(open.items).toHaveLength(1);
			expect(open.items[0]).toMatchObject({ resolved: false, canUseOther: true, details: { field: 'name', winner: 'ever_works', gauzyValue: 'Platform' } });
			const resolved = await conflicts.resolve(integrationTenantId, open.items[0].id, 'keep');
			expect(resolved).toMatchObject({ resolved: true, resolvedByUserId: A.userId, details: { resolution: 'keep' } });
			await expect(conflicts.resolve(integrationTenantId, open.items[0].id, 'keep')).rejects.toBeInstanceOf(ConflictException);
			expect((await conflicts.list(integrationTenantId, {})).items).toHaveLength(0);
			expect((await conflicts.list(integrationTenantId, { state: 'resolved' })).items).toHaveLength(1);
		});

		it('"use the other value" writes the losing value into the Gauzy record and queues it for Ever Works', async () => {
			const team = await dataSource.getRepository(OrganizationTeam).findOneOrFail({ where: { name: 'Platform' } as never });
			await dataSource.getRepository(OrganizationTeam).update({ id: team.id } as never, { name: 'Platform team' } as never); // Ever Works won
			await teamConflict(team.id as string);
			const [conflict] = (await conflicts.list(integrationTenantId, {})).items;
			await conflicts.resolve(integrationTenantId, conflict.id, 'use_other');
			expect((await dataSource.getRepository(OrganizationTeam).findOneOrFail({ where: { id: team.id } as never })).name).toBe('Platform');
			expect(await dataSource.getRepository(EverWorksOutboundChange).count({ where: { entityType: EverWorksLinkType.TEAM, gauzyId: team.id } as never })).toBe(1);
		});

		it('a failing write gives the claim back: the conflict stays open', async () => {
			await teamConflict(randomUUID()); // its Gauzy team does not exist: the write fails
			const [conflict] = (await conflicts.list(integrationTenantId, {})).items;
			await expect(conflicts.resolve(integrationTenantId, conflict.id, 'use_other')).rejects.toBeTruthy();
			const [again] = (await conflicts.list(integrationTenantId, {})).items;
			expect(again).toMatchObject({ id: conflict.id, resolved: false, resolvedByUserId: null });
			expect(again.details?.resolution).toBeUndefined();
		});

		it('two resolutions at once: one wins, the other writes nothing', async () => {
			const team = await dataSource.getRepository(OrganizationTeam).findOneOrFail({ where: { name: 'Platform' } as never });
			await dataSource.getRepository(OrganizationTeam).update({ id: team.id } as never, { name: 'Platform team' } as never);
			await teamConflict(team.id as string);
			const [conflict] = (await conflicts.list(integrationTenantId, {})).items;
			const results = await Promise.allSettled([conflicts.resolve(integrationTenantId, conflict.id, 'keep'), conflicts.resolve(integrationTenantId, conflict.id, 'use_other')]);
			expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
			const resolved = (await conflicts.list(integrationTenantId, { state: 'resolved' })).items[0];
			const name = (await dataSource.getRepository(OrganizationTeam).findOneOrFail({ where: { id: team.id } as never })).name;
			// The value in Gauzy matches the resolution that won.
			expect(name).toBe(resolved.details?.resolution === 'use_other' ? 'Platform' : 'Platform team');
		});

		it('a resolution cut short frees its conflict after the claim time; a fresh claim is respected', async () => {
			await teamConflict(randomUUID());
			const [conflict] = (await conflicts.list(integrationTenantId, {})).items;
			// Another admin's resolution is in progress (claimed a moment ago): refused.
			await dataSource.getRepository(EverWorksSyncLog).update({ id: conflict.id } as never, { resolvedByUserId: randomUUID(), updatedAt: new Date() } as never);
			await expect(conflicts.resolve(integrationTenantId, conflict.id, 'keep')).rejects.toBeInstanceOf(ConflictException);
			// The process stopped mid-way long ago: the conflict can be resolved again.
			await dataSource.getRepository(EverWorksSyncLog).update({ id: conflict.id } as never, { updatedAt: new Date(Date.now() - 10 * 60_000) } as never);
			await expect(conflicts.resolve(integrationTenantId, conflict.id, 'keep')).resolves.toMatchObject({ resolved: true, resolvedByUserId: A.userId });
		});

		it('pages of open conflicts never skip one when earlier ones are resolved in between', async () => {
			for (let i = 0; i < 3; i++) await teamConflict(randomUUID());
			const first = await conflicts.list(integrationTenantId, { limit: '2' });
			expect(first.items).toHaveLength(2);
			for (const item of first.items) await conflicts.resolve(integrationTenantId, item.id, 'keep');
			const next = await conflicts.list(integrationTenantId, { limit: '2', cursor: first.nextCursor as string });
			expect(next.items).toHaveLength(1);
			expect(first.items.map((item) => item.id)).not.toContain(next.items[0].id);
		});

		it('a task value goes through the platform command; a field without a writer is refused', async () => {
			const taskId = randomUUID();
			await conflicts.record({
				tenantId: A.tenantId,
				organizationId: A.organizationId,
				integrationTenantId,
				direction: 'inbound',
				entityType: EverWorksLinkType.TASK,
				gauzyId: taskId,
				ewId: 'ew-task-1',
				field: 'title',
				gauzyValue: 'Mine',
				everWorksValue: 'Theirs',
				winner: 'gauzy'
			});
			const [task] = (await conflicts.list(integrationTenantId, {})).items;
			await conflicts.resolve(integrationTenantId, task.id, 'use_other');
			expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({ id: taskId, input: expect.objectContaining({ title: 'Theirs' }), triggeredEvent: true }));
			await conflicts.record({
				tenantId: A.tenantId,
				organizationId: A.organizationId,
				integrationTenantId,
				direction: 'inbound',
				entityType: EverWorksLinkType.TASK,
				gauzyId: taskId,
				ewId: 'ew-task-1',
				field: 'assignees',
				gauzyValue: [],
				everWorksValue: ['x'],
				winner: 'gauzy'
			});
			const [other] = (await conflicts.list(integrationTenantId, {})).items;
			expect(other.canUseOther).toBe(false);
			await expect(conflicts.resolve(integrationTenantId, other.id, 'use_other')).rejects.toBeInstanceOf(BadRequestException);
		});
	});
});
