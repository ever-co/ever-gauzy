import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { Organization, OrganizationProjectService, TenantAwareCrudService } from '@gauzy/core';
import {
	MikroOrmTrelloBoardMappingRepository,
	TrelloBoardMapping,
	TrelloSyncDirection,
	TypeOrmTrelloBoardMappingRepository
} from './entities/trello-board-mapping.entity';
import { TrelloSyncRun } from './entities/trello-sync-run.entity';
import { TRELLO_MAPPING_EXISTS, TRELLO_MAPPING_PROJECT_FIXED, TRELLO_PROJECT_NOT_FOUND, TRELLO_PROJECT_OUTBOUND_TAKEN } from './trello.constants';
import { serializeListMap } from './sync/trello-card.mapper';

/** What a mapping is made or changed from. */
export interface TrelloMappingInput {
	trelloBoardId: string;
	trelloBoardName?: string | null;
	projectId: ID;
	direction?: TrelloSyncDirection;
	listMap?: Record<string, string> | null;
	syncEnabled?: boolean;
}

/** Whether a write failed on a unique index: Postgres 23505, MySQL / MariaDB ER_DUP_ENTRY (1062), SQLite's constraint code. */
export function isUniqueViolation(error: unknown): boolean {
	const failure = error as { code?: unknown; errno?: unknown; driverError?: { code?: unknown; errno?: unknown } } | null;
	const code = String(failure?.code ?? failure?.driverError?.code ?? '');
	const errno = Number(failure?.errno ?? failure?.driverError?.errno ?? 0);
	return code === '23505' || code === 'ER_DUP_ENTRY' || errno === 1062 || code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE';
}

/** The board ↔ project mappings of the connections: listed, created, changed, removed; the webhook and the import position recorded. */
@Injectable()
export class TrelloMappingService extends TenantAwareCrudService<TrelloBoardMapping> {
	constructor(
		readonly typeOrmTrelloBoardMappingRepository: TypeOrmTrelloBoardMappingRepository,
		readonly mikroOrmTrelloBoardMappingRepository: MikroOrmTrelloBoardMappingRepository,
		private readonly organizationProjectService: OrganizationProjectService,
		private readonly dataSource: DataSource
	) {
		super(typeOrmTrelloBoardMappingRepository, mikroOrmTrelloBoardMappingRepository);
	}

	/** The mappings of a connection, oldest first. */
	async list(tenant: IIntegrationTenant): Promise<TrelloBoardMapping[]> {
		return this.typeOrmTrelloBoardMappingRepository.find({
			where: { integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID },
			order: { createdAt: 'ASC' }
		});
	}

	/** One mapping of a connection; 404 otherwise. */
	async requireOne(tenant: IIntegrationTenant, mappingId: ID): Promise<TrelloBoardMapping> {
		const mapping = await this.findOneByOptions({ where: { id: mappingId, integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID } }).catch(() => null);
		if (!mapping) throw new NotFoundException({ message: 'The mapping was not found' });
		return mapping;
	}

	/** One mapping by id regardless of the request (a webhook names it in its path), or null. */
	async findAnyById(mappingId: ID): Promise<TrelloBoardMapping | null> {
		return this.typeOrmTrelloBoardMappingRepository.findOne({ where: { id: mappingId } });
	}

	/**
	 * Creates a mapping: the project must be the organization's, the board not mapped yet, the project not already
	 * sending its tasks elsewhere. The checks and the write run in one transaction that admits one writer per
	 * connection at a time (an advisory lock on Postgres, the connection's mappings locked on MySQL / MariaDB; SQLite
	 * serializes writers), and a unique-index violation that still gets through answers the same 409.
	 */
	async createMapping(tenant: IIntegrationTenant, input: TrelloMappingInput): Promise<TrelloBoardMapping> {
		await this.requireProject(tenant, input.projectId);
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const direction = input.direction ?? TrelloSyncDirection.INBOUND;
		const where = { integrationId: tenant.id as ID, trelloBoardId: input.trelloBoardId, tenantId: scope.tenantId };
		try {
			return await this.dataSource.transaction(async (manager) => {
				await this.lockMappingsOf(manager, tenant);
				const existing = await manager.findOne(TrelloBoardMapping, { where: where as never });
				if (existing) throw this.mappedAlready(existing.id as ID);
				await this.assertOutboundFree(tenant, input.projectId, direction, null, manager);
				const mapping = Object.assign(new TrelloBoardMapping(), {
					integrationId: tenant.id as ID,
					...scope,
					trelloBoardId: input.trelloBoardId,
					trelloBoardName: input.trelloBoardName ?? null,
					projectId: input.projectId,
					direction,
					listMap: serializeListMap(input.listMap),
					syncEnabled: input.syncEnabled ?? true
				});
				return manager.save(TrelloBoardMapping, mapping);
			});
		} catch (error) {
			if (!isUniqueViolation(error)) throw error;
			// The violation aborted the transaction (Postgres): the raced row is read outside it, once it rolled back.
			const raced = await this.typeOrmTrelloBoardMappingRepository.findOne({ where: where as never }).catch(() => null);
			throw raced ? this.mappedAlready(raced.id as ID) : error;
		}
	}

	private mappedAlready(mappingId: ID): ConflictException {
		return new ConflictException({ message: 'This Trello board is mapped already', code: TRELLO_MAPPING_EXISTS, mappingId });
	}

	/**
	 * One writer of an organization's mappings at a time within the transaction (see `createMapping`): an advisory
	 * lock by organization on Postgres (two connections of one organization serialize too), the organization's own
	 * row on MySQL / MariaDB — a row that always exists, unlike the mappings (a first mapping has none to lock).
	 */
	private async lockMappingsOf(manager: EntityManager, tenant: IIntegrationTenant): Promise<void> {
		const dialect = manager.connection.options.type;
		if (dialect === 'postgres') {
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`integration-trello:mappings:${tenant.tenantId}:${tenant.organizationId}`]);
		} else if (dialect === 'mysql' || dialect === 'mariadb') {
			await manager.findOne(Organization, { where: { id: tenant.organizationId as ID } as never, lock: { mode: 'pessimistic_write' } });
		}
	}

	/**
	 * Changes a mapping's project, direction, list map or switch: the mapping is read again under the same lock as a
	 * creation, so the outbound check sees the latest row and two changes cannot both pass it. A mapping that has
	 * imported or taken a webhook keeps its project (its tasks' id maps point into that project): remove it and map
	 * the board again instead.
	 */
	async updateMapping(tenant: IIntegrationTenant, mappingId: ID, input: Partial<TrelloMappingInput>): Promise<TrelloBoardMapping> {
		await this.requireOne(tenant, mappingId);
		if (input.projectId) await this.requireProject(tenant, input.projectId);
		await this.dataSource.transaction(async (manager) => {
			await this.lockMappingsOf(manager, tenant);
			const mapping = await manager.findOne(TrelloBoardMapping, { where: { id: mappingId, integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID } as never });
			if (!mapping) throw new NotFoundException({ message: 'The mapping was not found' });
			const patch: Partial<TrelloBoardMapping> = {};
			if (input.projectId && input.projectId !== mapping.projectId) {
				const runs = await manager.count(TrelloSyncRun, { where: { mappingId: mapping.id, tenantId: tenant.tenantId as ID } as never });
				if (runs > 0) {
					throw new ConflictException({ message: 'A mapping that has synced keeps its project; remove it and map the board again', code: TRELLO_MAPPING_PROJECT_FIXED, mappingId });
				}
				patch.projectId = input.projectId;
			}
			if (input.direction) patch.direction = input.direction;
			if (input.listMap !== undefined) patch.listMap = serializeListMap(input.listMap);
			if (input.syncEnabled !== undefined) patch.syncEnabled = input.syncEnabled;
			if (input.trelloBoardName !== undefined) patch.trelloBoardName = input.trelloBoardName;
			if (!Object.keys(patch).length) return;
			await this.assertOutboundFree(tenant, patch.projectId ?? mapping.projectId, patch.direction ?? mapping.direction, mapping.id ?? null, manager);
			await manager.update(TrelloBoardMapping, { id: mapping.id, tenantId: tenant.tenantId as ID }, patch as never);
		});
		return this.requireOne(tenant, mappingId);
	}

	/** Removes a mapping for good (its tasks stay, with their id maps). */
	async removeMapping(tenant: IIntegrationTenant, mappingId: ID): Promise<void> {
		const mapping = await this.requireOne(tenant, mappingId);
		await this.typeOrmTrelloBoardMappingRepository.delete({ id: mapping.id, tenantId: tenant.tenantId as ID });
	}

	/** Records the webhook Trello registered for the mapping (or clears it). */
	async recordWebhook(mapping: TrelloBoardMapping, webhookId: string | null): Promise<void> {
		await this.typeOrmTrelloBoardMappingRepository.update({ id: mapping.id }, { webhookId } as never);
		mapping.webhookId = webhookId;
	}

	/** The mapping that sends a project's tasks out, in the tenant and organization (the oldest, should two exist), or null. */
	async findOutboundForProject(scope: { tenantId: ID; organizationId: ID }, projectId: ID): Promise<TrelloBoardMapping | null> {
		const mappings = await this.typeOrmTrelloBoardMappingRepository.find({
			where: { projectId, tenantId: scope.tenantId, organizationId: scope.organizationId, syncEnabled: true },
			order: { createdAt: 'ASC' } as never
		});
		return mappings.find((mapping) => mapping.direction !== TrelloSyncDirection.INBOUND) ?? null;
	}

	/** Where an import ended: its watermark and time, or what went wrong. */
	async recordImport(mapping: TrelloBoardMapping, outcome: { cursor?: string | null; error?: string | null }): Promise<void> {
		await this.typeOrmTrelloBoardMappingRepository.update(
			{ id: mapping.id },
			{ ...(outcome.cursor !== undefined ? { lastCursor: outcome.cursor } : {}), lastImportedAt: new Date(), lastError: outcome.error ?? null } as never
		);
		if (outcome.cursor !== undefined) mapping.lastCursor = outcome.cursor;
		mapping.lastImportedAt = new Date();
		mapping.lastError = outcome.error ?? null;
	}

	/** A project sends its tasks to at most one Trello board: a second `outbound` / `both` mapping is refused (409). */
	private async assertOutboundFree(tenant: IIntegrationTenant, projectId: ID, direction: TrelloSyncDirection, exceptMappingId: ID | null, manager: EntityManager): Promise<void> {
		if (direction === TrelloSyncDirection.INBOUND) return;
		const others = await manager.find(TrelloBoardMapping, {
			where: { projectId, tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID } as never
		});
		const taken = others.find((other) => other.id !== exceptMappingId && other.direction !== TrelloSyncDirection.INBOUND);
		if (taken) {
			throw new ConflictException({ message: 'This project already sends its tasks to another Trello board', code: TRELLO_PROJECT_OUTBOUND_TAKEN, mappingId: taken.id });
		}
	}

	private async requireProject(tenant: IIntegrationTenant, projectId: ID): Promise<void> {
		const project = await this.organizationProjectService
			.findOneByIdString(projectId, { where: { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID } })
			.catch(() => null);
		if (!project) {
			throw new NotFoundException({ message: 'The project was not found in this organization', code: TRELLO_PROJECT_NOT_FOUND });
		}
	}
}
