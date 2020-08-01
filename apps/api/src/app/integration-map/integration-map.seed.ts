import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { IntegrationMap } from './integration-map.entity';
import * as faker from 'faker';
import { IntegrationTenant } from '../integration-tenant/integration-tenant.entity';

export const createRandomIntegrationMap = async (
	connection: Connection,
	tenants: Tenant[]
): Promise<IntegrationMap[]> => {
	if (!tenants) {
		console.warn(
			'Warning: tenants not found, Integration Map  will not be created'
		);
		return;
	}

	const integrationMaps: IntegrationMap[] = [];

	for (const tenant of tenants) {
		const integrationTenants = await connection.manager.find(
			IntegrationTenant,
			{
				where: [{ tenant: tenant }]
			}
		);
		for (const integrationTenant of integrationTenants) {
			const integrationMap = new IntegrationMap();

			integrationMap.integration = integrationTenant;

			//todo: need to understand real values here
			integrationMap.entity = 'entity-' + faker.random.number(40);
			integrationMap.sourceId = 'sourceId-' + faker.random.number(40);
			integrationMap.gauzyId = 'gauzyId-' + faker.random.number(40);

			integrationMaps.push(integrationMap);
		}
	}

	await connection.manager.save(integrationMaps);
};
