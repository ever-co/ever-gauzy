import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ID, IntegrationEntity } from '@gauzy/contracts';
import { IntegrationEntitySetting, IntegrationTenant } from '@gauzy/core';
import { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EVER_WORKS_INTEGRATION_NAME } from '../ever-works.constants';
import { EverWorksSettingName as S } from '../ever-works-setting.enum';
import { EverWorksScopeService } from '../ever-works-scope.service';
import {
	DEFAULT_EVER_WORKS_DIRECTIONS,
	effectiveDirections,
	EVER_WORKS_SYNCED_ENTITIES,
	EverWorksDirection,
	EverWorksDomain,
	EverWorksEntitySync
} from './ever-works-mapping.defaults';

/** One organization mapping, resolved with its connection: what every per-entity sync step needs. */
export interface EverWorksMappingContext {
	tenantId: ID;
	organizationId: ID;
	integrationTenantId: ID;
	mapping: IntegrationTenant;
	connection: EverWorksConnection;
	everWorksOrganizationId: string;
	everWorksOrganizationSlug: string;
	/**
	 * The directions that take effect: the stored `ENTITY_DIRECTIONS`, with the domains of an entity whose
	 * `integration_entity_setting` toggle is `sync: false` set to `off` (OQ4, review F77).
	 */
	directions: Record<EverWorksDomain, EverWorksDirection>;
	/** The per-entity toggles as stored (`false`: not synced; missing: on). Read with `entitySynced()`. */
	entitySync?: EverWorksEntitySync;
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
		const viaConnection = mappings.filter((mapping) => setting(mapping, S.CONNECTION_ID) === connection.id);
		await this.loadEntitySettings(viaConnection);
		const contexts: EverWorksMappingContext[] = [];
		for (const mapping of viaConnection) {
			const context = await this.build(mapping, connection);
			if (context) contexts.push(context);
		}
		return contexts;
	}

	/**
	 * The per-entity toggles of several mappings, read in one query and kept on each mapping, so building them reads
	 * none per mapping (review of #11096). A read that builds one mapping reads its rows once in `entitySyncOf`.
	 */
	private async loadEntitySettings(mappings: IntegrationTenant[]): Promise<void> {
		const ids = mappings.filter((mapping) => !mapping.entitySettings && mapping.id).map((mapping) => mapping.id as ID);
		if (!ids.length) return;
		const rows = await this.dataSource.getRepository(IntegrationEntitySetting).find({
			where: { integrationId: In(ids) } as never,
			select: { id: true, entity: true, sync: true, integrationId: true } as never
		});
		const byMapping = new Map<string, IntegrationEntitySetting[]>();
		for (const row of rows) {
			const group = byMapping.get(row.integrationId as string);
			if (group) group.push(row);
			else byMapping.set(row.integrationId as string, [row]);
		}
		for (const mapping of mappings) {
			mapping.entitySettings ??= byMapping.get(mapping.id as string) ?? [];
		}
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
		const entitySync = await this.entitySyncOf(mapping);
		return {
			tenantId: mapping.tenantId as ID,
			organizationId: mapping.organizationId as ID,
			integrationTenantId: mapping.id as ID,
			mapping,
			connection,
			everWorksOrganizationId: setting(mapping, S.EVER_WORKS_ORGANIZATION_ID),
			everWorksOrganizationSlug: setting(mapping, S.EVER_WORKS_ORGANIZATION_SLUG),
			directions: effectiveDirections({ ...DEFAULT_EVER_WORKS_DIRECTIONS, ...stored }, entitySync),
			entitySync,
			isEnabled: setting(mapping, S.IS_ENABLED) === 'true'
		};
	}

	/**
	 * The mapping's per-entity toggles (`PUT /mappings/:id` `entitySettings`, or the platform's integration API): the
	 * rows already loaded with the mapping, else read. Only the synced entities count; a missing row is on.
	 */
	private async entitySyncOf(mapping: IntegrationTenant): Promise<EverWorksEntitySync> {
		const rows =
			mapping.entitySettings ??
			(await this.dataSource.getRepository(IntegrationEntitySetting).find({
				// The mapping's own rows (its id is tenant-scoped already), as the mapping view reads them.
				where: { integrationId: mapping.id } as never,
				select: { id: true, entity: true, sync: true } as never
			}));
		const entitySync: EverWorksEntitySync = {};
		for (const row of rows) {
			const entity = row.entity as IntegrationEntity;
			if (EVER_WORKS_SYNCED_ENTITIES.includes(entity) && row.sync === false) entitySync[entity] = false;
		}
		return entitySync;
	}
}

function setting(mapping: IntegrationTenant, name: S): string {
	return mapping.settings?.find((s) => s.settingsName === name)?.settingsValue ?? '';
}
