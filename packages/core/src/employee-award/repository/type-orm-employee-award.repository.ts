import { Repository } from 'typeorm';
import { EmployeeAward } from '../employee-award.entity';

export class TypeOrmEmployeeAwardRepository extends Repository<EmployeeAward> { }