import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { OrganizationProjectService, TenantAwareCrudService } from '@gauzy/core';
import {
	LinearSyncDirection,
	LinearTeamMapping,
	MikroOrmLinearTeamMappingRepository,
	TypeOrmLinearTeamMappingRepository
} from './entities/linear-team-mapping.entity';
import { LINEAR_MAPPING_EXISTS, LINEAR_PROJECT_NOT_FOUND } from './linear.constants';
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

/** The team ↔ project mappings of the connections, scoped to the caller's tenant. */
@Injectable()
export class LinearMappingService extends TenantAwareCrudService<LinearTeamMapping> {
	constructor(
		readonly typeOrmLinearTeamMappingRepository: TypeOrmLinearTeamMappingRepository,
		readonly mikroOrmLinearTeamMappingRepository: MikroOrmLinearTeamMappingRepository,
		private readonly organizationProjectService: OrganizationProjectService
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

	/** Creates a mapping: the project must be the organization's, the team not mapped yet. */
	async createMapping(tenant: IIntegrationTenant, input: LinearMappingInput): Promise<LinearTeamMapping> {
		await this.requireProject(tenant, input.projectId);
		const existing = await this.findOneByOptions({
			where: { integrationId: tenant.id as ID, linearTeamId: input.linearTeamId, tenantId: tenant.tenantId as ID }
		}).catch(() => null);
		if (existing) {
			throw new ConflictException({ message: 'This Linear team is mapped already', code: LINEAR_MAPPING_EXISTS, mappingId: existing.id });
		}
		return this.create({
			integrationId: tenant.id as ID,
			tenantId: tenant.tenantId as ID,
			organizationId: tenant.organizationId as ID,
			linearTeamId: input.linearTeamId,
			linearTeamKey: input.linearTeamKey ?? null,
			linearTeamName: input.linearTeamName ?? null,
			projectId: input.projectId,
			direction: input.direction ?? LinearSyncDirection.INBOUND,
			stateMap: serializeStateMap(input.stateMap),
			syncEnabled: input.syncEnabled ?? true
		} as never);
	}

	/** Changes a mapping's project, direction, state map or switch. */
	async updateMapping(tenant: IIntegrationTenant, mappingId: ID, input: Partial<LinearMappingInput>): Promise<LinearTeamMapping> {
		const mapping = await this.requireOne(tenant, mappingId);
		const patch: Partial<LinearTeamMapping> = {};
		if (input.projectId && input.projectId !== mapping.projectId) {
			await this.requireProject(tenant, input.projectId);
			patch.projectId = input.projectId;
		}
		if (input.direction) patch.direction = input.direction;
		if (input.stateMap !== undefined) patch.stateMap = serializeStateMap(input.stateMap);
		if (input.syncEnabled !== undefined) patch.syncEnabled = input.syncEnabled;
		if (input.linearTeamKey !== undefined) patch.linearTeamKey = input.linearTeamKey;
		if (input.linearTeamName !== undefined) patch.linearTeamName = input.linearTeamName;
		if (Object.keys(patch).length) {
			await this.typeOrmLinearTeamMappingRepository.update({ id: mapping.id, tenantId: tenant.tenantId as ID }, patch as never);
		}
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

	private async requireProject(tenant: IIntegrationTenant, projectId: ID): Promise<void> {
		const project = await this.organizationProjectService
			.findOneByIdString(projectId, { where: { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID } })
			.catch(() => null);
		if (!project) {
			throw new NotFoundException({ message: 'The project was not found in this organization', code: LINEAR_PROJECT_NOT_FOUND });
		}
	}
}
