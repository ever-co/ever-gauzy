import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EmployeeSetting } from '../employee-setting.entity';

export class MikroOrmEmployeeSettingRepository extends MikroOrmBaseEntityRepository<EmployeeSetting> { }
