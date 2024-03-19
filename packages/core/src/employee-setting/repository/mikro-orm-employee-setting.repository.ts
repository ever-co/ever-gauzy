import { EntityRepository } from '@mikro-orm/knex';
import { EmployeeSetting } from '../employee-setting.entity';

export class MikroOrmEmployeeSettingRepository extends EntityRepository<EmployeeSetting> { }
