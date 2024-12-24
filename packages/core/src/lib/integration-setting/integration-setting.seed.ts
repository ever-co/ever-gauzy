import { DataSource } from 'typeorm';
import { IntegrationSetting } from './integration-setting.entity';
import { faker } from '@faker-js/faker';
import { ITenant } from '@gauzy/contracts';
import { IntegrationTenant, Organization } from './../core/entities/internal';

export const createRandomIntegrationSetting = async (
	dataSource: DataSource,
	tenants: ITenant[]
): Promise<IntegrationSetting[]> => {
	if (!tenants) {
		console.warn(
			'Warning: tenants not found, Integration Setting  will not be created'
		);
		return;
	}
	const integrationSettings: IntegrationSetting[] = [];
	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const integrationTenants = await dataSource.manager.findBy(IntegrationTenant, {
			tenantId
		});
		const organizations = await dataSource.manager.findBy(Organization, {
			tenantId
		});
		for (const integrationTenant of integrationTenants) {
			const integrationSetting = new IntegrationSetting();
			integrationSetting.integration = integrationTenant;
			integrationSetting.organization = faker.helpers.arrayElement(
				organizations
			);
			integrationSetting.tenant = tenant;
			//todo: need to understand real values here
			integrationSetting.settingsName =
				'Setting-' + faker.number.int(40);
			integrationSetting.settingsValue = faker.person.jobArea();
			integrationSettings.push(integrationSetting);
		}
	}

	await dataSource.manager.save(integrationSettings);
};
