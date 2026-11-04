import '../core/entities/internal';

import { Brackets } from 'typeorm';
import { IUser, PermissionsEnum, TimesheetStatus } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { Organization, OrganizationProject, TimeLog } from '../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskService } from './task.service';

/**
 * A time log keeps the project it was tracked under, so a task moved to another project left its time behind.
 * With `moveTimeLogs` the task's logs follow it. Moving a log changes recorded time, so it takes the rules of a time
 * log edit: the ALLOW_MODIFY_TIME permission, the organization's `allowModifyTime`, and only the logs of employees
 * the caller may act for. A log of an approved or billed timesheet stays where it is.
 */
describe('TaskService.update — moving the time logs with the task', () => {
	const CALLER = 'caller-employee';
	const COLLEAGUE = 'colleague-employee';
	const fixture = createTenantFixture({ user: { employeeId: CALLER } as IUser });
	const stored = {
		id: 'task-1',
		title: 'Task 1',
		tenantId: fixture.tenantId,
		organizationId: fixture.organizationId,
		projectId: 'project-old',
		number: 12,
		prefix: 'OLD',
		members: []
	};
	const openSheet = { id: 'sheet-open', status: TimesheetStatus.PENDING, isBilled: false };
	const TIME_LOGS = [
		{ id: 'log-own', employeeId: CALLER, projectId: 'project-old', timesheet: openSheet },
		{ id: 'log-own-no-sheet', employeeId: CALLER, projectId: null, timesheet: null },
		{ id: 'log-colleague', employeeId: COLLEAGUE, projectId: 'project-old', timesheet: openSheet },
		{
			id: 'log-approved',
			employeeId: CALLER,
			projectId: 'project-old',
			timesheet: { id: 'sheet-approved', status: TimesheetStatus.APPROVED, isBilled: false }
		},
		{
			id: 'log-billed',
			employeeId: CALLER,
			projectId: 'project-old',
			timesheet: { id: 'sheet-billed', status: TimesheetStatus.PENDING, isBilled: true }
		},
		{ id: 'log-already-there', employeeId: CALLER, projectId: 'project-new', timesheet: openSheet }
	];

	let restore: () => void;
	let service: TaskService;
	let save: jest.SpyInstance;
	let findOne: jest.Mock;
	let findLogs: jest.Mock;
	let canManageEmployee: jest.Mock;
	let organizationAllowsModifyTime: boolean;
	let projectBillable: boolean | null;
	let write: {
		set?: Record<string, unknown>;
		where?: Record<string, unknown>;
		conditions: unknown[];
		executed: boolean;
	};

	const signInWith = (permissions: PermissionsEnum[]) => {
		({ restore } = asTenantUser(fixture, { permissions }));
	};

	const movedIds = () => (write.executed ? (write.where?.id as { value: string[] }).value : []);

	beforeEach(() => {
		organizationAllowsModifyTime = true;
		projectBillable = true;
		write = { conditions: [], executed: false };
		findOne = jest.fn(async (entity, { where }) => {
			if (entity === Organization) {
				return { id: where.id, allowModifyTime: organizationAllowsModifyTime };
			}
			const isNewProject = entity === OrganizationProject && where.id === 'project-new';
			return isNewProject ? { id: 'project-new', name: 'Ever Works', billable: projectBillable } : null;
		});
		findLogs = jest.fn(async () => TIME_LOGS);
		canManageEmployee = jest.fn(async (employeeId: string) => employeeId === CALLER);
		const builder = {
			update: () => builder,
			set: (changes: Record<string, unknown>) => {
				write.set = changes;
				return builder;
			},
			where: (where: Record<string, unknown>) => {
				write.where = where;
				return builder;
			},
			andWhere: (condition: unknown) => {
				write.conditions.push(condition);
				return builder;
			},
			execute: async () => {
				write.executed = true;
				return { affected: 1 };
			}
		};

		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue(stored as never);
		save = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (entity) => ({ ...stored, ...entity }) as never);
		service = Object.create(TaskService.prototype);
		Object.assign(service, {
			_entitySubscriptionService: { delete: jest.fn(), deleteForEmployee: jest.fn() },
			_activityLogService: { logActivity: jest.fn() },
			_eventBus: { publish: jest.fn() },
			_employeeNotificationService: { publishNotificationEvent: jest.fn() },
			_managedEmployeeService: { canManageEmployee },
			getMaxTaskNumberByProject: jest.fn(async () => 4)
		});
		Object.defineProperty(service, 'typeOrmRepository', {
			value: { manager: { findOne, find: findLogs, createQueryBuilder: () => builder } },
			configurable: true
		});
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it("moves the caller's open logs to the task's new project, with the project's billable setting", async () => {
		signInWith([PermissionsEnum.ALLOW_MODIFY_TIME]);

		await service.update('task-1', { projectId: 'project-new', moveTimeLogs: true });

		expect(findLogs).toHaveBeenCalledWith(
			TimeLog,
			expect.objectContaining({
				where: { taskId: 'task-1', tenantId: fixture.tenantId, organizationId: fixture.organizationId }
			})
		);
		expect(movedIds()).toEqual(['log-own', 'log-own-no-sheet']);
		expect(write.set).toEqual({ projectId: 'project-new', isBillable: true });
		expect(write.where).toMatchObject({
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			taskId: 'task-1'
		});
	});

	it('leaves the logs of an approved or billed timesheet, and re-checks that in the write itself', async () => {
		signInWith([PermissionsEnum.ALLOW_MODIFY_TIME]);

		await service.update('task-1', { projectId: 'project-new', moveTimeLogs: true });

		expect(movedIds()).not.toContain('log-approved');
		expect(movedIds()).not.toContain('log-billed');
		expect(write.conditions).toHaveLength(2);
		expect(write.conditions[0]).toBeInstanceOf(Brackets);
	});

	it("moves a colleague's logs only for a caller who may act for them", async () => {
		signInWith([PermissionsEnum.ALLOW_MODIFY_TIME]);
		canManageEmployee.mockImplementation(async () => true);

		await service.update('task-1', { projectId: 'project-new', moveTimeLogs: true });

		expect(movedIds()).toEqual(['log-own', 'log-own-no-sheet', 'log-colleague']);
		expect(canManageEmployee).toHaveBeenCalledWith(COLLEAGUE, undefined, fixture.organizationId);
	});

	it('moves nothing for a caller without ALLOW_MODIFY_TIME', async () => {
		signInWith([]);

		await service.update('task-1', { projectId: 'project-new', moveTimeLogs: true });

		expect(write.executed).toBe(false);
		expect(save).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-new' }));
	});

	it('moves nothing when the organization does not allow modifying time', async () => {
		signInWith([PermissionsEnum.ALLOW_MODIFY_TIME]);
		organizationAllowsModifyTime = false;

		await service.update('task-1', { projectId: 'project-new', moveTimeLogs: true });

		expect(write.executed).toBe(false);
	});

	it('moves nothing without the flag, or when the update keeps the same project', async () => {
		signInWith([PermissionsEnum.ALLOW_MODIFY_TIME]);

		await service.update('task-1', { projectId: 'project-new' });
		await service.update('task-1', { projectId: 'project-old', moveTimeLogs: true });

		expect(write.executed).toBe(false);
		expect(findLogs).not.toHaveBeenCalled();
	});

	it('keeps the billable setting of the logs when the new project states none', async () => {
		signInWith([PermissionsEnum.ALLOW_MODIFY_TIME]);
		projectBillable = null;

		await service.update('task-1', { projectId: 'project-new', moveTimeLogs: true });

		expect(write.set).toEqual({ projectId: 'project-new' });
	});

	it('takes the task out of its project, relation included, and its logs with it', async () => {
		signInWith([PermissionsEnum.ALLOW_MODIFY_TIME]);

		await service.update('task-1', {
			projectId: null,
			project: { id: 'project-old' },
			moveTimeLogs: true
		} as never);

		expect(save.mock.calls[0][0]).toMatchObject({ projectId: null, project: null });
		expect(write.set).toEqual({ projectId: null });
		expect(movedIds()).toEqual(['log-own', 'log-already-there']);
	});

	it('never fails an update that was saved when the move fails', async () => {
		signInWith([PermissionsEnum.ALLOW_MODIFY_TIME]);
		findLogs.mockRejectedValue(new Error('connection reset'));
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		await expect(service.update('task-1', { projectId: 'project-new', moveTimeLogs: true })).resolves.toMatchObject(
			{ projectId: 'project-new' }
		);
		expect(write.executed).toBe(false);
	});
});
