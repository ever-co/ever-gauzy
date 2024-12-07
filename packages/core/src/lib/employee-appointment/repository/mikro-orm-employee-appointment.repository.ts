import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EmployeeAppointment } from '../employee-appointment.entity';

export class MikroOrmEmployeeAppointmentRepository extends MikroOrmBaseEntityRepository<EmployeeAppointment> { }
