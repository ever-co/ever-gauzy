import { Repository } from 'typeorm';
import { Employee } from '../employee.entity';

export class TypeOrmEmployeeRepository extends Repository<Employee> { }