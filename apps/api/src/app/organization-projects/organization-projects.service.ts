import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationProjects } from './organization-projects.entity';

@Injectable()
export class OrganizationProjectsService extends CrudService<
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
}
