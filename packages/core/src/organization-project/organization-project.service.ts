import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, FindManyOptions, In, IsNull, Repository, WhereExpressionBuilder } from 'typeorm';
import { isNotEmpty } from '@gauzy/common';
import { IEmployee, IOrganizationProject, IOrganizationProjectsFindInput, IPagination } from '@gauzy/contracts';
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
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				const tenantId = RequestContext.currentTenantId();
				const { organizationId, organizationContactId } = options;

				qb.andWhere('member.id = :employeeId', { employeeId });
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });

				if (isNotEmpty(organizationContactId)) {
					query.andWhere(`${query.alias}.organizationContactId = :organizationContactId`, {
						organizationContactId
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
}
