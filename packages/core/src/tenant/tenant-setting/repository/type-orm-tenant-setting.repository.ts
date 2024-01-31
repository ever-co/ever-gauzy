import { Repository } from 'typeorm';
import { TenantSetting } from '../tenant-setting.entity';

export class TypeOrmTenantSettingRepository extends Repository<TenantSetting> { }
