import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, MoreThanOrEqual } from 'typeorm';
import { ID, IIntegrationTenant, IntegrationEntity } from '@gauzy/contracts';
import { createHash } from 'node:crypto';
import { IntegrationMap, IntegrationSetting, OrganizationProjectService, Task, TenantAwareCrudService } from '@gauzy/core';
import {
	JiraSyncDirection,
	JiraProjectMapping,
	MikroOrmJiraProjectMappingRepository,
	TypeOrmJiraProjectMappingRepository
} from './entities/jira-project-mapping.entity';
import { JiraSyncRun, JiraSyncRunStatus } from './entities/jira-sync-run.entity';
import { JIRA_IMPORT_STALE_MS } from './jira-sync-run.service';
import {
	JIRA_MAPPING_EXISTS,
	JIRA_MAPPINGS_BUSY,
	JIRA_MAPPING_PROJECT_FIXED,
	JIRA_PROJECT_NOT_FOUND,
	JIRA_PROJECT_OUTBOUND_TAKEN,
	JIRA_SITE_CHANGED,
	JIRA_STATUS_MAP_INVALID,
	JiraSettingName
} from './jira.constants';
import { invalidStatusMapKeys, serializeIssueTypeIds, serializeStatusMap } from './sync/jira-issue.mapper';

export interface JiraMappingInput {
	jiraProjectId: string;
	jiraProjectKey?: string | null;
	jiraProjectName?: string | null;
	projectId: ID;
	direction?: JiraSyncDirection;
	statusMap?: Record<string, string> | null;
	/** The issue types imported (ids); none for every type. */
	issueTypeIds?: string[] | null;
	syncEnabled?: boolean;
}

/** How long a MySQL / MariaDB change of an organization's mappings waits for another one before it is refused (409). */
const MYSQL_MAPPINGS_LOCK_WAIT_SECONDS = 30;

/** Whether a write failed on a unique index: Postgres 23505, MySQL / MariaDB ER_DUP_ENTRY (1062), SQLite's constraint code. */
export function isUniqueViolation(error: unknown): boolean {
	const failure = error as { code?: unknown; errno?: unknown; driverError?: { code?: unknown; errno?: unknown } } | null;
	const code = String(failure?.code ?? failure?.driverError?.code ?? '');
	const errno = Number(failure?.errno ?? failure?.driverError?.errno ?? 0);
	return code === '23505' || code === 'ER_DUP_ENTRY' || errno === 1062 || code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE';
}

/** The Jira project ↔ platform project mappings of the connections, scoped to the caller's tenant. */
@Injectable()
export class JiraMappingService extends TenantAwareCrudService<JiraProjectMapping> {
	constructor(
		readonly typeOrmJiraProjectMappingRepository: TypeOrmJiraProjectMappingRepository,
		readonly mikroOrmJiraProjectMappingRepository: MikroOrmJiraProjectMappingRepository,
		private readonly organizationProjectService: OrganizationProjectService,
		private readonly dataSource: DataSource
	) {
		super(typeOrmJiraProjectMappingRepository, mikroOrmJiraProjectMappingRepository);
	}

	/** The mappings of a connection. */
	async list(tenant: IIntegrationTenant): Promise<JiraProjectMapping[]> {
		const { items } = await this.findAll({
			where: { integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID },
			order: { createdAt: 'ASC' }
		});
		return items;
	}

	/** One mapping of a connection; 404 otherwise. */
	async requireOne(tenant: IIntegrationTenant, mappingId: ID): Promise<JiraProjectMapping> {
		const mapping = await this.findOneByOptions({
			where: { id: mappingId, integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID }
		}).catch(() => null);
		if (!mapping) throw new NotFoundException({ message: 'The mapping was not found' });
		return mapping;
	}

	/**
	 * Creates a mapping: the project must be the organization's, the Jira project not mapped yet, the project not already
	 * sending its tasks elsewhere. The checks and the write run in one transaction that admits one writer per
	 * connection at a time (an advisory lock on Postgres, the connection's mappings locked on MySQL / MariaDB; SQLite
	 * serializes writers), and a unique-index violation that still gets through answers the same 409.
	 */
	async createMapping(tenant: IIntegrationTenant, input: JiraMappingInput, expectedCloudId?: string): Promise<JiraProjectMapping> {
		assertStatusMap(input.statusMap);
		await this.requireProject(tenant, input.projectId);
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const direction = input.direction ?? JiraSyncDirection.INBOUND;
		const where = { integrationId: tenant.id as ID, jiraProjectId: input.jiraProjectId, tenantId: scope.tenantId };
		try {
			return await this.withMappingsLock(tenant, async (manager) => {
				// The Jira project id was chosen on the site the request read; a site changed meanwhile (under this lock, see
				// `whileMappingsLocked`) could give it another project: refused, the person reads the new site's projects.
				if (expectedCloudId !== undefined) {
					const site = await manager.findOne(IntegrationSetting, {
						where: { integrationId: tenant.id as ID, settingsName: JiraSettingName.JIRA_CLOUD_ID, tenantId: tenant.tenantId as ID } as never
					});
					if ((site?.settingsValue || '') !== expectedCloudId) {
						throw new ConflictException({ message: 'The Jira site of the connection changed; choose the Jira project again', code: JIRA_SITE_CHANGED });
					}
				}
				const existing = await manager.findOne(JiraProjectMapping, { where: where as never });
				if (existing) throw this.mappedAlready(existing.id as ID);
				await this.assertOutboundFree(tenant, input.projectId, direction, null, manager);
				const mapping = Object.assign(new JiraProjectMapping(), {
					integrationId: tenant.id as ID,
					...scope,
					jiraProjectId: input.jiraProjectId,
					jiraProjectKey: input.jiraProjectKey ?? null,
					jiraProjectName: input.jiraProjectName ?? null,
					projectId: input.projectId,
					direction,
					statusMap: serializeStatusMap(input.statusMap),
					issueTypeIds: serializeIssueTypeIds(input.issueTypeIds),
					syncEnabled: input.syncEnabled ?? true
				});
				return manager.save(JiraProjectMapping, mapping);
			});
		} catch (error) {
			if (!isUniqueViolation(error)) throw error;
			// The violation aborted the transaction (Postgres): the raced row is read outside it, once it rolled back.
			const raced = await this.typeOrmJiraProjectMappingRepository.findOne({ where: where as never }).catch(() => null);
			throw raced ? this.mappedAlready(raced.id as ID) : error;
		}
	}

	private mappedAlready(mappingId: ID): ConflictException {
		return new ConflictException({ message: 'This Jira project is mapped already', code: JIRA_MAPPING_EXISTS, mappingId });
	}

	/**
	 * Runs work in a transaction while it is the one writer of an organization's mappings (see `createMapping`): an
	 * advisory lock by organization on Postgres, held to the end of the transaction; a named lock (`GET_LOCK`) on MySQL /
	 * MariaDB, released when the work ends. Never a row lock: work under the lock may write on other connections (a
	 * reconnect writes the connection and its settings, which reference the organization), and their foreign-key checks
	 * would wait on a locked organization row for good. SQLite serializes writers by itself.
	 */
	private async withMappingsLock<T>(scope: { tenantId?: ID | null; organizationId?: ID | null }, work: (manager: EntityManager) => Promise<T>): Promise<T> {
		const key = `integration-jira:mappings:${scope.tenantId}:${scope.organizationId}`;
		const runner = this.dataSource.createQueryRunner();
		await runner.connect();
		const dialect = runner.connection.options.type;
		// A lock name holds 64 characters at most.
		const named = dialect === 'mysql' || dialect === 'mariadb' ? `ijm:${createHash('sha1').update(key).digest('hex')}` : null;
		let held = false;
		try {
			// The named lock is taken before the transaction and released after its commit or rollback: a waiting writer
			// never reads the mappings before this one's are visible.
			if (named) {
				const [row] = (await runner.query('SELECT GET_LOCK(?, ?) AS acquired', [named, MYSQL_MAPPINGS_LOCK_WAIT_SECONDS])) as Array<{ acquired?: unknown }>;
				if (Number(row?.acquired) !== 1) {
					throw new ConflictException({ message: 'Another change of these mappings is running; try again', code: JIRA_MAPPINGS_BUSY });
				}
				held = true;
			}
			await runner.startTransaction();
			try {
				// Postgres: an advisory lock of the transaction, released by its commit or rollback.
				if (dialect === 'postgres') await runner.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
				const result = await work(runner.manager);
				await runner.commitTransaction();
				return result;
			} catch (error) {
				await runner.rollbackTransaction().catch(() => undefined);
				throw error;
			}
		} finally {
			if (named && held) await runner.query('SELECT RELEASE_LOCK(?)', [named]).catch(() => undefined);
			await runner.release();
		}
	}

	/**
	 * Runs work while no mapping of the organization can be created or changed (the lock a creation takes): a reconnect
	 * checks the site its mappings pin and writes the connection under it.
	 */
	async whileOrganizationMappingsLocked<T>(scope: { tenantId: ID; organizationId: ID }, work: () => Promise<T>): Promise<T> {
		return this.withMappingsLock(scope, () => work());
	}

	/**
	 * Runs work while no mapping of the connection's organization can be created or changed (the lock a creation takes),
	 * handing it how many mappings the connection has and whether it holds issues it synced (their id maps): a site change
	 * checks and writes under it, so a mapping created meanwhile for the former site can never stay behind on the new one.
	 */
	async whileMappingsLocked<T>(tenant: IIntegrationTenant, work: (mappings: number, synced: boolean) => Promise<T>): Promise<T> {
		return this.withMappingsLock(tenant, async (manager) => {
			const mappings = await manager.count(JiraProjectMapping, { where: { integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID } as never });
			// Live runs first: a run no longer running has committed its id maps, which the read after it then sees.
			return work(mappings, (await this.hasLiveRuns(tenant, manager)) || (await this.hasIssueMaps(tenant, manager)));
		});
	}

	/**
	 * Whether a run of the connection is live (running, with progress within the stale window): an import waiting for
	 * its first page holds no id map yet, but will write some for its site, whose mapping may be removed meanwhile.
	 */
	async hasLiveRuns(tenant: IIntegrationTenant, manager: EntityManager = this.dataSource.manager): Promise<boolean> {
		const runs = await manager.count(JiraSyncRun, {
			where: {
				integrationId: tenant.id as ID,
				tenantId: tenant.tenantId as ID,
				status: JiraSyncRunStatus.RUNNING,
				updatedAt: MoreThanOrEqual(new Date(Date.now() - JIRA_IMPORT_STALE_MS))
			} as never
		});
		return runs > 0;
	}

	/**
	 * Whether the connection holds issues it synced (the platform's id maps of its issues). They name Jira issues by ids
	 * only their site knows, so such a connection keeps its site, as one with mappings does, even once its mappings are
	 * removed; it moves to another site by a disconnect (which removes its id maps) and a new connection.
	 */
	async hasIssueMaps(tenant: IIntegrationTenant, manager: EntityManager = this.dataSource.manager): Promise<boolean> {
		const maps = await manager.count(IntegrationMap, {
			where: { integrationId: tenant.id as ID, entity: IntegrationEntity.ISSUE, tenantId: tenant.tenantId as ID } as never
		});
		return maps > 0;
	}

	/**
	 * Changes a mapping's project, direction, state map or switch: the mapping is read again under the same lock as
	 * a creation, so the outbound check sees the latest row and two changes cannot both pass it. A mapping that has
	 * synced keeps its project (its tasks' id maps point into that project): remove it and map the Jira project again
	 * instead. "Synced" is read from what lasts: a run of the mapping, its import position, or a task of its project
	 * that the connection's id map holds (a webhook's runs are pruned after a week; the id map stays).
	 */
	async updateMapping(tenant: IIntegrationTenant, mappingId: ID, input: Partial<JiraMappingInput>): Promise<JiraProjectMapping> {
		assertStatusMap(input.statusMap);
		await this.requireOne(tenant, mappingId);
		if (input.projectId) await this.requireProject(tenant, input.projectId);
		await this.withMappingsLock(tenant, async (manager) => {
			const mapping = await manager.findOne(JiraProjectMapping, { where: { id: mappingId, integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID } as never });
			if (!mapping) throw new NotFoundException({ message: 'The mapping was not found' });
			const patch: Partial<JiraProjectMapping> = {};
			if (input.projectId && input.projectId !== mapping.projectId) {
				if (await this.hasSynced(manager, tenant, mapping)) {
					throw new ConflictException({ message: 'A mapping that has synced keeps its project; remove it and map the Jira project again', code: JIRA_MAPPING_PROJECT_FIXED, mappingId });
				}
				patch.projectId = input.projectId;
			}
			if (input.direction) patch.direction = input.direction;
			if (input.statusMap !== undefined) patch.statusMap = serializeStatusMap(input.statusMap);
			if (input.issueTypeIds !== undefined) patch.issueTypeIds = serializeIssueTypeIds(input.issueTypeIds);
			if (input.syncEnabled !== undefined) patch.syncEnabled = input.syncEnabled;
			if (input.jiraProjectKey !== undefined) patch.jiraProjectKey = input.jiraProjectKey;
			if (input.jiraProjectName !== undefined) patch.jiraProjectName = input.jiraProjectName;
			if (!Object.keys(patch).length) return;
			await this.assertOutboundFree(tenant, patch.projectId ?? mapping.projectId, patch.direction ?? mapping.direction, mapping.id ?? null, manager);
			await manager.update(JiraProjectMapping, { id: mapping.id, tenantId: tenant.tenantId as ID }, patch as never);
		});
		return this.requireOne(tenant, mappingId);
	}

	/** Whether a mapping has brought anything in or sent anything out: a run, an import position, or a mapped task of its project. */
	private async hasSynced(manager: EntityManager, tenant: IIntegrationTenant, mapping: JiraProjectMapping): Promise<boolean> {
		if (mapping.lastImportedAt || mapping.lastCursor) return true;
		const runs = await manager.count(JiraSyncRun, { where: { mappingId: mapping.id, tenantId: tenant.tenantId as ID } as never });
		if (runs > 0) return true;
		const mappedTasks = await manager
			.createQueryBuilder(IntegrationMap, 'map')
			.innerJoin(Task, 'task', 'task.id = map.gauzyId')
			.where('map.integrationId = :integrationId', { integrationId: tenant.id })
			.andWhere('map.entity = :entity', { entity: IntegrationEntity.ISSUE })
			.andWhere('map.tenantId = :tenantId', { tenantId: tenant.tenantId })
			.andWhere('task.projectId = :projectId', { projectId: mapping.projectId })
			.getCount();
		return mappedTasks > 0;
	}

	/** Removes a mapping for good (its tasks stay, with their id maps). */
	async removeMapping(tenant: IIntegrationTenant, mappingId: ID): Promise<void> {
		const mapping = await this.requireOne(tenant, mappingId);
		await this.typeOrmJiraProjectMappingRepository.delete({ id: mapping.id, tenantId: tenant.tenantId as ID });
	}

	/** The mapping of a Jira project under a connection, when it syncs inbound. */
	async findInboundForProject(integrationId: ID, jiraProjectId: string): Promise<JiraProjectMapping | null> {
		const mapping = await this.typeOrmJiraProjectMappingRepository.findOne({ where: { integrationId, jiraProjectId } });
		if (!mapping || !mapping.syncEnabled || mapping.direction === JiraSyncDirection.OUTBOUND) return null;
		return mapping;
	}

	/** The mapping that sends a project's tasks out, in the tenant and organization, or null. */
	async findOutboundForProject(scope: { tenantId: ID; organizationId: ID }, projectId: ID): Promise<JiraProjectMapping | null> {
		const mappings = await this.typeOrmJiraProjectMappingRepository.find({
			where: { projectId, tenantId: scope.tenantId, organizationId: scope.organizationId, syncEnabled: true }
		});
		return mappings.find((mapping) => mapping.direction !== JiraSyncDirection.INBOUND) ?? null;
	}

	/** Where an import ended: its watermark and time, or what went wrong. */
	async recordImport(mapping: JiraProjectMapping, outcome: { cursor?: string | null; error?: string | null }): Promise<void> {
		await this.typeOrmJiraProjectMappingRepository.update(
			{ id: mapping.id },
			{
				...(outcome.cursor !== undefined ? { lastCursor: outcome.cursor } : {}),
				lastImportedAt: new Date(),
				lastError: outcome.error ?? null
			} as never
		);
	}

	/**
	 * A project sends its tasks to at most one Jira project: a second `outbound` / `both` mapping of the same
	 * project is refused (409), so a task's push always uses the Jira project that owns its issue.
	 */
	private async assertOutboundFree(tenant: IIntegrationTenant, projectId: ID, direction: JiraSyncDirection, exceptMappingId: ID | null, manager: EntityManager): Promise<void> {
		if (direction === JiraSyncDirection.INBOUND) return;
		const others = await manager.find(JiraProjectMapping, {
			where: { projectId, tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID } as never
		});
		const taken = others.find((other) => other.id !== exceptMappingId && other.direction !== JiraSyncDirection.INBOUND);
		if (taken) {
			throw new ConflictException({
				message: 'This project already sends its tasks to another Jira project',
				code: JIRA_PROJECT_OUTBOUND_TAKEN,
				mappingId: taken.id
			});
		}
	}

	private async requireProject(tenant: IIntegrationTenant, projectId: ID): Promise<void> {
		const project = await this.organizationProjectService
			.findOneByIdString(projectId, { where: { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID } })
			.catch(() => null);
		if (!project) {
			throw new NotFoundException({ message: 'The project was not found in this organization', code: JIRA_PROJECT_NOT_FOUND });
		}
	}
}

/**
 * A status map whose keys are not a status category or a status id is refused (400), rather than quietly dropped; so
 * is one whose value is not a task status name (blank, not text, or longer than 100), which would not be kept either.
 */
function assertStatusMap(statusMap: Record<string, string> | null | undefined): void {
	const invalid = invalidStatusMapKeys(statusMap ?? null);
	if (invalid.length) {
		throw new BadRequestException({
			message: `The status map names neither a status category (new, indeterminate, done) nor a status (status:<id>): ${invalid.slice(0, 5).join(', ')}`,
			code: JIRA_STATUS_MAP_INVALID
		});
	}
	const unusable = Object.entries(statusMap ?? {})
		.filter(([, value]) => typeof value !== 'string' || !value.trim() || value.trim().length > 100)
		.map(([key]) => key);
	if (unusable.length) {
		throw new BadRequestException({
			message: `The status map gives no task status (a name of 1 to 100 characters) for: ${unusable.slice(0, 5).join(', ')}`,
			code: JIRA_STATUS_MAP_INVALID
		});
	}
}
