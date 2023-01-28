import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { IOrganizationProject, IPagination, ITaskSize, ITaskSizeFindInput, ITenant } from '@gauzy/contracts';
import { SharedPrioritySizeService } from './../../tasks/shared-priority-size.service';
import { TaskSize } from './size.entity';
import { DEFAULT_GLOBAL_SIZES } from './default-global-sizes';

@Injectable()
export class TaskSizeService extends SharedPrioritySizeService<TaskSize> {

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
		return await this.findAllTaskShared(params);
	}

	/**
	 * Create bulk task sizes for specific tenants
	 *
	 * @param tenants '
	 */
	async bulkCreateTenantsTaskSizes(tenants: ITenant[]): Promise<ITaskSize[]> {
		const sizes: ITaskSize[] = [];
		for (const tenant of tenants) {
			for (const size of DEFAULT_GLOBAL_SIZES) {
				const create = this.repository.create({
					...size,
					tenant,
					isSystem: false
				});
				sizes.push(create);
			}
		}
		return await this.repository.save(sizes);
	}

	/**
	 * Create bulk task sizes for specific organization project
	 *
	 * @param project
	 * @returns
	 */
	async bulkCreateOrganizationProjectSize(project: IOrganizationProject): Promise<ITaskSize[]> {
		try {
			const sizes: ITaskSize[] = [];

			const { tenantId, organizationId } = project;
			const { items = [] } = await this.findAllTaskShared({ tenantId, organizationId });

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
				sizes.push(create);
			}
			return await this.repository.save(sizes);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
