import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { TimeOffBalance } from '../time-off-balance.entity';

export class MikroOrmTimeOffBalanceRepository extends MikroOrmBaseEntityRepository<TimeOffBalance> {}
