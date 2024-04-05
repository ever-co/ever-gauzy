import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult } from 'typeorm';
import { Knex as KnexConnection } from 'knex';
import { InjectConnection } from 'nest-knexjs';
import { IOrganization, IPagination, ITaskSize, ITaskSizeCreateInput, ITaskSizeFindInput, ITenant } from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { TaskStatusPrioritySizeService } from '../task-status-priority-size.service';
import { TaskSize } from './size.entity';
import { DEFAULT_GLOBAL_SIZES } from './default-global-sizes';
import { TypeOrmTaskSizeRepository } from './repository/type-orm-task-size.repository';
import { MikroOrmTaskSizeRepository } from './repository/mikro-orm-task-size.repository';


@Injectable()
export class TaskSizeService extends TaskStatusPrioritySizeService<TaskSize> {

	constructor(
		@InjectRepository(TaskSize)
		readonly typeOrmTaskSizeRepository: TypeOrmTaskSizeRepository,

		readonly mikroOrmTaskSizeRepository: MikroOrmTaskSizeRepository,

		@InjectConnection()
		readonly knexConnection: KnexConnection
	) {
		super(typeOrmTaskSizeRepository, mikroOrmTaskSizeRepository, knexConnection);
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
				isSystem: false
			},
		});
	}

	/**
	 * Find task sizes based on the provided parameters.
	 * @param params - The input parameters for the task size search.
	 * @returns {Promise<IPagination<ITaskSize>>} A promise resolving to the paginated list of task sizes.
	 * @throws {HttpException} Thrown if there's an issue with the request parameters, such as missing or unauthorized integration.
	 */
	public async fetchAll(params: ITaskSizeFindInput): Promise<IPagination<ITaskSize>> {
		try {
			if (this.ormType == MultiORMEnum.TypeORM && isPostgres()) {
				return await super.fetchAllByKnex(params);
			} else {
				return await super.fetchAll(params);
			}
		} catch (error) {
			console.log('Failed to retrieve task sizes. Please ensure that all required parameters are provided correctly.', error);
			throw new BadRequestException('Failed to retrieve task sizes. Ensure that the provided parameters are valid and complete.', error);
		}
	}

	/**
	 * Create bulk task sizes for tenants
	 *
	 * @param tenants
	 */
	async bulkCreateTenantsTaskSizes(tenants: ITenant[]): Promise<ITaskSize[]> {
		try {
			const sizes: ITaskSize[] = [];
			for (const tenant of tenants) {
				for (const size of DEFAULT_GLOBAL_SIZES) {
					const create = this.typeOrmRepository.create({
						...size,
						icon: `ever-icons/${size.icon}`,
						tenant,
						isSystem: false
					});
					sizes.push(create);
				}
			}
			return await this.typeOrmRepository.save(sizes);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk task sizes for organization
	 *
	 * @param organization
	 */
	async bulkCreateOrganizationTaskSizes(organization: IOrganization): Promise<ITaskSize[]> {
		try {
			const tenantId = RequestContext.currentTenantId();

			const sizes: ITaskSize[] = [];
			const { items = [] } = await super.fetchAll({ tenantId });

			for (const item of items) {
				const { tenantId, name, value, description, icon, color } = item;
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
				sizes.push(create);
			}
			return await this.typeOrmRepository.save(sizes);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk task sizes for specific organization entity
	 *
	 * @param entity
	 * @returns
	 */
	async createBulkSizesByEntity(entity: Partial<ITaskSizeCreateInput>): Promise<ITaskSize[]> {
		try {
			const { organizationId } = entity;
			const tenantId = RequestContext.currentTenantId();

			const sizes: ITaskSize[] = [];
			const { items = [] } = await super.fetchAll({ tenantId, organizationId });

			for (const item of items) {
				const { name, value, description, icon, color } = item;

				const size = await this.create({
					...entity,
					name,
					value,
					description,
					icon,
					color,
					isSystem: false
				});
				sizes.push(size);
			}

			return sizes;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
