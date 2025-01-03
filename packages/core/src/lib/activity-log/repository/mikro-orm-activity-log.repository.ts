import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ActivityLog } from '../activity-log.entity';

export class MikroOrmActivityLogRepository extends MikroOrmBaseEntityRepository<ActivityLog> {}
