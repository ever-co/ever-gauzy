// Must stay first: see time-log.service.spec.ts.
import '../../core/entities/internal';

import { CommandBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { IManualTimeInput, TimeLogType } from '@gauzy/contracts';
import { OrganizationProject, Task } from '../../core/entities/internal';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { mockRequestContext } from '../testing/recording-query-builder';
import { TimeLogCreateCommand } from './commands';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { TimeLogService } from './time-log.service';

/**
 * An entry added by hand that sends `billableFromProject` is billable as its project is set: the project it names,
 * else its task's, a project with no setting counting as not billable (ever-co/ever-teams#5571). An entry without it,
 * or without a project, keeps the `isBillable` it sends, and a break is never billable.
 */
describe('TimeLogService.addManualTime with billableFromProject', () => {
	const TENANT_ID = 'tenant-1';
	const ORGANIZATION_ID = 'organization-1';
	const MEMBER_ID = 'employee-member';

	let service: TimeLogService;
	let execute: jest.Mock;
	let findOne: jest.Mock;
	let projectBillable: boolean | null;

	const request = {
		employeeId: MEMBER_ID,
		startedAt: new Date('2026-01-05T09:00:00.000Z'),
		stoppedAt: new Date('2026-01-05T10:00:00.000Z')
	} as IManualTimeInput;

	const createdBillable = () => {
		const create = execute.mock.calls.find(([command]) => command instanceof TimeLogCreateCommand)?.[0];
		return (create as TimeLogCreateCommand | undefined)?.input.isBillable;
	};

	beforeEach(async () => {
		projectBillable = true;
		execute = jest.fn().mockResolvedValue([]);
		findOne = jest.fn(async (entity: unknown) => {
			if (entity === OrganizationProject) {
				return { id: 'project-1', billable: projectBillable };
			}
			if (entity === Task) {
				return { id: 'task-1', projectId: 'project-of-task' };
			}
			return null;
		});

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
								allowBreaks: true
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
					return {
						metadata: { tableName: 'time_log' },
						manager: { find: jest.fn(async () => []), findOne },
						find: async () => []
					};
				}
				return {};
			})
			.compile();

		service = module.get<TimeLogService>(TimeLogService);
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
		mockRequestContext({
			tenantId: TENANT_ID,
			user: { id: 'user-member', employeeId: MEMBER_ID },
			canChangeSelectedEmployee: false
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it.each([
		[true, false, true],
		[false, true, false],
		[null, true, false]
	])(
		'records an entry on a project set to %s, sent with isBillable %s, as billable %s',
		async (billable, isBillable, expected) => {
			projectBillable = billable;
			await service.addManualTime({ ...request, projectId: 'project-1', isBillable, billableFromProject: true });

			expect(findOne).toHaveBeenCalledWith(OrganizationProject, {
				where: { id: 'project-1', tenantId: TENANT_ID, organizationId: ORGANIZATION_ID },
				select: { id: true, billable: true }
			});
			expect(createdBillable()).toBe(expected);
		}
	);

	it("reads the task's project for an entry that names only a task", async () => {
		await service.addManualTime({ ...request, taskId: 'task-1', billableFromProject: true });

		expect(createdBillable()).toBe(true);
	});

	it('keeps the isBillable of an entry without a project', async () => {
		findOne.mockResolvedValue(null);
		await service.addManualTime({ ...request, isBillable: true, billableFromProject: true });

		expect(createdBillable()).toBe(true);
	});

	it('never makes a break billable', async () => {
		await service.addManualTime({
			...request,
			logType: TimeLogType.BREAK,
			projectId: 'project-1',
			billableFromProject: true
		});

		expect(createdBillable()).toBe(false);
	});

	it('CONTROL: an entry without billableFromProject keeps its isBillable and reads no project', async () => {
		projectBillable = true;
		await service.addManualTime({ ...request, projectId: 'project-1', isBillable: false });

		expect(createdBillable()).toBe(false);
		expect(findOne).not.toHaveBeenCalledWith(OrganizationProject, expect.anything());
	});
});
