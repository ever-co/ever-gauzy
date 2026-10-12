import { ForbiddenException, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { ID, IIntegrationEntitySettingTied } from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { IntegrationEntitySetting } from './../integration-entity-setting/integration-entity-setting.entity';
import { IntegrationEntitySettingTied } from './integration-entity-setting-tied.entity';
import { MikroOrmIntegrationEntitySettingTiedRepository } from './repository/mikro-orm-integration-entity-setting-tied.repository';
import { TypeOrmIntegrationEntitySettingTiedRepository } from './repository/type-orm-integration-entity-setting-tied.repository';

@Injectable()
export class IntegrationEntitySettingTiedService extends TenantAwareCrudService<IntegrationEntitySettingTied> {
	constructor(
		readonly typeOrmIntegrationEntitySettingTiedRepository: TypeOrmIntegrationEntitySettingTiedRepository,
		readonly mikroOrmIntegrationEntitySettingTiedRepository: MikroOrmIntegrationEntitySettingTiedRepository
	) {
		super(typeOrmIntegrationEntitySettingTiedRepository, mikroOrmIntegrationEntitySettingTiedRepository);
	}

	/**
	 * Create or update bulk integration entity settings tied entities by integration.
	 *
	 * Goes through the tenant-aware `saveMany()` (tenant stamping + foreign-id refusal) instead of a raw
	 * `repository.save(body)`, which upserted any tenant's row by the id in the body
	 * (GHSA-jh6m-9fxr-rx3c). The parent setting each item names must be a setting of the route's
	 * integration in the caller's tenant.
	 *
	 * @param integrationId - The integration (from the route) the tied entities belong to.
	 * @param input - The integration entity setting tied input data, either a single entity or an array of entities.
	 * @returns A promise that resolves to an array of created or updated IIntegrationEntitySettingTied instances.
	 */
	async bulkUpdateOrCreate(
		integrationId: ID,
		input: IIntegrationEntitySettingTied | IIntegrationEntitySettingTied[]
	): Promise<IIntegrationEntitySettingTied[]> {
		// Ensure that the input is always an array for consistency
		const settings: IIntegrationEntitySettingTied[] = (Array.isArray(input) ? input : [input]).map((setting) => {
			// Reduce the parent relation object to its id, so it is validated below and cannot cascade.
			const { integrationEntitySetting, ...rest } = setting ?? ({} as IIntegrationEntitySettingTied);
			const integrationEntitySettingId = rest.integrationEntitySettingId ?? integrationEntitySetting?.id;
			return { ...rest, ...(integrationEntitySettingId ? { integrationEntitySettingId } : {}) };
		});

		await this.assertParentSettingsBelongToIntegration(settings, integrationId);

		// Save the array of integration entity settings to the database
		return await this.saveMany(settings);
	}

	/**
	 * Refuses a tied entity whose parent setting is not a setting of the given integration in the
	 * caller's tenant.
	 *
	 * @param settings - The tied entities about to be saved.
	 * @param integrationId - The integration of the route.
	 */
	private async assertParentSettingsBelongToIntegration(
		settings: IIntegrationEntitySettingTied[],
		integrationId: ID
	): Promise<void> {
		const parentIds = [...new Set(settings.map((setting) => setting.integrationEntitySettingId).filter(Boolean))];
		if (!parentIds.length) {
			return;
		}
		const tenantId = RequestContext.currentTenantId();
		const count = tenantId
			? await this.typeOrmRepository.manager.count(IntegrationEntitySetting, {
					where: { id: In(parentIds), integrationId, tenantId }
				})
			: 0;
		if (count !== parentIds.length) {
			throw new ForbiddenException('The integration entity setting does not belong to this integration');
		}
	}
}
