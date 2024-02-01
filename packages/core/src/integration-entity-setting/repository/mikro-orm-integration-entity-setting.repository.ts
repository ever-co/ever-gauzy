import { EntityRepository } from '@mikro-orm/core';
import { IntegrationEntitySetting } from '../integration-entity-setting.entity';

export class MikroOrmIntegrationEntitySettingRepository extends EntityRepository<IntegrationEntitySetting> { }