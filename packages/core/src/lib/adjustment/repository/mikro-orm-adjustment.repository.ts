import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Adjustment } from '../adjustment.entity';

export class MikroOrmAdjustmentRepository extends MikroOrmBaseEntityRepository<Adjustment> {}
