/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller.
 *
 * `dashboard.entity.ts` applies `@IsEmployeeBelongsToOrganization()` at class-definition time, and
 * that decorator's module reaches the entity graph again through the employee repository. Importing
 * the subject first enters the cycle from the wrong end: the decorator module is still initializing
 * when `dashboard.entity.ts` applies it, so it resolves to `undefined` and the whole suite fails to
 * LOAD with `IsEmployeeBelongsToOrganization is not a function`. Loading the entity barrel first
 * lets that module finish before anything applies it. The API does not hit this because Nest
 * bootstraps the entity graph before the service layer.
 */
import '../../core/entities/internal';
import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { IGetTimeLogReportInput } from '@gauzy/contracts';
import { moment } from '../../core/moment-extend';
import { getDateRangeFormat, MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import {
	executedFilters,
	mockRequestContext,
	nextMacrotask,
	RecordingQueryBuilder
} from '../testing/recording-query-builder';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { TimeLogService } from './time-log.service';

const TENANT_ID = '5a1c2f0e-6d3b-4c8a-9e2f-1b7d4a6c8e90';
const ORGANIZATION_ID = '0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f';
const USER_ID = 'c3b2a190-8f7e-4d6c-9b5a-4e3d2c1b0a9f';
const CURRENT_EMPLOYEE_ID = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928';
const TARGET_EMPLOYEE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('TimeLogService', () => {
	let service: TimeLogService;
	let builder: RecordingQueryBuilder;
	let canManageEmployees: jest.Mock;

	beforeEach(async () => {
		builder = new RecordingQueryBuilder('time_log');
		canManageEmployees = jest.fn();

		const module: TestingModule = await Test.createTestingModule({
			providers: [TimeLogService]
		})
			/**
			 * Every dependency is mocked to an empty object, except the three the report methods
			 * actually touch: the TypeORM repository (hands out the recording builder), the
			 * manager check, and the command bus used by `getDailyReport` to group results.
			 */
			.useMocker((token) => {
				if (token === TypeOrmTimeLogRepository) {
					return { metadata: { tableName: 'time_log' }, createQueryBuilder: () => builder };
				}
				if (token === ManagedEmployeeService) {
					return { canManageEmployees };
				}
				if (token === CommandBus) {
					return { execute: jest.fn().mockResolvedValue([]) };
				}
				return {};
			})
			.compile();

		service = module.get<TimeLogService>(TimeLogService);
		// The ORM switch is resolved from DB_ORM at module load; pin it so the suite ignores the local .env.
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('report queries', () => {
		const request: IGetTimeLogReportInput = {
			organizationId: ORGANIZATION_ID,
			employeeIds: [TARGET_EMPLOYEE_ID],
			startDate: '2026-01-05T00:00:00.000Z',
			endDate: '2026-01-12T00:00:00.000Z',
			timeZone: 'UTC'
		};

		// The date range is the pair of startedAt predicates inside the `Brackets`.
		const { start, end } = getDateRangeFormat(moment.utc(request.startDate), moment.utc(request.endDate));
		const scopingConditions = [
			'"time_log"."tenantId" = :tenantId',
			'"time_log"."organizationId" = :organizationId',
			'"time_log"."employeeId" IN (:...employeeIds)',
			'Brackets',
			'"time_log"."startedAt" >= :startDate',
			'"time_log"."startedAt" < :endDate'
		];

		const reportMethods: Array<[string, (input: IGetTimeLogReportInput) => Promise<unknown>]> = [
			['getTimeLogs', (input) => service.getTimeLogs(input)],
			['getWeeklyReport', (input) => service.getWeeklyReport(input)],
			['getDailyReportCharts', (input) => service.getDailyReportCharts(input)],
			['getDailyReport', (input) => service.getDailyReport(input)],
			['getOwedAmountReport', (input) => service.getOwedAmountReport(input)],
			['getOwedAmountReportCharts', (input) => service.getOwedAmountReportCharts(input)],
			['getTimeLimit', (input) => service.getTimeLimit({ ...input, duration: 'day' })]
		];

		const actAs = (caller: { canChangeSelectedEmployee: boolean }) =>
			mockRequestContext({
				tenantId: TENANT_ID,
				user: { id: USER_ID, employeeId: CURRENT_EMPLOYEE_ID },
				canChangeSelectedEmployee: caller.canChangeSelectedEmployee
			});

		// Resolves on a later macrotask, like the repository round-trip behind the real manager check.
		const resolveLater = (value: boolean) => async () => {
			await nextMacrotask();
			return value;
		};

		it.each<[string, (input: IGetTimeLogReportInput) => Promise<unknown>]>(reportMethods)(
			'%s applies the tenant, organization, employee and date filters before executing for a manager',
			async (_name, run) => {
				actAs({ canChangeSelectedEmployee: false });
				canManageEmployees.mockImplementation(resolveLater(true));

				await run(request);

				expect(canManageEmployees).toHaveBeenCalledWith([TARGET_EMPLOYEE_ID], []);
				const { conditions, parameters } = executedFilters(builder);
				expect(conditions).toEqual(expect.arrayContaining(scopingConditions));
				expect(parameters).toEqual(
					expect.objectContaining({
						tenantId: TENANT_ID,
						organizationId: ORGANIZATION_ID,
						employeeIds: [TARGET_EMPLOYEE_ID],
						startDate: start,
						endDate: end
					})
				);
			}
		);

		it('narrows a caller who does not manage the requested employees to their own logs', async () => {
			actAs({ canChangeSelectedEmployee: false });
			canManageEmployees.mockImplementation(resolveLater(false));

			await service.getDailyReport(request);

			const { conditions, parameters } = executedFilters(builder);
			expect(conditions).toEqual(expect.arrayContaining(scopingConditions));
			expect(parameters).toEqual(expect.objectContaining({ employeeIds: [CURRENT_EMPLOYEE_ID] }));
		});

		it('keeps the requested employees for a caller with CHANGE_SELECTED_EMPLOYEE', async () => {
			actAs({ canChangeSelectedEmployee: true });

			await service.getDailyReport(request);

			expect(canManageEmployees).not.toHaveBeenCalled();
			const { conditions, parameters } = executedFilters(builder);
			expect(conditions).toEqual(expect.arrayContaining(scopingConditions));
			expect(parameters).toEqual(expect.objectContaining({ employeeIds: [TARGET_EMPLOYEE_ID] }));
		});

		it('honours onlyMe without consulting the manager check', async () => {
			actAs({ canChangeSelectedEmployee: false });

			await service.getDailyReport({ ...request, onlyMe: true });

			expect(canManageEmployees).not.toHaveBeenCalled();
			const { conditions, parameters } = executedFilters(builder);
			expect(conditions).toEqual(expect.arrayContaining(scopingConditions));
			expect(parameters).toEqual(expect.objectContaining({ employeeIds: [CURRENT_EMPLOYEE_ID] }));
		});

		/**
		 * `moment().tz(undefined)` returns undefined rather than a moment, so every report that groups
		 * its rows by `.tz(timeZone).format(...)` answered 500 "Cannot read properties of undefined
		 * (reading 'format')" for a request that named no time zone — but only once the organization had
		 * time logs, because an empty result never runs the grouping. The filter specs above all run on
		 * an empty result, which is why they never caught it.
		 */
		describe('a request without a time zone', () => {
			const LOG_STARTED_AT = '2026-01-06T22:00:00.000Z';

			beforeEach(() => {
				actAs({ canChangeSelectedEmployee: true });
				builder.rows = [
					{
						id: 'b1f0c6da-6f54-4f3e-8f7a-4c2e9d0b1a23',
						employeeId: TARGET_EMPLOYEE_ID,
						startedAt: LOG_STARTED_AT,
						stoppedAt: '2026-01-06T23:00:00.000Z',
						duration: 3600,
						logType: 'TRACKED',
						employee: { id: TARGET_EMPLOYEE_ID, user: { id: USER_ID } },
						timeSlots: [{ id: '2f3e4d5c-6b7a-4980-9a1b-2c3d4e5f6a7b', overall: 60, duration: 600 }]
					}
				];
			});

			it.each<[string, (input: IGetTimeLogReportInput) => Promise<unknown>]>(reportMethods)(
				'%s still answers when the request names no time zone',
				async (_name, run) => {
					const { timeZone, ...withoutTimeZone } = request;

					await expect(run(withoutTimeZone as IGetTimeLogReportInput)).resolves.toBeDefined();
				}
			);

			it.each<[string, (input: IGetTimeLogReportInput) => Promise<unknown>]>(reportMethods)(
				'%s still answers when the time zone is empty',
				async (_name, run) => {
					await expect(run({ ...request, timeZone: '' })).resolves.toBeDefined();
				}
			);

			it('buckets the rows under the server zone, the same one the day list is built in', async () => {
				const { timeZone, ...withoutTimeZone } = request;
				const serverZoneDate = moment.utc(LOG_STARTED_AT).tz(moment.tz.guess()).format('YYYY-MM-DD');

				const report = (await service.getWeeklyReport(withoutTimeZone as IGetTimeLogReportInput)) as Array<{
					dates: Record<string, unknown>;
				}>;

				// The day list and the grouping agree, so the log lands in a real bucket rather than in a
				// key nobody reads
				expect(Object.keys(report[0].dates)).toContain(serverZoneDate);
				expect(report[0].dates[serverZoneDate]).not.toBe(0);
			});

			it('keeps using the requested time zone when the request names one', async () => {
				const report = (await service.getWeeklyReport({ ...request, timeZone: 'Asia/Tokyo' })) as Array<{
					dates: Record<string, unknown>;
				}>;

				// UTC+9: 22:00Z on the 6th is already 07:00 on the 7th there
				const zoned = moment.utc(LOG_STARTED_AT).tz('Asia/Tokyo').format('YYYY-MM-DD');
				expect(report[0].dates[zoned]).not.toBe(0);
			});
		});
	});
});
