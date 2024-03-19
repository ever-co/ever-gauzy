import { EntityRepository } from '@mikro-orm/knex';
import { EmployeeAppointment } from '../employee-appointment.entity';

export class MikroOrmEmployeeAppointmentRepository extends EntityRepository<EmployeeAppointment> { }
