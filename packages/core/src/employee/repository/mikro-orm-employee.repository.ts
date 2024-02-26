import { EntityRepository } from '@mikro-orm/core';
import { Employee } from '../employee.entity';

export class MikroOrmEmployeeRepository extends EntityRepository<Employee> { }
