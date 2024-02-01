import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TaskEstimation } from './task-estimation.entity';
import { TenantAwareCrudService } from '../../core/crud';
import { TypeOrmTaskEstimationRepository } from './repository/type-orm-estimation.repository';
import { MikroOrmTaskEstimationRepository } from './repository/mikro-orm-estimation.repository';

@Injectable()
export class TaskEstimationService extends TenantAwareCrudService<TaskEstimation> {
	constructor(
		@InjectRepository(TaskEstimation)
		typeOrmTaskEstimationRepository: TypeOrmTaskEstimationRepository,

		mikroOrmTaskEstimationRepository: MikroOrmTaskEstimationRepository
	) {
		super(typeOrmTaskEstimationRepository, mikroOrmTaskEstimationRepository);
	}
}
