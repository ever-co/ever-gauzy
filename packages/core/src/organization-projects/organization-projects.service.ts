import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationProject } from './organization-projects.entity';
import { TenantAwareCrudService } from './../core/crud';
import { IOrganizationProjectsFindInput } from '@gauzy/contracts';
import { RequestContext } from '../core/context';

@Injectable()
export class OrganizationProjectsService extends TenantAwareCrudService<OrganizationProject> {
	constructor(
		@InjectRepository(OrganizationProject)
		private readonly organizationProjectsRepository: Repository<OrganizationProject>
	) {
		super(organizationProjectsRepository);
	}

	async findByEmployee(
		id: string,
		findInput?: IOrganizationProjectsFindInput
	): Promise<any> {
		const tenantId = RequestContext.currentTenantId();
		const query = this.organizationProjectsRepository.createQueryBuilder(
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
		const project = await this.organizationProjectsRepository.findOne(id);
		project.taskListType = taskViewMode;
		return await this.organizationProjectsRepository.save(project);
	}
}
