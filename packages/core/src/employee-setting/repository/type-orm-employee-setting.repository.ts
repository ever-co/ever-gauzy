import { Repository } from 'typeorm';
import { EmployeeSetting } from '../employee-setting.entity';

export class TypeOrmEmployeeSettingRepository extends Repository<EmployeeSetting> { }