import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
import { TaskStatusPrioritySizeService } from './../task-status-priority-size.service';
import { DEFAULT_GLOBAL_ISSUE_TYPES } from './default-global-issue-types';
import { RequestContext } from './../../core/context';
import { MikroOrmIssueTypeRepository } from './repository/mikro-orm-issue-type.repository';
import { TypeOrmIssueTypeRepository } from './repository/type-orm-issue-type.repository';

@Injectable()
export class IssueTypeService extends TaskStatusPrioritySizeService<IssueType> {
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
		} catch (error) {
			console.log('Invalid request parameter: Some required parameters are missing or incorrect', error);
			return await this.getDefaultEntities();
		}
	}

	/**
	 * Create or fetch issue types for a list of tenants.
	 *
	 * @param tenants The list of tenants.
	 * @returns A promise resolving to an array of created or fetched issue types.
	 */
	async bulkCreateTenantsIssueTypes(tenants: ITenant[]): Promise<IIssueType[]> {
		try {
			// Fetch existing issue types
			const { items = [], total } = await super.fetchAll({});

			// Define default issue types
			const defaultIssueTypes = DEFAULT_GLOBAL_ISSUE_TYPES.map((issueType: IIssueType) => ({
				...issueType,
				icon: `ever-icons/${issueType.icon}`,
				isSystem: false
			}));

			// Function to generate issue types based on a source array
			const generateIssueTypes = (source: IIssueType[]) =>
				tenants.flatMap((tenant) =>
					source.map(({ name, value, description, icon, color, isDefault, imageId = null }: IIssueType) => ({
						name,
						value,
						description,
						icon,
						color,
						imageId,
						tenant,
						isDefault,
						isSystem: false
					}))
				);

			// Generate the array of issue types based on existing or default values
			const issueTypes: IIssueType[] =
				total > 0 ? generateIssueTypes(items) : generateIssueTypes(defaultIssueTypes);

			// Save the created or fetched issue types to the repository and return the result.
			return await this.typeOrmRepository.save(issueTypes);
		} catch (error) {
			throw new BadRequestException(
				'Failed to create or fetch issue types for the specified tenants. Some required parameters are missing or incorrect.',
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
			return await this.typeOrmRepository.save(issueTypes);
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

			// Use Promise.all to concurrently create issue types for each item
			// Wait for all issue types to be created and resolve the promises
			const issueTypes = await Promise.all(
				items.map(async (item: IIssueType) => {
					const { name, value, description, icon, color, imageId, isDefault } = item;
					// Create and return the issue type
					return await this.create({
						...entity,
						name,
						value,
						description,
						icon,
						color,
						imageId,
						isDefault,
						isSystem: false
					});
				})
			);
			return issueTypes;
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
