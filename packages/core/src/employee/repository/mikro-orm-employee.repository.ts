import { EntityRepository } from '@mikro-orm/knex';
import { Employee } from '../employee.entity';

export class MikroOrmEmployeeRepository extends EntityRepository<Employee> { }
