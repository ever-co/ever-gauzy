import { Injectable } from '@nestjs/common';
import { Brackets, In, IsNull, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { isNotEmpty } from '@gauzy/common';
import {
	IEmployee,
	IOrganizationGithubRepository,
	IOrganizationProject,
	IOrganizationProjectsFindInput,
	IPagination
} from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { OrganizationProject } from './organization-project.entity';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmOrganizationProjectRepository } from './repository/type-orm-organization-project.repository';
import { MikroOrmOrganizationProjectRepository } from './repository/mikro-orm-organization-project.repository';

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
					query.andWhere(`${query.alias}.organizationContactId = :organizationContactId`, {
						organizationContactId
					});
				}

				if (isNotEmpty(organizationTeamId)) {
					query.andWhere(`project_team.id = :organizationTeamId`, {
						organizationTeamId
					});
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
		options: {
			organizationId: IOrganizationGithubRepository['id'];
			tenantId: IOrganizationGithubRepository['tenantId'];
			integrationId: IOrganizationGithubRepository['integrationId'];
			projectId?: IOrganizationProject['id'];
		}
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
					repository: {
						repositoryId,
						integrationId,
						organizationId,
						tenantId,
						isActive: true,
						isArchived: false,
						hasSyncEnabled: true
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
	 * Find synchronized organization projects with options and count their associated issues.
	 *
	 * @param options - Query and pagination options (optional).
	 * @returns A paginated list of synchronized organization projects with associated issue counts.
	 */
	async findSyncedProjects(
		options?: PaginationParams<OrganizationProject>
	): Promise<IPagination<OrganizationProject>> {
		// Create a query builder for the `OrganizationProject` entity
		const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

		// Set find options (skip, take, and relations)
		query.skip(options && options.skip ? options.take * (options.skip - 1) : 0);
		query.take(options && options.take ? options.take : 10);

		// Join with the `Repository` entity and left join with `Issue` entity
		query.innerJoinAndSelect(`${query.alias}.repository`, 'repository');
		query.leftJoin('repository.issues', 'issue');

		// Select and count issues, and group the result by project and repository
		query.addSelect('COUNT(issue.id)', 'issueCount');
		query.groupBy(`${query.alias}.id, repository.id`);

		// Define where conditions for the query
		query.where((qb: SelectQueryBuilder<OrganizationProject>) => {
			const tenantId = RequestContext.currentTenantId();
			qb.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), {
				tenantId
			});
			qb.andWhere(p(`"repository"."tenantId" = :tenantId`), {
				tenantId
			});

			if (options?.where) {
				for (const key of Object.keys(options.where)) {
					qb.andWhere(p(`"${query.alias}"."${key}" = :${key}`), { [key]: options.where[key] });
				}
				for (const key of Object.keys(options.where)) {
					qb.andWhere(p(`"repository"."${key}" = :${key}`), { [key]: options.where[key] });
				}
			}

			qb.andWhere(p(`"${query.alias}"."repositoryId" IS NOT NULL`));
		});

		// Log the SQL query (for debugging)
		// console.log(await query.getRawMany());

		// Execute the query and return the paginated result
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}
}
