import { EntityRepository } from '@mikro-orm/core';
import { IntegrationSetting } from '../integration-setting.entity';

export class MikroOrmIntegrationSettingRepository extends EntityRepository<IntegrationSetting> { }