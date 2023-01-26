import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { IPagination, ITaskPriority, ITaskPriorityFindInput } from '@gauzy/contracts';
import { SharedPrioritySizeService } from './../../tasks/shared-priority-size.service';
import { TaskPriority } from './priority.entity';

@Injectable()
export class TaskPriorityService extends SharedPrioritySizeService<TaskPriority> {

	constructor(
		@InjectRepository(TaskPriority)
		protected readonly taskPriorityRepository: Repository<TaskPriority>
	) {
		super(taskPriorityRepository);
	}

	/**
	 * Few task priorities can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: ITaskPriority['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: {
				isSystem: false,
			},
		});
	}

	/**
	 * GET priorities by filters
	 * If parameters not match, retrieve global task sizes
	 *
	 * @param params
	 * @returns
	 */
	async findTaskPriorities(
		params: ITaskPriorityFindInput
	): Promise<IPagination<ITaskPriority>> {
		return await this.findAllTaskShared(params);
	}
}
