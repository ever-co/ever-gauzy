import { EntityRepository } from '@mikro-orm/core';
import { EmployeeAward } from '../employee-award.entity';

export class MikroOrmEmployeeAwardRepository extends EntityRepository<EmployeeAward> { }