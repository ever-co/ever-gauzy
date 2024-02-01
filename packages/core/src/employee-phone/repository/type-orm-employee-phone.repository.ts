import { Repository } from 'typeorm';
import { EmployeePhone } from '../employee-phone.entity';

export class TypeOrmEmployeePhoneRepository extends Repository<EmployeePhone> { }