import { EntityRepository } from '@mikro-orm/knex';
import { TenantSetting } from '../tenant-setting.entity';

export class MikroOrmTenantSettingRepository extends EntityRepository<TenantSetting> { }
