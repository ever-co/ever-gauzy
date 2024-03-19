import { EntityRepository } from '@mikro-orm/knex';
import { EmployeeLevel } from '../employee-level.entity';

export class MikroOrmEmployeeLevelRepository extends EntityRepository<EmployeeLevel> { }
