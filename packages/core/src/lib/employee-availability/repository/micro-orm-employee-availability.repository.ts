import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EmployeeAvailability } from '../employee-availability.entity';

export class MikroOrmEmployeeAvailabilityRepository extends MikroOrmBaseEntityRepository<EmployeeAvailability> {}
