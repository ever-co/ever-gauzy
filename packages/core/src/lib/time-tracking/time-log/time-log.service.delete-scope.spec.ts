/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `time-log.service.spec.ts` for the cycle it avoids.
 */
import '../../core/entities/internal';
import { NotAcceptableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { mockRequestContext, RecordingQueryBuilder } from '../testing/recording-query-builder';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { TimeLogDeleteCommand } from './commands';
import { TimeLogService } from './time-log.service';

const TENANT_ID = '10742000-0000-4000-8000-0000000000aa';
const ORGANIZATION_ID = '10742000-0000-4000-8000-0000000000bb';
const USER_ID = '10742000-0000-4000-8000-0000000000cc';
const CURRENT_EMPLOYEE_ID = '10742000-0000-4000-8000-000000000001';
const TARGET_EMPLOYEE_ID = '10742000-0000-4000-8000-000000000002';

/**
 * #10742: an employee who manages no team got a 406 deleting their own time logs without a team. Every
 * employee of the selection went through `canManageEmployees`, whose no-team path only accepts a team
 * manager. The real `ManagedEmployeeService` runs here, over a membership store evaluated in memory.
 */
describe('TimeLogService.deleteTimeLogs — whose logs a caller without CHANGE_SELECTED_EMPLOYEE may delete', () => {
	const MANAGED_TEAM_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
	const UNMANAGED_EMPLOYEE_ID = '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f';

	let deleteService: TimeLogService;
	let deleteBuilder: RecordingQueryBuilder;
	let execute: jest.Mock;
	let memberships: Array<{ employeeId: string; organizationTeamId: string; isManager: boolean }>;

	beforeEach(async () => {
		deleteBuilder = new RecordingQueryBuilder('time_log');
		execute = jest.fn().mockResolvedValue({ affected: 1 });
		memberships = [];

		// `find` lists a caller's memberships, `existsBy` asks whether a target is in one of the given teams.
		const teamEmployeeRepository = {
			find: jest.fn(async ({ where }: any) =>
				memberships.filter(
					(membership) =>
						membership.employeeId === where.employeeId &&
						(where.isManager === undefined || membership.isManager === where.isManager)
				)
			),
			existsBy: jest.fn(async (where: any) =>
				memberships.some(
					(membership) =>
						membership.employeeId === where.employeeId &&
						(where.organizationTeamId.value as string[]).includes(membership.organizationTeamId)
				)
			)
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [TimeLogService, ManagedEmployeeService]
		})
			.useMocker((token) => {
				if (token === TypeOrmTimeLogRepository) {
					return { metadata: { tableName: 'time_log' }, createQueryBuilder: () => deleteBuilder };
				}
				if (token === TypeOrmOrganizationTeamEmployeeRepository) {
					return teamEmployeeRepository;
				}
				if (token === CommandBus) {
					return { execute };
				}
				return {};
			})
			.compile();

		deleteService = module.get<TimeLogService>(TimeLogService);
		Object.defineProperty(deleteService, 'ormType', { value: MultiORMEnum.TypeORM });
	});

	afterEach(() => jest.restoreAllMocks());

	const logOf = (id: string, employeeId: string, organizationTeamId: string | null = null) => ({
		id,
		employeeId,
		organizationTeamId,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		timeSlots: []
	});

	const actAs = (employeeId: string | null) =>
		mockRequestContext({
			tenantId: TENANT_ID,
			user: { id: USER_ID, employeeId },
			canChangeSelectedEmployee: false
		});

	const deleteLogs = (logs: ReturnType<typeof logOf>[]) => {
		deleteBuilder.rows = logs;
		return deleteService.deleteTimeLogs({
			logIds: logs.map((log) => log.id),
			organizationId: ORGANIZATION_ID
		} as any);
	};

	const deleteCommands = () => execute.mock.calls.filter(([command]) => command instanceof TimeLogDeleteCommand);

	it('lets an employee who manages no team delete their own logs without a team', async () => {
		actAs(CURRENT_EMPLOYEE_ID);

		await deleteLogs([logOf('log-own-1', CURRENT_EMPLOYEE_ID), logOf('log-own-2', CURRENT_EMPLOYEE_ID)]);

		expect(deleteCommands()).toHaveLength(1);
	});

	it('still refuses a selection that holds a log of an employee the caller does not manage', async () => {
		actAs(CURRENT_EMPLOYEE_ID);

		await expect(
			deleteLogs([logOf('log-own', CURRENT_EMPLOYEE_ID), logOf('log-unmanaged', UNMANAGED_EMPLOYEE_ID)])
		).rejects.toBeInstanceOf(NotAcceptableException);
		expect(deleteCommands()).toHaveLength(0);
	});

	it('lets a team manager delete their own logs together with those of an employee they manage', async () => {
		memberships = [
			{ employeeId: CURRENT_EMPLOYEE_ID, organizationTeamId: MANAGED_TEAM_ID, isManager: true },
			{ employeeId: TARGET_EMPLOYEE_ID, organizationTeamId: MANAGED_TEAM_ID, isManager: false }
		];
		actAs(CURRENT_EMPLOYEE_ID);

		await deleteLogs([logOf('log-own', CURRENT_EMPLOYEE_ID), logOf('log-managed', TARGET_EMPLOYEE_ID)]);

		expect(deleteCommands()).toHaveLength(1);
	});

	it('refuses a caller with no employee identity, whose logs are none of their own', async () => {
		actAs(null);

		await expect(deleteLogs([logOf('log-other', TARGET_EMPLOYEE_ID)])).rejects.toBeInstanceOf(
			NotAcceptableException
		);
		expect(deleteCommands()).toHaveLength(0);
	});
});
