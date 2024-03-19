import { EntityRepository } from '@mikro-orm/knex';
import { AppointmentEmployee } from '../appointment-employees.entity';

export class MikroOrmAppointmentEmployeeRepository extends EntityRepository<AppointmentEmployee> { }
