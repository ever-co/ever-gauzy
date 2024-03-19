import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationTaskSetting } from '../organization-task-setting.entity';

export class MikroOrmOrganizationTaskSettingRepository extends EntityRepository<OrganizationTaskSetting> { }
