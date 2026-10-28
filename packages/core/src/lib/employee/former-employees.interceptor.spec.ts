import '../core/entities/internal';

import { lastValueFrom, of } from 'rxjs';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { FormerEmployeesInterceptor } from './former-employees.interceptor';
import { OrganizationTeamController } from '../organization-team/organization-team.controller';
import { OrganizationTeamResolver } from '../organization-team/organization-team.resolver';
import { OrganizationSprintController } from '../organization-sprint/organization-sprint.controller';
import { OrganizationSprintResolver } from '../organization-sprint/organization-sprint.resolver';
import { OrganizationProjectModuleController } from '../organization-project-module/organization-project-module.controller';
import { OrganizationProjectModuleResolver } from '../organization-project-module/organization-project-module.resolver';
import { OrganizationDepartmentController } from '../organization-department/organization-department.controller';
import { OrganizationDepartmentResolver } from '../organization-department/organization-department.resolver';
import { OrganizationContactController } from '../organization-contact/organization-contact.controller';
import { OrganizationContactResolver } from '../organization-contact/organization-contact.resolver';

/**
 * Every surface that answers a member list leaves the employees whose work ended out of it: the REST routes and
 * the GraphQL fields of teams (the Teams page, Ever Teams), sprints, project modules, departments and clients.
 */
describe('FormerEmployeesInterceptor', () => {
	it.each([
		['OrganizationTeamController', OrganizationTeamController],
		['OrganizationTeamResolver', OrganizationTeamResolver],
		['OrganizationSprintController', OrganizationSprintController],
		['OrganizationSprintResolver', OrganizationSprintResolver],
		['OrganizationProjectModuleController', OrganizationProjectModuleController],
		['OrganizationProjectModuleResolver', OrganizationProjectModuleResolver],
		['OrganizationDepartmentController', OrganizationDepartmentController],
		['OrganizationDepartmentResolver', OrganizationDepartmentResolver],
		['OrganizationContactController', OrganizationContactController],
		['OrganizationContactResolver', OrganizationContactResolver]
	])('is mounted on %s', (_name, surface) => {
		expect(Reflect.getMetadata(INTERCEPTORS_METADATA, surface)).toContain(FormerEmployeesInterceptor);
	});

	it('filters the answer with the application’s EmployeeService', async () => {
		const employeeService = { findWorkingEmployeeIds: jest.fn(async () => new Set(['employee-a'])) };
		const moduleRef = { get: jest.fn(() => employeeService) };
		const interceptor = new FormerEmployeesInterceptor(moduleRef as never);
		const team = {
			members: [
				{ id: 'm1', employeeId: 'employee-a' },
				{ id: 'm2', employeeId: 'employee-ended' }
			]
		};

		const answer = await lastValueFrom(interceptor.intercept({} as never, { handle: () => of(team) }));

		expect(answer).toBe(team);
		expect(team.members.map(({ id }) => id)).toEqual(['m1']);
		expect(moduleRef.get).toHaveBeenCalledWith(expect.anything(), { strict: false });
	});

	it('still reads the employee rows that state their status when no EmployeeService is found', async () => {
		const moduleRef = {
			get: jest.fn(() => {
				throw new Error('not found');
			})
		};
		const interceptor = new FormerEmployeesInterceptor(moduleRef as never);
		const department = {
			members: [
				{ id: 'employee-a', userId: 'u1', isActive: true, isArchived: false },
				{ id: 'employee-ended', userId: 'u2', isActive: false, isArchived: true }
			]
		};

		await lastValueFrom(interceptor.intercept({} as never, { handle: () => of(department) }));

		expect(department.members.map(({ id }) => id)).toEqual(['employee-a']);
	});
});
