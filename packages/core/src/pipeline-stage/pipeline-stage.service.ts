import { TenantAwareCrudService } from './../core/crud';
import { PipelineStage } from './pipeline-stage.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StageService extends TenantAwareCrudService<PipelineStage> {
	public constructor(
		@InjectRepository(PipelineStage)
		stageRepository: Repository<PipelineStage>
	) {
		super(stageRepository);
	}
}
