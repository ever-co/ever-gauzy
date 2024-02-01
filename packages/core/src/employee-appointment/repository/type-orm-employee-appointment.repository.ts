import { Repository } from 'typeorm';
import { EmployeeAppointment } from '../employee-appointment.entity';

export class TypeOrmEmployeeAppointmentRepository extends Repository<EmployeeAppointment> { }