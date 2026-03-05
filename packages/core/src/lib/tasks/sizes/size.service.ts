import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { Knex as KnexConnection } from 'knex';
import { InjectConnection } from 'nest-knexjs';
import {
	ID,
	IOrganization,
	IPagination,
	ITaskSize,
	ITaskSizeCreateInput,
	ITaskSizeFindInput,
	ITenant
} from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { TaskMetadataService } from '../task-metadata.service';
import { TaskSize } from './size.entity';
import { DEFAULT_GLOBAL_SIZES } from './default-global-sizes';
import { TypeOrmTaskSizeRepository } from './repository/type-orm-task-size.repository';
import { MikroOrmTaskSizeRepository } from './repository/mikro-orm-task-size.repository';

@Injectable()
export class TaskSizeService extends TaskMetadataService<TaskSize> {
	readonly logger = new Logger(TaskSizeService.name);

	constructor(
		readonly typeOrmTaskSizeRepository: TypeOrmTaskSizeRepository,
		readonly mikroOrmTaskSizeRepository: MikroOrmTaskSizeRepository,
		@InjectConnection() readonly knexConnection: KnexConnection
	) {
		super(typeOrmTaskSizeRepository, mikroOrmTaskSizeRepository, knexConnection);
	}

	/**
	 * Few task sizes can't be removed/delete because they are global
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
	 * Find task sizes based on the provided parameters.
	 *
	 * @param params - The input parameters for the task size search.
	 * @returns A promise resolving to the paginated list of task sizes.
	 */
	public async fetchAll(params: ITaskSizeFindInput): Promise<IPagination<ITaskSize>> {
		try {
			if (this.ormType == MultiORMEnum.TypeORM && isPostgres()) {
				return await super.fetchAllByKnex(params);
			} else {
				return await super.fetchAll(params);
			}
		} catch (error) {
			this.logger.error('Failed to retrieve task sizes. Ensure that the provided parameters are valid and complete.', error);
			throw new BadRequestException(
				'Failed to retrieve task sizes. Ensure that the provided parameters are valid and complete.',
				error
			);
		}
	}

	/**
	 * Create bulk task sizes for tenants.
	 * Uses saveManyWithoutEnrichment to preserve each entity's specific tenantId.
	 *
	 * @param tenants
	 */
	async bulkCreateTenantsTaskSizes(tenants: ITenant[]): Promise<ITaskSize[]> {
		try {
			if (!tenants?.length) {
				return [];
			}

			const sizes = tenants.flatMap((tenant) =>
				DEFAULT_GLOBAL_SIZES.map(
					(size) =>
						new TaskSize({
							...size,
							icon: `ever-icons/${size.icon}`,
							tenant,
							isSystem: false
						})
				)
			);

			return await this.saveManyWithoutEnrichment(sizes);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk task sizes for organization.
	 *
	 * @param organization
	 */
	async bulkCreateOrganizationTaskSizes(organization: IOrganization): Promise<ITaskSize[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { items = [] } = await super.fetchAll({ tenantId });

			const sizes = items.map(
				(item) =>
					new TaskSize({
						tenantId: item.tenantId,
						name: item.name,
						value: item.value,
						description: item.description,
						icon: item.icon,
						color: item.color,
						organization,
						isSystem: false
					})
			);

			return await this.saveMany(sizes);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk task sizes for specific organization entity.
	 *
	 * @param entity
	 * @returns
	 */
	async createBulkSizesByEntity(entity: Partial<ITaskSizeCreateInput>): Promise<ITaskSize[]> {
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
