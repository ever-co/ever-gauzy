import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { OrganizationProjectService, TenantAwareCrudService } from '@gauzy/core';
import {
	AsanaProjectMapping,
	AsanaSyncDirection,
	MikroOrmAsanaProjectMappingRepository,
	TypeOrmAsanaProjectMappingRepository
} from './entities/asana-project-mapping.entity';
import { ASANA_MAPPING_EXISTS, ASANA_PROJECT_NOT_FOUND, ASANA_PROJECT_OUTBOUND_TAKEN } from './asana.constants';
import { serializeSectionMap } from './sync/asana-task.mapper';

export interface AsanaMappingInput {
	asanaWorkspaceGid: string;
	asanaProjectGid: string;
	asanaProjectName?: string | null;
	projectId: ID;
	direction?: AsanaSyncDirection;
	sectionMap?: Record<string, string> | null;
	syncEnabled?: boolean;
}

/** The Asana project ↔ platform project mappings of the connections, scoped to the caller's tenant. */
@Injectable()
export class AsanaMappingService extends TenantAwareCrudService<AsanaProjectMapping> {
	constructor(
		readonly typeOrmAsanaProjectMappingRepository: TypeOrmAsanaProjectMappingRepository,
		readonly mikroOrmAsanaProjectMappingRepository: MikroOrmAsanaProjectMappingRepository,
		private readonly organizationProjectService: OrganizationProjectService
	) {
		super(typeOrmAsanaProjectMappingRepository, mikroOrmAsanaProjectMappingRepository);
	}

	/** The mappings of a connection. */
	async list(tenant: IIntegrationTenant): Promise<AsanaProjectMapping[]> {
		const { items } = await this.findAll({
			where: { integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID },
			order: { createdAt: 'ASC' }
		});
		return items;
	}

	/** One mapping of a connection; 404 otherwise. */
	async requireOne(tenant: IIntegrationTenant, mappingId: ID): Promise<AsanaProjectMapping> {
		const mapping = await this.findOneByOptions({ where: { id: mappingId, integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID } }).catch(() => null);
		if (!mapping) throw new NotFoundException({ message: 'The mapping was not found' });
		return mapping;
	}

	/** One mapping by id regardless of the request (a webhook names it in its path), or null. */
	async findAnyById(mappingId: ID): Promise<AsanaProjectMapping | null> {
		return this.typeOrmAsanaProjectMappingRepository.findOne({ where: { id: mappingId } });
	}

	/** Creates a mapping: the project must be the organization's, the Asana project not mapped yet. */
	async createMapping(tenant: IIntegrationTenant, input: AsanaMappingInput): Promise<AsanaProjectMapping> {
		await this.requireProject(tenant, input.projectId);
		const existing = await this.findOneByOptions({
			where: { integrationId: tenant.id as ID, asanaProjectGid: input.asanaProjectGid, tenantId: tenant.tenantId as ID }
		}).catch(() => null);
		if (existing) {
			throw new ConflictException({ message: 'This Asana project is mapped already', code: ASANA_MAPPING_EXISTS, mappingId: existing.id });
		}
		await this.assertOutboundFree(tenant, input.projectId, input.direction ?? AsanaSyncDirection.INBOUND, null);
		return this.create({
			integrationId: tenant.id as ID,
			tenantId: tenant.tenantId as ID,
			organizationId: tenant.organizationId as ID,
			asanaWorkspaceGid: input.asanaWorkspaceGid,
			asanaProjectGid: input.asanaProjectGid,
			asanaProjectName: input.asanaProjectName ?? null,
			projectId: input.projectId,
			direction: input.direction ?? AsanaSyncDirection.INBOUND,
			sectionMap: serializeSectionMap(input.sectionMap),
			syncEnabled: input.syncEnabled ?? true
		} as never);
	}

	/** Changes a mapping's project, direction, section map or switch. */
	async updateMapping(tenant: IIntegrationTenant, mappingId: ID, input: Partial<AsanaMappingInput>): Promise<AsanaProjectMapping> {
		const mapping = await this.requireOne(tenant, mappingId);
		const patch: Partial<AsanaProjectMapping> = {};
		if (input.projectId && input.projectId !== mapping.projectId) {
			await this.requireProject(tenant, input.projectId);
			patch.projectId = input.projectId;
		}
		if (input.direction) patch.direction = input.direction;
		await this.assertOutboundFree(tenant, patch.projectId ?? mapping.projectId, patch.direction ?? mapping.direction, mapping.id);
		if (input.sectionMap !== undefined) patch.sectionMap = serializeSectionMap(input.sectionMap);
		if (input.syncEnabled !== undefined) patch.syncEnabled = input.syncEnabled;
		if (input.asanaProjectName !== undefined) patch.asanaProjectName = input.asanaProjectName;
		if (Object.keys(patch).length) {
			await this.typeOrmAsanaProjectMappingRepository.update({ id: mapping.id, tenantId: tenant.tenantId as ID }, patch as never);
		}
		return this.requireOne(tenant, mappingId);
	}

	/** Removes a mapping for good (its tasks stay, with their id maps). */
	async removeMapping(tenant: IIntegrationTenant, mappingId: ID): Promise<void> {
		const mapping = await this.requireOne(tenant, mappingId);
		await this.typeOrmAsanaProjectMappingRepository.delete({ id: mapping.id, tenantId: tenant.tenantId as ID });
	}

	/** Records the webhook Asana registered for the mapping (or clears it). */
	async recordWebhook(mapping: AsanaProjectMapping, webhook: { gid: string | null; secret: string | null }): Promise<void> {
		await this.typeOrmAsanaProjectMappingRepository.update({ id: mapping.id }, { webhookGid: webhook.gid, webhookSecret: webhook.secret } as never);
		mapping.webhookGid = webhook.gid;
		mapping.webhookSecret = webhook.secret;
	}

	/** The mapping that sends a project's tasks out, in the tenant and organization, or null. */
	async findOutboundForProject(scope: { tenantId: ID; organizationId: ID }, projectId: ID): Promise<AsanaProjectMapping | null> {
		const mappings = await this.typeOrmAsanaProjectMappingRepository.find({ where: { projectId, tenantId: scope.tenantId, organizationId: scope.organizationId, syncEnabled: true } });
		return mappings.find((mapping) => mapping.direction !== AsanaSyncDirection.INBOUND) ?? null;
	}

	/** Where an import ended: its watermark and time, or what went wrong. */
	async recordImport(mapping: AsanaProjectMapping, outcome: { cursor?: string | null; error?: string | null }): Promise<void> {
		await this.typeOrmAsanaProjectMappingRepository.update(
			{ id: mapping.id },
			{ ...(outcome.cursor !== undefined ? { lastCursor: outcome.cursor } : {}), lastImportedAt: new Date(), lastError: outcome.error ?? null } as never
		);
	}

	/** A project sends its tasks to at most one Asana project: a second `outbound` / `both` mapping is refused (409). */
	private async assertOutboundFree(tenant: IIntegrationTenant, projectId: ID, direction: AsanaSyncDirection, exceptMappingId: ID | null): Promise<void> {
		if (direction === AsanaSyncDirection.INBOUND) return;
		const others = await this.typeOrmAsanaProjectMappingRepository.find({
			where: { projectId, tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID }
		});
		const taken = others.find((other) => other.id !== exceptMappingId && other.direction !== AsanaSyncDirection.INBOUND);
		if (taken) {
			throw new ConflictException({ message: 'This project already sends its tasks to another Asana project', code: ASANA_PROJECT_OUTBOUND_TAKEN, mappingId: taken.id });
		}
	}

	private async requireProject(tenant: IIntegrationTenant, projectId: ID): Promise<void> {
		const project = await this.organizationProjectService
			.findOneByIdString(projectId, { where: { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID } })
			.catch(() => null);
		if (!project) {
			throw new NotFoundException({ message: 'The project was not found in this organization', code: ASANA_PROJECT_NOT_FOUND });
		}
	}
}
