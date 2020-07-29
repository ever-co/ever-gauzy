import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { IntegrationSetting } from './integration-setting.entity';
import * as faker from 'faker';
import { IntegrationTenant } from '../integration-tenant/integration-tenant.entity';

export const createRandomIntegrationSetting = async (
  connection: Connection,
  tenants: Tenant[]
): Promise<IntegrationSetting[]> => {
  if (!tenants) {
    console.warn(
      'Warning: tenants not found, Integration Setting  will not be created'
    );
    return;
  }

  const integrationSettings: IntegrationSetting[] = [];

  for (const tenant of tenants) {
    const integrationTenants = await connection.manager.find(IntegrationTenant, {
      where: [{ tenant: tenant }]
    });
    for (const integrationTenant of integrationTenants) {

      const integrationSetting = new IntegrationSetting();

      integrationSetting.integration = integrationTenant;
      //todo: need to understand real values here
      integrationSetting.settingsName = "Setting-"+faker.random.number(40);
      integrationSetting.settingsValue = faker.name.jobArea();

      integrationSettings.push(integrationSetting);
    }
  }

  await connection.manager.save(integrationSettings);
};
