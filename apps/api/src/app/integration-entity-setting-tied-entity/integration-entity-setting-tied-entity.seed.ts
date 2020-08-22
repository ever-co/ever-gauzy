import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import * as faker from 'faker';
import { IntegrationTenant } from '../integration-tenant/integration-tenant.entity';
import { IntegrationEntitySetting } from '../integration-entity-setting/integration-entity-setting.entity';
import { IntegrationEntitySettingTiedEntity } from './integration-entity-setting-tied-entity.entity';

export const createRandomIntegrationEntitySettingTiedEntity = async (
	connection: Connection,
	tenants: Tenant[]
): Promise<IntegrationEntitySettingTiedEntity[]> => {
	if (!tenants) {
		console.warn(
			'Warning: tenants not found, Integration Entity Setting  will not be created'
		);
		return;
	}

	const randomIntegrationEntitySettingsTiedEntity: IntegrationEntitySettingTiedEntity[] = [];

	for (const tenant of tenants) {
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
				integrationEntitySettingTiedEntity.sync = faker.random.boolean();
				//todo: need to understand real values here
				integrationEntitySettingTiedEntity.entity =
					'entity-' + faker.random.number(40);

				randomIntegrationEntitySettingsTiedEntity.push(
					integrationEntitySettingTiedEntity
				);
			}
		}
	}

	await connection.manager.save(randomIntegrationEntitySettingsTiedEntity);
};
