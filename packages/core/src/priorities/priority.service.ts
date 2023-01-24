import { DeleteResult, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IStatus } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { Priority } from './priority.entity';

@Injectable()
export class PriorityService extends TenantAwareCrudService<Priority> {

	constructor(
		@InjectRepository(Priority)
		protected readonly priorityRepository: Repository<Priority>
	) {
		super(priorityRepository);
	}

	/**
	 * Few priorities can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: IStatus['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: {
				isSystem: false,
			},
		});
	}
}
