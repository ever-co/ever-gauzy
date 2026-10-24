import { Injectable } from '@nestjs/common';
import { In, Like } from 'typeorm';
import { OrganizationDepartment } from './organization-department.entity';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { MultiORMEnum } from './../core/utils';
import { TypeOrmOrganizationDepartmentRepository } from './repository/type-orm-organization-department.repository';
import { MikroOrmOrganizationDepartmentRepository } from './repository/mikro-orm-organization-department.repository';

@Injectable()
export class OrganizationDepartmentService extends TenantAwareCrudService<OrganizationDepartment> {
	constructor(
		typeOrmOrganizationDepartmentRepository: TypeOrmOrganizationDepartmentRepository,
		mikroOrmOrganizationDepartmentRepository: MikroOrmOrganizationDepartmentRepository
	) {
		super(typeOrmOrganizationDepartmentRepository, mikroOrmOrganizationDepartmentRepository);
	}

	/**
	 * The departments of an employee, in the caller's tenant.
	 *
	 * Both queries bypass the scoping of `TenantAwareCrudService`, and an employee id is not a secret (public team
	 * pages show them): without the tenant condition, an employee id of another tenant answered that tenant's
	 * departments (GHSA-gwpq-mmw7-vx85 class). No tenant in the request context, no departments.
	 *
	 * @param id The employee.
	 * @returns The departments the employee is a member of.
	 */
	async findByEmployee(id: string): Promise<any> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			return [];
		}
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const items = await this.mikroOrmRepository.find({ members: { id }, tenantId } as any);
				return items.map((e) => this.serialize(e));
			}
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmRepository
					.createQueryBuilder('organization_department')
					.leftJoin('organization_department.members', 'member')
					.where('member.id = :id', { id })
					.andWhere('organization_department.tenantId = :tenantId', { tenantId })
					.getMany();
		}
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
