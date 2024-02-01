import { EntityRepository } from '@mikro-orm/core';
import { OrganizationTaskSetting } from '../organization-task-setting.entity';

export class MikroOrmOrganizationTaskSettingRepository extends EntityRepository<OrganizationTaskSetting> { }