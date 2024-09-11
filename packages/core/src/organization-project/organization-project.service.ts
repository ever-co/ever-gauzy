import { Injectable } from '@nestjs/common';
import { Brackets, In, IsNull, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import {
	FavoriteTypeEnum,
	ID,
	IEmployee,
	IOrganizationGithubRepository,
	IOrganizationProject,
	IOrganizationProjectsFindInput,
	IPagination
} from '@gauzy/contracts';
import { getConfig } from '@gauzy/config';
import { CustomEmbeddedFieldConfig, isNotEmpty } from '@gauzy/common';
import { FavoriteService } from '../core/decorators';
import { PaginationParams, TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { OrganizationProject } from './organization-project.entity';
import { prepareSQLQuery as p } from './../database/database.helper';
import { MikroOrmOrganizationProjectRepository, TypeOrmOrganizationProjectRepository } from './repository';

@FavoriteService(FavoriteTypeEnum.PROJECT)
@Injectable()
export class OrganizationProjectService extends TenantAwareCrudService<OrganizationProject> {
	constructor(
		typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository,
		mikroOrmOrganizationProjectRepository: MikroOrmOrganizationProjectRepository
	) {
		super(typeOrmOrganizationProjectRepository, mikroOrmOrganizationProjectRepository);
	}

	/**
	 * Find employee assigned projects
	 *
	 * @param employeeId
	 * @param options
	 * @returns
	 */
	async findByEmployee(
		employeeId: IEmployee['id'],
		options: IOrganizationProjectsFindInput
	): Promise<IOrganizationProject[]> {
		const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
		query.setFindOptions({
			select: {
				id: true,
				name: true,
				imageUrl: true,
				currency: true,
				billing: true,
				public: true,
				owner: true,
				taskListType: true
			}
		});
		query.innerJoin(`${query.alias}.members`, 'member');
		query.leftJoin(`${query.alias}.teams`, 'project_team');
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				const tenantId = RequestContext.currentTenantId();
				const { organizationId, organizationContactId, organizationTeamId } = options;

				qb.andWhere(p('member.id = :employeeId'), { employeeId });
				qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

				if (isNotEmpty(organizationContactId)) {
					qb.andWhere(`${query.alias}.organizationContactId = :organizationContactId`, {
						organizationContactId
					});
				}

				if (isNotEmpty(organizationTeamId)) {
					qb.andWhere(`project_team.id = :organizationTeamId`, { organizationTeamId });
				}
			})
		);
		return await query.getMany();
	}

	/**
	 * Organization project override find all method
	 *
	 * @param filter
	 * @returns
	 */
	public async findAll(options?: PaginationParams<OrganizationProject>): Promise<IPagination<OrganizationProject>> {
		if ('where' in options) {
			const { where } = options;
			if (where.organizationContactId === 'null') {
				options.where.organizationContactId = IsNull();
			}
		}
		return await super.findAll(options);
	}

	/**
	 * Organization project override pagination method
	 *
	 * @param filter
	 * @returns
	 */
	public async pagination(
		options?: PaginationParams<OrganizationProject>
	): Promise<IPagination<OrganizationProject>> {
		if ('where' in options) {
			const { where } = options;
			if (where.tags) {
				options.where.tags = {
					id: In(where.tags as string[])
				};
			}
		}
		return await super.paginate(options);
	}

	/**
	 * Get organization projects associated with a specific repository.
	 *
	 * @param repositoryId - The ID of the repository.
	 * @param options - An object containing organization, tenant, and integration information.
	 * @returns A Promise that resolves to an array of organization projects.
	 */
	public async getProjectsByGithubRepository(
		repositoryId: IOrganizationGithubRepository['repositoryId'],
		options: { organizationId: ID; tenantId: ID; integrationId: ID; projectId?: ID }
	): Promise<IOrganizationProject[]> {
		try {
			const tenantId = RequestContext.currentTenantId() || options.tenantId;
			const { organizationId, projectId, integrationId } = options;

			// Attempt to retrieve the organization projects by the provided parameters.
			const projects = await this.typeOrmRepository.find({
				where: {
					...(projectId ? { id: projectId } : {}),
					organizationId,
					tenantId,
					customFields: {
						repository: {
							repositoryId,
							integrationId,
							organizationId,
							tenantId,
							isActive: true,
							isArchived: false,
							hasSyncEnabled: true
						}
					},
					isActive: true,
					isArchived: false
				}
			});
			return projects;
		} catch (error) {
			return [];
		}
	}

	/**
	 * Adds custom joins and selects based on the presence of custom fields.
	 *
	 * @param query - The TypeORM query builder instance.
	 * @param customFields - The array of custom fields.
	 * @returns The modified query builder instance.
	 */
	addCustomFieldJoins<T>(
		query: SelectQueryBuilder<T>,
		customFields: CustomEmbeddedFieldConfig[]
	): SelectQueryBuilder<T> {
		const hasRepositoryField = customFields.some((field: CustomEmbeddedFieldConfig) => field.name === 'repository');

		if (hasRepositoryField) {
			// Join with the `Repository` entity and left join with `Issue` entity
			query.innerJoinAndSelect(`${query.alias}.customFields.repository`, 'repository');
			query.leftJoin('repository.issues', 'issue');

			// Select and count issues, and group the result by project and repository
			query.addSelect('COUNT(issue.id)', 'issueCount');
			query.groupBy(`${query.alias}.id, repository.id`);
		}

		return query;
	}

	/**
	 * Adds custom where conditions based on provided options and tenant ID.
	 *
	 * @param query - The TypeORM query builder instance.
	 * @param tenantId - The tenant ID to be used in the where conditions.
	 * @param options - Additional options containing where conditions.
	 * @returns The modified query builder instance.
	 */
	addWhereConditions<T>(
		query: SelectQueryBuilder<T>,
		options?: { where?: Record<string, any> }
	): SelectQueryBuilder<T> {
		const tenantId = RequestContext.currentTenantId();

		// Define where conditions for the query
		query.where((qb: SelectQueryBuilder<OrganizationProject>) => {
			qb.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });

			// Conditionally add repository tenantId condition only if repository is joined
			if (query.expressionMap.joinAttributes.some((ja) => ja.alias.name === 'repository')) {
				qb.andWhere(p(`"repository"."tenantId" = :tenantId`), { tenantId });
			}

			if (options?.where) {
				for (const key of Object.keys(options.where)) {
					qb.andWhere(p(`"${qb.alias}"."${key}" = :${key}`), { [key]: options.where[key] });

					// Conditionally add where conditions for repository if it's joined
					if (query.expressionMap.joinAttributes.some((ja) => ja.alias.name === 'repository')) {
						qb.andWhere(p(`"repository"."${key}" = :${key}`), { [key]: options.where[key] });
					}
				}
			}

			qb.andWhere(p(`"${qb.alias}"."repositoryId" IS NOT NULL`));
		});

		return query;
	}

	/**
	 * Find synchronized organization projects with options and count their associated issues.
	 *
	 * @param options - Query and pagination options (optional).
	 * @returns A paginated list of synchronized organization projects with associated issue counts.
	 */
	async findSyncedProjects(
		options?: PaginationParams<OrganizationProject>
	): Promise<IPagination<OrganizationProject>> {
		// Get the list of custom fields for the specified entity, defaulting to an empty array if none are found
		const customFields = getConfig().customFields?.['OrganizationProject'] ?? [];

		// Create a query builder for the `OrganizationProject` entity
		const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

		// Set find options (skip, take, and relations)
		query.skip(options && options.skip ? options.take * (options.skip - 1) : 0);
		query.take(options && options.take ? options.take : 10);

		// Conditionally add joins based on custom fields
		this.addCustomFieldJoins(query, customFields);

		// Add where conditions
		this.addWhereConditions(query, options);

		// Log the SQL query (for debugging)
		// console.log(await query.getRawMany());

		// Execute the query and return the paginated result
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}
}
