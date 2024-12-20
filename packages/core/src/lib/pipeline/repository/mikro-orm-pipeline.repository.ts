import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Pipeline } from '../pipeline.entity';

export class MikroOrmPipelineRepository extends MikroOrmBaseEntityRepository<Pipeline> { }
