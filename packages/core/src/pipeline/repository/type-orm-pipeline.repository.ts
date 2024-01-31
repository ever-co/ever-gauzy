import { Repository } from 'typeorm';
import { Pipeline } from '../pipeline.entity';

export class TypeOrmPipelineRepository extends Repository<Pipeline> { }