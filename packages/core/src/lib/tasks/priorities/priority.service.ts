import { BadRequestException, Injectable } from '@nestjs/common';
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
import { TaskStatusPrioritySizeService } from '../task-status-priority-size.service';
import { TaskPriority } from './priority.entity';
import { DEFAULT_GLOBAL_PRIORITIES } from './default-global-priorities';
import { MikroOrmTaskPriorityRepository } from './repository/mikro-orm-task-priority.repository';
import { TypeOrmTaskPriorityRepository } from './repository/type-orm-task-priority.repository';

@Injectable()
export class TaskPriorityService extends TaskStatusPrioritySizeService<TaskPriority> {
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
			where: {
				isSystem: false
			}
		});
	}

	/**
	 * GET priorities by filters
	 * If parameters not match, retrieve global task priorities
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
			console.log(
				'Failed to retrieve task priorities. Ensure that the provided parameters are valid and complete.',
				error
			);
			throw new BadRequestException(
				'Failed to retrieve task priorities. Ensure that the provided parameters are valid and complete.',
				error
			);
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
					const create = this.typeOrmRepository.create({
						...priority,
						icon: `ever-icons/${priority.icon}`,
						tenant,
						isSystem: false
					});
					priorities.push(create);
				}
			}
			return await this.typeOrmRepository.save(priorities);
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
			const tenantId = RequestContext.currentTenantId();

			const priorities: ITaskPriority[] = [];
			const { items = [] } = await super.fetchAll({ tenantId });

			for (const item of items) {
				const { name, value, description, icon, color } = item;

				const create = this.typeOrmRepository.create({
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
			return await this.typeOrmRepository.save(priorities);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk task priorities for specific organization entity
	 *
	 * @param entity
	 * @returns
	 */
	async createBulkPrioritiesByEntity(entity: Partial<ITaskPriorityCreateInput>): Promise<ITaskPriority[]> {
		try {
			const { organizationId } = entity;
			const tenantId = RequestContext.currentTenantId();

			const priorities: ITaskPriority[] = [];
			const { items = [] } = await super.fetchAll({ tenantId, organizationId });

			for (const item of items) {
				const { name, value, description, icon, color } = item;

				const priority = await this.create({
					...entity,
					name,
					value,
					description,
					icon,
					color,
					isSystem: false
				});
				priorities.push(priority);
			}

			return priorities;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
