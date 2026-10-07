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

	let restore: () => void;
	let findAndCount: jest.Mock;
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
		const stub = {};
		service = new TaskService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'task' } } as any,
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
});
