// Must stay first: see time-log.service.spec.ts.
import '../../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { IManualTimeInput } from '@gauzy/contracts';
import { OrganizationTeamEmployee, Task } from '../../core/entities/internal';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { mockRequestContext } from '../testing/recording-query-builder';
import { IGetConflictTimeLogCommand, TimeLogCreateCommand } from './commands';
import { ITrackingRequirements, TRACKING_FIELD_REQUIRED } from './organization-tracking-requirements';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { TimeLogService } from './time-log.service';

/**
 * Manual time records the same context a timer start does, so an organization's tracking requirements hold for it
 * too. The team the server fills is the one of the employee the time is for, who may not be the caller (a manager
 * recording a member's time). With every switch off, an entry is recorded exactly as before.
 */
describe('TimeLogService.addManualTime under the organization tracking requirements', () => {
	const TENANT_ID = 'tenant-1';
	const ORGANIZATION_ID = 'organization-1';
	const MEMBER_ID = 'employee-member';

	let service: TimeLogService;
	let execute: jest.Mock;
	let find: jest.Mock;
	let findOne: jest.Mock;
	let requirements: ITrackingRequirements;
	let teamsOfMember: string[];

	const request = {
		employeeId: MEMBER_ID,
		startedAt: new Date('2026-01-05T09:00:00.000Z'),
		stoppedAt: new Date('2026-01-05T10:00:00.000Z')
	} as IManualTimeInput;

	const created = () => {
		const create = execute.mock.calls.find(([command]) => command instanceof TimeLogCreateCommand)?.[0];
		return (create as TimeLogCreateCommand | undefined)?.input;
	};

	beforeEach(async () => {
		requirements = {
			requireTeam: false,
			requireProject: false,
			requireTask: false,
			requireClient: false,
			requireDescription: false
		};
		teamsOfMember = [];
		execute = jest.fn().mockResolvedValue([]);
		find = jest.fn(async () =>
			teamsOfMember.map((organizationTeamId) => ({ id: `member-${organizationTeamId}`, organizationTeamId }))
		);
		findOne = jest.fn(async () => ({ id: 'task-1', projectId: 'project-of-task' }));

		const module: TestingModule = await Test.createTestingModule({ providers: [TimeLogService] })
			.useMocker((token) => {
				if (token === TypeOrmEmployeeRepository) {
					return {
						findOne: jest.fn(async () => ({
							id: MEMBER_ID,
							organizationId: ORGANIZATION_ID,
							organization: {
								id: ORGANIZATION_ID,
								futureDateAllowed: true,
								allowManualTime: true,
								...requirements
							}
						}))
					};
				}
				if (token === CommandBus) {
					return { execute };
				}
				if (token === ManagedEmployeeService) {
					return { canManageEmployee: jest.fn().mockResolvedValue(true) };
				}
				if (token === TypeOrmTimeLogRepository) {
					return { metadata: { tableName: 'time_log' }, manager: { find, findOne } };
				}
				return {};
			})
			.compile();

		service = module.get<TimeLogService>(TimeLogService);
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
		mockRequestContext({
			tenantId: TENANT_ID,
			user: { id: 'user-manager', employeeId: 'employee-manager' },
			canChangeSelectedEmployee: false
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('records the entry as sent when every switch is off, without any extra lookup', async () => {
		await service.addManualTime({ ...request, taskId: 'task-1' });

		expect(created()).toEqual({ ...request, taskId: 'task-1', organizationId: ORGANIZATION_ID });
		expect(find).not.toHaveBeenCalled();
		expect(findOne).not.toHaveBeenCalled();
	});

	it.each([
		['requireTeam', 'organizationTeamId'],
		['requireProject', 'projectId'],
		['requireTask', 'taskId'],
		['requireClient', 'organizationContactId'],
		['requireDescription', 'description']
	] as const)(
		'refuses an entry without the field when %s is on, before anything is written',
		async (requirement, field) => {
			requirements[requirement] = true;

			const error = await service.addManualTime(request).catch((caught) => caught);

			expect(error).toBeInstanceOf(BadRequestException);
			expect(error.getResponse()).toMatchObject({ code: TRACKING_FIELD_REQUIRED, fields: [field] });
			expect(execute).not.toHaveBeenCalled();
		}
	);

	it("files the entry under the member's only active team, not the caller's", async () => {
		requirements.requireTeam = true;
		teamsOfMember = ['team-of-member'];

		await service.addManualTime(request);

		expect(find).toHaveBeenCalledWith(
			OrganizationTeamEmployee,
			expect.objectContaining({
				where: expect.objectContaining({
					employeeId: MEMBER_ID,
					organizationId: ORGANIZATION_ID,
					tenantId: TENANT_ID
				})
			})
		);
		expect(created()).toMatchObject({ organizationTeamId: 'team-of-member' });
		expect(execute.mock.calls.some(([command]) => command instanceof IGetConflictTimeLogCommand)).toBe(true);
	});

	it("files an entry that names a task but no project under the task's project when a project is required", async () => {
		requirements.requireProject = true;

		await service.addManualTime({ ...request, taskId: 'task-1' });

		expect(findOne).toHaveBeenCalledWith(Task, expect.anything());
		expect(created()).toMatchObject({ projectId: 'project-of-task', taskId: 'task-1' });
	});
});
