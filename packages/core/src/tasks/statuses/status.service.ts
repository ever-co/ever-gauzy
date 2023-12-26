
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	DeleteResult,
	Repository
} from 'typeorm';
import {
	IOrganization,
	IPagination,
	ITaskStatus,
	ITaskStatusCreateInput,
	ITaskStatusFindInput,
	ITenant
} from '@gauzy/contracts';
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
			throw new HttpException(`Error while retrieve task statuses: ${error.message}`, HttpStatus.BAD_REQUEST);
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
	 * Creates bulk task statuses for specific tenants.
	 *
	 * @param tenants An array of tenants for whom the task statuses will be created.
	 * @returns A promise that resolves to an array of created task statuses.
	 */
	async bulkCreateTenantsStatus(tenants: ITenant[]): Promise<ITaskStatus[] & TaskStatus[]> {
		try {
			// Initialize an array to store the created task statuses.
			const statuses: ITaskStatus[] = [];

			// Iterate over each tenant.
			for (const tenant of tenants) {
				// Iterate over each default global status.
				for (const status of DEFAULT_GLOBAL_STATUSES) {
					// Create a new TaskStatus instance with modified properties.
					const newStatus = new TaskStatus({
						...status,
						icon: `ever-icons/${status.icon}`,
						isSystem: false,
						tenant,
					});

					// Add the new status to the array.
					statuses.push(newStatus);
				}
			}

			// Save the created task statuses using the repository.
			return await this.repository.save(statuses);
		} catch (error) {
			// If an error occurs during the creation process, log the error.
			console.error('Error while creating task statuses', error.message);
		}
	}

	/**
	 * Creates bulk task statuses for a specific organization.
	 *
	 * @param organization The organization for which the task statuses will be created.
	 * @returns A promise that resolves to an array of created task statuses.
	 */
	async bulkCreateOrganizationStatus(organization: IOrganization): Promise<ITaskStatus[] & TaskStatus[]> {
		try {
			// Initialize an array to store the created task statuses.
			const statuses: ITaskStatus[] = [];

			// Get the current tenant ID from the request context.
			const tenantId = RequestContext.currentTenantId();

			// Find entities by parameters, filtering by tenant ID.
			const { items = [] } = await this.findEntitiesByParams({ tenantId });

			// Initialize an index variable.
			let index = 0;

			// Iterate over each found entity.
			for (const item of items) {

				// Extract relevant properties from the entity.
				const { tenantId, name, value, description, icon, color, order, isCollapsed } = item;

				// Create a new TaskStatus instance with modified properties.
				const status = new TaskStatus({
					tenantId,
					name,
					value,
					description,
					icon,
					color,
					organization,
					isSystem: false,
					order: order || index,
					isCollapsed,
				});

				// Increment the index.
				index++;

				// Add the new status to the array.
				statuses.push(status);
			}

			// Save the created task statuses using the repository.
			return await this.repository.save(statuses);
		} catch (error) {
			// If an error occurs during the creation process, log the error.
			console.error('Error while creating task statuses for organization', error.message);
		}
	}

	/**
	 * Creates bulk task statuses based on the properties of a given entity.
	 *
	 * @param entity A partial representation of the entity from which properties will be extracted for creating task statuses.
	 * @returns A promise that resolves to an array of created task statuses.
	 */
	async createBulkStatusesByEntity(entity: Partial<ITaskStatusCreateInput>): Promise<ITaskStatus[]> {
		// Extract relevant properties from the entity.
		const { organizationId } = entity;
		const tenantId = RequestContext.currentTenantId();

		try {
			// Initialize an array to store the created task statuses.
			const statuses: ITaskStatus[] = [];

			// Find entities by parameters, filtering by tenant ID and organization ID.
			const { items = [] } = await this.findEntitiesByParams({ tenantId, organizationId });

			// Initialize an index variable.
			let index = 0;

			// Iterate over each found entity.
			for await (const item of items) {
				// Extract properties from the entity.
				const { name, value, description, icon, color, order, isCollapsed } = item;

				// Create a new TaskStatus instance with modified properties.
				const status = await this.create({
					...entity,
					name,
					value,
					description,
					icon,
					color,
					isSystem: false,
					order: order || index,
					isCollapsed,
				});

				// Increment the index.
				index++;

				// Add the new status to the array.
				statuses.push(status);
			}

			// Return the array of created task statuses.
			return statuses;
		} catch (error) {
			// If an error occurs during the creation process, log the error.
			console.error('Error while creating task statuses', error);
		}
	}
}
