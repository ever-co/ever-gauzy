import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { SystemSetting } from '../system-setting.entity';

export class MikroOrmSystemSettingRepository extends MikroOrmBaseEntityRepository<SystemSetting> {}
