import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { Knex as KnexConnection } from 'knex';
import { InjectConnection } from 'nest-knexjs';
import {
	IOrganization,
	IPagination,
	ITaskPriority,
	ITaskPriorityCreateInput,
	ITaskPriorityFindInput,
	ITenant
} from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { TaskMetadataService } from '../task-metadata.service';
import { TaskPriority } from './priority.entity';
import { DEFAULT_GLOBAL_PRIORITIES } from './default-global-priorities';
import { MikroOrmTaskPriorityRepository } from './repository/mikro-orm-task-priority.repository';
import { TypeOrmTaskPriorityRepository } from './repository/type-orm-task-priority.repository';

@Injectable()
export class TaskPriorityService extends TaskMetadataService<TaskPriority> {
	readonly logger = new Logger(TaskPriorityService.name);

	constructor(
		readonly typeOrmTaskPriorityRepository: TypeOrmTaskPriorityRepository,
		readonly mikroOrmTaskPriorityRepository: MikroOrmTaskPriorityRepository,
		@InjectConnection() readonly knexConnection: KnexConnection
	) {
		super(typeOrmTaskPriorityRepository, mikroOrmTaskPriorityRepository, knexConnection);
	}

	/**
	 * Few task priorities can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: ITaskPriority['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: { isSystem: false }
		});
	}

	/**
	 * GET priorities by filters.
	 * If parameters not match, retrieve global task priorities.
	 *
	 * @param params
	 * @returns
	 */
	public async fetchAll(params: ITaskPriorityFindInput): Promise<IPagination<ITaskPriority>> {
		try {
			if (this.ormType == MultiORMEnum.TypeORM && isPostgres()) {
				return await super.fetchAllByKnex(params);
			} else {
				return await super.fetchAll(params);
			}
		} catch (error) {
			this.logger.error('Failed to retrieve task priorities. Ensure that the provided parameters are valid and complete.', error);
			throw new BadRequestException(
				'Failed to retrieve task priorities. Ensure that the provided parameters are valid and complete.',
				error
			);
		}
	}

	/**
	 * Create bulk task priorities for tenants.
	 * Uses saveManyWithoutEnrichment to preserve each entity's specific tenantId.
	 *
	 * @param tenants
	 */
	async bulkCreateTenantsTaskPriorities(tenants: ITenant[]): Promise<ITaskPriority[]> {
		try {
			if (!tenants?.length) {
				return [];
			}

			const priorities = tenants.flatMap((tenant) =>
				DEFAULT_GLOBAL_PRIORITIES.map(
					(priority) =>
						new TaskPriority({
							...priority,
							icon: `ever-icons/${priority.icon}`,
							tenant,
							isSystem: false
						})
				)
			);

			return await this.saveManyWithoutEnrichment(priorities);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk task priorities for organization.
	 *
	 * @param organization
	 */
	async bulkCreateOrganizationTaskPriorities(organization: IOrganization): Promise<ITaskPriority[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { items = [] } = await super.fetchAll({ tenantId });

			const priorities = items.map(
				(item) =>
					new TaskPriority({
						tenantId,
						name: item.name,
						value: item.value,
						description: item.description,
						icon: item.icon,
						color: item.color,
						organization,
						isSystem: false
					})
			);

			return await this.saveMany(priorities);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk task priorities for specific organization entity.
	 *
	 * @param entity
	 * @returns
	 */
	async createBulkPrioritiesByEntity(entity: Partial<ITaskPriorityCreateInput>): Promise<ITaskPriority[]> {
		try {
			const { organizationId } = entity;
			const tenantId = RequestContext.currentTenantId();

			const { items = [] } = await super.fetchAll({ tenantId, organizationId });

			const entitiesToCreate = items.map((item) => ({
				...entity,
				name: item.name,
				value: item.value,
				description: item.description,
				icon: item.icon,
				color: item.color,
				isSystem: false
			}));

			return await this.createMany(entitiesToCreate);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
