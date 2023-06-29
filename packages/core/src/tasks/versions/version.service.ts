import { DeleteResult, Repository } from 'typeorm';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	IOrganization,
	IPagination,
	ITaskVersion,
	ITaskVersionCreateInput,
	ITaskVersionFindInput,
	ITenant
} from '@gauzy/contracts';
import { TaskStatusPrioritySizeService } from '../task-status-priority-size.service';
import { RequestContext } from '../../core/context';
import { TaskVersion } from './version.entity';
import { DEFAULT_GLOBAL_VERSIONS } from './default-global-versions';

@Injectable()
export class TaskVersionService extends TaskStatusPrioritySizeService<TaskVersion> {
	constructor(
		@InjectRepository(TaskVersion)
		protected readonly taskVersionsRepository: Repository<TaskVersion>
	) {
		super(taskVersionsRepository);
	}

	/**
	 * GET versionses by filters
	 * If parameters not match, retrieve global versionses
	 *
	 * @param params
	 * @returns
	 */
	async findTaskVersiones(params: ITaskVersionFindInput): Promise<IPagination<TaskVersion>> {
		try {
			return await this.findEntitiesByParams(params);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Few Versionses can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: ITaskVersion['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: {
				isSystem: false
			}
		});
	}

	/**
	 * Create bulk versionses for specific tenants
	 *
	 * @param tenants '
	 */
	async bulkCreateTenantsVersions(tenants: ITenant[]): Promise<ITaskVersion[] & TaskVersion[]> {
		const versionses: ITaskVersion[] = [];
		for (const tenant of tenants) {
			for (const versions of DEFAULT_GLOBAL_VERSIONS) {
				versionses.push(
					new TaskVersion({
						...versions,
						icon: `ever-icons/${versions.icon}`,
						isSystem: false,
						tenant
					})
				);
			}
		}
		return await this.repository.save(versionses);
	}

	/**
	 * Create bulk versionses for specific organization
	 *
	 * @param organization
	 */
	async bulkCreateOrganizationVersions(organization: IOrganization): Promise<ITaskVersion[] & TaskVersion[]> {
		try {
			const versionses: ITaskVersion[] = [];

			const tenantId = RequestContext.currentTenantId();
			const { items = [] } = await this.findEntitiesByParams({
				tenantId
			});

			for (const item of items) {
				const { tenantId, name, value, description, icon, color } = item;
				const versions = new TaskVersion({
					tenantId,
					name,
					value,
					description,
					icon,
					color,
					organization,
					isSystem: false
				});
				versionses.push(versions);
			}
			return await this.repository.save(versionses);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk versions for specific organization entity
	 *
	 * @param entity
	 * @returns
	 */
	async createBulkVersionsByEntity(entity: Partial<ITaskVersionCreateInput>): Promise<ITaskVersion[]> {
		try {
			const { organizationId } = entity;
			const tenantId = RequestContext.currentTenantId();

			const versionses: ITaskVersion[] = [];
			const { items = [] } = await this.findEntitiesByParams({
				tenantId,
				organizationId
			});

			for (const item of items) {
				const { name, value, description, icon, color } = item;

				const versions = await this.create({
					...entity,
					name,
					value,
					description,
					icon,
					color,
					isSystem: false
				});
				versionses.push(versions);
			}

			return versionses;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
