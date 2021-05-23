import { Connection } from 'typeorm';
import * as faker from 'faker';
import { DEFAULT_ENTITY_SETTINGS } from '@gauzy/integration-hubstaff';
import { IIntegrationEntitySetting, IIntegrationEntitySettingTied, ITenant } from '@gauzy/contracts';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import { IntegrationTenant, Organization } from './../core/entities/internal';

export const createRandomIntegrationEntitySetting = async (
	connection: Connection,
	tenants: ITenant[]
): Promise<IntegrationEntitySetting[]> => {
	if (!tenants) {
		console.warn(
			'Warning: tenants not found, Integration Entity Setting will not be created.'
		);
		return;
	}

	const integrationEntitySettings: IIntegrationEntitySetting[] = [];
	const integrationEntitySettingTiedEntities: IIntegrationEntitySettingTied[] = [];

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
			integrationEntitySetting.sync = faker.datatype.boolean();
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
