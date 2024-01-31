import { EntityRepository } from '@mikro-orm/core';
import { Pipeline } from '../pipeline.entity';

export class MikroOrmPipelineRepository extends EntityRepository<Pipeline> { }