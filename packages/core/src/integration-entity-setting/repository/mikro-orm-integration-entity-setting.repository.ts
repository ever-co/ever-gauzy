import { EntityRepository } from '@mikro-orm/knex';
import { IntegrationEntitySetting } from '../integration-entity-setting.entity';

export class MikroOrmIntegrationEntitySettingRepository extends EntityRepository<IntegrationEntitySetting> { }
