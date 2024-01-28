import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { OrganizationDepartment } from './organization-department.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class OrganizationDepartmentService extends TenantAwareCrudService<OrganizationDepartment> {
	constructor(
		@InjectRepository(OrganizationDepartment)
		organizationDepartmentRepository: Repository<OrganizationDepartment>,
		@MikroInjectRepository(OrganizationDepartment)
		mikroOrganizationDepartmentRepository: EntityRepository<OrganizationDepartment>
	) {
		super(organizationDepartmentRepository, mikroOrganizationDepartmentRepository);
	}

	async findByEmployee(id: string): Promise<any> {
		return await this.repository
			.createQueryBuilder('organization_department')
			.leftJoin('organization_department.members', 'member')
			.where('member.id = :id', { id })
			.getMany();
	}

	public pagination(filter?: any) {
		if ('where' in filter) {
			const { where } = filter;
			if ('name' in where) {
				const { name } = where;
				filter.where.name = Like(`%${name}%`);
			}
			if ('tags' in where) {
				const { tags } = where;
				filter.where.tags = {
					id: In(tags)
				};
			}
		}
		return super.paginate(filter);
	}
}
