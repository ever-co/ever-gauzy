import '../core/entities/internal';

import { Brackets } from 'typeorm';
import * as gauzyConfig from '@gauzy/config';
import { IUser, PermissionsEnum, TimesheetStatus } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { Organization, OrganizationProject, TaskFormerReference, TimeLog, Timesheet } from '../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { Task } from './task.entity';
import { TaskService } from './task.service';

// The dialect the task row lock depends on is stated per case; every other case keeps the configured one.
jest.mock('@gauzy/config', () => {
	const actual = jest.requireActual('@gauzy/config');

	return {
		...actual,
		isPostgres: jest.fn(actual.isPostgres),
		isMySQL: jest.fn(actual.isMySQL)
	};
});

const actualConfig = jest.requireActual('@gauzy/config') as typeof gauzyConfig;
const isPostgresMock = gauzyConfig.isPostgres as unknown as jest.Mock;
const isMySQLMock = gauzyConfig.isMySQL as unknown as jest.Mock;

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
	let steps: string[];

	const signInWith = (permissions: PermissionsEnum[]) => {
		({ restore } = asTenantUser(fixture, { permissions }));
	};

	const movedIds = () => (write.executed ? ((write.where?.id as { value: string[] } | undefined)?.value ?? []) : []);

	beforeEach(() => {
		organizationAllowsModifyTime = true;
		projectBillable = true;
		write = { conditions: [], executed: false };
		steps = [];
		isPostgresMock.mockImplementation(actualConfig.isPostgres);
		isMySQLMock.mockImplementation(actualConfig.isMySQL);
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
				steps.push('write');
				return { affected: 1 };
			}
		};
		const rowLock = (table: string) => {
			const lock = {
				lockedIds: [] as unknown[],
				select: () => lock,
				where: ({ id }: { id: string | { value: string[] } }) => {
					if (typeof id === 'string') {
						lock.lockedIds = [id];
						return lock;
					}
					lock.lockedIds = id.value;
					return lock;
				},
				setLock: (mode: string) => {
					steps.push(`${mode} ${table} ${lock.lockedIds.join(',')}`);
					return lock;
				},
				getOne: async () => ({ id: lock.lockedIds[0] }),
				getMany: async () => lock.lockedIds.map((id) => ({ id }))
			};
			return lock;
		};
		const inTransaction = {
			// The update's transaction checks the destination (and finds no former number to take back) as the base
			// manager would answer
			findOne: (...args: unknown[]) => (findOne as (...a: unknown[]) => unknown)(...args),
			// The update's own transaction saves the task and the reference it leaves in the project it left
			getRepository: (entity: unknown) => ({
				save: async (row: unknown) => {
					steps.push(entity === TaskFormerReference ? 'save former reference' : 'save');
					return row;
				}
			}),
			createQueryBuilder: (entity?: unknown) => {
				if (entity === Task) {
					return rowLock('task');
				}
				if (entity === Timesheet) {
					return rowLock('timesheet');
				}
				return builder;
			}
		};

		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue(stored as never);
		save = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (entity) => {
				steps.push('save task');
				return { ...stored, ...entity } as never;
			});
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
			value: {
				manager: {
					findOne,
					find: findLogs,
					transaction: async (work: (manager: unknown) => Promise<unknown>) => {
						steps.push('begin');
						const result = await work(inTransaction);
						steps.push('commit');
						return result;
					}
				}
			},
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

	it.each(['postgres', 'mysql'])(
		'on %s, locks the task row and the timesheets in the transaction of the write, so a save or an approval waits',
		async (dialect) => {
			signInWith([PermissionsEnum.ALLOW_MODIFY_TIME]);
			isPostgresMock.mockReturnValue(dialect === 'postgres');
			isMySQLMock.mockReturnValue(dialect === 'mysql');

			await service.update('task-1', { projectId: 'project-new', moveTimeLogs: true });

			// The update's transaction locks the task row, reads the reference it leaves and commits first: the move
			// locks the same row, which the update holds until then
			expect(steps).toEqual([
				'begin',
				'pessimistic_write task task-1',
				'save former reference',
				'save task',
				'commit',
				'begin',
				'pessimistic_write task task-1',
				'pessimistic_write timesheet sheet-open',
				'write',
				'commit'
			]);
		}
	);

	it('writes in a transaction without a row lock on the embedded dialect', async () => {
		signInWith([PermissionsEnum.ALLOW_MODIFY_TIME]);
		isPostgresMock.mockReturnValue(false);
		isMySQLMock.mockReturnValue(false);

		await service.update('task-1', { projectId: 'project-new', moveTimeLogs: true });

		expect(steps).toEqual(['begin', 'save former reference', 'save task', 'commit', 'begin', 'write', 'commit']);
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
