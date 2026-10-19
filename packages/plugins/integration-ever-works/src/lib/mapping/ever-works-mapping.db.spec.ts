// cspell:ignore unmapping
/**
 * Organization mapping and settings (G-P1-4) on a real database (better-sqlite3) with the mock Ever
 * Works: one `integration_tenant` per mapped organization with the plan's settings, the per-entity sync
 * toggles, the seeded "Idea" issue type and "Ideas" view, the projects created on demand through the
 * platform's command, uniqueness of both sides of a pair, validation of directions and projects,
 * organization isolation, and unmap/remap resuming the same mapping.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application); its
 * entities are mapped by fixture schemas over the same table names.
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
		ExportRedacted: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		...Object.fromEntries(
			[
				'Tenant',
				'Organization',
				'UserOrganization',
				'Employee',
				'EmployeeNotification',
				'Integration',
				'IntegrationType',
				'IntegrationTenant',
				'IntegrationSetting',
				'IntegrationEntitySetting',
				'IssueType',
				'TaskView',
				'OrganizationProject'
			].map((name) => [name, entity(name)])
		),
		OrganizationProjectCreateCommand: class OrganizationProjectCreateCommand {
			constructor(readonly input: Record<string, unknown>) {}
		},
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
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { IntegrationEntity } from '@gauzy/contracts';
import {
	Employee,
	EmployeeNotification,
	Integration,
	IntegrationEntitySetting,
	IntegrationSetting,
	IntegrationTenant,
	IntegrationType,
	IssueType,
	Organization,
	OrganizationProject,
	TaskView,
	Tenant,
	UserOrganization
} from '@gauzy/core';
import { TestEverWorksClientFactory } from '../client/ever-works-client.factory';
import { EverWorksCatalogService } from '../ever-works-catalog.service';
import { EverWorksScopeService } from '../ever-works-scope.service';
import { CreateEverWorksConnection1791000001100 } from '../database/migrations/1791000001100-CreateEverWorksConnection';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';
import { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksNotifier } from '../connection/ever-works-notifier.service';
import { DEFAULT_EVER_WORKS_DIRECTIONS, EVER_WORKS_IDEAS_PROJECT_NAME, EVER_WORKS_SYNCED_ENTITIES } from './ever-works-mapping.defaults';
import { EverWorksMappingService } from './ever-works-mapping.service';
import { EverWorksMappingContextService } from './ever-works-mapping-context.service';
import { EverWorksSettingName } from '../ever-works-setting.enum';

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
const schema = (name: string, target: new (...args: never[]) => object, tableName: string, columns: Record<string, unknown>, relations?: Record<string, unknown>) =>
	new EntitySchema({ name, target, tableName, columns: { ...base, ...columns } as never, relations: relations as never });

const coreSchemas = [
	schema('Tenant', Tenant, 'tenant', { name: { type: String, nullable: true } }),
	schema('Organization', Organization, 'organization', { name: { type: String, nullable: true } }),
	schema('UserOrganization', UserOrganization, 'user_organization', { userId: { type: String } }),
	schema('Employee', Employee, 'employee', { userId: { type: String } }),
	schema('EmployeeNotification', EmployeeNotification, 'employee_notification', { receiverEmployeeId: { type: String, nullable: true } }),
	schema('IntegrationType', IntegrationType, 'integration_type', { name: { type: String }, groupName: { type: String, nullable: true } }),
	schema(
		'Integration',
		Integration,
		'integration',
		{
			name: { type: String, unique: true },
			provider: { type: String, nullable: true },
			imgSrc: { type: String, nullable: true },
			redirectUrl: { type: String, nullable: true },
			isComingSoon: { type: Boolean, default: false },
			isPaid: { type: Boolean, default: false },
			order: { type: Number, default: 0 }
		},
		{ integrationTypes: { type: 'many-to-many', target: 'IntegrationType', joinTable: { name: 'integration_integration_type' } } }
	),
	schema(
		'IntegrationTenant',
		IntegrationTenant,
		'integration_tenant',
		{ name: { type: String }, integrationId: { type: String, nullable: true } },
		{ settings: { type: 'one-to-many', target: 'IntegrationSetting', inverseSide: 'integration', cascade: true } }
	),
	schema(
		'IntegrationSetting',
		IntegrationSetting,
		'integration_setting',
		{ settingsName: { type: String }, settingsValue: { type: String, nullable: true } },
		{ integration: { type: 'many-to-one', target: 'IntegrationTenant', joinColumn: { name: 'integrationId' } } }
	),
	schema('IntegrationEntitySetting', IntegrationEntitySetting, 'integration_entity_setting', {
		entity: { type: String },
		sync: { type: Boolean },
		integrationId: { type: String }
	}),
	schema('IssueType', IssueType, 'issue_type', {
		name: { type: String },
		value: { type: String },
		description: { type: String, nullable: true },
		icon: { type: String, nullable: true },
		color: { type: String, nullable: true },
		isSystem: { type: Boolean, default: false },
		isDefault: { type: Boolean, default: false },
		projectId: { type: String, nullable: true },
		organizationTeamId: { type: String, nullable: true }
	}),
	schema('TaskView', TaskView, 'task_view', {
		name: { type: String },
		description: { type: 'text', nullable: true },
		visibilityLevel: { type: Number, nullable: true },
		queryParams: { type: 'text', nullable: true },
		filterOptions: { type: 'text', nullable: true },
		isLocked: { type: Boolean, default: false }
	}),
	schema('OrganizationProject', OrganizationProject, 'organization_project', {
		name: { type: String },
		description: { type: String, nullable: true }
	})
];

const connectionSchema = new EntitySchema({
	name: 'EverWorksConnection',
	target: EverWorksConnection,
	tableName: 'ever_works_connection',
	columns: {
		...base,
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

describe('Ever Works organization mapping on SQLite', () => {
	let dir: string;
	let dataSource: DataSource;
	let mock: MockEverWorksServer;
	let connections: EverWorksConnectionService;
	let mappings: EverWorksMappingService;
	let commandBus: { execute: jest.Mock };
	const savedKey = process.env['ENCRYPTION_KEY'];

	const A = { tenantId: randomUUID(), organizationId: randomUUID(), userId: randomUUID() };
	const A2 = { ...A, organizationId: randomUUID() }; // a second organization of tenant A, same admin
	const B = { tenantId: randomUUID(), organizationId: randomUUID(), userId: randomUUID() };
	const as = (who: { tenantId: string; organizationId: string; userId: string }) => {
		mockCaller.tenantId = who.tenantId;
		mockCaller.userId = who.userId;
		mockCaller.organizationId = who.organizationId;
	};
	const ewOrgs = [
		{ id: randomUUID(), slug: 'acme', displayName: 'Acme Inc.' },
		{ id: randomUUID(), slug: 'acme-labs', displayName: 'Acme Labs' }
	];

	beforeAll(async () => {
		process.env['ENCRYPTION_KEY'] = randomBytes(32).toString('base64');
		dir = mkdtempSync(join(tmpdir(), 'ever-works-mapping-'));
		const file = join(dir, 'gauzy.sqlite');
		const core = new DataSource({ type: 'better-sqlite3', database: file, entities: coreSchemas, synchronize: true });
		await core.initialize();
		await core.destroy();
		dataSource = new DataSource({ type: 'better-sqlite3', database: file, entities: [...coreSchemas, connectionSchema] });
		await dataSource.initialize();
		const runner = dataSource.createQueryRunner();
		await new CreateEverWorksConnection1791000001100().up(runner);
		await runner.release();
		for (const type of ['All Integrations', 'Project Management']) {
			await dataSource.getRepository(IntegrationType).save({ id: randomUUID(), name: type });
		}
		for (const who of [A, A2, B]) {
			await dataSource.getRepository(Tenant).save({ id: who.tenantId, name: 't' });
			await dataSource.getRepository(Organization).save({ id: who.organizationId, tenantId: who.tenantId, name: 'o' });
			await dataSource.getRepository(UserOrganization).save({ id: randomUUID(), tenantId: who.tenantId, organizationId: who.organizationId, userId: who.userId });
		}
	});

	afterAll(async () => {
		await dataSource?.destroy();
		rmSync(dir, { recursive: true, force: true });
		if (savedKey === undefined) delete process.env['ENCRYPTION_KEY'];
		else process.env['ENCRYPTION_KEY'] = savedKey;
	});

	beforeEach(async () => {
		for (const table of ['integration_setting', 'integration_entity_setting', 'integration_tenant', 'issue_type', 'task_view', 'organization_project', 'ever_works_connection']) {
			await dataSource.query(`DELETE FROM "${table}"`);
		}
		mock = new MockEverWorksServer();
		const scopes = new EverWorksScopeService(dataSource);
		connections = new EverWorksConnectionService(
			dataSource,
			new TestEverWorksClientFactory(mock.transport()),
			scopes,
			new EverWorksNotifier(dataSource),
			{ defaultApiUrl: null, appUrl: null, gauzyApiUrl: null }
		);
		// The platform's OrganizationProjectCreateCommand, reduced to what it stores.
		commandBus = {
			execute: jest.fn(async (command: { input: Record<string, unknown> }) =>
				dataSource.getRepository(OrganizationProject).save({ id: randomUUID(), ...command.input })
			)
		};
		mappings = new EverWorksMappingService(dataSource, scopes, connections, new EverWorksCatalogService(dataSource), commandBus as never);
		as(A);
		await connections.connect({ apiBaseUrl: 'https://ew.example.test/api', apiKey: mock.addKey({ organizations: ewOrgs }) });
	});

	it('maps the organization with the plan defaults, sync toggles, the Idea issue type and the Ideas view', async () => {
		const view = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
		expect(view).toMatchObject({
			organizationId: A.organizationId,
			everWorksOrganization: { id: ewOrgs[0].id, slug: 'acme', displayName: 'Acme Inc.' },
			isEnabled: true,
			directions: DEFAULT_EVER_WORKS_DIRECTIONS,
			defaultProjectId: null,
			syncUnlinkedProjectTasks: true,
			includeHiddenTasks: false
		});
		expect(view.entitySettings.map((s) => s.entity)).toEqual([...EVER_WORKS_SYNCED_ENTITIES]);
		expect(view.entitySettings.every((s) => s.sync)).toBe(true);
		const issueType = await dataSource.getRepository(IssueType).findOneByOrFail({ id: view.ideaIssueTypeId as string });
		expect(issueType).toMatchObject({ name: 'Idea', value: 'Idea', organizationId: A.organizationId, tenantId: A.tenantId });
		const ideas = await dataSource.getRepository(TaskView).findOneByOrFail({ id: view.ideasTaskViewId as string });
		// Read the way TaskService.findTasksByViewQuery reads a view on SQLite: JSON, then `types` and the organization.
		const { types = [], organizationId } = JSON.parse((ideas as { queryParams: string }).queryParams) as { types?: string[]; organizationId?: string };
		expect(types).toEqual(['Idea']);
		expect(organizationId).toBe(A.organizationId);
		expect(JSON.parse((ideas as { filterOptions: string }).filterOptions)).toEqual({ types: ['Idea'] });
		// The catalog row exists and the mapping points at it.
		const integration = await dataSource.getRepository(Integration).findOneByOrFail({ name: 'Ever_Works' });
		const row = await dataSource.getRepository(IntegrationTenant).findOneByOrFail({ id: view.integrationTenantId });
		expect((row as { integrationId: string }).integrationId).toBe((integration as { id: string }).id);
		expect(await mappings.current()).toMatchObject({ integrationTenantId: view.integrationTenantId });
	});

	it('pairs each side once: the organization twice → 409; the Ever Works organization in another organization → 409', async () => {
		await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
		await expect(mappings.create({ everWorksOrganizationId: ewOrgs[1].id })).rejects.toBeInstanceOf(ConflictException);
		as(A2);
		await expect(mappings.create({ everWorksOrganizationId: ewOrgs[0].id })).rejects.toBeInstanceOf(ConflictException);
		const second = await mappings.create({ everWorksOrganizationId: ewOrgs[1].id });
		expect(second.organizationId).toBe(A2.organizationId);
		// The second organization reuses its own Idea issue type, never the first one's.
		expect(second.ideaIssueTypeId).not.toBeNull();
		expect(await dataSource.getRepository(IssueType).count()).toBe(2);
	});

	it('refuses an Ever Works organization the key is not pinned to, and a tenant without a connection', async () => {
		await expect(mappings.create({ everWorksOrganizationId: randomUUID() })).rejects.toBeInstanceOf(BadRequestException);
		as(B);
		await expect(mappings.create({ everWorksOrganizationId: ewOrgs[0].id })).rejects.toBeInstanceOf(NotFoundException);
	});

	it('a change of the agentEmail direction (or archiving the mapping) brings the webhook events along (G-P4-6)', async () => {
		const view = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
		const refresh = jest.spyOn(connections, 'refreshWebhookEvents').mockResolvedValue(undefined);
		const connection = await connections.current();
		await mappings.update(view.integrationTenantId, { directions: { tasks: 'ew_to_gauzy' } });
		expect(refresh).not.toHaveBeenCalled();
		await mappings.update(view.integrationTenantId, { directions: { agentEmail: 'ew_to_gauzy' } });
		expect(refresh).toHaveBeenCalledWith(connection?.id, A.tenantId);
		await mappings.remove(view.integrationTenantId);
		expect(refresh).toHaveBeenCalledTimes(2);
		// Restored (mapped again), its directions come back with it: so do the events (#11055 review).
		await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
		expect(refresh).toHaveBeenCalledTimes(3);
		expect(refresh).toHaveBeenLastCalledWith(connection?.id, A.tenantId);
		refresh.mockRestore();
	});

	it('updates directions, flags, projects and toggles; refuses an unknown domain, a disallowed direction and a foreign project', async () => {
		const view = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
		const project = await dataSource.getRepository(OrganizationProject).save({ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, name: 'P' });
		const updated = await mappings.update(view.integrationTenantId, {
			directions: { tasks: 'ew_to_gauzy', docs: 'off' },
			defaultProjectId: (project as { id: string }).id,
			includeTriageTasks: true,
			entitySettings: [{ entity: IntegrationEntity.DOCUMENT, sync: false }]
		});
		expect(updated.directions).toMatchObject({ tasks: 'ew_to_gauzy', docs: 'off', teams: 'both' });
		expect(updated.defaultProjectId).toBe((project as { id: string }).id);
		expect(updated.includeTriageTasks).toBe(true);
		expect(updated.entitySettings.find((s) => s.entity === IntegrationEntity.DOCUMENT)?.sync).toBe(false);
		await expect(mappings.update(view.integrationTenantId, { directions: { payroll: 'both' } })).rejects.toThrow(/Unknown synced domain/);
		await expect(mappings.update(view.integrationTenantId, { directions: { agents: 'gauzy_to_ew' } })).rejects.toThrow(/agents syncs/);
		const foreign = await dataSource.getRepository(OrganizationProject).save({ id: randomUUID(), tenantId: B.tenantId, organizationId: B.organizationId, name: 'X' });
		await expect(mappings.update(view.integrationTenantId, { ideasProjectId: (foreign as { id: string }).id })).rejects.toBeInstanceOf(BadRequestException);
		// A toggle for an entity Ever Works does not sync is refused, and nothing of that update is written.
		await expect(
			mappings.update(view.integrationTenantId, { includeHiddenTasks: true, entitySettings: [{ entity: IntegrationEntity.INCOME, sync: false }] })
		).rejects.toThrow(/Not a synced Ever Works entity: Income/);
		expect((await mappings.current())?.includeHiddenTasks).toBe(false);
	});

	it('creates the Ideas project once, through the platform command, and reuses it', async () => {
		const view = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
		const first = await mappings.ensureIdeasProject(view.integrationTenantId);
		const again = await mappings.ensureIdeasProject(view.integrationTenantId);
		expect(first.created).toBe(true);
		expect(again).toEqual({ projectId: first.projectId, created: false });
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		expect(commandBus.execute.mock.calls[0][0].input).toMatchObject({ name: EVER_WORKS_IDEAS_PROJECT_NAME, tenantId: A.tenantId, organizationId: A.organizationId });
		expect((await mappings.current())?.ideasProjectId).toBe(first.projectId);
	});

	it('is invisible to another organization and another tenant', async () => {
		const view = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
		as(A2);
		expect(await mappings.current()).toBeNull();
		await expect(mappings.update(view.integrationTenantId, { isEnabled: false })).rejects.toBeInstanceOf(NotFoundException);
		as(B);
		await expect(mappings.remove(view.integrationTenantId)).rejects.toBeInstanceOf(NotFoundException);
		as({ ...B, organizationId: A.organizationId }); // naming another tenant's organization
		await expect(mappings.current()).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('unmapping archives the mapping; mapping the same pair again resumes it (same id, settings kept)', async () => {
		const view = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
		await mappings.update(view.integrationTenantId, { directions: { docs: 'off' } });
		expect(await mappings.remove(view.integrationTenantId)).toEqual({ success: true });
		expect(await mappings.current()).toBeNull();
		const archived = await dataSource.getRepository(IntegrationTenant).findOneByOrFail({ id: view.integrationTenantId });
		expect(archived).toMatchObject({ isActive: false, isArchived: true });
		const again = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
		expect(again.integrationTenantId).toBe(view.integrationTenantId);
		expect(again.directions.docs).toBe('off');
		expect(again.isEnabled).toBe(true);
	});

	it('disconnecting the connection archives the mapping too', async () => {
		const view = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
		const connection = await connections.current();
		await connections.disconnect(connection!.id);
		expect(await mappings.current()).toBeNull();
		expect(await dataSource.getRepository(IntegrationTenant).findOneByOrFail({ id: view.integrationTenantId })).toMatchObject({ isActive: false });
	});

	describe('per-entity sync settings take effect (OQ4, review F77)', () => {
		const contexts = () => new EverWorksMappingContextService(dataSource, new EverWorksScopeService(dataSource));
		const engine = () => contexts().forOrganization(A.tenantId as never, A.organizationId as never);
		const toggle = (entity: IntegrationEntity, sync: boolean) => ({ entity, sync });

		it('a toggle set to false turns its domains off for the engine and in the view; the stored directions stay', async () => {
			const view = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
			const updated = await mappings.update(view.integrationTenantId, {
				entitySettings: [
					toggle(IntegrationEntity.ORGANIZATION_TEAM, false),
					toggle(IntegrationEntity.TASK, false),
					toggle(IntegrationEntity.COMMENT, false),
					toggle(IntegrationEntity.KEY_RESULT, false)
				]
			});
			// The form keeps what the admin chose; what takes effect is answered next to it.
			expect(updated.directions).toEqual(DEFAULT_EVER_WORKS_DIRECTIONS);
			expect(updated).toMatchObject({
				effectiveDirections: { ...DEFAULT_EVER_WORKS_DIRECTIONS, teams: 'off', tasks: 'off', ideas: 'off' }
			});
			// Every engine path reads the mapping through the context: inbound, outbound, sweeps, initial sync, resync.
			expect(await engine()).toMatchObject({
				directions: { ...DEFAULT_EVER_WORKS_DIRECTIONS, teams: 'off', tasks: 'off', ideas: 'off' },
				entitySync: { OrganizationTeam: false, Task: false, Comment: false, KeyResult: false }
			});
			const connection = (await engine())!.connection;
			expect(await contexts().forConnection(connection)).toMatchObject([{ directions: { teams: 'off', goals: 'both' } }]);
			expect(await contexts().forEverWorksOrganization(connection, ewOrgs[0].id)).toMatchObject({ directions: { tasks: 'off' } });
			expect(await contexts().forRequest(view.integrationTenantId as never)).toMatchObject({ directions: { ideas: 'off' } });

			// On again: the stored directions take effect again.
			await mappings.update(view.integrationTenantId, {
				entitySettings: [toggle(IntegrationEntity.ORGANIZATION_TEAM, true), toggle(IntegrationEntity.TASK, true)]
			});
			expect(await engine()).toMatchObject({ directions: { ...DEFAULT_EVER_WORKS_DIRECTIONS }, entitySync: { Comment: false, KeyResult: false } });
		});

		it('each entity turns off exactly its own domains; KEY_RESULT and COMMENT turn none off', async () => {
			const created = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
			// Every domain on first (agent mail is off by default), so each toggle shows what it turns off.
			const view = await mappings.update(created.integrationTenantId, { directions: { agentEmail: 'ew_to_gauzy' } });
			const stored = view.directions as Record<string, string>;
			const expected: Array<[IntegrationEntity, string[]]> = [
				[IntegrationEntity.EMPLOYEE, ['members']],
				[IntegrationEntity.AGENT, ['agents']],
				[IntegrationEntity.ORGANIZATION_TEAM, ['teams']],
				[IntegrationEntity.PROJECT, ['works']],
				[IntegrationEntity.STRATEGIC_INITIATIVE, ['missions']],
				[IntegrationEntity.GOAL, ['goals']],
				[IntegrationEntity.TASK, ['tasks', 'ideas']],
				[IntegrationEntity.INBOX_ITEM, ['inbox', 'agentEmail']],
				[IntegrationEntity.DOCUMENT, ['docs']],
				[IntegrationEntity.KEY_RESULT, []],
				[IntegrationEntity.COMMENT, []]
			];
			for (const [entity, domains] of expected) {
				await mappings.update(view.integrationTenantId, { entitySettings: [toggle(entity, false)] });
				const context = await engine();
				const off = Object.entries((context as unknown as { directions: Record<string, string> }).directions)
					.filter(([domain, direction]) => direction === 'off' && stored[domain] !== 'off')
					.map(([domain]) => domain);
				expect([entity, off.sort()]).toEqual([entity, [...domains].sort()]);
				await mappings.update(view.integrationTenantId, { entitySettings: [toggle(entity, true)] });
			}
		});

		it('a toggle written through the platform (the entity setting row itself) takes effect too; no rows at all keeps the directions', async () => {
			const view = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
			await dataSource
				.getRepository(IntegrationEntitySetting)
				.update({ integrationId: view.integrationTenantId, entity: IntegrationEntity.DOCUMENT } as never, { sync: false } as never);
			expect(await engine()).toMatchObject({ directions: { docs: 'off', tasks: 'both' } });
			expect(await mappings.current()).toMatchObject({ effectiveDirections: { docs: 'off' }, directions: { docs: 'both' } });

			// A mapping without toggle rows (made before they existed) keeps its stored directions.
			await dataSource.query(`DELETE FROM "integration_entity_setting"`);
			expect(await engine()).toMatchObject({ directions: DEFAULT_EVER_WORKS_DIRECTIONS });
			expect(await mappings.current()).toMatchObject({ effectiveDirections: DEFAULT_EVER_WORKS_DIRECTIONS });
			// Its toggles can still be set: the missing rows are created (all on) before the change is written.
			const updated = await mappings.update(view.integrationTenantId, { entitySettings: [toggle(IntegrationEntity.AGENT, false)] });
			expect(updated.entitySettings).toHaveLength(EVER_WORKS_SYNCED_ENTITIES.length);
			expect(updated.entitySettings.filter((row) => !row.sync)).toEqual([{ entity: IntegrationEntity.AGENT, sync: false }]);
			expect(await engine()).toMatchObject({ directions: { agents: 'off', docs: 'both' } });
		});
	});

	describe('review hardening (#10774)', () => {
		it("the view reads the mapping's connection within its tenant only", async () => {
			const view = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
			expect(view.everWorksOrganization.displayName).toBe(ewOrgs[0].displayName);
			as(B);
			const other = await connections.connect({ apiBaseUrl: 'https://ew.example.test/api', apiKey: mock.addKey({ organizations: ewOrgs }) });
			as(A);
			// A setting that names another tenant's connection (it pins the same organization) shows nothing of it.
			await dataSource.query('UPDATE "integration_setting" SET "settingsValue" = ? WHERE "integrationId" = ? AND "settingsName" = ?', [
				other.id,
				view.integrationTenantId,
				EverWorksSettingName.CONNECTION_ID
			]);
			expect((await mappings.current())?.connectionId).toBe(other.id);
			expect((await mappings.current())?.everWorksOrganization.displayName).toBeNull();
		});

		it('a disconnect that lands after the connection was read but before the mapping is written leaves no mapping', async () => {
			const connection = await connections.current();
			// The catalog step runs between the read and the transaction: disconnect there.
			const racing = new EverWorksMappingService(
				dataSource,
				new EverWorksScopeService(dataSource),
				connections,
				{ ensure: async () => (await connections.disconnect(connection!.id), new EverWorksCatalogService(dataSource).ensure()) } as never,
				commandBus as never
			);
			await expect(racing.create({ everWorksOrganizationId: ewOrgs[0].id })).rejects.toBeInstanceOf(ConflictException);
			expect(await dataSource.getRepository(IntegrationTenant).count({ where: { isActive: true } as never })).toBe(0);
		});

		it('two requests in one process create the Ideas project once', async () => {
			const view = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
			const [a, b] = await Promise.all([mappings.ensureIdeasProject(view.integrationTenantId), mappings.ensureIdeasProject(view.integrationTenantId)]);
			expect(a.projectId).toBe(b.projectId);
			expect(commandBus.execute).toHaveBeenCalledTimes(1);
			expect([a.created, b.created].sort()).toEqual([false, true]);
		});

		it('a project another process recorded first wins; the one made here is archived', async () => {
			const view = await mappings.create({ everWorksOrganizationId: ewOrgs[0].id });
			const theirs = await dataSource.getRepository(OrganizationProject).save({ id: randomUUID(), tenantId: A.tenantId, organizationId: A.organizationId, name: 'theirs' });
			// While this process creates its project, the other one records its own.
			commandBus.execute.mockImplementationOnce(async (command: { input: Record<string, unknown> }) => {
				const row = await dataSource.getRepository(IntegrationTenant).findOneOrFail({ where: { id: view.integrationTenantId }, relations: { settings: true } } as never);
				const setting = (row as { settings: Array<{ settingsName: string; settingsValue: string }> }).settings.find((s) => s.settingsName === 'IDEAS_PROJECT_ID');
				await dataSource.getRepository(IntegrationSetting).update({ id: (setting as unknown as { id: string }).id } as never, { settingsValue: (theirs as { id: string }).id } as never);
				return dataSource.getRepository(OrganizationProject).save({ id: randomUUID(), ...command.input });
			});
			const result = await mappings.ensureIdeasProject(view.integrationTenantId);
			expect(result).toEqual({ projectId: (theirs as { id: string }).id, created: false });
			const ours = await dataSource.getRepository(OrganizationProject).findOneByOrFail({ name: EVER_WORKS_IDEAS_PROJECT_NAME });
			expect(ours).toMatchObject({ isActive: false, isArchived: true });
		});
	});
});
