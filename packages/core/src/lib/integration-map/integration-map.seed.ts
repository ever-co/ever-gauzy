import { DataSource } from 'typeorm';
import { IntegrationMap } from './integration-map.entity';
import { faker } from '@faker-js/faker';
import { IntegrationTenant } from '../integration-tenant/integration-tenant.entity';
import { Organization } from '../organization/organization.entity';
import { IIntegrationMap, IntegrationEntity, ITenant } from '@gauzy/contracts';

export const createRandomIntegrationMap = async (
	dataSource: DataSource,
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
		const { id: tenantId } = tenant;
		const integrationTenants = await dataSource.manager.findBy(IntegrationTenant, {
			tenantId
		});
		const organizations = await dataSource.manager.findBy(Organization, {
			tenantId
		});
		for (const integrationTenant of integrationTenants) {
			const integrationMap = new IntegrationMap();
			integrationMap.integration = integrationTenant;
			integrationMap.organization = faker.helpers.arrayElement(
				organizations
			);
			integrationMap.tenant = tenant;
			//todo: need to understand real values here
			integrationMap.entity = faker.helpers.arrayElement(
				Object.values(IntegrationEntity)
			);
			integrationMap.sourceId = faker.string.uuid();
			integrationMap.gauzyId = faker.string.uuid();
			integrationMaps.push(integrationMap);
		}
	}
	return await dataSource.manager.save(integrationMaps);
};
