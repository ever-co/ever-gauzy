import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import * as faker from 'faker';
import { IntegrationTenant } from '../integration-tenant/integration-tenant.entity';
import { IntegrationEntitySettingTiedEntity } from '../integration-entity-setting-tied-entity/integration-entity-setting-tied-entitiy.entity';

export const createRandomIntegrationEntitySetting = async (
  connection: Connection,
  tenants: Tenant[]
): Promise<IntegrationEntitySetting[]> => {
  if (!tenants) {
    console.warn(
      'Warning: tenants not found, Integration Entity Setting  will not be created'
    );
    return;
  }

  const integrationEntitySettings: IntegrationEntitySetting[] = [];
  const integrationEntitySettingTiedEntities: IntegrationEntitySettingTiedEntity[] = [];

  for (const tenant of tenants) {
    const integrationTenants = await connection.manager.find(IntegrationTenant, {
      where: [{ tenant: tenant }]
    });
    for (const integrationTenant of integrationTenants) {

      const integrationEntitySetting = new IntegrationEntitySetting();

      integrationEntitySetting.integration = integrationTenant;
      integrationEntitySetting.tiedEntities = integrationEntitySettingTiedEntities;
      integrationEntitySetting.sync = faker.random.boolean();
      //todo: need to understand real values here
      integrationEntitySetting.entity = 'entity-' + faker.random.number(40);

      integrationEntitySettings.push(integrationEntitySetting);
    }
  }

  await connection.manager.save(integrationEntitySettings);
};
