import { EntityRepository } from '@mikro-orm/knex';
import { IntegrationSetting } from '../integration-setting.entity';

export class MikroOrmIntegrationSettingRepository extends EntityRepository<IntegrationSetting> { }
