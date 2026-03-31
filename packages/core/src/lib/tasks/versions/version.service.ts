import { BadRequestException, Injectable } from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { Knex as KnexConnection } from 'knex';
import { InjectConnection } from 'nest-knexjs';
import {
	IOrganization,
	IPagination,
	ITaskVersion,
	ITaskVersionCreateInput,
	ITaskVersionFindInput,
	ITenant
} from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { TaskMetadataService } from '../task-metadata.service';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { TaskVersion } from './version.entity';
import { DEFAULT_GLOBAL_VERSIONS } from './default-global-versions';
import { MikroOrmTaskVersionRepository } from './repository/mikro-orm-task-version.repository';
import { TypeOrmTaskVersionRepository } from './repository/type-orm-task-version.repository';

@Injectable()
export class TaskVersionService extends TaskMetadataService<TaskVersion> {
	constructor(
		readonly typeOrmTaskVersionRepository: TypeOrmTaskVersionRepository,
		readonly mikroOrmTaskVersionRepository: MikroOrmTaskVersionRepository,
		@InjectConnection() readonly knexConnection: KnexConnection
	) {
		super(typeOrmTaskVersionRepository, mikroOrmTaskVersionRepository, knexConnection);
	}

	/**
	 * GET versions by filters
	 * If parameters not match, retrieve global versions
	 *
	 * @param params
	 * @returns
	 */
	async fetchAll(params: ITaskVersionFindInput): Promise<IPagination<TaskVersion>> {
		try {
			if (this.ormType == MultiORMEnum.TypeORM && isPostgres()) {
				return await super.fetchAllByKnex(params);
			} else {
				return await super.fetchAll(params);
			}
		} catch (error) {
			console.log(
				'Failed to retrieve task versions. Ensure that the provided parameters are valid and complete.',
				error
			);
			throw new BadRequestException(
				'Failed to retrieve task versions. Ensure that the provided parameters are valid and complete.',
				error
			);
		}
	}

	/**
	 * Few Versions can't be removed/delete because they are global
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
	 * Creates default task versions for multiple tenants.
	 *
	 * @param tenants Array of tenants for which task versions should be created.
	 * @returns Promise resolving to an array of created task versions.
	 */
	async bulkCreateTenantsVersions(tenants: ITenant[]): Promise<TaskVersion[]> {
		if (!tenants?.length) {
			return [];
		}

		const versions: TaskVersion[] = tenants.flatMap((tenant: ITenant) =>
			DEFAULT_GLOBAL_VERSIONS.map(
				(version) =>
					new TaskVersion({
						...version,
						icon: `ever-icons/${version.icon}`,
						isSystem: false,
						tenant
					})
			)
		);

		return await this.saveManyWithoutEnrichment(versions);
	}

	/**
	 * Creates default task versions for a specific organization.
	 *
	 * @param organization The organization for which task versions will be created.
	 * @returns A promise that resolves to an array of created task versions.
	 */
	async bulkCreateOrganizationVersions(organization: IOrganization): Promise<ITaskVersion[] & TaskVersion[]> {
		const tenantId = RequestContext.currentTenantId();
		const { items = [] } = await super.fetchAll({ tenantId });

		const versions = items.map(
			(item) =>
				new TaskVersion({
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

		return (await this.saveMany(versions)) as ITaskVersion[] & TaskVersion[];
	}

	/**
	 * Creates bulk task versions for a specific organization entity.
	 *
	 * @param entity Base entity input to use as a template for each version.
	 * @returns A promise that resolves to an array of created task versions.
	 */
	async createBulkVersionsByEntity(entity: Partial<ITaskVersionCreateInput>): Promise<ITaskVersion[]> {
		const tenantId = RequestContext.currentTenantId() ?? entity.tenantId;
		const organizationId = entity.organizationId;

		const { items = [] } = await this.fetchAll({ tenantId, organizationId });

		const versions = items.map((item) => ({
			...entity,
			name: item.name,
			value: item.value,
			description: item.description,
			icon: item.icon,
			color: item.color,
			isSystem: false
		}));

		return await this.createMany(versions);
	}
}
