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

	const teamTasks = (members?: { id: string }, filters?: Record<string, string[]>) =>
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service.findTeamTasks({ where: { organizationId: employee.organizationId, members }, filters } as any);
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
			...(Array.from({ length: 9 }, () => stub) as [
				never,
				never,
				never,
				never,
				never,
				never,
				never,
				never,
				never
			])
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

	/**
	 * The advanced `filters` (projects, tags, statuses, ...) were only applied by the TypeORM branch; the
	 * MikroORM branch read them and dropped them, so a filtered team board listed every team task.
	 */
	describe('advanced filters', () => {
		it('translates the column and relation filters into the MikroORM where', async () => {
			({ restore } = asTenantUser(employee, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));

			await teamTasks(undefined, { projects: ['project-1'], tags: ['tag-1', 'tag-2'], statusIds: ['status-1'] });

			expect(where()).toEqual(
				expect.objectContaining({
					projectId: { $in: ['project-1'] },
					tags: { id: { $in: ['tag-1', 'tag-2'] } },
					taskStatusId: { $in: ['status-1'] }
				})
			);
		});

		it('keeps the employee team scoping next to a teams filter', async () => {
			({ restore } = asTenantUser(employee));

			await teamTasks(undefined, { teams: ['team-1'] });

			expect(where().teams).toEqual({ members: { employeeId: 'employee-1' }, id: { $in: ['team-1'] } });
		});

		it('applies nothing without filters', async () => {
			({ restore } = asTenantUser(employee, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));

			await teamTasks();

			expect(where()).toEqual({ tenantId: employee.tenantId, organizationId: employee.organizationId, isScreeningTask: false });
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

	/**
	 * #10730 — with both `where[projectId]` and `where[teams]` (every Ever Teams board load), the TypeORM branch lists
	 * the team's tasks plus the project's tasks (#10437); the MikroORM branch ANDed the project with the team scope,
	 * so a team task without a project, or in another one, dropped off the board.
	 */
	describe('a project and teams together', () => {
		const board = (where: Record<string, unknown>, filters?: Record<string, string[]>) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			service.findTeamTasks({ where: { organizationId: employee.organizationId, ...where }, filters } as any);

		it("lists the team's tasks plus the project's tasks, with every other condition on both", async () => {
			({ restore } = asTenantUser(employee));

			await board({ projectId: 'project-1', teams: ['team-1'], status: 'open' });

			expect(where()).toEqual({
				tenantId: employee.tenantId,
				organizationId: employee.organizationId,
				isScreeningTask: false,
				status: 'open',
				$or: [
					{ teams: { id: { $in: ['team-1'] }, members: { employeeId: 'employee-1' } } },
					{ projectId: 'project-1' }
				]
			});
		});

		it('keeps the advanced filters on both sides of the union', async () => {
			({ restore } = asTenantUser(employee, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));

			await board({ projectId: 'project-1', teams: ['team-1'] }, { statusIds: ['status-1'] });

			expect(where()).toEqual(
				expect.objectContaining({
					taskStatusId: { $in: ['status-1'] },
					$or: [{ teams: { id: { $in: ['team-1'] } } }, { projectId: 'project-1' }]
				})
			);
			expect(where()).not.toHaveProperty('teams');
			expect(where()).not.toHaveProperty('projectId');
		});

		it('still narrows to the project when no team is sent', async () => {
			({ restore } = asTenantUser(employee, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));

			await board({ projectId: 'project-1' });

			expect(where()).toMatchObject({ projectId: 'project-1' });
			expect(where()).not.toHaveProperty('$or');
		});

		it('still lists the team tasks only when no project is sent', async () => {
			({ restore } = asTenantUser(employee));

			await board({ teams: ['team-1'] });

			expect(where().teams).toEqual({ id: { $in: ['team-1'] }, members: { employeeId: 'employee-1' } });
			expect(where()).not.toHaveProperty('$or');
			expect(where()).not.toHaveProperty('projectId');
		});
	});
});
