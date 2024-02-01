import { EntityRepository } from '@mikro-orm/core';
import { TenantSetting } from '../tenant-setting.entity';

export class MikroOrmTenantSettingRepository extends EntityRepository<TenantSetting> { }
