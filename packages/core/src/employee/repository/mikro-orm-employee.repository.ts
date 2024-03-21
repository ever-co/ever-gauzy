import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Employee } from '../employee.entity';

export class MikroOrmEmployeeRepository extends MikroOrmBaseEntityRepository<Employee> { }
