import { EntityRepository } from '@mikro-orm/core';
import { PipelineStage } from '../pipeline-stage.entity';

export class MikroOrmPipelineStageRepository extends EntityRepository<PipelineStage> { }