import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like } from 'typeorm';
import { OrganizationDepartment } from './organization-department.entity';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmOrganizationDepartmentRepository } from './repository/type-orm-organization-department.repository';
import { MikroOrmOrganizationDepartmentRepository } from './repository/mikro-orm-organization-department.repository';

@Injectable()
export class OrganizationDepartmentService extends TenantAwareCrudService<OrganizationDepartment> {
	constructor(
		@InjectRepository(OrganizationDepartment)
		typeOrmOrganizationDepartmentRepository: TypeOrmOrganizationDepartmentRepository,

		mikroOrmOrganizationDepartmentRepository: MikroOrmOrganizationDepartmentRepository
	) {
		super(typeOrmOrganizationDepartmentRepository, mikroOrmOrganizationDepartmentRepository);
	}

	/**
	 *
	 * @param id
	 * @returns
	 */
	async findByEmployee(id: string): Promise<any> {
		return await this.typeOrmRepository
			.createQueryBuilder('organization_department')
			.leftJoin('organization_department.members', 'member')
			.where('member.id = :id', { id })
			.getMany();
	}

	/**
	 *
	 * @param filter
	 * @returns
	 */
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
