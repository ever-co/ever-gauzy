import { EntityRepository } from '@mikro-orm/knex';
import { EmployeeAward } from '../employee-award.entity';

export class MikroOrmEmployeeAwardRepository extends EntityRepository<EmployeeAward> { }
