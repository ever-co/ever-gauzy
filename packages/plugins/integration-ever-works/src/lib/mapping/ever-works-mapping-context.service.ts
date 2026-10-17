import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { IntegrationTenant } from '@gauzy/core';
import { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EVER_WORKS_INTEGRATION_NAME } from '../ever-works.constants';
import { EverWorksSettingName as S } from '../ever-works-setting.enum';
import { EverWorksScopeService } from '../ever-works-scope.service';
import { DEFAULT_EVER_WORKS_DIRECTIONS, EverWorksDirection, EverWorksDomain } from './ever-works-mapping.defaults';

/** One organization mapping, resolved with its connection: what every per-entity sync step needs. */
export interface EverWorksMappingContext {
	tenantId: ID;
	organizationId: ID;
	integrationTenantId: ID;
	mapping: IntegrationTenant;
	connection: EverWorksConnection;
	everWorksOrganizationId: string;
	everWorksOrganizationSlug: string;
	directions: Record<EverWorksDomain, EverWorksDirection>;
	isEnabled: boolean;
}

/**
 * Resolves a mapping (`integration_tenant` named `Ever_Works`) with its settings and its active
 * connection — for a route (after the caller's organization-membership check) or for the engine (by the
 * organization an event or a change belongs to). Never trusts a tenant or organization from a payload.
 */
@Injectable()
export class EverWorksMappingContextService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly scopes: EverWorksScopeService
	) {}

	/** For a management route: the caller must be an active member of the mapping's organization. */
	async forRequest(integrationTenantId: ID, organizationId?: ID): Promise<EverWorksMappingContext> {
		const scope = await this.scopes.resolve(organizationId);
		const mapping = await this.dataSource.getRepository(IntegrationTenant).findOne({
			where: {
				id: integrationTenantId,
				tenantId: scope.tenantId,
				organizationId: scope.organizationId,
				name: EVER_WORKS_INTEGRATION_NAME,
				isActive: true,
				isArchived: false
			},
			relations: { settings: true }
		});
		const context = mapping ? await this.build(mapping) : null;
		if (!context) throw new NotFoundException('Ever Works mapping not found.');
		return context;
	}

	/** For the engine: the active mapping of a Gauzy organization, or `null`. */
	async forOrganization(tenantId: ID, organizationId: ID): Promise<EverWorksMappingContext | null> {
		const mapping = await this.dataSource.getRepository(IntegrationTenant).findOne({
			where: { tenantId, organizationId, name: EVER_WORKS_INTEGRATION_NAME, isActive: true, isArchived: false },
			relations: { settings: true }
		});
		return mapping ? this.build(mapping) : null;
	}

	/** For the engine: the mapping of an Ever Works organization through a connection, or `null`. */
	async forEverWorksOrganization(connection: EverWorksConnection, everWorksOrganizationId: string): Promise<EverWorksMappingContext | null> {
		const mappings = await this.dataSource.getRepository(IntegrationTenant).find({
			where: { tenantId: connection.tenantId, name: EVER_WORKS_INTEGRATION_NAME, isActive: true, isArchived: false },
			relations: { settings: true }
		});
		const mapping = mappings.find(
			(row) => setting(row, S.CONNECTION_ID) === connection.id && setting(row, S.EVER_WORKS_ORGANIZATION_ID) === everWorksOrganizationId
		);
		return mapping ? this.build(mapping, connection) : null;
	}

	/** For the engine's sweeps: every active mapping that syncs through a connection. */
	async forConnection(connection: EverWorksConnection): Promise<EverWorksMappingContext[]> {
		const mappings = await this.dataSource.getRepository(IntegrationTenant).find({
			where: { tenantId: connection.tenantId, name: EVER_WORKS_INTEGRATION_NAME, isActive: true, isArchived: false },
			relations: { settings: true }
		});
		const contexts: EverWorksMappingContext[] = [];
		for (const mapping of mappings) {
			if (setting(mapping, S.CONNECTION_ID) !== connection.id) continue;
			const context = await this.build(mapping, connection);
			if (context) contexts.push(context);
		}
		return contexts;
	}

	private async build(mapping: IntegrationTenant, known?: EverWorksConnection): Promise<EverWorksMappingContext | null> {
		const connectionId = setting(mapping, S.CONNECTION_ID);
		const connection =
			known && known.id === connectionId
				? known
				: connectionId
					? await this.dataSource.getRepository(EverWorksConnection).findOne({ where: { id: connectionId, tenantId: mapping.tenantId, isActive: true } })
					: null;
		if (!connection || !mapping.id || !mapping.tenantId || !mapping.organizationId) return null;
		let stored: Partial<Record<EverWorksDomain, EverWorksDirection>> = {};
		try {
			stored = JSON.parse(setting(mapping, S.ENTITY_DIRECTIONS) || '{}');
		} catch {
			stored = {};
		}
		return {
			tenantId: mapping.tenantId as ID,
			organizationId: mapping.organizationId as ID,
			integrationTenantId: mapping.id as ID,
			mapping,
			connection,
			everWorksOrganizationId: setting(mapping, S.EVER_WORKS_ORGANIZATION_ID),
			everWorksOrganizationSlug: setting(mapping, S.EVER_WORKS_ORGANIZATION_SLUG),
			directions: { ...DEFAULT_EVER_WORKS_DIRECTIONS, ...stored },
			isEnabled: setting(mapping, S.IS_ENABLED) === 'true'
		};
	}
}

function setting(mapping: IntegrationTenant, name: S): string {
	return mapping.settings?.find((s) => s.settingsName === name)?.settingsValue ?? '';
}
