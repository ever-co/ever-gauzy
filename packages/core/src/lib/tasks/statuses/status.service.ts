import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere } from 'typeorm';
import { Knex as KnexConnection } from 'knex';
import { InjectConnection } from 'nest-knexjs';
import {
	ID,
	IOrganization,
	IPagination,
	IReorderDTO,
	ITaskStatus,
	ITaskStatusCreateInput,
	ITaskStatusFindInput,
	ITaskStatusUpdateInput,
	ITenant
} from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { IPartialEntity } from '../../core/crud/icrud.service';
import { TaskMetadataService } from '../task-metadata.service';
import { TaskStatus } from './status.entity';
import { DEFAULT_GLOBAL_STATUSES } from './default-global-statuses';
import { TASK_STATUSES_TEMPLATES } from './standard-statuses-template';
import { TypeOrmTaskStatusRepository } from './repository/type-orm-task-status.repository';
import { MikroOrmTaskStatusRepository } from './repository/mikro-orm-task-status.repository';

@Injectable()
export class TaskStatusService extends TaskMetadataService<TaskStatus> {
	readonly logger = new Logger(TaskStatusService.name);

	constructor(
		readonly typeOrmTaskStatusRepository: TypeOrmTaskStatusRepository,
		readonly mikroOrmTaskStatusRepository: MikroOrmTaskStatusRepository,
		@InjectConnection() readonly knexConnection: KnexConnection
	) {
		super(typeOrmTaskStatusRepository, mikroOrmTaskStatusRepository, knexConnection);
	}

	/**
	 * Create task status
	 *
	 * @param entity - object that contains the input values and template to be used
	 * @returns - a promise that resolves after task status created
	 */
	public async create(entity: IPartialEntity<TaskStatus>): Promise<ITaskStatus> {
		try {
			// Extract the template from the entity
			const { template, ...partialEntity } = entity;

			// Get the work flow for the template
			const workFlow = TASK_STATUSES_TEMPLATES[template];

			// Save the entity with the work flow
			return await this.save({ ...partialEntity, ...workFlow });
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to add task status: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * GET statuses by filters
	 * If parameters not match, retrieve global statuses
	 *
	 * @param params
	 * @returns
	 */
	async fetchAll(params: ITaskStatusFindInput): Promise<IPagination<TaskStatus>> {
		try {
			if (this.ormType == MultiORMEnum.TypeORM && isPostgres()) {
				return await super.fetchAllByKnex(params);
			} else {
				return await super.fetchAll(params);
			}
		} catch (error) {
			this.logger.error(
				'Failed to retrieve task statuses. Ensure that the provided parameters are valid and complete.',
				error
			);
			throw new BadRequestException(
				'Failed to retrieve task statuses. Ensure that the provided parameters are valid and complete.',
				error
			);
		}
	}

	/**
	 * Few Statuses can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: ID): Promise<DeleteResult> {
		return await super.delete(id, {
			where: { isSystem: false }
		});
	}

	/**
	 *
	 */
	async bulkCreateTenantsStatus(tenants: ITenant[]): Promise<ITaskStatus[] & TaskStatus[]> {
		try {
			if (!tenants || tenants.length === 0) {
				return [];
			}

			/**
			 * Cartesian product of tenants and default global statuses.
			 */
			const statuses: TaskStatus[] = tenants.flatMap((tenant: ITenant) =>
				DEFAULT_GLOBAL_STATUSES.map(
					(status) =>
						new TaskStatus({
							...status,
							icon: `ever-icons/${status.icon}`,
							isSystem: false,
							tenant
						})
				)
			);

			/**
			 * Use saveManyWithoutEnrichment to ensure that each entity's specific tenantId
			 * is preserved. The standard saveMany() would force the current session's tenantId.
			 */
			return (await this.saveManyWithoutEnrichment(statuses)) as ITaskStatus[] & TaskStatus[];
		} catch (error) {
			this.logger.error('Error while creating bulk task statuses for tenants:', error.message);
			return [];
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
			const tenantId = RequestContext.currentTenantId();
			const { items = [] } = await super.fetchAll({ tenantId });

			const statuses = items.map(
				(item, index) =>
					new TaskStatus({
						tenantId: item.tenantId,
						name: item.name,
						value: item.value,
						description: item.description,
						icon: item.icon,
						color: item.color,
						organization,
						isSystem: false,
						order: item.order || index,
						isCollapsed: item.isCollapsed
					})
			);

			return (await this.saveMany(statuses)) as ITaskStatus[] & TaskStatus[];
		} catch (error) {
			this.logger.error('Error while creating task statuses for organization', error.message);
			return [] as any;
		}
	}

	/**
	 * Creates bulk task statuses based on the properties of a given entity.
	 *
	 * @param entity A partial representation of the entity from which properties will be extracted for creating task statuses.
	 * @returns A promise that resolves to an array of created task statuses.
	 */
	async createBulkStatusesByEntity(entity: Partial<ITaskStatusCreateInput>): Promise<ITaskStatus[]> {
		try {
			const { organizationId } = entity;
			const tenantId = RequestContext.currentTenantId();

			const { items = [] } = await super.fetchAll({ tenantId, organizationId });

			const entities = items.map((item, index) => ({
				...entity,
				name: item.name,
				value: item.value,
				description: item.description,
				icon: item.icon,
				color: item.color,
				isSystem: false,
				order: item.order || index,
				isCollapsed: item.isCollapsed
			}));

			return await this.createMany(entities);
		} catch (error) {
			this.logger.error('Error while creating task statuses', error);
			return [];
		}
	}

	/**
	 * Reorders a list of items based on the given ReorderDTO array.
	 * @param list - An array of ReorderDTO representing the IDs and their new orders.
	 * @returns An object indicating success or failure, along with the updated list.
	 * @throws BadRequestException if an error occurs during reordering.
	 */
	async reorder(list: IReorderDTO[]): Promise<{ success: boolean; list?: IReorderDTO[] }> {
		try {
			// Loop through the list and update each item's order
			for await (const item of list) {
				this.logger.log(`Updating item with ID: ${item.id} to order: ${item.order}`); // Logging operation

				// Update the entity with the new order value
				if (item.id) {
					await super.update({ id: item.id, isSystem: false }, { order: item.order });
				}
			}

			// Return a success status and the updated list
			return { success: true, list };
		} catch (error) {
			// Handle errors during reordering
			this.logger.error('Error during reordering of task statues:', error); // Log the error for debugging
			throw new BadRequestException('An error occurred while reordering task statues. Please try again.', error); // Return error
		}
	}

	/**
	 * Marks an task status as default and updates other task statuses accordingly.
	 *
	 * @param id The ID of the task status to mark as default.
	 * @param input An object containing input parameters, including organization, team, and project IDs.
	 * @returns A Promise that resolves to an array of updated task statuses.
	 */
	async markAsDefault(id: ID, input: ITaskStatusUpdateInput): Promise<ITaskStatus[]> {
		try {
			const { organizationId, organizationTeamId, projectId } = input;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			// Find the task status by ID
			const taskStatus: ITaskStatus = await this.findOneByIdString(id, { where: { isSystem: false } });

			// Update the task status to mark it as default
			taskStatus.isDefault = true;

			// Define options to find task statuses to update
			const findOptions: FindOptionsWhere<TaskStatus> = {
				...(organizationId ? { organizationId } : {}),
				...(organizationTeamId ? { organizationTeamId } : {}),
				...(projectId ? { projectId } : {}),
				tenantId,
				isSystem: false
			};

			// Update other task statuses to mark them as non-default
			await super.update(findOptions, { isDefault: false });

			// Save the updated issue type
			await super.save(taskStatus);

			// Fetch and return all task statuses based on the specified parameters
			const { items = [] } = await super.fetchAll({
				tenantId,
				organizationId,
				organizationTeamId,
				projectId
			});

			return items;
		} catch (error) {
			// If an error occurs, throw a BadRequestException
			throw new BadRequestException(error);
		}
	}
}
