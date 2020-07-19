import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationDepartment } from './organization-department.entity';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class OrganizationDepartmentService extends TenantAwareCrudService<
	OrganizationDepartment
> {
	constructor(
		@InjectRepository(OrganizationDepartment)
		private readonly organizationDepartmentRepository: Repository<
			OrganizationDepartment
		>
	) {
		super(organizationDepartmentRepository);
	}

	async findByEmployee(id: string): Promise<any> {
		return await this.organizationDepartmentRepository
			.createQueryBuilder('organization_department')
			.leftJoin('organization_department.members', 'member')
			.where('member.id = :id', { id })
			.getMany();
	}
}
