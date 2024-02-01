import { EntityRepository } from '@mikro-orm/core';
import { EmployeeLevel } from '../employee-level.entity';

export class MikroOrmEmployeeLevelRepository extends EntityRepository<EmployeeLevel> { }