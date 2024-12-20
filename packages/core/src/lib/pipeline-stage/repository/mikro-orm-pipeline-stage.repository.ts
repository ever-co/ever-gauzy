import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { PipelineStage } from '../pipeline-stage.entity';

export class MikroOrmPipelineStageRepository extends MikroOrmBaseEntityRepository<PipelineStage> { }
