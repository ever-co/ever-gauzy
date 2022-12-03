import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, WhereExpressionBuilder } from 'typeorm';
import { isNotEmpty } from '@gauzy/common';
import { IEmployee, IOrganizationProject, IOrganizationProjectsFindInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
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

	async updateTaskViewMode(id: string, taskViewMode: string): Promise<any> {
		const project = await this.organizationProjectRepository.findOneBy({ id });
		project.taskListType = taskViewMode;
		return await this.organizationProjectRepository.save(project);
	}

	public pagination(filter?: any) {
		if ('where' in filter) {
			const { where } = filter;
			if (where.tags) {
				filter.where.tags = {
					id: In(where.tags)
				}
			}
		}
		return super.paginate(filter);
	}
}
