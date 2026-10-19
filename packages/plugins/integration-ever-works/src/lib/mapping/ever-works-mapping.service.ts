// cspell:ignore Unmapping sqljs
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { ID, IntegrationEntity, VisibilityLevelEnum } from '@gauzy/contracts';
import {
	IntegrationEntitySetting,
	IntegrationSetting,
	IntegrationTenant,
	IssueType,
	OrganizationProject,
	OrganizationProjectCreateCommand,
	RequestContext,
	TaskView,
	Tenant
} from '@gauzy/core';
import { EverWorksCatalogService } from '../ever-works-catalog.service';
import { EVER_WORKS_INTEGRATION_NAME } from '../ever-works.constants';
import { EverWorksSettingName as S } from '../ever-works-setting.enum';
import { EverWorksScope, EverWorksScopeService } from '../ever-works-scope.service';
import { EverWorksConnection, EverWorksConnectionStatus } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksCreateMappingDto, EverWorksUpdateMappingDto } from './dto/ever-works-mapping.dto';
import {
	DEFAULT_EVER_WORKS_DIRECTIONS,
	effectiveDirections,
	EVER_WORKS_DEFAULT_PROJECT_NAME,
	EVER_WORKS_DOMAINS,
	EVER_WORKS_IDEA_ISSUE_TYPE,
	EVER_WORKS_IDEAS_PROJECT_NAME,
	EVER_WORKS_IDEAS_VIEW,
	EVER_WORKS_SYNCED_ENTITIES,
	EverWorksDirection,
	EverWorksDomain
} from './ever-works-mapping.defaults';

/** A mapping (one Gauzy organization ↔ one pinned Ever Works organization) as the API returns it. */
export interface EverWorksMappingView {
	integrationTenantId: ID;
	organizationId: ID;
	connectionId: ID;
	everWorksOrganization: { id: string; slug: string; displayName: string | null };
	isEnabled: boolean;
	/** The directions as stored (what the directions form edits). */
	directions: Record<EverWorksDomain, EverWorksDirection>;
	/**
	 * The directions that take effect: `directions` with every domain of an entity whose `entitySettings` toggle is
	 * `sync: false` set to `off` (OQ4, review F77).
	 */
	effectiveDirections: Record<EverWorksDomain, EverWorksDirection>;
	defaultProjectId: ID | null;
	ideasProjectId: ID | null;
	docsRootFolderId: ID | null;
	includeHiddenTasks: boolean;
	includeTriageTasks: boolean;
	includeGoalIterationKeyResults: boolean;
	syncUnlinkedProjectTasks: boolean;
	ideaIssueTypeId: ID | null;
	ideasTaskViewId: ID | null;
	entitySettings: Array<{ entity: IntegrationEntity; sync: boolean }>;
}

type Mapping = IntegrationTenant & { id: ID; tenantId: ID; organizationId: ID };

/**
 * Organization mapping and settings (plan 06 G-P1-4): one `integration_tenant` named `Ever_Works` per
 * mapped Gauzy organization, pointing at the tenant's connection and one pinned Ever Works organization;
 * the settings of plan 06 as `integration_setting` rows (none of them secret), the per-entity `sync`
 * toggles as `integration_entity_setting` rows, the "Idea" issue type and "Ideas" view seeded for the
 * organization, and the "Ever Works" and "Ever Works — Ideas" projects created when needed.
 *
 * Every route is scoped to an organization the caller is an active member of; the tenant comes from the
 * request context only. Unmapping archives the mapping (links and logs are kept).
 */
@Injectable()
export class EverWorksMappingService {
	private readonly logger = new Logger('EverWorksMapping');
	private readonly projectCreations = new Map<string, Promise<{ projectId: ID; created: boolean }>>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly scopes: EverWorksScopeService,
		private readonly connections: EverWorksConnectionService,
		private readonly catalog: EverWorksCatalogService,
		private readonly commandBus: CommandBus
	) {}

	/** `GET /mappings`: this organization's mapping, or `null`. */
	async current(organizationId?: ID): Promise<EverWorksMappingView | null> {
		const scope = await this.scopes.resolve(organizationId);
		const mapping = await this.find(scope);
		return mapping ? this.view(mapping) : null;
	}

	/**
	 * `POST /mappings`: maps this organization to a pinned Ever Works organization of the tenant's active
	 * connection. A mapping archived earlier for the same pair is resumed (same id), so its links apply.
	 */
	async create(dto: EverWorksCreateMappingDto, organizationId?: ID): Promise<EverWorksMappingView> {
		const scope = await this.scopes.resolve(organizationId);
		const connection = await this.dataSource.getRepository(EverWorksConnection).findOne({
			where: { tenantId: scope.tenantId, isActive: true }
		});
		if (!connection || (dto.connectionId && dto.connectionId !== connection.id)) {
			throw new NotFoundException('Connect this tenant to Ever Works first.');
		}
		if (connection.status === EverWorksConnectionStatus.NEEDS_REAUTH) {
			throw new BadRequestException('The Ever Works key needs replacing before organizations can be mapped.');
		}
		const pinned = this.connections.pins(connection).find((org) => org.id === dto.everWorksOrganizationId);
		if (!pinned) {
			throw new BadRequestException('The Ever Works organization is not pinned to the connected key.');
		}
		const integration = await this.catalog.ensure();
		const mapping = await this.transaction(scope, async (manager) => {
			// Under the lock disconnect takes too: a disconnect that finished after the read above is seen
			// here, so no enabled mapping is ever saved onto a disconnected connection.
			const current = await manager.findOne(EverWorksConnection, { where: { id: connection.id as ID, tenantId: scope.tenantId, isActive: true } });
			if (!current || current.status === EverWorksConnectionStatus.NEEDS_REAUTH) {
				throw new ConflictException('The Ever Works connection changed meanwhile (disconnected or needs a new key). Try again.');
			}
			const all = await manager.find(IntegrationTenant, {
				where: { tenantId: scope.tenantId, name: EVER_WORKS_INTEGRATION_NAME },
				relations: { settings: true }
			});
			const setting = (row: IntegrationTenant, name: S) => row.settings?.find((s) => s.settingsName === name)?.settingsValue;
			const active = all.filter((row) => row.isActive && !row.isArchived);
			if (active.some((row) => row.organizationId === scope.organizationId)) {
				throw new ConflictException('This organization is already mapped to an Ever Works organization. Unmap it first.');
			}
			if (active.some((row) => setting(row, S.EVER_WORKS_ORGANIZATION_ID) === pinned.id)) {
				throw new ConflictException('That Ever Works organization is already mapped to another organization of this tenant.');
			}
			const previous = all.find(
				(row) =>
					row.organizationId === scope.organizationId &&
					setting(row, S.EVER_WORKS_ORGANIZATION_ID) === pinned.id &&
					setting(row, S.CONNECTION_ID) === connection.id
			);
			const row: IntegrationTenant =
				previous ??
				manager.create(IntegrationTenant, {
					id: randomUUID(),
					tenantId: scope.tenantId,
					organizationId: scope.organizationId,
					name: EVER_WORKS_INTEGRATION_NAME,
					integrationId: integration.id
				});
			Object.assign(row, { isActive: true, isArchived: false, archivedAt: null, integrationId: integration.id });
			const defaults: Record<string, string> = {
				[S.CONNECTION_ID]: connection.id as ID,
				[S.EVER_WORKS_ORGANIZATION_ID]: pinned.id,
				[S.EVER_WORKS_ORGANIZATION_SLUG]: pinned.slug,
				[S.IS_ENABLED]: 'true'
			};
			const firstTime: Record<string, string> = {
				[S.ENTITY_DIRECTIONS]: JSON.stringify(DEFAULT_EVER_WORKS_DIRECTIONS),
				[S.DEFAULT_PROJECT_ID]: '',
				[S.IDEAS_PROJECT_ID]: '',
				[S.DOCS_ROOT_FOLDER_ID]: '',
				[S.INCLUDE_HIDDEN_TASKS]: 'false',
				[S.INCLUDE_TRIAGE_TASKS]: 'false',
				[S.INCLUDE_GOAL_ITERATION_KEY_RESULTS]: 'false',
				[S.SYNC_UNLINKED_PROJECT_TASKS]: 'true'
			};
			this.set(row, defaults, manager, true);
			this.set(row, firstTime, manager, false);
			const saved = (await manager.save(IntegrationTenant, row)) as Mapping;
			await this.ensureEntitySettings(manager, saved);
			await this.seedIdeas(manager, saved);
			return saved;
		});
		this.logger.log(`Organization ${scope.organizationId} mapped to Ever Works organization ${pinned.id} (mapping ${mapping.id}).`);
		const created = await this.reload(mapping.id);
		// A restored mapping keeps its directions: when it mirrors agent mail, the webhook asks for it again.
		if (this.directions(created)['agentEmail'] === 'ew_to_gauzy') {
			await this.connections.refreshWebhookEvents(connection.id as ID, scope.tenantId);
		}
		return this.view(created);
	}

	/** `PUT /mappings/:integrationTenantId`: directions, projects, docs folder, include flags, enabled, entity toggles. */
	async update(integrationTenantId: ID, dto: EverWorksUpdateMappingDto, organizationId?: ID): Promise<EverWorksMappingView> {
		const scope = await this.scopes.resolve(organizationId);
		// A toggle for an entity Ever Works does not sync would be dropped silently: refused before anything is written.
		const unsynced = (dto.entitySettings ?? []).filter((change) => !EVER_WORKS_SYNCED_ENTITIES.includes(change.entity));
		if (unsynced.length) {
			throw new BadRequestException(`Not a synced Ever Works entity: ${unsynced.map((change) => change.entity).join(', ')}.`);
		}
		const connectionId = await this.transaction(scope, async (manager) => {
			const mapping = await this.require(manager, scope, integrationTenantId);
			const values: Record<string, string> = {};
			if (dto.directions !== undefined) {
				const merged = { ...this.directions(mapping), ...this.validDirections(dto.directions) };
				values[S.ENTITY_DIRECTIONS] = JSON.stringify(merged);
			}
			for (const [field, name] of [
				['defaultProjectId', S.DEFAULT_PROJECT_ID],
				['ideasProjectId', S.IDEAS_PROJECT_ID]
			] as const) {
				const value = dto[field];
				if (value === undefined) continue;
				if (value) await this.assertProject(manager, scope, value);
				values[name] = value ?? '';
			}
			if (dto.docsRootFolderId !== undefined) values[S.DOCS_ROOT_FOLDER_ID] = dto.docsRootFolderId ?? '';
			for (const [field, name] of [
				['includeHiddenTasks', S.INCLUDE_HIDDEN_TASKS],
				['includeTriageTasks', S.INCLUDE_TRIAGE_TASKS],
				['includeGoalIterationKeyResults', S.INCLUDE_GOAL_ITERATION_KEY_RESULTS],
				['syncUnlinkedProjectTasks', S.SYNC_UNLINKED_PROJECT_TASKS],
				['isEnabled', S.IS_ENABLED]
			] as const) {
				if (dto[field] !== undefined) values[name] = String(dto[field]);
			}
			this.set(mapping, values, manager, true);
			await manager.save(IntegrationTenant, mapping);
			if (dto.entitySettings?.length) {
				// A mapping made before the toggles existed gets its rows first (all on), so its toggles can be set (OQ4).
				await this.ensureEntitySettings(manager, mapping as Mapping);
				const rows = await manager.find(IntegrationEntitySetting, { where: { integrationId: mapping.id } as never });
				for (const change of dto.entitySettings) {
					const row = rows.find((r) => r.entity === change.entity);
					// Every synced entity has its row from the mapping's creation; a missing one rolls the update back.
					if (!row) throw new BadRequestException(`The mapping has no ${change.entity} toggle.`);
					row.sync = change.sync;
					await manager.save(IntegrationEntitySetting, row);
				}
			}
			return (this.setting(mapping, S.CONNECTION_ID) as ID) || null;
		});
		// Agent mail arrives by webhook while a mapping mirrors it: the subscription follows the direction.
		if (connectionId && dto.directions && 'agentEmail' in dto.directions) {
			await this.connections.refreshWebhookEvents(connectionId, scope.tenantId);
		}
		return this.view(await this.reload(integrationTenantId));
	}

	/** `DELETE /mappings/:integrationTenantId`: archives the mapping (links and logs are kept; nothing synced is deleted). */
	async remove(integrationTenantId: ID, organizationId?: ID): Promise<{ success: true }> {
		const scope = await this.scopes.resolve(organizationId);
		const connectionId = await this.transaction(scope, async (manager) => {
			const mapping = await this.require(manager, scope, integrationTenantId);
			Object.assign(mapping, { isActive: false, isArchived: true, archivedAt: new Date() });
			this.set(mapping, { [S.IS_ENABLED]: 'false' }, manager, true);
			await manager.save(IntegrationTenant, mapping);
			return (this.setting(mapping, S.CONNECTION_ID) as ID) || null;
		});
		// An archived mapping mirrors no agent mail any more.
		if (connectionId) await this.connections.refreshWebhookEvents(connectionId, scope.tenantId);
		return { success: true };
	}

	/** `POST /mappings/:id/projects/default`: the "Ever Works" project, created on first need (plan 06 G-P1-4). */
	async ensureDefaultProject(integrationTenantId: ID, organizationId?: ID): Promise<{ projectId: ID; created: boolean }> {
		return this.ensureProject(integrationTenantId, S.DEFAULT_PROJECT_ID, EVER_WORKS_DEFAULT_PROJECT_NAME, () => this.scopes.resolve(organizationId));
	}

	/** `POST /mappings/:id/projects/ideas`: the "Ever Works — Ideas" project, created on first need. */
	async ensureIdeasProject(integrationTenantId: ID, organizationId?: ID): Promise<{ projectId: ID; created: boolean }> {
		return this.ensureProject(integrationTenantId, S.IDEAS_PROJECT_ID, EVER_WORKS_IDEAS_PROJECT_NAME, () => this.scopes.resolve(organizationId));
	}

	/**
	 * For the sync engine (no request, so no caller to check): the mapping's "Ever Works" (`default`) or
	 * "Ever Works — Ideas" (`ideas`) project, created on first need exactly as the routes above create it.
	 * The caller runs it inside a request context of its own, so the platform's project command sees the
	 * tenant (plan 01 §7.2: every synced task sits in a project).
	 */
	async ensureProjectForSync(tenantId: ID, organizationId: ID, integrationTenantId: ID, kind: 'default' | 'ideas'): Promise<ID> {
		const scope: EverWorksScope = { tenantId, organizationId, userId: (RequestContext.currentUserId() ?? '') as ID };
		const { projectId } =
			kind === 'ideas'
				? await this.ensureProject(integrationTenantId, S.IDEAS_PROJECT_ID, EVER_WORKS_IDEAS_PROJECT_NAME, async () => scope)
				: await this.ensureProject(integrationTenantId, S.DEFAULT_PROJECT_ID, EVER_WORKS_DEFAULT_PROJECT_NAME, async () => scope);
		return projectId;
	}

	// ── Internals ──────────────────────────────────────────────────────────────────────────────

	/**
	 * Returns the configured project, or creates it through the platform's own command (so the project
	 * gets its task statuses, priorities, sizes and issue types like any other) and records it.
	 */
	private async ensureProject(
		integrationTenantId: ID,
		name: S,
		projectName: string,
		scopeOf: () => Promise<EverWorksScope>
	): Promise<{ projectId: ID; created: boolean }> {
		const key = `${integrationTenantId}:${name}`;
		const previous = this.projectCreations.get(key) ?? Promise.resolve();
		const current = previous.catch(() => undefined).then(() => this.ensureProjectOnce(integrationTenantId, name, projectName, scopeOf));
		this.projectCreations.set(key, current);
		try {
			return await current;
		} finally {
			if (this.projectCreations.get(key) === current) this.projectCreations.delete(key);
		}
	}

	private async ensureProjectOnce(
		integrationTenantId: ID,
		name: S,
		projectName: string,
		scopeOf: () => Promise<EverWorksScope>
	): Promise<{ projectId: ID; created: boolean }> {
		const scope = await scopeOf();
		const mapping = await this.require(this.dataSource.manager, scope, integrationTenantId);
		const configured = this.setting(mapping, name);
		if (configured) {
			const exists = await this.dataSource.getRepository(OrganizationProject).findOne({
				where: { id: configured, tenantId: scope.tenantId, organizationId: scope.organizationId, isActive: true, isArchived: false }
			});
			if (exists?.id) return { projectId: exists.id, created: false };
		}
		// A project of that name made earlier (by this integration or by hand) is reused, not duplicated.
		const named = await this.dataSource.getRepository(OrganizationProject).findOne({
			where: { name: projectName, tenantId: scope.tenantId, organizationId: scope.organizationId, isActive: true, isArchived: false }
		});
		const project =
			named ??
			((await this.commandBus.execute(
				new OrganizationProjectCreateCommand({
					name: projectName,
					tenantId: scope.tenantId,
					organizationId: scope.organizationId,
					description: 'Created by the Ever Works integration.'
				} as never)
			)) as OrganizationProject);
		const recorded = await this.transaction(scope, async (manager) => {
			const row = await this.require(manager, scope, integrationTenantId);
			// Another process recorded a live project first: keep it.
			const winner = this.setting(row, name);
			if (winner && winner !== project.id) {
				const alive = await manager.count(OrganizationProject, {
					where: { id: winner, tenantId: scope.tenantId, organizationId: scope.organizationId, isActive: true, isArchived: false }
				});
				if (alive) return winner as ID;
			}
			this.set(row, { [name]: project.id as ID }, manager, true);
			await manager.save(IntegrationTenant, row);
			return project.id as ID;
		});
		if (recorded !== project.id && !named) {
			// The project made here lost the race: archive it (it is empty and seconds old) rather than leave a twin.
			await this.dataSource
				.getRepository(OrganizationProject)
				.update({ id: project.id as ID }, { isActive: false, isArchived: true } as never)
				.catch(() => undefined);
		}
		return { projectId: recorded, created: recorded === project.id && !named };
	}

	/** One sync toggle per synced entity, all on, created once. */
	private async ensureEntitySettings(manager: EntityManager, mapping: Mapping): Promise<void> {
		const existing = await manager.find(IntegrationEntitySetting, { where: { integrationId: mapping.id } as never });
		const missing = EVER_WORKS_SYNCED_ENTITIES.filter((entity) => !existing.some((row) => row.entity === entity));
		if (!missing.length) return;
		await manager.save(
			IntegrationEntitySetting,
			missing.map((entity) =>
				manager.create(IntegrationEntitySetting, {
					id: randomUUID(),
					tenantId: mapping.tenantId,
					organizationId: mapping.organizationId,
					integrationId: mapping.id,
					entity,
					sync: true
				} as never)
			)
		);
	}

	/**
	 * The organization's "Idea" issue type and "Ideas" view (plan 01 §8), created once; an existing
	 * org-level "Idea" type (made by hand) is reused rather than duplicated.
	 */
	private async seedIdeas(manager: EntityManager, mapping: Mapping): Promise<void> {
		const where = { tenantId: mapping.tenantId, organizationId: mapping.organizationId };
		let issueType = await manager.findOne(IssueType, {
			where: { ...where, value: EVER_WORKS_IDEA_ISSUE_TYPE.value, projectId: IsNull(), organizationTeamId: IsNull() } as never
		});
		if (!issueType) {
			issueType = await manager.save(
				IssueType,
				manager.create(IssueType, {
					id: randomUUID(),
					...where,
					...EVER_WORKS_IDEA_ISSUE_TYPE,
					isSystem: false,
					isDefault: false
				} as never)
			);
		}
		const json = (value: Record<string, unknown>) =>
			['sqlite', 'better-sqlite3', 'sqljs'].includes(manager.connection.options.type) ? (JSON.stringify(value) as never) : value;
		let view = await manager.findOne(TaskView, { where: { ...where, name: EVER_WORKS_IDEAS_VIEW.name } as never });
		if (!view) {
			view = await manager.save(
				TaskView,
				manager.create(TaskView, {
					id: randomUUID(),
					...where,
					...EVER_WORKS_IDEAS_VIEW,
					visibilityLevel: VisibilityLevelEnum.ORGANIZATION,
					// The shape TaskService.findTasksByViewQuery reads: `types` (issue types) and the organization.
					queryParams: json({ types: [EVER_WORKS_IDEA_ISSUE_TYPE.value], organizationId: mapping.organizationId }),
					filterOptions: json({ types: [EVER_WORKS_IDEA_ISSUE_TYPE.value] }),
					isLocked: false
				} as never)
			);
		}
		this.set(mapping, { [S.IDEA_ISSUE_TYPE_ID]: issueType.id as ID, [S.IDEAS_TASK_VIEW_ID]: view.id as ID }, manager, true);
		await manager.save(IntegrationTenant, mapping);
	}

	private async assertProject(manager: EntityManager, scope: EverWorksScope, projectId: ID): Promise<void> {
		const found = await manager.count(OrganizationProject, {
			where: { id: projectId, tenantId: scope.tenantId, organizationId: scope.organizationId, isActive: true, isArchived: false }
		});
		if (!found) throw new BadRequestException('The project must be an active project of this organization.');
	}

	private validDirections(input: Record<string, string>): Partial<Record<EverWorksDomain, EverWorksDirection>> {
		const result: Partial<Record<EverWorksDomain, EverWorksDirection>> = {};
		for (const [domain, direction] of Object.entries(input ?? {})) {
			const allowed = (EVER_WORKS_DOMAINS as Record<string, ReadonlyArray<string>>)[domain];
			if (!allowed) throw new BadRequestException(`Unknown synced domain: ${domain}.`);
			if (!allowed.includes(direction)) {
				throw new BadRequestException(`${domain} syncs ${allowed.join(', ')}; not ${direction}.`);
			}
			result[domain as EverWorksDomain] = direction as EverWorksDirection;
		}
		return result;
	}

	private directions(mapping: IntegrationTenant): Record<EverWorksDomain, EverWorksDirection> {
		let stored: Partial<Record<EverWorksDomain, EverWorksDirection>> = {};
		try {
			stored = JSON.parse(this.setting(mapping, S.ENTITY_DIRECTIONS) || '{}');
		} catch {
			stored = {};
		}
		return { ...DEFAULT_EVER_WORKS_DIRECTIONS, ...stored };
	}

	private setting(mapping: IntegrationTenant, name: S): string {
		return mapping.settings?.find((s) => s.settingsName === name)?.settingsValue ?? '';
	}

	/** Writes settings; `overwrite=false` only fills the ones that are missing. */
	private set(mapping: IntegrationTenant, values: Record<string, string>, manager: EntityManager, overwrite: boolean): void {
		mapping.settings ??= [];
		for (const [settingsName, settingsValue] of Object.entries(values)) {
			const existing = mapping.settings.find((s) => s.settingsName === settingsName);
			if (existing) {
				if (overwrite) existing.settingsValue = settingsValue;
				continue;
			}
			mapping.settings.push(
				manager.create(IntegrationSetting, {
					id: randomUUID(),
					tenantId: mapping.tenantId,
					organizationId: mapping.organizationId,
					settingsName,
					settingsValue
				})
			);
		}
	}

	private async find(scope: EverWorksScope, manager: EntityManager = this.dataSource.manager): Promise<Mapping | null> {
		return (await manager.findOne(IntegrationTenant, {
			where: { tenantId: scope.tenantId, organizationId: scope.organizationId, name: EVER_WORKS_INTEGRATION_NAME, isActive: true, isArchived: false },
			relations: { settings: true }
		})) as Mapping | null;
	}

	private async require(manager: EntityManager, scope: EverWorksScope, integrationTenantId: ID): Promise<Mapping> {
		const mapping = await this.find(scope, manager);
		if (!mapping || mapping.id !== integrationTenantId) throw new NotFoundException('Ever Works mapping not found.');
		return mapping;
	}

	private async reload(id: ID): Promise<Mapping> {
		return (await this.dataSource.manager.findOneOrFail(IntegrationTenant, { where: { id }, relations: { settings: true } })) as Mapping;
	}

	/**
	 * A transaction serialised per tenant, under the same lock as the connection's connect and disconnect
	 * (Postgres advisory lock, MySQL tenant row lock; SQLite has one writer).
	 */
	private async transaction<T>(scope: EverWorksScope, work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(async (manager) => {
			const type = manager.connection.options.type;
			if (type === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`ever-works:connection:${scope.tenantId}`]);
			} else if (type === 'mysql' || type === 'mariadb') {
				await manager.findOne(Tenant, { where: { id: scope.tenantId }, lock: { mode: 'pessimistic_write' } });
			}
			return work(manager);
		});
	}

	/** The mapping as the API returns it. */
	async view(mapping: IntegrationTenant): Promise<EverWorksMappingView> {
		const bool = (name: S, fallback: boolean) => {
			const value = this.setting(mapping, name);
			return value === '' ? fallback : value === 'true';
		};
		const id = (name: S) => (this.setting(mapping, name) || null) as ID | null;
		const connectionId = this.setting(mapping, S.CONNECTION_ID) as ID;
		// Scoped by tenant like every other connection read: a wrong setting value never shows another tenant's connection.
		const connection = connectionId
			? await this.dataSource.getRepository(EverWorksConnection).findOne({ where: { id: connectionId, tenantId: mapping.tenantId as ID } })
			: null;
		const everWorksOrganizationId = this.setting(mapping, S.EVER_WORKS_ORGANIZATION_ID);
		const pin = connection ? this.connections.pins(connection).find((org) => org.id === everWorksOrganizationId) : undefined;
		const entitySettings = await this.dataSource.getRepository(IntegrationEntitySetting).find({
			where: { integrationId: mapping.id, entity: In([...EVER_WORKS_SYNCED_ENTITIES]) } as never
		});
		return {
			integrationTenantId: mapping.id as ID,
			organizationId: mapping.organizationId as ID,
			connectionId,
			everWorksOrganization: { id: everWorksOrganizationId, slug: this.setting(mapping, S.EVER_WORKS_ORGANIZATION_SLUG), displayName: pin?.displayName ?? null },
			isEnabled: mapping.isActive === true && bool(S.IS_ENABLED, false),
			directions: this.directions(mapping),
			effectiveDirections: effectiveDirections(
				this.directions(mapping),
				Object.fromEntries(entitySettings.filter((row) => row.sync === false).map((row) => [row.entity, false]))
			),
			defaultProjectId: id(S.DEFAULT_PROJECT_ID),
			ideasProjectId: id(S.IDEAS_PROJECT_ID),
			docsRootFolderId: id(S.DOCS_ROOT_FOLDER_ID),
			includeHiddenTasks: bool(S.INCLUDE_HIDDEN_TASKS, false),
			includeTriageTasks: bool(S.INCLUDE_TRIAGE_TASKS, false),
			includeGoalIterationKeyResults: bool(S.INCLUDE_GOAL_ITERATION_KEY_RESULTS, false),
			syncUnlinkedProjectTasks: bool(S.SYNC_UNLINKED_PROJECT_TASKS, true),
			ideaIssueTypeId: id(S.IDEA_ISSUE_TYPE_ID),
			ideasTaskViewId: id(S.IDEAS_TASK_VIEW_ID),
			entitySettings: EVER_WORKS_SYNCED_ENTITIES.map((entity) => ({
				entity,
				sync: entitySettings.find((row) => row.entity === entity)?.sync ?? true
			}))
		};
	}
}
