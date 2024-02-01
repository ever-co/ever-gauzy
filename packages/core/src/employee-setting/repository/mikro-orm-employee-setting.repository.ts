import { EntityRepository } from '@mikro-orm/core';
import { EmployeeSetting } from '../employee-setting.entity';

export class MikroOrmEmployeeSettingRepository extends EntityRepository<EmployeeSetting> { }