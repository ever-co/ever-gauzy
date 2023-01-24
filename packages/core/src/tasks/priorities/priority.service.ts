import { DeleteResult, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ITaskPriority } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../../core/crud';
import { TaskPriority } from './priority.entity';

@Injectable()
export class TaskPriorityService extends TenantAwareCrudService<TaskPriority> {

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
}
