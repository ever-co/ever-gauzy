import { Connection } from 'typeorm';
import * as faker from 'faker';
import { IntegrationEntity, ITenant } from '@gauzy/contracts';
import { PROJECT_TIED_ENTITIES } from '@gauzy/integration-hubstaff';
import { IntegrationEntitySettingTiedEntity } from './integration-entity-setting-tied-entity.entity';
import { IntegrationEntitySetting, IntegrationTenant, Organization } from './../core/entities/internal';

export const createRandomIntegrationEntitySettingTiedEntity = async (
	connection: Connection,
	tenants: ITenant[]
): Promise<IntegrationEntitySettingTiedEntity[]> => {
	if (!tenants) {
		console.warn(
			'Warning: tenants not found, Integration Entity Setting  will not be created'
		);
		return;
	}

	const randomIntegrationEntitySettingsTiedEntity: IntegrationEntitySettingTiedEntity[] = [];

	for (const tenant of tenants) {
		const organizations = await connection.manager.find(Organization, {
			where: [{ tenant: tenant }]
		});
		const integrationTenants = await connection.manager.find(
			IntegrationTenant,
			{
				where: [{ tenant: tenant }]
			}
		);
		for (const integrationTenant of integrationTenants) {
			const integrationEntitySettings = await connection.manager.find(
				IntegrationEntitySetting,
				{
					where: [{ integration: integrationTenant }]
				}
			);
			for (const integrationEntitySetting of integrationEntitySettings) {
				const integrationEntitySettingTiedEntity = new IntegrationEntitySettingTiedEntity();

				integrationEntitySettingTiedEntity.integrationEntitySetting = integrationEntitySetting;
				integrationEntitySettingTiedEntity.sync = faker.datatype.boolean();
				integrationEntitySettingTiedEntity.organization = faker.random.arrayElement(
					organizations
				);
				integrationEntitySettingTiedEntity.tenant = tenant;
				//todo: need to understand real values here
				if (
					integrationEntitySetting['entity'] ===
					IntegrationEntity.PROJECT
				) {
					integrationEntitySettingTiedEntity.entity = faker.random.arrayElement(
						PROJECT_TIED_ENTITIES
					)['entity'];
				} else {
					integrationEntitySettingTiedEntity.entity = faker.random.arrayElement(
						Object.values(IntegrationEntity)
					);
				}
				randomIntegrationEntitySettingsTiedEntity.push(
					integrationEntitySettingTiedEntity
				);
			}
		}
	}

	await connection.manager.save(randomIntegrationEntitySettingsTiedEntity);
};
