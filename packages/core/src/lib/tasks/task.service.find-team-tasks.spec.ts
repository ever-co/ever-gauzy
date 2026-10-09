import '../core/entities/internal';

import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskService } from './task.service';

/**
 * `findTeamTasks` limits an employee without CHANGE_SELECTED_EMPLOYEE to the tasks of their own teams, and lets a
 * permission holder pick the employee. The TypeORM branch did both; the MikroORM branch only honoured a
 * client-supplied `members.id`, so an employee got every team task of the organization.
 */
describe('TaskService.findTeamTasks (MikroORM) — employee scoping', () => {
	const employee = createTenantFixture({ user: { employeeId: 'employee-1' } as IUser });
	// Same tenant, a user with no employee record (e.g. a plain user account)
	const noEmployee = createTenantFixture({ tenantId: employee.tenantId, organizationId: employee.organizationId });

	let restore: () => void;
	let findAndCount: jest.Mock;
	let createQueryBuilder: jest.Mock;
	let service: TaskService;

	const teamTasks = (members?: { id: string }) =>
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service.findTeamTasks({ where: { organizationId: employee.organizationId, members } } as any);
	const where = () => findAndCount.mock.calls[0][0];

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		jest.spyOn(TaskService.prototype as any, 'assertRelationsPermitted').mockImplementation(() => undefined);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		jest.spyOn(TaskService.prototype as any, 'serialize').mockImplementation((entity: object) => ({ ...entity }));
		findAndCount = jest.fn().mockResolvedValue([[], 0]);
		createQueryBuilder = jest.fn();
		const stub = {};
		service = new TaskService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'task' }, createQueryBuilder } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ findAndCount } as any,
			...(Array.from({ length: 8 }, () => stub) as [never, never, never, never, never, never, never, never])
		);
	});

	afterEach(() => {
		restore?.();
		jest.restoreAllMocks();
	});

	it('limits an employee without CHANGE_SELECTED_EMPLOYEE to their own teams, whatever members.id says', async () => {
		({ restore } = asTenantUser(employee));

		await teamTasks({ id: 'someone-else' });

		expect(where().teams).toEqual({ members: { employeeId: 'employee-1' } });
	});

	it('lets a CHANGE_SELECTED_EMPLOYEE holder pick the employee', async () => {
		({ restore } = asTenantUser(employee, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));

		await teamTasks({ id: 'someone-else' });

		expect(where().teams).toEqual({ members: { employeeId: 'someone-else' } });
	});

	it('applies no employee filter for a CHANGE_SELECTED_EMPLOYEE holder who picks nobody', async () => {
		({ restore } = asTenantUser(employee, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));

		await teamTasks();

		expect(where()).not.toHaveProperty('teams');
	});

	describe('a caller without CHANGE_SELECTED_EMPLOYEE and without an employee record', () => {
		it('gets no team tasks on MikroORM, without querying', async () => {
			({ restore } = asTenantUser(noEmployee));

			await expect(teamTasks({ id: 'someone-else' })).resolves.toEqual({ items: [], total: 0 });
			expect(findAndCount).not.toHaveBeenCalled();
		});

		it('gets no team tasks on TypeORM, without querying', async () => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			({ restore } = asTenantUser(noEmployee));

			await expect(teamTasks({ id: 'someone-else' })).resolves.toEqual({ items: [], total: 0 });
			expect(createQueryBuilder).not.toHaveBeenCalled();
		});
	});

	describe('an ALL_ORG_VIEW holder without an employee record', () => {
		it('keeps the organization-wide team tasks on MikroORM, without picking an employee', async () => {
			({ restore } = asTenantUser(noEmployee, { permissions: [PermissionsEnum.ALL_ORG_VIEW] }));

			await teamTasks({ id: 'someone-else' });

			expect(findAndCount).toHaveBeenCalledTimes(1);
			expect(where()).not.toHaveProperty('teams');
		});

		it('reaches the query on TypeORM', async () => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			({ restore } = asTenantUser(noEmployee, { permissions: [PermissionsEnum.ALL_ORG_VIEW] }));

			await expect(teamTasks()).rejects.toThrow();
			expect(createQueryBuilder).toHaveBeenCalled();
		});
	});
});
