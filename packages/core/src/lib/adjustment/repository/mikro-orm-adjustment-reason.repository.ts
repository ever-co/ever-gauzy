import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { AdjustmentReason } from '../adjustment-reason.entity';

export class MikroOrmAdjustmentReasonRepository extends MikroOrmBaseEntityRepository<AdjustmentReason> {}
