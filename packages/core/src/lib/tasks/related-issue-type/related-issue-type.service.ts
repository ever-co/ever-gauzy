import { BadRequestException, Injectable } from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { Knex as KnexConnection } from 'knex';
import { InjectConnection } from 'nest-knexjs';
import {
	IOrganization,
	IPagination,
	ITaskRelatedIssueType,
	ITaskRelatedIssueTypeCreateInput,
	ITaskRelatedIssueTypeFindInput
} from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { TaskMetadataService } from '../task-metadata.service';
import { MultiORMEnum } from '../../core/utils';
import { RequestContext } from '../../core/context';
import { TaskRelatedIssueType } from './related-issue-type.entity';
import { TypeOrmTaskRelatedIssueTypeRepository } from './repository/type-orm-related-issue-type.repository';
import { MikroOrmTaskRelatedIssueTypeRepository } from './repository/mikro-orm-related-issue-type.repository';

@Injectable()
export class TaskRelatedIssueTypeService extends TaskMetadataService<TaskRelatedIssueType> {
	constructor(
		readonly typeOrmTaskRelatedIssueTypeRepository: TypeOrmTaskRelatedIssueTypeRepository,
		readonly mikroOrmTaskRelatedIssueTypeRepository: MikroOrmTaskRelatedIssueTypeRepository,
		@InjectConnection() readonly knexConnection: KnexConnection
	) {
		super(typeOrmTaskRelatedIssueTypeRepository, mikroOrmTaskRelatedIssueTypeRepository, knexConnection);
	}

	/**
	 * GET statuses by filters
	 * If parameters not match, retrieve global statuses
	 *
	 * @param params
	 * @returns
	 */
	async fetchAll(params: ITaskRelatedIssueTypeFindInput): Promise<IPagination<TaskRelatedIssueType>> {
		try {
			if (this.ormType == MultiORMEnum.TypeORM && isPostgres()) {
				return await super.fetchAllByKnex(params);
			} else {
				return await super.fetchAll(params);
			}
		} catch (error) {
			console.log(
				'Failed to retrieve related issue types for tasks. Please ensure that the provided parameters are valid and complete.',
				error
			);
			throw new BadRequestException(
				'Failed to retrieve related issue types for tasks. Please ensure that the provided parameters are valid and complete.',
				error
			);
		}
	}

	/**
	 * Few RelatedIssueTypes can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: ITaskRelatedIssueType['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: {
				isSystem: false
			}
		});
	}

	/**
	 * Create bulk related issue types for a specific organization.
	 *
	 * This method retrieves issue types for the tenant and creates
	 * organization-specific related issue types from them.
	 *
	 * @param organization The organization for which related issue types will be created.
	 * @returns Promise resolving to created related issue types.
	 */
	async bulkCreateOrganizationRelatedIssueTypes(organization: IOrganization): Promise<ITaskRelatedIssueType[]> {
		const tenantId = RequestContext.currentTenantId() ?? organization.tenantId;

		const { items = [] } = await super.fetchAll({ tenantId });

		if (!items.length) {
			return [];
		}

		const relatedIssueTypes: TaskRelatedIssueType[] = items.map(
			({ tenantId, name, value, description, icon, color }) =>
				new TaskRelatedIssueType({
					tenantId,
					name,
					value,
					description,
					icon,
					color,
					organization,
					isSystem: false
				})
		);

		return await this.saveMany(relatedIssueTypes);
	}

	/**
	 * Create bulk related issue types for a specific organization entity.
	 *
	 * @param entity Base entity input to use as a template for each related issue type.
	 * @returns A promise that resolves to an array of created related issue types.
	 */
	async createBulkRelatedIssueTypesByEntity(
		entity: Partial<ITaskRelatedIssueTypeCreateInput>
	): Promise<ITaskRelatedIssueType[]> {
		const tenantId = RequestContext.currentTenantId() ?? entity.tenantId;
		const organizationId = entity.organizationId;

		const { items = [] } = await super.fetchAll({ tenantId, organizationId });

		const relatedIssueTypes = items.map((item) => ({
			...entity,
			name: item.name,
			value: item.value,
			description: item.description,
			icon: item.icon,
			color: item.color,
			isSystem: false
		}));

		return await this.createMany(relatedIssueTypes);
	}
}
