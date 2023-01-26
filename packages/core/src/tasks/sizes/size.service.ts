import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { IPagination, ITaskSize, ITaskSizeFindInput } from '@gauzy/contracts';
import { SharedPrioritySizeService } from './../../tasks/shared-priority-size.service';
import { TaskSize } from './size.entity';

@Injectable()
export class TaskSizeService extends SharedPrioritySizeService<TaskSize> {

	constructor(
		@InjectRepository(TaskSize)
		protected readonly taskSizeRepository: Repository<TaskSize>
	) {
		super(taskSizeRepository);
	}

	/**
	 * Few task sizes can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: ITaskSize['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: {
				isSystem: false,
			},
		});
	}

	/**
	 * GET task sizes by filters
	 * If parameters not match, retrieve global task sizes
	 *
	 * @param params
	 * @returns
	 */
	async findTaskSizes(
		params: ITaskSizeFindInput
	): Promise<IPagination<ITaskSize>> {
		return await this.findAllTaskShared(params);
	}
}
