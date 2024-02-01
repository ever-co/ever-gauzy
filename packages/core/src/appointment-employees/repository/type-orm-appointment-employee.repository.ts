import { Repository } from 'typeorm';
import { AppointmentEmployee } from '../appointment-employees.entity';

export class TypeOrmAppointmentEmployeeRepository extends Repository<AppointmentEmployee> { }
