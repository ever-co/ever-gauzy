import { Injectable } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { TaskEstimation } from './task-estimation.entity';
import { TenantAwareCrudService } from '../../core/crud';
import { TypeOrmTaskEstimationRepository } from './repository/type-orm-estimation.repository';
import { MikroOrmTaskEstimationRepository } from './repository/mikro-orm-estimation.repository';

@Injectable()
export class TaskEstimationService extends TenantAwareCrudService<TaskEstimation> {
	constructor(
		typeOrmTaskEstimationRepository: TypeOrmTaskEstimationRepository,
		mikroOrmTaskEstimationRepository: MikroOrmTaskEstimationRepository
	) {
		super(typeOrmTaskEstimationRepository, mikroOrmTaskEstimationRepository);
	}

	/**
	 * Every estimation of the task, whoever made it.
	 *
	 * A plain `findAll` limits a caller without CHANGE_SELECTED_EMPLOYEE to their own estimation (the entity
	 * has an `employeeId` column), so the task estimate was recalculated from the caller's estimate alone.
	 */
	async findAllForTask(taskId: ID): Promise<TaskEstimation[]> {
		const { items } = await this.withoutEmployeeFilter(() => this.findAll({ where: { taskId } }));
		return items;
	}
}
