import { Repository } from 'typeorm';
import { IntegrationSetting } from '../integration-setting.entity';

export class TypeOrmIntegrationSettingRepository extends Repository<IntegrationSetting> { }