import { Connection } from 'typeorm';
import { IntegrationMap } from './integration-map.entity';
import { faker } from '@ever-co/faker';
import { IntegrationTenant } from '../integration-tenant/integration-tenant.entity';
import { Organization } from '../organization/organization.entity';
import { IIntegrationMap, IntegrationEntity, ITenant } from '@gauzy/contracts';

export const createRandomIntegrationMap = async (
	connection: Connection,
	tenants: ITenant[]
): Promise<IIntegrationMap[]> => {
	if (!tenants) {
		console.warn(
			'Warning: tenants not found, Integration Map  will not be created'
		);
		return;
	}
	const integrationMaps: IIntegrationMap[] = [];
	for (const tenant of tenants) {
		const integrationTenants = await connection.manager.find(IntegrationTenant, {
			where: { 
				tenant: tenant 
			}
		});
		const organizations = await connection.manager.find(Organization, {
			where: { 
				tenant: tenant 
			}
		});
		for (const integrationTenant of integrationTenants) {
			const integrationMap = new IntegrationMap();
			integrationMap.integration = integrationTenant;
			integrationMap.organization = faker.random.arrayElement(
				organizations
			);
			integrationMap.tenant = tenant;
			//todo: need to understand real values here
			integrationMap.entity = faker.random.arrayElement(
				Object.values(IntegrationEntity)
			);
			integrationMap.sourceId = faker.datatype.number({ min: 10000000, max: 99999999999 });
			integrationMap.gauzyId = faker.datatype.uuid();
			integrationMaps.push(integrationMap);
		}
	}
	return await connection.manager.save(integrationMaps);
};
