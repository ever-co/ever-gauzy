import { Repository } from 'typeorm';
import { PipelineStage } from '../pipeline-stage.entity';

export class TypeOrmPipelineStageRepository extends Repository<PipelineStage> { }