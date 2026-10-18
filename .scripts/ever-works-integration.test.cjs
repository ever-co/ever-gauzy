// cspell:ignore sqljs
/**
 * The Ever Works integration (`@gauzy/plugin-integration-ever-works`) at its boundary, on a real SQL
 * database (better-sqlite3; the plugin's own migrations, not a synchronised schema) against the mock
 * Ever Works server — plan 06 G-P1-12, in the style of `ever-async-integration.test.cjs`:
 *
 * - migrations: up, up again, down, up (SQLite; Postgres too when EVER_WORKS_TEST_DATABASE_URL names a
 *   loopback `_test` database: the CI job's service);
 * - tenant and organization isolation;
 * - webhook signature verification;
 * - dedupe (webhook + change feed);
 * - loop suppression: an inbound apply captures no outbound change, our own origin is skipped;
 * - the 412 merge (a push against a newer Ever Works version);
 * - initial-sync resume (a run continues from its checkpoint in another process);
 * - scope: team ↔ organization both ways, a push waiting for an unlinked team, private never synced;
 * - transition revert: a `409 transition_blocked` puts Ever Works' status back into the Gauzy task, with a
 *   comment saying why (tasks, G-P1-9, through the real task store on stand-in task tables);
 * - orphan delete: a linked task gone from Gauzy without a captured delete is found by the task sweep, and
 *   the delete policy is pushed (Ever Works cancels the task; the link stops syncing).
 *
 * The real plugin modules run through ts-node; `@gauzy/core` is replaced by the few entity classes,
 * decorators and helpers the plugin uses (as Ever Async's suite does), so no application boot is needed.
 */
const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const { createHmac, randomBytes, randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const Module = require('node:module');
require('reflect-metadata');
require('ts-node').register({
	transpileOnly: true,
	compilerOptions: {
		module: 'commonjs',
		moduleResolution: 'node',
		target: 'es2022',
		experimentalDecorators: true,
		emitDecoratorMetadata: true
	}
});
const { DataSource, EntitySchema } = require('typeorm');

const PLUGIN = '../packages/plugins/integration-ever-works/src/lib';

// ── @gauzy/core, as far as the plugin uses it ───────────────────────────────────────────────────

const caller = { tenantId: null, userId: null, organizationId: null };
const entityNames = [
	'Tenant',
	'Organization',
	'UserOrganization',
	'User',
	'Employee',
	'EmployeeNotification',
	'Integration',
	'IntegrationType',
	'IntegrationTenant',
	'IntegrationSetting',
	'IntegrationEntitySetting',
	'OrganizationTeam',
	'OrganizationTeamEmployee',
	'OrganizationProject',
	'OrganizationProjectEmployee',
	'Task',
	'Role',
	'IssueType',
	'TaskView',
	'TaskStatus',
	'TaskPriority',
	'Tag',
	'Comment',
	'EntitySubscription',
	'TaskLinkedIssue',
	'ResourceLink',
	'OrganizationStrategicInitiative'
];
const entities = Object.fromEntries(entityNames.map((name) => [name, { [name]: class {} }[name]]));
const decorator = () => () => undefined;
/** Maps TypeORM's subscriber calls to the hooks the platform's `BaseEntityEventSubscriber` offers. */
class BaseEntityEventSubscriber {
	afterInsert(event) {
		return this.afterEntityCreate?.(event.entity);
	}
	afterUpdate(event) {
		return this.afterEntityUpdate?.(event.entity);
	}
	afterRemove(event) {
		return this.afterEntityDelete?.(event.entity ?? event.databaseEntity);
	}
}
const core = {
	...entities,
	ColumnIndex: decorator,
	MultiORMColumn: decorator,
	MultiORMEntity: decorator,
	MultiORMManyToOne: decorator,
	ExportRedacted: decorator,
	SkipExport: decorator,
	Permissions: decorator,
	UseValidationPipe: decorator,
	TenantOrganizationBaseEntity: class {},
	MikroOrmBaseEntityRepository: class {},
	BaseEntityEventSubscriber,
	PermissionGuard: class {},
	TenantPermissionGuard: class {},
	UUIDValidationPipe: class {},
	PluginCommonModule: class {},
	RolePermissionModule: class {},
	EmployeeService: class {},
	EmployeeAgentProfileService: class {},
	OrganizationProjectService: class {},
	EventBus: class {},
	TaskEvent: class {},
	TaskService: class {},
	TaskCreateCommand: class {
		constructor(input, triggeredEvent = true) {
			Object.assign(this, { input, triggeredEvent });
		}
	},
	BaseEntityEventTypeEnum: { CREATED: 'created', UPDATED: 'updated', DELETED: 'deleted' },
	TaskUpdateCommand: class {
		constructor(id, input, triggeredEvent = true) {
			Object.assign(this, { id, input, triggeredEvent });
		}
	},
	OrganizationProjectCreateCommand: class {},
	createSsrfSafeHttpsAgent: () => undefined,
	RequestContext: {
		currentTenantId: () => caller.tenantId,
		currentUserId: () => caller.userId,
		currentOrganizationId: () => caller.organizationId,
		currentRequestContext: () => null,
		/**
		 * The platform opens a request context for the sync's writes (`runInSyncRequestContext`): synchronous like
		 * the platform's, so the sync's store probe sees a real context; restored when the work settles.
		 */
		runWithRequest: (request, work) => {
			const saved = { ...caller };
			const restore = () => Object.assign(caller, saved);
			Object.assign(caller, { tenantId: request.user?.tenantId ?? null, userId: request.user?.id ?? null, organizationId: request.user?.lastOrganizationId ?? null });
			try {
				const result = work();
				if (result && typeof result.then === 'function') return result.finally(restore);
				restore();
				return result;
			} catch (error) {
				restore();
				throw error;
			}
		}
	}
};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
	if (name === '@gauzy/core') {
		core.verifyWebhookSignature ??= originalLoad.call(this, '../packages/core/src/lib/webhook/webhook-signature.ts', module, false).verifyWebhookSignature;
		return core;
	}
	if (name === '@gauzy/common') return { Public: () => () => undefined };
	if (name === '@gauzy/contracts') return originalLoad.call(this, '../packages/contracts/src/index.ts', module, false);
	if (name === '@gauzy/constants') return originalLoad.call(this, '../packages/constants/src/index.ts', module, false);
	if (name === '@gauzy/utils') return originalLoad.call(this, '../packages/utils/src/lib/ssrf-url.ts', module, false);
	return originalLoad.call(this, name, parent, isMain);
};
const load = (path) => require(`${PLUGIN}/${path}`);
const { TestEverWorksClientFactory } = load('client/ever-works-client.factory.ts');
const { EverWorksConnection } = load('connection/ever-works-connection.entity.ts');
const { EverWorksConnectionService } = load('connection/ever-works-connection.service.ts');
const { EverWorksNotifier } = load('connection/ever-works-notifier.service.ts');
const { CreateEverWorksConnection1791000001100 } = load('database/migrations/1791000001100-CreateEverWorksConnection.ts');
const { CreateEverWorksSyncTables1791000001300 } = load('database/migrations/1791000001300-CreateEverWorksSyncTables.ts');
const { CreateEverWorksSyncRun1791000001550 } = load('database/migrations/1791000001550-CreateEverWorksSyncRun.ts');
const { AlterEverWorksConnectionOrganizationForeignKey1791000003100 } = load('database/migrations/1791000003100-AlterEverWorksConnectionOrganizationForeignKey.ts');
const { EverWorksScopeService } = load('ever-works-scope.service.ts');
const { EverWorksSettingName } = load('ever-works-setting.enum.ts');
const { EverWorksMappingContextService } = load('mapping/ever-works-mapping-context.service.ts');
const { EverWorksAgentsService } = load('people/ever-works-agents.service.ts');
const { EverWorksSyncStatusService } = load('sync/admin/ever-works-sync-status.service.ts');
const { EverWorksConflictsService } = load('sync/conflicts/ever-works-conflicts.service.ts');
const sync = load('sync/entities/ever-works-sync.entities.ts');
const { EverWorksSyncLogService } = load('sync/ever-works-sync-log.service.ts');
const { EverWorksFeedPoller } = load('sync/inbound/ever-works-feed.poller.ts');
const { EverWorksInboundApplier } = load('sync/inbound/ever-works-inbound.applier.ts');
const { EverWorksInboundStore } = load('sync/inbound/ever-works-inbound.store.ts');
const { EverWorksInitialSyncService } = load('sync/initial/ever-works-initial-sync.service.ts');
const { EverWorksSyncRun } = load('sync/initial/ever-works-sync-run.entity.ts');
const { EverWorksLinkService } = load('sync/links/ever-works-link.service.ts');
const { EverWorksOutboundPusher } = load('sync/outbound/ever-works-outbound.pusher.ts');
const { EverWorksOutboundQueue } = load('sync/outbound/ever-works-outbound.queue.ts');
const { EverWorksWebhookController } = load('sync/webhook/ever-works-webhook.controller.ts');
const { EverWorksTeamCapture, EverWorksTeamMemberSubscriber, EverWorksTeamSubscriber } = load('teams/ever-works-team.signals.ts');
const { gauzyTeamsFor, isSyncedVisibility, teamScopeFor } = load('teams/ever-works-team-scope.ts');
const { EverWorksTeamsService } = load('teams/ever-works-teams.service.ts');
const { MockEverWorksServer } = load('testing/mock-ever-works.server.ts');
const { EverWorksSyncContext } = load('sync/ever-works-sync.context.ts');
const { EverWorksTaskStore } = load('tasks/ever-works-task.store.ts');
const { EverWorksTaskCommentsService } = load('tasks/ever-works-task-comments.service.ts');
const { everWorksSideOf } = load('tasks/ever-works-task.mapper.ts');
const { EverWorksTasksService, gauzySideOf } = load('tasks/ever-works-tasks.service.ts');
const { ActorTypeEnum } = require('../packages/contracts/src/index.ts');
// The platform's own column transformer (`ActorTypeEnum` ↔ the stored integer), so comments round-trip as in production.
const { ActorTypeTransformer } = require('../packages/core/src/lib/shared/pipes/actor-type-transform.ts');
Module._load = originalLoad;

// ── Schema ───────────────────────────────────────────────────────────────────────────────────────

const base = {
	// Generated when the plugin saves a new row without one (the platform's entities do the same).
	id: { type: String, primary: true, generated: 'uuid' },
	tenantId: { type: String, nullable: true },
	organizationId: { type: String, nullable: true },
	isActive: { type: Boolean, nullable: true, default: true },
	isArchived: { type: Boolean, nullable: true, default: false },
	archivedAt: { type: Date, nullable: true },
	createdAt: { type: Date, createDate: true },
	updatedAt: { type: Date, updateDate: true }
};
const s = (name, target, tableName, columns, relations) => new EntitySchema({ name, target, tableName, columns: { ...base, ...columns }, relations });
const str = (nullable = true) => ({ type: String, nullable });
const txt = (nullable = true) => ({ type: 'text', nullable });
const date = { type: Date, nullable: true };
const int = (nullable = true) => ({ type: Number, nullable });
const bool = { type: Boolean, nullable: true };
const coreSchemas = [
	s('Tenant', entities.Tenant, 'tenant', { name: str() }),
	s('Organization', entities.Organization, 'organization', { name: str() }),
	s('UserOrganization', entities.UserOrganization, 'user_organization', { userId: str(false) }),
	s('User', entities.User, 'user', { email: str(), firstName: str() }),
	s('Employee', entities.Employee, 'employee', { userId: str() }),
	s('EmployeeNotification', entities.EmployeeNotification, 'employee_notification', { receiverEmployeeId: str() }),
	s('Role', entities.Role, 'role', { name: str(false) }),
	s('OrganizationTeam', entities.OrganizationTeam, 'organization_team', { name: str(false), emoji: str(), public: { type: Boolean, nullable: true } }),
	s('OrganizationTeamEmployee', entities.OrganizationTeamEmployee, 'organization_team_employee', {
		organizationTeamId: str(false), employeeId: str(false), isManager: { type: Boolean, nullable: true }, roleId: str()
	}, { role: { type: 'many-to-one', target: 'Role', joinColumn: { name: 'roleId' } } }),
	s('OrganizationProject', entities.OrganizationProject, 'organization_project', { name: str(false) }),
	// The task columns and relations the task sync reads and writes (EverWorksTaskStore).
	s('TaskStatus', entities.TaskStatus, 'task_status', {
		name: str(false), value: str(false), order: int(), isTodo: bool, isInProgress: bool, isDone: bool, isSystem: bool, projectId: str(), organizationTeamId: str()
	}),
	s('TaskPriority', entities.TaskPriority, 'task_priority', { name: str(false), value: str(false), isSystem: bool, projectId: str(), organizationTeamId: str() }),
	s('Tag', entities.Tag, 'tag', { name: str(false), color: str(), isSystem: bool, organizationTeamId: str() }),
	s('Task', entities.Task, 'task', {
		title: str(false), description: txt(), status: str(), priority: str(), taskStatusId: str(), taskPriorityId: str(), projectId: str(), parentId: str(),
		issueType: str(), taskTypeId: str(), dueDate: date, startDate: date, estimate: int(), deletedAt: { type: Date, nullable: true, deleteDate: true }
	}, {
		members: { type: 'many-to-many', target: 'Employee', joinTable: { name: 'task_employee' } },
		teams: { type: 'many-to-many', target: 'OrganizationTeam', joinTable: { name: 'task_team' } },
		tags: { type: 'many-to-many', target: 'Tag', joinTable: { name: 'tag_task' } },
		project: { type: 'many-to-one', target: 'OrganizationProject', joinColumn: { name: 'projectId' }, createForeignKeyConstraints: false },
		taskStatus: { type: 'many-to-one', target: 'TaskStatus', joinColumn: { name: 'taskStatusId' }, createForeignKeyConstraints: false },
		taskPriority: { type: 'many-to-one', target: 'TaskPriority', joinColumn: { name: 'taskPriorityId' }, createForeignKeyConstraints: false }
	}),
	s('Comment', entities.Comment, 'comment', {
		entity: str(false), entityId: str(false), comment: txt(false), actorType: { ...int(), transformer: new ActorTypeTransformer() }, employeeId: str(), editedAt: date,
		deletedAt: { type: Date, nullable: true, deleteDate: true }
	}),
	s('EntitySubscription', entities.EntitySubscription, 'entity_subscription', { entity: str(false), entityId: str(false), employeeId: str(), type: str() }),
	s('TaskLinkedIssue', entities.TaskLinkedIssue, 'task_linked_issues', { taskToId: str(false), taskFromId: str(false), action: int(false) }),
	s('ResourceLink', entities.ResourceLink, 'resource_link', {
		entity: str(false), entityId: str(false), title: str(), url: txt(false), deletedAt: { type: Date, nullable: true, deleteDate: true }
	}),
	s('IntegrationTenant', entities.IntegrationTenant, 'integration_tenant', { name: str(false) }, {
		settings: { type: 'one-to-many', target: 'IntegrationSetting', inverseSide: 'integration', cascade: true }
	}),
	s('IntegrationSetting', entities.IntegrationSetting, 'integration_setting', { settingsName: str(false), settingsValue: str() }, {
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
	s('EverWorksEntityLink', sync.EverWorksEntityLink, 'ever_works_entity_link', {
		integrationTenantId: str(false), entityType: str(false), gauzyId: str(false), ewId: str(false), ewVersion: int(), ewUpdatedAt: date, gauzyUpdatedAt: date,
		snapshot: txt(), ewOnly: txt(), lastDirection: str(), lastSyncedAt: date, state: str(false), lastError: txt()
	}),
	s('EverWorksInboundEvent', sync.EverWorksInboundEvent, 'ever_works_inbound_event', {
		connectionId: str(false), eventId: str(false), seq: { type: 'bigint' }, type: str(false), aggregateType: str(false), aggregateId: str(false),
		aggregateVersion: int(), ewOrganizationId: str(), payload: txt(false), receivedVia: str(false), status: str(false), attempts: int(false), availableAt: date,
		error: txt(), appliedAt: date
	}),
	s('EverWorksOutboundChange', sync.EverWorksOutboundChange, 'ever_works_outbound_change', {
		integrationTenantId: str(false), entityType: str(false), gauzyId: str(false), op: str(false), changedFieldsHint: txt(), actorUserId: str(), status: str(false),
		attempts: int(false), availableAt: date, lastError: txt()
	}),
	s('EverWorksSyncLog', sync.EverWorksSyncLog, 'ever_works_sync_log', {
		integrationTenantId: str(), connectionId: str(), direction: str(false), entityType: str(), gauzyId: str(), ewId: str(), action: str(false), status: str(false),
		message: txt(), details: txt(), resolvedByUserId: str(), resolvedAt: date
	}),
	s('EverWorksSyncRun', EverWorksSyncRun, 'ever_works_sync_run', {
		integrationTenantId: str(false), connectionId: str(false), mode: str(false), reason: str(), status: str(false), feedHead: str(), currentPhase: str(),
		phases: txt(), requestedByUserId: str(), startedAt: date, finishedAt: date, lastProgressAt: date, lastError: txt()
	})
];
const MIGRATIONS = [CreateEverWorksConnection1791000001100, CreateEverWorksSyncTables1791000001300, CreateEverWorksSyncRun1791000001550, AlterEverWorksConnectionOrganizationForeignKey1791000003100];

// ── Ever Works teams (the mock serves whoami, the feed and webhooks; teams are kept here) ─────────

/** A team store with versions and If-Match, answering the contract's team routes (B.6). */
function teamRoutes() {
	const teams = new Map();
	const ok = (data, status = 200) => ({ status, headers: { 'content-type': 'application/json' }, data });
	const mismatch = (current) => MockEverWorksServer.error(412, 'version_mismatch', `The current version is ${current}.`);
	const ifMatch = (headers) => {
		const raw = headers['if-match'] ?? headers['If-Match'];
		return raw ? Number(String(raw).replace(/"/g, '')) : null;
	};
	return {
		teams,
		handle(request) {
			const url = new URL(request.url);
			const path = url.pathname.slice(url.pathname.indexOf('/integrations/v1') + '/integrations/v1'.length);
			const parts = path.split('/').filter(Boolean);
			if (parts[0] !== 'teams') return null;
			if (request.method === 'GET' && parts.length === 1) return ok(MockEverWorksServer.page([...teams.values()], Object.fromEntries(url.searchParams.entries())));
			const team = teams.get(parts[1]);
			if (!team) return MockEverWorksServer.error(404, 'not_found', 'No such team.');
			if (request.method === 'GET' && parts.length === 2) return ok(team);
			const expected = ifMatch(request.headers);
			if (expected !== null && expected !== team.version) return mismatch(team.version);
			if (request.method === 'PATCH' && parts.length === 2) Object.assign(team, request.body ?? {});
			else if (request.method === 'PUT' && parts[2] === 'members') team.members = request.body?.members ?? [];
			else return MockEverWorksServer.error(404, 'not_found', `No route ${request.method} ${path}.`);
			team.version += 1;
			team.updatedAt = new Date().toISOString();
			return ok(team);
		}
	};
}

// ── Harness ──────────────────────────────────────────────────────────────────────────────────────

let dir, db;
const savedKey = process.env.ENCRYPTION_KEY;
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

before(async () => {
	process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
	dir = mkdtempSync(join(tmpdir(), 'ever-works-integration-'));
	const file = join(dir, 'gauzy.sqlite');
	// The platform's tables (a stand-in schema), then the plugin's own migrations on top.
	const platform = new DataSource({ type: 'better-sqlite3', database: file, entities: coreSchemas, synchronize: true });
	await platform.initialize();
	await platform.destroy();
	db = new DataSource({
		type: 'better-sqlite3',
		database: file,
		entities: [...coreSchemas, ...pluginSchemas],
		subscribers: [EverWorksTeamSubscriber, EverWorksTeamMemberSubscriber]
	});
	await db.initialize();
	const runner = db.createQueryRunner();
	for (const Migration of MIGRATIONS) await new Migration().up(runner);
	await runner.release();
});

after(async () => {
	if (db) await db.destroy();
	if (dir) rmSync(dir, { recursive: true, force: true });
	if (savedKey === undefined) delete process.env.ENCRYPTION_KEY;
	else process.env.ENCRYPTION_KEY = savedKey;
});

/** One Gauzy tenant connected to the mock Ever Works, with one mapped organization. */
async function tenant(options = {}) {
	const t = { tenantId: randomUUID(), organizationId: randomUUID(), userId: randomUUID(), ewOrgId: randomUUID() };
	await db.getRepository(entities.Tenant).save({ id: t.tenantId, name: 't' });
	await db.getRepository(entities.Organization).save({ id: t.organizationId, tenantId: t.tenantId, name: 'o' });
	await db.getRepository(entities.UserOrganization).save({ id: randomUUID(), tenantId: t.tenantId, organizationId: t.organizationId, userId: t.userId });
	t.mock = options.mock ?? new MockEverWorksServer();
	t.teamStore = options.teamStore ?? teamRoutes();
	const transport = { send: async (request) => t.teamStore.handle(request) ?? t.mock.handle(request) };
	as(t);
	t.connections = new EverWorksConnectionService(
		db,
		new TestEverWorksClientFactory(transport),
		new EverWorksScopeService(db),
		new EverWorksNotifier(db),
		{ defaultApiUrl: null, appUrl: null, gauzyApiUrl: 'https://api.gauzy.example' }
	);
	const view = await t.connections.connect({
		apiBaseUrl: 'https://ew.example.test/api',
		apiKey: t.mock.addKey({ organizations: [{ id: t.ewOrgId, slug: `org-${t.ewOrgId.slice(0, 8)}`, displayName: 'Acme' }] })
	});
	await t.connections.registerWebhook(view.id);
	t.secret = [...t.mock.webhooks.values()].find((w) => w.url.endsWith(view.id)).secret;
	t.integrationTenantId = randomUUID();
	await db.getRepository(entities.IntegrationTenant).save({
		id: t.integrationTenantId,
		tenantId: t.tenantId,
		organizationId: t.organizationId,
		name: 'Ever_Works',
		isActive: true,
		isArchived: false,
		settings: [
			[EverWorksSettingName.CONNECTION_ID, view.id],
			[EverWorksSettingName.EVER_WORKS_ORGANIZATION_ID, t.ewOrgId],
			[EverWorksSettingName.EVER_WORKS_ORGANIZATION_SLUG, `org-${t.ewOrgId.slice(0, 8)}`],
			[EverWorksSettingName.IS_ENABLED, 'true']
		].map(([settingsName, settingsValue]) => ({ id: randomUUID(), tenantId: t.tenantId, organizationId: t.organizationId, settingsName, settingsValue }))
	});
	t.connection = await db.getRepository(EverWorksConnection).findOneByOrFail({ id: view.id });
	t.store = new EverWorksInboundStore(db);
	t.log = new EverWorksSyncLogService(db);
	t.applier = new EverWorksInboundApplier(db, t.log);
	t.pusher = new EverWorksOutboundPusher(db, t.log);
	t.queue = new EverWorksOutboundQueue(db);
	t.contexts = new EverWorksMappingContextService(db, new EverWorksScopeService(db));
	t.links = new EverWorksLinkService(db);
	t.teams = new EverWorksTeamsService(db, t.contexts, t.connections, t.links, t.queue);
	t.applier.register(t.teams);
	t.pusher.register(t.teams);
	t.webhook = new EverWorksWebhookController(db, t.connections, t.store);
	t.reload = async () => (t.connection = await db.getRepository(EverWorksConnection).findOneByOrFail({ id: t.connection.id }));
	t.sign = (body, key = t.secret, at = Math.floor(Date.now() / 1000)) => `t=${at},v1=${createHmac('sha256', key).update(`${at}.${body}`).digest('hex')}`;
	t.deliver = (envelope, signature) => {
		const raw = JSON.stringify(envelope);
		return t.webhook.receive(t.connection.id, { rawBody: Buffer.from(raw, 'utf8') }, signature ?? t.sign(raw), envelope.id);
	};
	t.envelope = (over = {}) => ({
		id: `evt_${randomUUID().replace(/-/g, '')}`,
		seq: '1',
		type: 'team.updated',
		version: 1,
		occurredAt: new Date().toISOString(),
		tenantId: t.mock.tenant.id,
		organizationId: t.ewOrgId,
		aggregate: { type: 'team', id: 'ew-team-1', version: 1 },
		actor: { type: 'user', id: 'u1', label: 'U' },
		data: { id: 'ew-team-1', name: 'Team' },
		...over
	});
	return t;
}

/** The signed-in user of a tenant (the request context the management routes read). */
function as(t) {
	caller.tenantId = t.tenantId;
	caller.userId = t.userId;
	caller.organizationId = t.organizationId;
}

/** A Gauzy team paired with an Ever Works team at `version` (the snapshot is the agreed state). */
async function pairedTeam(t, { name = 'Platform', version = 2 } = {}) {
	const team = { id: randomUUID(), tenantId: t.tenantId, organizationId: t.organizationId, name, isArchived: false, public: false };
	await db.getRepository(entities.OrganizationTeam).insert(team);
	const ewTeam = { id: `ew-${team.id.slice(0, 8)}`, organizationId: t.ewOrgId, name, version, members: [], resources: [] };
	t.teamStore.teams.set(ewTeam.id, ewTeam);
	await t.links.record({
		tenantId: t.tenantId,
		organizationId: t.organizationId,
		integrationTenantId: t.integrationTenantId,
		entityType: sync.EverWorksLinkType.TEAM,
		gauzyId: team.id,
		ewId: ewTeam.id,
		ewVersion: version,
		snapshot: { name, emoji: null, members: [] },
		ewOnly: { members: [], resources: [] },
		direction: 'inbound'
	});
	return { team, ewTeam };
}

/**
 * The task sync (G-P1-9) of a tenant on the real task store: task writes go through a stand-in command bus
 * (the platform's `TaskUpdateCommand` handler) that records whether each one ran as the sync.
 */
function taskSync(t) {
	const commands = [];
	const commandBus = {
		execute: async (command) => {
			commands.push({ command, applying: EverWorksSyncContext.isApplying() });
			if (!(command instanceof core.TaskUpdateCommand)) throw new Error(`${command?.constructor?.name} is not handled in this suite.`);
			const repository = db.getRepository(entities.Task);
			const { members, teams, tags, ...columns } = command.input;
			if (Object.keys(columns).length) await repository.update({ id: command.id }, columns);
			if (members || teams || tags) {
				const row = await repository.findOneOrFail({ where: { id: command.id }, relations: { members: true, teams: true, tags: true } });
				await repository.save(Object.assign(row, members ? { members } : {}, teams ? { teams } : {}, tags ? { tags } : {}));
			}
			return { id: command.id };
		}
	};
	const moduleRef = {
		get: () => {
			throw new Error('TaskService is not wired in this suite.');
		}
	};
	const store = new EverWorksTaskStore(db, commandBus, moduleRef);
	const comments = new EverWorksTaskCommentsService(t.contexts, t.connections, t.links, t.queue, store, t.log);
	const service = new EverWorksTasksService(t.contexts, t.connections, t.links, t.queue, store, { ensureProjectForSync: async () => null }, t.log, comments);
	t.applier.register(service);
	t.pusher.register(service);
	return { service, store, commands };
}

/** The organization's task statuses (open, in progress, done), as a mapped organization has them. */
async function taskStatuses(t) {
	const row = (value, order, flags) => ({ id: randomUUID(), tenantId: t.tenantId, organizationId: t.organizationId, name: value, value, order, isSystem: false, ...flags });
	const statuses = { open: row('open', 0, { isTodo: true }), inProgress: row('in-progress', 1, { isInProgress: true }), done: row('done', 2, { isDone: true }) };
	// Copies: after a multi-row insert TypeORM reads the generated defaults back with an unordered SELECT and merges
	// them into the inserted objects by position, so on SQLite the objects could come back with each other's ids.
	await db.getRepository(entities.TaskStatus).insert(Object.values(statuses).map((status) => ({ ...status })));
	return statuses;
}

/** An active project of the tenant's organization. */
async function project(t, name = 'Site') {
	const row = { id: randomUUID(), tenantId: t.tenantId, organizationId: t.organizationId, name, isArchived: false };
	await db.getRepository(entities.OrganizationProject).insert(row);
	return row;
}

/**
 * A Gauzy task paired with an Ever Works task (the snapshot is the agreed state of both sides, so only what
 * the test changes afterwards is a difference).
 */
async function pairedTask(t, tasks, { title, projectId, gauzyStatus, everWorksStatus }) {
	const ewTask = t.mock.addTask(t.ewOrgId, { title, status: everWorksStatus });
	const id = randomUUID();
	await db.getRepository(entities.Task).insert({
		id,
		tenantId: t.tenantId,
		organizationId: t.organizationId,
		title,
		projectId,
		status: gauzyStatus.value,
		taskStatusId: gauzyStatus.id
	});
	const row = await tasks.store.load(t.tenantId, id);
	await t.links.record({
		tenantId: t.tenantId,
		organizationId: t.organizationId,
		integrationTenantId: t.integrationTenantId,
		entityType: sync.EverWorksLinkType.TASK,
		gauzyId: id,
		ewId: ewTask.id,
		ewVersion: ewTask.version,
		snapshot: { g: { ...gauzySideOf(row), watcherIds: [], blockedBy: [], relations: [] }, e: everWorksSideOf(ewTask) },
		ewOnly: {},
		direction: 'inbound'
	});
	return { id, ewTask };
}

// ── Tests ────────────────────────────────────────────────────────────────────────────────────────

describe('migrations', () => {
	test('SQLite: up, up again, down, up — every plugin table and the one-running-run index', async () => {
		const runner = db.createQueryRunner();
		try {
			for (const Migration of MIGRATIONS) await new Migration().up(runner); // up again: no DDL error
			for (const Migration of [...MIGRATIONS].reverse()) await new Migration().down(runner);
			for (const table of ['ever_works_connection', 'ever_works_entity_link', 'ever_works_inbound_event', 'ever_works_outbound_change', 'ever_works_sync_log', 'ever_works_sync_run']) {
				assert.equal(await runner.hasTable(table), false, `${table} dropped`);
			}
			for (const Migration of MIGRATIONS) await new Migration().up(runner);
			for (const table of ['ever_works_connection', 'ever_works_entity_link', 'ever_works_inbound_event', 'ever_works_outbound_change', 'ever_works_sync_log', 'ever_works_sync_run']) {
				assert.equal(await runner.hasTable(table), true, `${table} created`);
			}
		} finally {
			await runner.release();
		}
	});

	test('Postgres: up, up again, down, up (when a loopback _test database is given)', { skip: !process.env.EVER_WORKS_TEST_DATABASE_URL }, async () => {
		const url = new URL(process.env.EVER_WORKS_TEST_DATABASE_URL);
		if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
			throw new Error('The Postgres migration test needs a loopback database whose name ends in _test.');
		}
		const schema = `ever_works_${randomUUID().replace(/-/g, '')}`;
		const admin = new DataSource({ type: 'postgres', url: url.toString() });
		await admin.initialize();
		await admin.query(`CREATE SCHEMA "${schema}"`);
		await admin.destroy();
		// Every statement of the migrations runs in the test schema (search_path). The plugin's foreign keys
		// point at the platform's tenant and organization, whose keys are uuid there: those two tables only.
		const pg = new DataSource({ type: 'postgres', url: url.toString(), schema, extra: { options: `-c search_path=${schema}` } });
		await pg.initialize();
		await pg.query(`CREATE TABLE "${schema}"."tenant" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid())`);
		await pg.query(`CREATE TABLE "${schema}"."organization" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid)`);
		const runner = pg.createQueryRunner();
		try {
			await runner.startTransaction();
			for (const Migration of MIGRATIONS) await new Migration().up(runner);
			for (const Migration of MIGRATIONS) await new Migration().up(runner);
			for (const Migration of [...MIGRATIONS].reverse()) await new Migration().down(runner);
			for (const Migration of MIGRATIONS) await new Migration().up(runner);
			await runner.commitTransaction();
			const tables = await pg.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name LIKE 'ever_works_%'`, [schema]);
			assert.equal(tables.length, 6);
		} finally {
			if (runner.isTransactionActive) await runner.rollbackTransaction();
			await runner.release();
			await pg.query(`DROP SCHEMA "${schema}" CASCADE`).catch(() => undefined);
			await pg.destroy();
		}
	});
});

describe('boundary', () => {
	let a, b;
	beforeEach(async () => {
		a = await tenant();
		b = await tenant();
		as(a);
	});

	test('tenant and organization isolation: events, links, the status and the log stay with their tenant', async () => {
		// An event for an Ever Works organization the connection does not map is stored without an organization and skipped.
		const foreign = a.envelope({ organizationId: b.ewOrgId });
		await a.deliver(foreign);
		const row = await db.getRepository(sync.EverWorksInboundEvent).findOneByOrFail({ eventId: foreign.id });
		assert.equal(row.tenantId, a.tenantId);
		assert.equal(row.organizationId ?? null, null);
		await a.applier.drain(a.connection, 50);
		assert.equal((await db.getRepository(sync.EverWorksInboundEvent).findOneByOrFail({ eventId: foreign.id })).status, sync.EverWorksInboundStatus.SKIPPED);
		// B's mapping is invisible to A's admin; A's own status answers.
		const status = new EverWorksSyncStatusService(db, a.contexts, a.connections, new EverWorksConflictsService(db, a.contexts, a.log, a.queue, { execute: async () => undefined }), new EverWorksInitialSyncService(db, a.contexts, a.connections, a.store, a.applier, a.pusher, a.queue, a.log));
		await assert.rejects(status.status(b.integrationTenantId));
		await assert.rejects(status.status(b.integrationTenantId, b.organizationId));
		const own = await status.status(a.integrationTenantId);
		assert.equal(own.integrationTenantId, a.integrationTenantId);
		await b.log.write({ tenantId: b.tenantId, organizationId: b.organizationId, integrationTenantId: b.integrationTenantId, direction: 'system', action: 'b-only', status: 'ok' });
		assert.equal((await status.log(a.integrationTenantId, {})).items.some((item) => item.action === 'b-only'), false);
	});

	test('signature verification: a valid signature is stored once; a wrong secret, a stale time or none is refused', async () => {
		const event = a.envelope();
		assert.deepEqual(await a.deliver(event), { accepted: true, duplicate: false });
		/** A delivery signed over its own body: only the secret or the time under test is wrong. */
		const refused = (sign) => {
			const other = a.envelope();
			return a.deliver(other, sign(JSON.stringify(other)));
		};
		await assert.rejects(refused((body) => a.sign(body, 'another-secret-of-at-least-32-characters')), /signature/i);
		await assert.rejects(refused((body) => a.sign(body, a.secret, Math.floor(Date.now() / 1000) - 3600)), /signature/i);
		// B's secret never opens A's connection.
		await assert.rejects(refused((body) => a.sign(body, b.secret)), /signature/i);
		const unsigned = a.envelope();
		await assert.rejects(a.webhook.receive(a.connection.id, { rawBody: Buffer.from(JSON.stringify(unsigned)) }, undefined, unsigned.id), /signature/i);
		// Control: the same helper with the right secret and time is accepted.
		assert.deepEqual(await refused((body) => a.sign(body)), { accepted: true, duplicate: false });
		assert.equal(await db.getRepository(sync.EverWorksInboundEvent).count({ where: { connectionId: a.connection.id } }), 2);
	});

	test('dedupe: the same event by webhook and by the change feed is stored once', async () => {
		a.mock.deliver = async (_url, headers, body) => {
			await a.webhook.receive(a.connection.id, { rawBody: Buffer.from(body, 'utf8') }, headers['x-ever-works-signature'], headers['x-ever-works-event-id']);
			return 202;
		};
		await a.reload();
		await db.getRepository(EverWorksConnection).update({ id: a.connection.id }, { feedCursor: a.mock.head });
		await a.reload();
		const emitted = await a.mock.emit(a.envelope({ id: undefined, seq: undefined }));
		const poll = await new EverWorksFeedPoller(db, a.connections, a.store).poll(a.connection);
		assert.equal(poll.duplicates, 1);
		assert.equal(await db.getRepository(sync.EverWorksInboundEvent).count({ where: { eventId: emitted.id } }), 1);
	});

	test('loop suppression: what an inbound apply writes is never captured; our own origin is skipped', async () => {
		const capture = new EverWorksTeamCapture(a.queue);
		capture.onModuleInit();
		try {
			// An Ever Works team created after the mapping is created in Gauzy by the sync…
			await a.deliver(a.envelope({ type: 'team.created', aggregate: { type: 'team', id: 'ew-new', version: 1 }, data: { id: 'ew-new', name: 'Design', members: [] } }));
			await a.applier.drain(a.connection, 50);
			await settle();
			const created = await db.getRepository(entities.OrganizationTeam).findOneByOrFail({ name: 'Design', tenantId: a.tenantId });
			assert.ok(created.id);
			// …and that write is not pushed back (loop guard 1).
			assert.equal(await db.getRepository(sync.EverWorksOutboundChange).count({ where: { integrationTenantId: a.integrationTenantId } }), 0);
			// Control: the same kind of write by a person is captured.
			await db.getRepository(entities.OrganizationTeam).save({ id: randomUUID(), tenantId: a.tenantId, organizationId: a.organizationId, name: 'By hand', public: false });
			await settle();
			assert.equal(await db.getRepository(sync.EverWorksOutboundChange).count({ where: { integrationTenantId: a.integrationTenantId } }), 1);
			// Our own origin (loop guard 3).
			const own = a.envelope({ origin: { tag: `gauzy:${a.connection.id}` } });
			await a.deliver(own);
			await a.applier.drain(a.connection, 50);
			const row = await db.getRepository(sync.EverWorksInboundEvent).findOneByOrFail({ eventId: own.id });
			assert.equal(row.status, sync.EverWorksInboundStatus.SKIPPED);
			assert.equal(row.error, 'own origin');
		} finally {
			capture.onModuleDestroy();
		}
	});

	test('412 merge: a push against a newer Ever Works version merges and goes through once', async () => {
		const { team, ewTeam } = await pairedTeam(a, { version: 2 });
		// Ever Works moved on (another field), Gauzy renamed the team.
		ewTeam.version = 3;
		ewTeam.description = 'Changed in Ever Works';
		await db.getRepository(entities.OrganizationTeam).update({ id: team.id }, { name: 'Platform Core' });
		await a.queue.enqueue({ tenantId: a.tenantId, organizationId: a.organizationId, entityType: sync.EverWorksLinkType.TEAM, gauzyId: team.id });
		await a.pusher.drain(a.connection, 10, new Date(Date.now() + 5_000));
		assert.equal(ewTeam.name, 'Platform Core');
		assert.equal(ewTeam.description, 'Changed in Ever Works');
		assert.equal(ewTeam.version, 4);
		const link = await a.links.byGauzy(a.integrationTenantId, sync.EverWorksLinkType.TEAM, team.id);
		assert.equal(link.ewVersion, 4);
		assert.equal((await db.getRepository(entities.OrganizationTeam).findOneByOrFail({ id: team.id })).name, 'Platform Core');
		const change = await db.getRepository(sync.EverWorksOutboundChange).findOneByOrFail({ gauzyId: team.id });
		assert.equal(change.status, sync.EverWorksOutboundStatus.PUSHED);
	});

	test('initial-sync resume: a run stopped mid-way continues from its checkpoint in another process', async () => {
		await pairedTeam(a, { name: 'Paired', version: 1 });
		a.teamStore.teams.set('ew-unpaired', { id: 'ew-unpaired', organizationId: a.ewOrgId, name: 'Unpaired', version: 1, members: [] });
		const first = new EverWorksInitialSyncService(db, a.contexts, a.connections, a.store, a.applier, a.pusher, a.queue, a.log);
		const run = await first.start(a.integrationTenantId, 'initial');
		await a.reload();
		await first.sweep(a.connection); // members done; teams read and queued
		const stopped = await db.getRepository(EverWorksSyncRun).findOneByOrFail({ id: run.id });
		const teams = JSON.parse(stopped.phases).find((phase) => phase.name === 'teams');
		assert.equal(teams.status, 'applying');
		assert.equal(teams.queued, 2);
		// "Another process" (a new service, nothing in memory) picks the run up where it stopped.
		const second = new EverWorksInitialSyncService(db, a.contexts, a.connections, a.store, a.applier, a.pusher, a.queue, a.log);
		for (let i = 0; i < 20 && (await db.getRepository(EverWorksSyncRun).findOneByOrFail({ id: run.id })).status === 'running'; i++) {
			await a.applier.drain(a.connection, 500);
			await a.reload();
			await second.sweep(a.connection);
		}
		const done = await db.getRepository(EverWorksSyncRun).findOneByOrFail({ id: run.id });
		assert.equal(done.status, 'done');
		// Nothing was read twice into the inbox: one initial event per team version.
		assert.equal(await db.getRepository(sync.EverWorksInboundEvent).count({ where: { connectionId: a.connection.id, receivedVia: 'initial' } }), 2);
	});

	test('scope: team ↔ organization both ways, a push waits for an unlinked team, private never syncs', async () => {
		const linked = new Map([['g1', 'ew1']]);
		assert.deepEqual(teamScopeFor(['g1'], linked), { scope: { visibility: 'team', teamIds: ['ew1'] } });
		assert.deepEqual(teamScopeFor([], linked), { scope: { visibility: 'organization', teamIds: [] } });
		assert.deepEqual(teamScopeFor(['g1', 'g2'], linked), { waitingFor: 'g2' });
		assert.deepEqual(gauzyTeamsFor(['ew1', 'ew9'], new Map([['ew1', 'g1']])), { teamIds: ['g1'], unmapped: ['ew9'] });
		assert.equal(isSyncedVisibility('private'), false);
		// An agent that turns private stops syncing: its link is unlinked, its Gauzy record kept.
		const agents = new EverWorksAgentsService(db, a.contexts, a.connections, a.links, { get: () => undefined }, a.store);
		const employeeId = randomUUID();
		await a.links.record({
			tenantId: a.tenantId,
			organizationId: a.organizationId,
			integrationTenantId: a.integrationTenantId,
			entityType: sync.EverWorksLinkType.AGENT,
			gauzyId: employeeId,
			ewId: 'ew-agent-1',
			ewVersion: 1,
			direction: 'inbound'
		});
		a.applier.register(agents);
		await a.deliver(a.envelope({ type: 'agent.visibility_changed', aggregate: { type: 'agent', id: 'ew-agent-1', version: 2 }, data: { id: 'ew-agent-1', visibility: 'private' } }));
		await a.applier.drain(a.connection, 50);
		const link = await a.links.byEw(a.integrationTenantId, sync.EverWorksLinkType.AGENT, 'ew-agent-1');
		assert.equal(link.state, sync.EverWorksLinkState.UNLINKED);
	});

	test('transition revert: a 409 transition_blocked puts Ever Works’ status back into the Gauzy task, with a comment', async () => {
		const tasks = taskSync(a);
		const statuses = await taskStatuses(a);
		const site = await project(a);
		const { id, ewTask } = await pairedTask(a, tasks, { title: 'Ship the release', projectId: site.id, gauzyStatus: statuses.inProgress, everWorksStatus: 'in_progress' });
		// Ever Works' gates refuse "done" while a blocker is open.
		a.mock.transitionGates.set(ewTask.id, { blocked: ['done'], blockers: [{ slug: 'T-43', title: 'Security review' }] });
		// A person moves the Gauzy task to done.
		await db.getRepository(entities.Task).update({ id }, { status: 'done', taskStatusId: statuses.done.id });
		const push = async () => {
			await a.queue.enqueue({ tenantId: a.tenantId, organizationId: a.organizationId, entityType: sync.EverWorksLinkType.TASK, gauzyId: id });
			await a.pusher.drain(a.connection, 10, new Date(Date.now() + 5_000));
		};
		await push();
		const transitions = () => a.mock.requests.filter((request) => request.method === 'POST' && request.path === `/tasks/${ewTask.id}/transition`);
		assert.equal(transitions().length, 1);
		assert.deepEqual(transitions()[0].body, { to: 'done', mode: 'sync' });
		// Ever Works kept its status; Gauzy took it back (the status row of the task's scope)…
		assert.equal(a.mock.tasks.get(ewTask.id).status, 'in_progress');
		const reverted = await db.getRepository(entities.Task).findOneByOrFail({ id });
		assert.equal(reverted.status, 'in-progress');
		assert.equal(reverted.taskStatusId, statuses.inProgress.id);
		// …as the sync (loop guard 1: the TaskEvent listener does not capture it), through the platform's command.
		const writes = tasks.commands.filter(({ command }) => command instanceof core.TaskUpdateCommand && command.id === id);
		assert.equal(writes.length, 1);
		assert.equal(writes[0].applying, true);
		// A comment on the task says why, and the log has the conflict Ever Works resolved.
		const comments = await db.getRepository(entities.Comment).findBy({ entityId: id });
		assert.equal(comments.length, 1);
		assert.equal(comments[0].actorType, ActorTypeEnum.System);
		// Stored as the platform stores it (0 = System, through ActorTypeTransformer).
		assert.deepEqual(await db.query('SELECT "actorType" FROM "comment" WHERE "entityId" = ?', [id]), [{ actorType: 0 }]);
		assert.match(comments[0].comment, /Ever Works kept the status &quot;in_progress&quot; instead of &quot;done&quot;: blocked by T-43/);
		const logged = await db.getRepository(sync.EverWorksSyncLog).findBy({ gauzyId: id, action: 'conflict:resolved-by-ew' });
		assert.equal(logged.length, 1);
		assert.equal(logged[0].status, 'conflict');
		assert.equal((await db.getRepository(sync.EverWorksOutboundChange).findOneByOrFail({ gauzyId: id })).status, sync.EverWorksOutboundStatus.PUSHED);
		// The reverted status is the agreed state now: pushed again, nothing goes out (no flapping).
		await push();
		assert.equal(transitions().length, 1);
		const link = await a.links.byGauzy(a.integrationTenantId, sync.EverWorksLinkType.TASK, id);
		assert.equal(JSON.parse(link.snapshot).g.status, 'in-progress');
		assert.equal(link.state, sync.EverWorksLinkState.OK);
	});

	test('orphan delete: a linked task gone from Gauzy without a captured delete is swept and its delete policy pushed', async () => {
		const tasks = taskSync(a);
		const statuses = await taskStatuses(a);
		const site = await project(a);
		const kept = await pairedTask(a, tasks, { title: 'Kept', projectId: site.id, gauzyStatus: statuses.open, everWorksStatus: 'todo' });
		const gone = await pairedTask(a, tasks, { title: 'Gone', projectId: site.id, gauzyStatus: statuses.open, everWorksStatus: 'todo' });
		const changes = db.getRepository(sync.EverWorksOutboundChange);
		const link = (id) => a.links.byGauzy(a.integrationTenantId, sync.EverWorksLinkType.TASK, id);
		// A raw (bulk) delete: no TaskEvent, nothing captured.
		await db.getRepository(entities.Task).delete({ id: gone.id });
		assert.equal(await changes.count({ where: { integrationTenantId: a.integrationTenantId } }), 0);
		await a.reload();
		await tasks.service.sweep(a.connection);
		// The sweep marks the link orphaned and queues the delete; the task that still exists is left alone.
		const queued = await changes.findBy({ integrationTenantId: a.integrationTenantId });
		assert.deepEqual(
			queued.map((row) => [row.gauzyId, row.op, row.status]),
			[[gone.id, 'delete', sync.EverWorksOutboundStatus.PENDING]]
		);
		assert.equal((await link(gone.id)).state, sync.EverWorksLinkState.ORPHANED);
		assert.equal((await link(kept.id)).state, sync.EverWorksLinkState.OK);
		// The push applies the delete policy: Ever Works cancels the task (nothing is deleted there), with a comment.
		await a.pusher.drain(a.connection, 10, new Date(Date.now() + 5_000));
		assert.equal((await changes.findOneByOrFail({ gauzyId: gone.id })).status, sync.EverWorksOutboundStatus.PUSHED);
		assert.equal(a.mock.tasks.get(gone.ewTask.id).status, 'cancelled');
		const notes = [...a.mock.comments.values()].filter((comment) => comment.taskId === gone.ewTask.id);
		assert.equal(notes.length, 1);
		assert.match(notes[0].body, /deleted in Ever Gauzy/);
		assert.equal((await link(gone.id)).state, sync.EverWorksLinkState.UNLINKED);
		assert.equal(a.mock.tasks.get(kept.ewTask.id).status, 'todo');
		// Swept again: nothing new is queued (the link no longer syncs).
		await tasks.service.sweep(a.connection);
		assert.equal(await changes.count({ where: { integrationTenantId: a.integrationTenantId } }), 1);
	});
});
