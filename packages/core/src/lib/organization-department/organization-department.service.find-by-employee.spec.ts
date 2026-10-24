/**
 * `GET /organization-department/employee/:id` and the `organizationDepartmentsByEmployee` query answer the departments
 * of an employee through a query builder (TypeORM) and a raw find (MikroORM), which bypass the tenant scoping of
 * `TenantAwareCrudService`: an employee id of another tenant answered that tenant's departments. Both queries now carry
 * the caller's tenant.
 *
 * The base CRUD class reaches the entity barrel and with it the whole application graph, so it is doubled, as are the
 * request context and the repositories the service is built from.
 */
const mockContext = { tenantId: 'tenant-1' as string | null };
const mockOrm = { type: 'typeorm' };

jest.mock('./../core/crud', () => ({
	TenantAwareCrudService: class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository: any
		) {}
		get ormType() {
			return mockOrm.type;
		}
		serialize(entity: unknown) {
			return entity;
		}
	}
}));
jest.mock('./../core/context', () => ({ RequestContext: { currentTenantId: () => mockContext.tenantId } }));
jest.mock('./../core/utils', () => ({ MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' } }));
jest.mock('./organization-department.entity', () => ({ OrganizationDepartment: class OrganizationDepartment {} }));
jest.mock('./repository/type-orm-organization-department.repository', () => ({
	TypeOrmOrganizationDepartmentRepository: class TypeOrmOrganizationDepartmentRepository {}
}));
jest.mock('./repository/mikro-orm-organization-department.repository', () => ({
	MikroOrmOrganizationDepartmentRepository: class MikroOrmOrganizationDepartmentRepository {}
}));

import { OrganizationDepartmentService } from './organization-department.service';

describe('OrganizationDepartmentService.findByEmployee', () => {
	const build = () => {
		const queryBuilder = {
			leftJoin: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([])
		};
		const typeOrmRepository = { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) };
		const mikroOrmRepository = { find: jest.fn().mockResolvedValue([]) };
		const service = new OrganizationDepartmentService(typeOrmRepository as any, mikroOrmRepository as any);
		return { service, queryBuilder, typeOrmRepository, mikroOrmRepository };
	};

	beforeEach(() => {
		mockContext.tenantId = 'tenant-1';
		mockOrm.type = 'typeorm';
	});

	it("answers the employee's departments in the caller's tenant only (TypeORM)", async () => {
		const { service, queryBuilder } = build();

		await service.findByEmployee('employee-1');

		expect(queryBuilder.where).toHaveBeenCalledWith('member.id = :id', { id: 'employee-1' });
		expect(queryBuilder.andWhere).toHaveBeenCalledWith('organization_department.tenantId = :tenantId', {
			tenantId: 'tenant-1'
		});
	});

	it("answers the employee's departments in the caller's tenant only (MikroORM)", async () => {
		mockOrm.type = 'mikro-orm';
		const { service, mikroOrmRepository } = build();

		await service.findByEmployee('employee-1');

		expect(mikroOrmRepository.find).toHaveBeenCalledWith({ members: { id: 'employee-1' }, tenantId: 'tenant-1' });
	});

	it('answers no department, and queries nothing, without a tenant', async () => {
		mockContext.tenantId = null;
		const { service, typeOrmRepository, mikroOrmRepository } = build();

		expect(await service.findByEmployee('employee-1')).toEqual([]);
		expect(typeOrmRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(mikroOrmRepository.find).not.toHaveBeenCalled();
	});
});
