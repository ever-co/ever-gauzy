import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { IIntegrationEntitySetting, IIntegrationEntitySettingTied, ITenant } from '@gauzy/contracts';
import { IntegrationTenant, Organization } from './../core/entities/internal';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import { DEFAULT_ENTITY_SETTINGS } from './integration-entity-settings';

/**
 *
 * @param dataSource
 * @param tenants
 * @returns
 */
export const createRandomIntegrationEntitySetting = async (
	dataSource: DataSource,
	tenants: ITenant[]
): Promise<IIntegrationEntitySetting[]> => {
	if (!tenants) {
		console.warn('Warning: tenants not found, Integration Entity Setting will not be created.');
		return;
	}

	const integrationEntitySettings: IIntegrationEntitySetting[] = [];
	const integrationEntitySettingTiedEntities: IIntegrationEntitySettingTied[] = [];

	for await (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const organizations = await dataSource.manager.findBy(Organization, { tenantId });
		const integrationTenants = await dataSource.manager.findBy(IntegrationTenant, { tenantId });

		for (const integrationTenant of integrationTenants) {
			const integrationEntitySetting = new IntegrationEntitySetting();
			integrationEntitySetting.integration = integrationTenant;
			integrationEntitySetting.tiedEntities = integrationEntitySettingTiedEntities;
			integrationEntitySetting.sync = faker.datatype.boolean();
			integrationEntitySetting.organization = faker.helpers.arrayElement(organizations);
			integrationEntitySetting.tenant = tenant;
			integrationEntitySetting.entity = faker.helpers.arrayElement(DEFAULT_ENTITY_SETTINGS)['entity'];
			integrationEntitySettings.push(integrationEntitySetting);
		}
	}

	await dataSource.manager.save(integrationEntitySettings);
};
