import { EntityRepository } from '@mikro-orm/core';
import { EmployeePhone } from '../employee-phone.entity';

export class MikroOrmEmployeePhoneRepository extends EntityRepository<EmployeePhone> { }