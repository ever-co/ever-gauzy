import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEstimation } from './task-estimation.entity';
import { TenantAwareCrudService } from '../../core/crud';

@Injectable()
export class TaskEstimationService extends TenantAwareCrudService<TaskEstimation> {
	constructor(
		@InjectRepository(TaskEstimation)
		taskEstimationRepository: Repository<TaskEstimation>,
		@MikroInjectRepository(TaskEstimation)
		mikroTaskEstimationRepository: EntityRepository<TaskEstimation>
	) {
		super(taskEstimationRepository, mikroTaskEstimationRepository);
	}
}
