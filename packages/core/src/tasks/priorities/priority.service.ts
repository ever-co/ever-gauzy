import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { IOrganizationProject, IPagination, ITaskPriority, ITaskPriorityFindInput } from '@gauzy/contracts';
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

	/**
	 * Create bulk task priorities for specific organization project
	 *
	 * @param project
	 * @returns
	 */
	async bulkCreateOrganizationProjectPriority(project: IOrganizationProject): Promise<ITaskPriority[]> {
		try {
			const { tenantId, organizationId } = project;

			const priorities: ITaskPriority[] = [];
			const { items = [] } = await this.findAllTaskShared({
				tenantId,
				organizationId
			});

			for (const item of items) {
				const { name, value, description, icon, color } = item;

				const create = this.repository.create({
					tenantId,
					organizationId,
					name,
					value,
					description,
					icon,
					color,
					project,
					isSystem: false
				});
				priorities.push(create);
			}
			return await this.repository.save(priorities);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
