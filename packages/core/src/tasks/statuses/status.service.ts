import {
	DeleteResult,
	Repository
} from 'typeorm';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IOrganization, IOrganizationProject, IPagination, ITaskStatus, ITaskStatusFindInput, ITenant } from '@gauzy/contracts';
import { TaskStatusPrioritySizeService } from '../task-status-priority-size.service';
import { RequestContext } from './../../core/context';
import { TaskStatus } from './status.entity';
import { DEFAULT_GLOBAL_STATUSES } from './default-global-statuses';

@Injectable()
export class TaskStatusService extends TaskStatusPrioritySizeService<TaskStatus> {
	constructor(
		@InjectRepository(TaskStatus)
		protected readonly taskStatusRepository: Repository<TaskStatus>
	) {
		super(taskStatusRepository);
	}

	/**
	 * GET statuses by filters
	 * If parameters not match, retrieve global statuses
	 *
	 * @param params
	 * @returns
	 */
	async findTaskStatuses(
		params: ITaskStatusFindInput
	): Promise<IPagination<TaskStatus>> {
		try {
			return await this.findEntitiesByParams(params);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Few Statuses can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: ITaskStatus['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: {
				isSystem: false,
			},
		});
	}

	/**
	 * Create bulk statuses for specific tenants
	 *
	 * @param tenants '
	 */
	async bulkCreateTenantsStatus(tenants: ITenant[]): Promise<ITaskStatus[] & TaskStatus[]> {
		const statuses: ITaskStatus[] = [];
		for (const tenant of tenants) {
			for (const status of DEFAULT_GLOBAL_STATUSES) {
				statuses.push(new TaskStatus({...status, icon: `ever-icons/${status.icon}`, isSystem: false, tenant }));
			}
		}
		return await this.repository.save(statuses);
	}

	/**
	 * Create bulk statuses for specific organization
	 *
	 * @param organization
	 */
	async bulkCreateOrganizationStatus(organization: IOrganization): Promise<ITaskStatus[] & TaskStatus[]> {
		try {
			const statuses: ITaskStatus[] = [];

			const tenantId = RequestContext.currentTenantId();
			const { items = [] } = await this.findEntitiesByParams({ tenantId });

			for (const item of items) {
				const { tenantId, name, value, description, icon, color } = item;
				const status = new TaskStatus({
					tenantId,
					name,
					value,
					description,
					icon,
					color,
					organization,
					isSystem: false
				});
				statuses.push(status);
			}
			return await this.repository.save(statuses);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk statuses for specific organization project
	 *
	 * @param project
	 * @returns
	 */
	async bulkCreateOrganizationProjectStatus(project: IOrganizationProject): Promise<ITaskStatus[] & TaskStatus[]> {
		try {
			const { tenantId, organizationId } = project;

			const statuses: ITaskStatus[] = [];
			const { items = [] } = await this.findEntitiesByParams({ tenantId, organizationId });

			for (const item of items) {
				const { name, value, description, icon, color } = item;
				const status = new TaskStatus({
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
				statuses.push(status);
			}
			return await this.repository.save(statuses);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
