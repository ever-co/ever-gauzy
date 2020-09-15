import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { OrganizationProject } from './organization-projects.entity';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class OrganizationProjectsService extends TenantAwareCrudService<
	OrganizationProject
> {
	constructor(
		@InjectRepository(OrganizationProject)
		private readonly organizationProjectsRepository: Repository<
			OrganizationProject
		>
	) {
		super(organizationProjectsRepository);
	}

	async findByEmployee(
		id: string,
		filter?: FindManyOptions<OrganizationProject>
	): Promise<any> {
		const query = this.organizationProjectsRepository
			.createQueryBuilder('organization_project')
			.leftJoin('organization_project.members', 'member');
		if (filter && filter.where) {
			query.where(filter.where);
		}
		query.andWhere('member.id = :id', { id });

		return await query.getMany();
	}

	async updateTaskViewMode(id: string, taskViewMode: string): Promise<any> {
		const project = await this.organizationProjectsRepository.findOne(id);
		project.taskListType = taskViewMode;
		return await this.organizationProjectsRepository.save(project);
	}
}
