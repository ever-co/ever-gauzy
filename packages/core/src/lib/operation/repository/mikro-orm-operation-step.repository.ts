import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { OperationStep } from '../operation-step.entity';

export class MikroOrmOperationStepRepository extends MikroOrmBaseEntityRepository<OperationStep> {}
