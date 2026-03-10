import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, SelectQueryBuilder } from 'typeorm';
import { Knex as KnexConnection } from 'knex';
import { InjectConnection } from 'nest-knexjs';
import {
	IIssueType,
	IIssueTypeCreateInput,
	IIssueTypeFindInput,
	IIssueTypeUpdateInput,
	IOrganization,
	IPagination,
	ITenant
} from '@gauzy/contracts';
import { IssueType } from './issue-type.entity';
import { TaskMetadataService } from './../task-metadata.service';
import { DEFAULT_GLOBAL_ISSUE_TYPES } from './default-global-issue-types';
import { RequestContext } from './../../core/context';
import { MultiORMEnum } from './../../core/utils';
import { MikroOrmIssueTypeRepository } from './repository/mikro-orm-issue-type.repository';
import { TypeOrmIssueTypeRepository } from './repository/type-orm-issue-type.repository';

@Injectable()
export class IssueTypeService extends TaskMetadataService<IssueType> {
	readonly logger = new Logger(IssueTypeService.name);

	constructor(
		readonly typeOrmIssueTypeRepository: TypeOrmIssueTypeRepository,
		readonly mikroOrmIssueTypeRepository: MikroOrmIssueTypeRepository,
		@InjectConnection() readonly knexConnection: KnexConnection
	) {
		super(typeOrmIssueTypeRepository, mikroOrmIssueTypeRepository, knexConnection);
	}

	/**
	 * Few issue types can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: IIssueType['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: { isSystem: false }
		});
	}

	/**
	 * Fetches issue types based on specified parameters.
	 *
	 * @param params - Parameters for finding issue types (IIssueTypeFindInput).
	 * @returns A Promise resolving to an object with items (array of issue types) and total count.
	 * @throws Error if no records are found or an error occurs during the query.
	 */
	public async fetchAll(params: IIssueTypeFindInput): Promise<IPagination<IIssueType>> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					// Check at least one record exists with given params
					const checkWhere = this.buildIssueTypeFilter(params);
					const exists = await this.mikroOrmRepository.findOne(checkWhere as any);
					if (!exists) {
						return await this.getDefaultEntities();
					}

					const [items, total] = await this.mikroOrmRepository.findAndCount(checkWhere as any);
					return { items: items.map((e) => this.serialize(e)) as IIssueType[], total };
				}
				case MultiORMEnum.TypeORM:
				default: {
					/**
					 * Find at least one record or get global records
					 */
					const cqb = this.typeOrmIssueTypeRepository.createQueryBuilder(this.tableName);
					cqb.where((qb: SelectQueryBuilder<IssueType>) => {
						this.getFilterQuery(qb, params);
					});
					await cqb.getOneOrFail();

					/**
					 * Find task issue types for given params
					 */
					const query = this.typeOrmIssueTypeRepository.createQueryBuilder(this.tableName);
					query.where((qb: SelectQueryBuilder<IssueType>) => {
						this.getFilterQuery(qb, params);
					});
					const [items, total] = await query.getManyAndCount();
					return { items, total };
				}
			}
		} catch (error) {
			this.logger.error('Invalid request parameter: Some required parameters are missing or incorrect', error);
			return await this.getDefaultEntities();
		}
	}

	/**
	 * Build a MikroORM-compatible filter object from IIssueTypeFindInput params.
	 */
	private buildIssueTypeFilter(params: IIssueTypeFindInput): Record<string, any> {
		const where: Record<string, any> = {};
		if ((params as any).tenantId) where.tenantId = (params as any).tenantId;
		if ((params as any).organizationId) where.organizationId = (params as any).organizationId;
		if ((params as any).organizationTeamId) where.organizationTeamId = (params as any).organizationTeamId;
		if ((params as any).projectId) where.projectId = (params as any).projectId;
		return where;
	}

	/**
	 * Create issue types for a list of tenants using DEFAULT_GLOBAL_ISSUE_TYPES.
	 *
	 * @param tenants The list of tenants.
	 * @returns A promise resolving to an array of created issue types.
	 */
	async bulkCreateTenantsIssueTypes(tenants: ITenant[]): Promise<IIssueType[]> {
		try {
			if (!tenants?.length) {
				return [];
			}

			/**
			 * Cartesian product of tenants and default global issue types.
			 */
			const issueTypes: IssueType[] = tenants.flatMap((tenant: ITenant) =>
				DEFAULT_GLOBAL_ISSUE_TYPES.map(
					(issueType: IIssueType) =>
						new IssueType({
							name: issueType.name,
							value: issueType.value,
							description: issueType.description,
							icon: `ever-icons/${issueType.icon}`,
							color: issueType.color,
							imageId: issueType.imageId ?? null,
							isDefault: issueType.isDefault,
							tenant,
							isSystem: false
						})
				)
			);

			/**
			 * Use saveManyWithoutEnrichment to preserve each entity's specific tenantId.
			 */
			return await this.saveManyWithoutEnrichment(issueTypes);
		} catch (error) {
			throw new BadRequestException(
				'Failed to create issue types for the specified tenants.',
				error
			);
		}
	}

	/**
	 * Create bulk issue types for organization
	 *
	 * @param organization
	 */
	async bulkCreateOrganizationIssueType(organization: IOrganization): Promise<IIssueType[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { items = [] } = await super.fetchAll({ tenantId });

			// Use map to generate issue types for each item.
			const issueTypes: IIssueType[] = items.map(
				(item: IIssueType) =>
					new IssueType({
						tenantId,
						name: item.name,
						value: item.value,
						description: item.description,
						icon: item.icon,
						color: item.color,
						imageId: item.imageId,
						isDefault: item.isDefault,
						organization,
						isSystem: false
					})
			);

			/**
			 * Save statuses without tenant enrichment to preserve
			 * the original tenantId assigned to each entity.
			 */
			return await this.saveManyWithoutEnrichment(issueTypes);
		} catch (error) {
			throw new BadRequestException(
				'Failed to create or fetch issue types for the specified tenants. Some required parameters are missing or incorrect.',
				error
			);
		}
	}

	/**
	 * Create bulk issue types for a specific organization entity.
	 *
	 * @param entity - Partial input for creating issue types (Partial<IIssueTypeCreateInput>).
	 * @returns A Promise resolving to an array of created issue types (IIssueType[]).
	 * @throws HttpException if an error occurs during the creation process.
	 */
	async createBulkIssueTypeByEntity(entity: Partial<IIssueTypeCreateInput>): Promise<IIssueType[]> {
		try {
			const { organizationId } = entity;
			const tenantId = RequestContext.currentTenantId();

			// Fetch items based on tenant and organizationId
			const { items = [] } = await super.fetchAll({ tenantId, organizationId });

			const entitiesToCreate = items.map((item: IIssueType) => ({
				...entity,
				name: item.name,
				value: item.value,
				description: item.description,
				icon: item.icon,
				color: item.color,
				imageId: item.imageId,
				isDefault: item.isDefault,
				isSystem: false
			}));
			return await this.createMany(entitiesToCreate);
		} catch (error) {
			// If an error occurs, throw an HttpException with a more specific message.
			throw new HttpException(
				'Failed to create bulk issue types for the organization entity.',
				HttpStatus.BAD_REQUEST
			);
		}
	}

	/**
	 * Marks an issue type as default and updates other issue types accordingly.
	 *
	 * @param id The ID of the issue type to mark as default.
	 * @param input An object containing input parameters, including organization, team, and project IDs.
	 * @returns A Promise that resolves to an array of updated issue types.
	 */
	async markAsDefault(id: IIssueType['id'], input: IIssueTypeUpdateInput): Promise<IIssueType[]> {
		try {
			const { organizationId, organizationTeamId, projectId } = input;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			// Find the issue type by ID
			const issueType: IIssueType = await this.findOneByIdString(id, { where: { isSystem: false } });

			// Update the issue type to mark it as default
			issueType.isDefault = true;

			// Define options to find issue types to update
			const findOptions: FindOptionsWhere<IssueType> = {
				...(organizationId ? { organizationId } : {}),
				...(organizationTeamId ? { organizationTeamId } : {}),
				...(projectId ? { projectId } : {}),
				tenantId,
				isSystem: false
			};

			// Update other issue types to mark them as non-default
			await super.update(findOptions, { isDefault: false });

			// Save the updated issue type
			await super.save(issueType);

			// Fetch and return all issue types based on the specified parameters
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
