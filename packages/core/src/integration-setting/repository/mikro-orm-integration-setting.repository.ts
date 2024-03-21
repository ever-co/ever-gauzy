import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { IntegrationSetting } from '../integration-setting.entity';

export class MikroOrmIntegrationSettingRepository extends MikroOrmBaseEntityRepository<IntegrationSetting> { }
