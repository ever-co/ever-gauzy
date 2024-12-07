import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ApiCallLog } from '../api-call-log.entity';

export class MikroOrmApiCallLogRepository extends MikroOrmBaseEntityRepository<ApiCallLog> {}
