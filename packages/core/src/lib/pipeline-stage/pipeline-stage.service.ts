import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { PipelineStage } from './pipeline-stage.entity';
import { TypeOrmPipelineStageRepository } from './repository/type-orm-pipeline-stage.repository';
import { MikroOrmPipelineStageRepository } from './repository/mikro-orm-pipeline-stage.repository';

@Injectable()
export class StageService extends TenantAwareCrudService<PipelineStage> {
	constructor(
		typeOrmPipelineStageRepository: TypeOrmPipelineStageRepository,
		mikroOrmPipelineStageRepository: MikroOrmPipelineStageRepository
	) {
		super(typeOrmPipelineStageRepository, mikroOrmPipelineStageRepository);
	}
}
