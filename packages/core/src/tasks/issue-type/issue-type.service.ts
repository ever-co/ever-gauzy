import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, SelectQueryBuilder } from 'typeorm';
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
		@InjectRepository(IssueType)
		readonly typeOrmIssueTypeRepository: TypeOrmIssueTypeRepository,

		readonly mikroOrmIssueTypeRepository: MikroOrmIssueTypeRepository,

		@InjectConnection()
		readonly knexConnection: KnexConnection
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
			where: {
				isSystem: false
			}
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
					source.map(({ name, value, description, icon, color, imageId = null }: IIssueType) => ({
						name,
						value,
						description,
						icon,
						color,
						imageId,
						tenant,
						isDefault: false,
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
						organization,
						isDefault: false,
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
					const { name, value, description, icon, color, imageId } = item;
					// Create and return the issue type
					return await this.create({
						...entity,
						name,
						value,
						description,
						icon,
						color,
						imageId,
						isDefault: false,
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
	 * @description
	 * @param id - the id of issue type to make as default
	 * @param entity - input that includes options useful for filters when search issues types items
	 * @returns A Promise resolving to an array of updated issue types (IIssueType[]).
	 * @throws HttpException if an error occurs during the creation process.
	 */
	async makeIssueTypeAsDefault(id: IIssueType['id'], entity: IIssueTypeUpdateInput): Promise<IIssueType[]> {
		try {
			const { organizationId, organizationTeamId, projectId } = entity;
			const tenantId = RequestContext.currentTenantId();

			// Fetch items based on tenant, organization, team and project
			const { items = [] } = await super.fetchAll({ tenantId, organizationId, organizationTeamId, projectId });

			// Use Promise.all to concurrently update issue types isDefault for each item
			const updatedIssueTypes = await Promise.all(
				items.map(async (item: IIssueType) => {
					// if the item matches, then make it as default
					if (item.id === id) {
						item.isDefault = true;
						return await this.save(item);
					}

					// Preload all of item's fields, update isDefault status and save it
					const notDefaultIssueType = await this.typeOrmRepository.preload({ ...item, isDefault: false });
					return await this.save(notDefaultIssueType);
				})
			);
			return updatedIssueTypes;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
