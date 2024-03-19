import { EntityRepository } from '@mikro-orm/knex';
import { PipelineStage } from '../pipeline-stage.entity';

export class MikroOrmPipelineStageRepository extends EntityRepository<PipelineStage> { }
