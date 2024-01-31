import { Repository } from 'typeorm';
import { IntegrationEntitySetting } from '../integration-entity-setting.entity';

export class TypeOrmIntegrationEntitySettingRepository extends Repository<IntegrationEntitySetting> { }