import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Not, Repository, WhereExpressionBuilder } from 'typeorm';
import { isNotEmpty } from '@gauzy/common';
import { IEmployee, IOrganizationGithubRepository, IOrganizationProject, IOrganizationProjectsFindInput, IPagination } from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { OrganizationProject } from './organization-project.entity';

@Injectable()
export class OrganizationProjectService extends TenantAwareCrudService<OrganizationProject> {
	constructor(
		@InjectRepository(OrganizationProject)
		private readonly organizationProjectRepository: Repository<OrganizationProject>
	) {
		super(organizationProjectRepository);
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
		const query = this.organizationProjectRepository.createQueryBuilder(this.alias);
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

				qb.andWhere('member.id = :employeeId', { employeeId });
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });

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
	public async findAll(
		options?: PaginationParams<OrganizationProject>
	): Promise<IPagination<OrganizationProject>> {
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
				}
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
			const projects = await this.organizationProjectRepository.find({
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
						isArchived: false
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
	 * Find all synchronized organization projects with the specified options.
	 *
	 * @param repository - The repository for the OrganizationProject entity.
	 * @param options - Query and pagination options (optional).
	 * @returns A paginated list of synchronized organization projects.
	 */
	async findSyncedProjects(options?: PaginationParams<OrganizationProject>): Promise<IPagination<OrganizationProject>> {
		const whereConditions = {
			...options?.where,
			repositoryId: Not(IsNull())
		};

		return await this.paginate({
			...options,
			where: whereConditions,
		});
	}
}
