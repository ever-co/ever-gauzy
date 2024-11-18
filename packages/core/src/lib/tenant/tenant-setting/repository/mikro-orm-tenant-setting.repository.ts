import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { TenantSetting } from '../tenant-setting.entity';

export class MikroOrmTenantSettingRepository extends MikroOrmBaseEntityRepository<TenantSetting> { }
