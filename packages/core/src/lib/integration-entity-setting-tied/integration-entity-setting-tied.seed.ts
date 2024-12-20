import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { IIntegrationEntitySettingTied, IntegrationEntity, ITenant } from '@gauzy/contracts';
import { IntegrationEntitySetting, IntegrationTenant, Organization } from './../core/entities/internal';
import { IntegrationEntitySettingTied } from './integration-entity-setting-tied.entity';
import { PROJECT_TIED_ENTITIES } from './integration-entity-setting-tied';

export const createRandomIntegrationEntitySettingTied = async (
	dataSource: DataSource,
	tenants: ITenant[]
): Promise<IIntegrationEntitySettingTied[]> => {
	if (!tenants) {
		console.warn('Warning: tenants not found, Integration Entity Setting  will not be created');
		return;
	}

	const randomIntegrationEntitySettingsTiedEntity: IIntegrationEntitySettingTied[] = [];

	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const organizations = await dataSource.manager.findBy(Organization, {
			tenantId
		});
		const integrationTenants = await dataSource.manager.findBy(IntegrationTenant, {
			tenantId
		});
		for (const integrationTenant of integrationTenants) {
			const integrationEntitySettings = await dataSource.manager.findBy(IntegrationEntitySetting, {
				integrationId: integrationTenant.id
			});
			for (const integrationEntitySetting of integrationEntitySettings) {
				const integrationEntitySettingTiedEntity = new IntegrationEntitySettingTied();

				integrationEntitySettingTiedEntity.integrationEntitySetting = integrationEntitySetting;
				integrationEntitySettingTiedEntity.sync = faker.datatype.boolean();
				integrationEntitySettingTiedEntity.organization = faker.helpers.arrayElement(organizations);
				integrationEntitySettingTiedEntity.tenant = tenant;
				//todo: need to understand real values here
				if (integrationEntitySetting['entity'] === IntegrationEntity.PROJECT) {
					integrationEntitySettingTiedEntity.entity =
						faker.helpers.arrayElement(PROJECT_TIED_ENTITIES)['entity'];
				} else {
					integrationEntitySettingTiedEntity.entity = faker.helpers.arrayElement(
						Object.values(IntegrationEntity)
					);
				}
				randomIntegrationEntitySettingsTiedEntity.push(integrationEntitySettingTiedEntity);
			}
		}
	}

	await dataSource.manager.save(randomIntegrationEntitySettingsTiedEntity);
};
