import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EmployeeAgentProfile } from '../employee-agent-profile.entity';

export class MikroOrmEmployeeAgentProfileRepository extends MikroOrmBaseEntityRepository<EmployeeAgentProfile> {}
