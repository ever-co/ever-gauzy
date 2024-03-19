import { EntityRepository } from '@mikro-orm/knex';
import { EmployeePhone } from '../employee-phone.entity';

export class MikroOrmEmployeePhoneRepository extends EntityRepository<EmployeePhone> { }
