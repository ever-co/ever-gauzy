import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEstimation } from './task-estimation.entity';
import { TenantAwareCrudService } from '../../core/crud';

@Injectable()
export class TaskEstimationService extends TenantAwareCrudService<TaskEstimation> {
	constructor(
		@InjectRepository(TaskEstimation)
		protected readonly taskEstimationRepository: Repository<TaskEstimation>
	) {
		super(taskEstimationRepository);
	}
}
