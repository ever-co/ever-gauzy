import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { AppointmentEmployee } from '../appointment-employees.entity';

export class MikroOrmAppointmentEmployeeRepository extends MikroOrmBaseEntityRepository<AppointmentEmployee> { }
