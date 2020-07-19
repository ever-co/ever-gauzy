import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationProjects } from './organization-projects.entity';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class OrganizationProjectsService extends TenantAwareCrudService<
	OrganizationProjects
> {
	constructor(
		@InjectRepository(OrganizationProjects)
		private readonly organizationProjectsRepository: Repository<
			OrganizationProjects
		>
	) {
		super(organizationProjectsRepository);
	}

	async findByEmployee(id: string): Promise<any> {
		return await this.organizationProjectsRepository
			.createQueryBuilder('organization_project')
			.leftJoin('organization_project.members', 'member')
			.where('member.id = :id', { id })
			.getMany();
	}

	async updateTaskViewMode(id: string, taskViewMode: string): Promise<any> {
		const project = await this.organizationProjectsRepository.findOne(id);
		project.taskListType = taskViewMode;
		return await this.organizationProjectsRepository.save(project);
	}
}
