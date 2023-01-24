import { DeleteResult, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ITaskSize } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../../core/crud';
import { TaskSize } from './size.entity';

@Injectable()
export class TaskSizeService extends TenantAwareCrudService<TaskSize> {

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
}
