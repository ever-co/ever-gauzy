import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import * as faker from 'faker';
import { IntegrationTenant } from '../integration-tenant/integration-tenant.entity';
import { IntegrationEntitySettingTiedEntity } from '../integration-entity-setting-tied-entity/integration-entity-setting-tied-entity.entity';
import { Organization } from '../organization/organization.entity';
import { DEFAULT_ENTITY_SETTINGS } from '@gauzy/integration-hubstaff';

export const createRandomIntegrationEntitySetting = async (
	connection: Connection,
	tenants: Tenant[]
): Promise<IntegrationEntitySetting[]> => {
	if (!tenants) {
		console.warn(
			'Warning: tenants not found, Integration Entity Setting will not be created.'
		);
		return;
	}

	const integrationEntitySettings: IntegrationEntitySetting[] = [];
	const integrationEntitySettingTiedEntities: IntegrationEntitySettingTiedEntity[] = [];

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
			const integrationEntitySetting = new IntegrationEntitySetting();

			integrationEntitySetting.integration = integrationTenant;
			integrationEntitySetting.tiedEntities = integrationEntitySettingTiedEntities;
			integrationEntitySetting.sync = faker.random.boolean();
			(integrationEntitySetting.organization = faker.random.arrayElement(
				organizations
			)),
				(integrationEntitySetting.tenant = tenant);
			//todo: need to understand real values here
			integrationEntitySetting.entity = faker.random.arrayElement(
				DEFAULT_ENTITY_SETTINGS
			)['entity'];
			integrationEntitySettings.push(integrationEntitySetting);
		}
	}

	await connection.manager.save(integrationEntitySettings);
};
