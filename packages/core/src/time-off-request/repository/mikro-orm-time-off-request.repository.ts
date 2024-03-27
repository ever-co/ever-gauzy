import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { TimeOffRequest } from '../time-off-request.entity';

export class MikroOrmTimeOffRequestRepository extends MikroOrmBaseEntityRepository<TimeOffRequest> { }
