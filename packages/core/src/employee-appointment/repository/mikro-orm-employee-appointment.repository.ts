import { EntityRepository } from '@mikro-orm/core';
import { EmployeeAppointment } from '../employee-appointment.entity';

export class MikroOrmEmployeeAppointmentRepository extends EntityRepository<EmployeeAppointment> { }