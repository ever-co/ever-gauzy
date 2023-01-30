import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { IOrganization, IOrganizationProject, IPagination, ITaskPriority, ITaskPriorityFindInput, ITenant } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { TaskStatusPrioritySizeService } from '../task-status-priority-size.service';
import { TaskPriority } from './priority.entity';
import { DEFAULT_GLOBAL_PRIORITIES } from './default-global-priorities';

@Injectable()
export class TaskPriorityService extends TaskStatusPrioritySizeService<TaskPriority> {

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
	 * If parameters not match, retrieve global task priorities
	 *
	 * @param params
	 * @returns
	 */
	async findTaskPriorities(
		params: ITaskPriorityFindInput
	): Promise<IPagination<ITaskPriority>> {
		try {
			return await this.findEntitiesByParams(params);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk task priorities for tenants
	 *
	 * @param tenants '
	 */
	async bulkCreateTenantsTaskPriorities(tenants: ITenant[]): Promise<ITaskPriority[]> {
		try {
			const priorities: ITaskPriority[] = [];
			for (const tenant of tenants) {
				for (const priority of DEFAULT_GLOBAL_PRIORITIES) {
					const create = this.repository.create({
						...priority,
						tenant,
						isSystem: false
					});
					priorities.push(create);
				}
			}
			return await this.repository.save(priorities);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk task priorities for organization
	 *
	 * @param organization
	 */
	async bulkCreateOrganizationTaskPriorities(organization: IOrganization): Promise<ITaskPriority[]> {
		try {
			const priorities: ITaskPriority[] = [];

			const tenantId = RequestContext.currentTenantId();
			const { items = [] } = await this.findEntitiesByParams({ tenantId });

			for (const item of items) {
				const { name, value, description, icon, color } = item;

				const create = this.repository.create({
					tenantId,
					name,
					value,
					description,
					icon,
					color,
					organization,
					isSystem: false
				});
				priorities.push(create);
			}
			return await this.repository.save(priorities);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk task priorities for organization project
	 *
	 * @param project
	 * @returns
	 */
	async bulkCreateOrganizationProjectTaskPriorities(project: IOrganizationProject): Promise<ITaskPriority[]> {
		try {
			const { tenantId, organizationId } = project;

			const priorities: ITaskPriority[] = [];
			const { items = [] } = await this.findEntitiesByParams({ tenantId, organizationId });

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
