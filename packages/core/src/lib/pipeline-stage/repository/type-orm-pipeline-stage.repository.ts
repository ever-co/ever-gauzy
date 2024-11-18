import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PipelineStage } from '../pipeline-stage.entity';

@Injectable()
export class TypeOrmPipelineStageRepository extends Repository<PipelineStage> {
    constructor(@InjectRepository(PipelineStage) readonly repository: Repository<PipelineStage>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
