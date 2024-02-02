import { Repository } from 'typeorm';
import { OrganizationTaskSetting } from '../organization-task-setting.entity';

export class TypeOrmOrganizationTaskSettingRepository extends Repository<OrganizationTaskSetting> { }