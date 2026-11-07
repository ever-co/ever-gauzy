import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { Organization, OrganizationProjectService, TenantAwareCrudService } from '@gauzy/core';
import {
	LinearSyncDirection,
	LinearTeamMapping,
	MikroOrmLinearTeamMappingRepository,
	TypeOrmLinearTeamMappingRepository
} from './entities/linear-team-mapping.entity';
import { LinearSyncRun } from './entities/linear-sync-run.entity';
import { LINEAR_MAPPING_EXISTS, LINEAR_MAPPING_PROJECT_FIXED, LINEAR_PROJECT_NOT_FOUND, LINEAR_PROJECT_OUTBOUND_TAKEN } from './linear.constants';
import { serializeStateMap } from './sync/linear-issue.mapper';

export interface LinearMappingInput {
	linearTeamId: string;
	linearTeamKey?: string | null;
	linearTeamName?: string | null;
	projectId: ID;
	direction?: LinearSyncDirection;
	stateMap?: Record<string, string> | null;
	syncEnabled?: boolean;
}

/** Whether a write failed on a unique index: Postgres 23505, MySQL / MariaDB ER_DUP_ENTRY (1062), SQLite's constraint code. */
export function isUniqueViolation(error: unknown): boolean {
	const failure = error as { code?: unknown; errno?: unknown; driverError?: { code?: unknown; errno?: unknown } } | null;
	const code = String(failure?.code ?? failure?.driverError?.code ?? '');
	const errno = Number(failure?.errno ?? failure?.driverError?.errno ?? 0);
	return code === '23505' || code === 'ER_DUP_ENTRY' || errno === 1062 || code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE';
}

/** The team ↔ project mappings of the connections, scoped to the caller's tenant. */
@Injectable()
export class LinearMappingService extends TenantAwareCrudService<LinearTeamMapping> {
	constructor(
		readonly typeOrmLinearTeamMappingRepository: TypeOrmLinearTeamMappingRepository,
		readonly mikroOrmLinearTeamMappingRepository: MikroOrmLinearTeamMappingRepository,
		private readonly organizationProjectService: OrganizationProjectService,
		private readonly dataSource: DataSource
	) {
		super(typeOrmLinearTeamMappingRepository, mikroOrmLinearTeamMappingRepository);
	}

	/** The mappings of a connection. */
	async list(tenant: IIntegrationTenant): Promise<LinearTeamMapping[]> {
		const { items } = await this.findAll({
			where: { integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID },
			order: { createdAt: 'ASC' }
		});
		return items;
	}

	/** One mapping of a connection; 404 otherwise. */
	async requireOne(tenant: IIntegrationTenant, mappingId: ID): Promise<LinearTeamMapping> {
		const mapping = await this.findOneByOptions({
			where: { id: mappingId, integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID }
		}).catch(() => null);
		if (!mapping) throw new NotFoundException({ message: 'The mapping was not found' });
		return mapping;
	}

	/**
	 * Creates a mapping: the project must be the organization's, the team not mapped yet, the project not already
	 * sending its tasks elsewhere. The checks and the write run in one transaction that admits one writer per
	 * connection at a time (an advisory lock on Postgres, the connection's mappings locked on MySQL / MariaDB; SQLite
	 * serializes writers), and a unique-index violation that still gets through answers the same 409.
	 */
	async createMapping(tenant: IIntegrationTenant, input: LinearMappingInput): Promise<LinearTeamMapping> {
		await this.requireProject(tenant, input.projectId);
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const direction = input.direction ?? LinearSyncDirection.INBOUND;
		const where = { integrationId: tenant.id as ID, linearTeamId: input.linearTeamId, tenantId: scope.tenantId };
		try {
			return await this.dataSource.transaction(async (manager) => {
				await this.lockMappingsOf(manager, tenant);
				const existing = await manager.findOne(LinearTeamMapping, { where: where as never });
				if (existing) throw this.mappedAlready(existing.id as ID);
				await this.assertOutboundFree(tenant, input.projectId, direction, null, manager);
				const mapping = Object.assign(new LinearTeamMapping(), {
					integrationId: tenant.id as ID,
					...scope,
					linearTeamId: input.linearTeamId,
					linearTeamKey: input.linearTeamKey ?? null,
					linearTeamName: input.linearTeamName ?? null,
					projectId: input.projectId,
					direction,
					stateMap: serializeStateMap(input.stateMap),
					syncEnabled: input.syncEnabled ?? true
				});
				return manager.save(LinearTeamMapping, mapping);
			});
		} catch (error) {
			if (!isUniqueViolation(error)) throw error;
			// The violation aborted the transaction (Postgres): the raced row is read outside it, once it rolled back.
			const raced = await this.typeOrmLinearTeamMappingRepository.findOne({ where: where as never }).catch(() => null);
			throw raced ? this.mappedAlready(raced.id as ID) : error;
		}
	}

	private mappedAlready(mappingId: ID): ConflictException {
		return new ConflictException({ message: 'This Linear team is mapped already', code: LINEAR_MAPPING_EXISTS, mappingId });
	}

	/**
	 * One writer of an organization's mappings at a time within the transaction (see `createMapping`): an advisory
	 * lock by organization on Postgres (two connections of one organization serialize too), the organization's own
	 * row on MySQL / MariaDB — a row that always exists, unlike the mappings (a first mapping has none to lock).
	 */
	private async lockMappingsOf(manager: EntityManager, tenant: IIntegrationTenant): Promise<void> {
		const dialect = manager.connection.options.type;
		if (dialect === 'postgres') {
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`integration-linear:mappings:${tenant.tenantId}:${tenant.organizationId}`]);
		} else if (dialect === 'mysql' || dialect === 'mariadb') {
			await manager.findOne(Organization, { where: { id: tenant.organizationId as ID } as never, lock: { mode: 'pessimistic_write' } });
		}
	}

	/**
	 * Changes a mapping's project, direction, state map or switch: the mapping is read again under the same lock as
	 * a creation, so the outbound check sees the latest row and two changes cannot both pass it. A mapping that has
	 * imported or taken a webhook keeps its project (its tasks' id maps point into that project): remove it and map
	 * the team again instead.
	 */
	async updateMapping(tenant: IIntegrationTenant, mappingId: ID, input: Partial<LinearMappingInput>): Promise<LinearTeamMapping> {
		await this.requireOne(tenant, mappingId);
		if (input.projectId) await this.requireProject(tenant, input.projectId);
		await this.dataSource.transaction(async (manager) => {
			await this.lockMappingsOf(manager, tenant);
			const mapping = await manager.findOne(LinearTeamMapping, { where: { id: mappingId, integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID } as never });
			if (!mapping) throw new NotFoundException({ message: 'The mapping was not found' });
			const patch: Partial<LinearTeamMapping> = {};
			if (input.projectId && input.projectId !== mapping.projectId) {
				const runs = await manager.count(LinearSyncRun, { where: { mappingId: mapping.id, tenantId: tenant.tenantId as ID } as never });
				if (runs > 0) {
					throw new ConflictException({ message: 'A mapping that has synced keeps its project; remove it and map the team again', code: LINEAR_MAPPING_PROJECT_FIXED, mappingId });
				}
				patch.projectId = input.projectId;
			}
			if (input.direction) patch.direction = input.direction;
			if (input.stateMap !== undefined) patch.stateMap = serializeStateMap(input.stateMap);
			if (input.syncEnabled !== undefined) patch.syncEnabled = input.syncEnabled;
			if (input.linearTeamKey !== undefined) patch.linearTeamKey = input.linearTeamKey;
			if (input.linearTeamName !== undefined) patch.linearTeamName = input.linearTeamName;
			if (!Object.keys(patch).length) return;
			await this.assertOutboundFree(tenant, patch.projectId ?? mapping.projectId, patch.direction ?? mapping.direction, mapping.id ?? null, manager);
			await manager.update(LinearTeamMapping, { id: mapping.id, tenantId: tenant.tenantId as ID }, patch as never);
		});
		return this.requireOne(tenant, mappingId);
	}

	/** Removes a mapping for good (its tasks stay, with their id maps). */
	async removeMapping(tenant: IIntegrationTenant, mappingId: ID): Promise<void> {
		const mapping = await this.requireOne(tenant, mappingId);
		await this.typeOrmLinearTeamMappingRepository.delete({ id: mapping.id, tenantId: tenant.tenantId as ID });
	}

	/** The mapping of a Linear team under a connection, when it syncs inbound. */
	async findInboundForTeam(integrationId: ID, linearTeamId: string): Promise<LinearTeamMapping | null> {
		const mapping = await this.typeOrmLinearTeamMappingRepository.findOne({ where: { integrationId, linearTeamId } });
		if (!mapping || !mapping.syncEnabled || mapping.direction === LinearSyncDirection.OUTBOUND) return null;
		return mapping;
	}

	/** The mapping that sends a project's tasks out, in the tenant and organization, or null. */
	async findOutboundForProject(scope: { tenantId: ID; organizationId: ID }, projectId: ID): Promise<LinearTeamMapping | null> {
		const mappings = await this.typeOrmLinearTeamMappingRepository.find({
			where: { projectId, tenantId: scope.tenantId, organizationId: scope.organizationId, syncEnabled: true }
		});
		return mappings.find((mapping) => mapping.direction !== LinearSyncDirection.INBOUND) ?? null;
	}

	/** Where an import ended: its watermark and time, or what went wrong. */
	async recordImport(mapping: LinearTeamMapping, outcome: { cursor?: string | null; error?: string | null }): Promise<void> {
		await this.typeOrmLinearTeamMappingRepository.update(
			{ id: mapping.id },
			{
				...(outcome.cursor !== undefined ? { lastCursor: outcome.cursor } : {}),
				lastImportedAt: new Date(),
				lastError: outcome.error ?? null
			} as never
		);
	}

	/**
	 * A project sends its tasks to at most one Linear team: a second `outbound` / `both` mapping of the same
	 * project is refused (409), so a task's push always uses the team that owns its issue.
	 */
	private async assertOutboundFree(tenant: IIntegrationTenant, projectId: ID, direction: LinearSyncDirection, exceptMappingId: ID | null, manager: EntityManager): Promise<void> {
		if (direction === LinearSyncDirection.INBOUND) return;
		const others = await manager.find(LinearTeamMapping, {
			where: { projectId, tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID } as never
		});
		const taken = others.find((other) => other.id !== exceptMappingId && other.direction !== LinearSyncDirection.INBOUND);
		if (taken) {
			throw new ConflictException({
				message: 'This project already sends its tasks to another Linear team',
				code: LINEAR_PROJECT_OUTBOUND_TAKEN,
				mappingId: taken.id
			});
		}
	}

	private async requireProject(tenant: IIntegrationTenant, projectId: ID): Promise<void> {
		const project = await this.organizationProjectService
			.findOneByIdString(projectId, { where: { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID } })
			.catch(() => null);
		if (!project) {
			throw new NotFoundException({ message: 'The project was not found in this organization', code: LINEAR_PROJECT_NOT_FOUND });
		}
	}
}
