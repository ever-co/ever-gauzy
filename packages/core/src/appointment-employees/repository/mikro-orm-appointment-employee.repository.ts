import { EntityRepository } from '@mikro-orm/core';
import { AppointmentEmployee } from '../appointment-employees.entity';

export class MikroOrmAppointmentEmployeeRepository extends EntityRepository<AppointmentEmployee> { }
