import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { IOrganizationProjectsFindInput } from '@gauzy/contracts';
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

	async findByEmployee(
		id: string,
		findInput?: IOrganizationProjectsFindInput
	): Promise<any> {
		const tenantId = RequestContext.currentTenantId();
		const query = this.organizationProjectRepository.createQueryBuilder(
			'organization_project'
		);
		query
			.leftJoin('organization_project.members', 'member')
			.where('member.id = :id', { id })
			.andWhere(`${query.alias}.tenantId = :tenantId`, {
				tenantId
			});
		if (findInput && findInput['organizationId']) {
			const { organizationId } = findInput;
			query.andWhere(`${query.alias}.organizationId = :organizationId`, {
				organizationId
			});
		}
		if (findInput && findInput['organizationContactId']) {
			const { organizationContactId } = findInput;
			query.andWhere(
				`${query.alias}.organizationContactId = :organizationContactId`,
				{
					organizationContactId
				}
			);
		}
		return await query.getMany();
	}

	async updateTaskViewMode(id: string, taskViewMode: string): Promise<any> {
		const project = await this.organizationProjectRepository.findOne(id);
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
