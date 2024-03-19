import { EntityRepository } from '@mikro-orm/knex';
import { Pipeline } from '../pipeline.entity';

export class MikroOrmPipelineRepository extends EntityRepository<Pipeline> { }
