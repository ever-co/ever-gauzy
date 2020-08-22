import { CrudService } from '../core/crud';
import { PipelineStage } from './pipeline-stage.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@angular/core';

@Injectable()
export class StageService extends CrudService<PipelineStage> {
	public constructor(
		@InjectRepository(PipelineStage)
		stageRepository: Repository<PipelineStage>
	) {
		super(stageRepository);
	}
}
