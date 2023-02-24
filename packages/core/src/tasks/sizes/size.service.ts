import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { IOrganization, IPagination, ITaskSize, ITaskSizeCreateInput, ITaskSizeFindInput, ITenant } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { TaskStatusPrioritySizeService } from '../task-status-priority-size.service';
import { TaskSize } from './size.entity';
import { DEFAULT_GLOBAL_SIZES } from './default-global-sizes';

@Injectable()
export class TaskSizeService extends TaskStatusPrioritySizeService<TaskSize> {

	constructor(
		@InjectRepository(TaskSize)
		protected readonly taskSizeRepository: Repository<TaskSize>
	) {
		super(taskSizeRepository);
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
				isSystem: false,
			},
		});
	}

	/**
	 * GET task sizes by filters
	 * If parameters not match, retrieve global task sizes
	 *
	 * @param params
	 * @returns
	 */
	async findTaskSizes(
		params: ITaskSizeFindInput
	): Promise<IPagination<ITaskSize>> {
		try {
			return await this.findEntitiesByParams(params);
		} catch (error) {
			throw new BadRequestException(error);
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
					const create = this.repository.create({
						...size,
						icon: `ever-icons/${size.icon}`,
						tenant,
						isSystem: false
					});
					sizes.push(create);
				}
			}
			return await this.repository.save(sizes);
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
			const { items = [] } = await this.findEntitiesByParams({ tenantId });

			for (const item of items) {
				const { tenantId, name, value, description, icon, color } = item;

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
				sizes.push(create);
			}
			return await this.repository.save(sizes);
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
			const { items = [] } = await this.findEntitiesByParams({ tenantId, organizationId });

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
