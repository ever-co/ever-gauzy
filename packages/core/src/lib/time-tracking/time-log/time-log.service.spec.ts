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
import { AsyncLocalStorage } from 'async_hooks';
import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { IGetTimeLogReportInput, IManualTimeInput } from '@gauzy/contracts';
import { moment } from '../../core/moment-extend';
import { getDateRangeFormat, MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import {
	executedFilters,
	mockRequestContext,
	nextMacrotask,
	RecordingQueryBuilder
} from '../testing/recording-query-builder';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { RequestContext } from '../../core/context';
import { ForbiddenException } from '@nestjs/common';
import { TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import {
	DeleteTimeSpanCommand,
	TimeLogCreateCommand,
	IGetConflictTimeLogCommand,
	TimeLogUpdateCommand,
	UpdateEmployeeTotalWorkedHoursCommand
} from './commands';
import { TimeLogUpdateHandler } from './commands/handlers/time-log-update.handler';
import { TimesheetFirstOrCreateCommand, TimesheetRecalculateCommand } from '../timesheet/commands';
import { TimeSlotBulkDeleteCommand } from '../time-slot/commands';
import { TimeSlotBulkDeleteHandler } from '../time-slot/commands/handlers/time-slot-bulk-delete.handler';
import { generateTimeSlots } from '../time-slot/utils';
import { TimeLog } from './time-log.entity';
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

		// `isNotEmpty(request.startDate)` guards the range. REST hands it strings and GraphQL's DateTime scalar
		// strings or numbers, but an internal caller hands it Dates — which `isEmpty` used to read as empty, so the
		// query silently ran without any date range at all.
		it('applies the date range when it is given as Date objects', async () => {
			actAs({ canChangeSelectedEmployee: true });

			await service.getDailyReport({
				...request,
				startDate: new Date(request.startDate as string),
				endDate: new Date(request.endDate as string)
			});

			const { conditions, parameters } = executedFilters(builder);
			expect(conditions).toEqual(expect.arrayContaining(scopingConditions));
			expect(parameters).toEqual(expect.objectContaining({ startDate: start, endDate: end }));
		});

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

		// GHSA-6qvm-3wg4-26w4: the employee predicate is only added when `employeeIds` is non-empty, and
		// the narrowing above only runs for a caller who HAS an employee record. A caller with neither
		// the permission nor an employee (a custom role holding TIME_TRACKER) therefore read the whole
		// organization, or the employees they named in the body. CONTROL: the two arms below, where the
		// same caller state with an employee record still produces the ordinary employee predicate.
		it.each<[string, (input: IGetTimeLogReportInput) => Promise<unknown>]>(reportMethods)(
			'%s matches nothing for a caller with neither CHANGE_SELECTED_EMPLOYEE nor an employee record',
			async (_name, run) => {
				mockRequestContext({
					tenantId: TENANT_ID,
					user: { id: USER_ID, employeeId: null },
					canChangeSelectedEmployee: false
				});

				await run(request);

				const { conditions, parameters } = executedFilters(builder);
				expect(conditions).toEqual(['1 = 0']);
				expect(parameters).not.toHaveProperty('employeeIds');
				expect(canManageEmployees).not.toHaveBeenCalled();
			}
		);

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

	/**
	 * The organization the manual-time routes act under is the EMPLOYEE's, not the body's: the
	 * `futureDateAllowed` policy they check belongs to `employee.organization`, so honouring a body
	 * organizationId of the same tenant judged the write by one organization's rules and then
	 * persisted it — log, slots and timesheet — under another's, and (on update) let a sibling
	 * organization's time slots count as conflicting, i.e. be deleted.
	 */
	describe('manual time organization scope', () => {
		const EMPLOYEE_ORGANIZATION_ID = 'a7f1c6de-0f3e-4f4b-9b1a-2c4d6e8f0a1b';
		const BODY_ORGANIZATION_ID = 'b8e2d7cf-1a4f-4c5d-8e2b-3d5f7a9c1b2e';

		let manualService: TimeLogService;
		let execute: jest.Mock;

		const request = {
			employeeId: TARGET_EMPLOYEE_ID,
			organizationId: BODY_ORGANIZATION_ID,
			startedAt: new Date('2026-01-05T09:00:00.000Z'),
			stoppedAt: new Date('2026-01-05T10:00:00.000Z')
		} as IManualTimeInput;

		const commandsOfType = <T>(type: new (...args: any[]) => T): T[] =>
			execute.mock.calls.map(([command]) => command).filter((command) => command instanceof type);

		beforeEach(async () => {
			execute = jest.fn().mockResolvedValue([]);

			const module: TestingModule = await Test.createTestingModule({ providers: [TimeLogService] })
				.useMocker((token) => {
					if (token === TypeOrmEmployeeRepository) {
						return {
							findOne: jest.fn().mockResolvedValue({
								id: TARGET_EMPLOYEE_ID,
								organizationId: EMPLOYEE_ORGANIZATION_ID,
								organization: {
									id: EMPLOYEE_ORGANIZATION_ID,
									futureDateAllowed: true,
									allowManualTime: true
								}
							})
						};
					}
					if (token === CommandBus) {
						return { execute };
					}
					if (token === ManagedEmployeeService) {
						return { canManageEmployee: jest.fn().mockResolvedValue(true) };
					}
					if (token === TypeOrmTimeLogRepository) {
						return { metadata: { tableName: 'time_log' }, createQueryBuilder: () => builder };
					}
					return {};
				})
				.compile();

			manualService = module.get<TimeLogService>(TimeLogService);
			Object.defineProperty(manualService, 'ormType', { value: MultiORMEnum.TypeORM });
			mockRequestContext({
				tenantId: TENANT_ID,
				user: { id: USER_ID, employeeId: CURRENT_EMPLOYEE_ID },
				canChangeSelectedEmployee: true
			});
		});

		it("addManualTime persists the employee's organization, not the body's", async () => {
			await manualService.addManualTime(request);

			// CONTROL: the body named a different organization of the same tenant.
			expect(request.organizationId).toBe(BODY_ORGANIZATION_ID);
			expect(commandsOfType(IGetConflictTimeLogCommand)[0].input).toMatchObject({
				organizationId: EMPLOYEE_ORGANIZATION_ID
			});
			expect(commandsOfType(TimeLogCreateCommand)[0].input).toMatchObject({
				organizationId: EMPLOYEE_ORGANIZATION_ID
			});
		});

		it("addManualTime refuses when the employee's organization does not allow manual time, whatever the body names", async () => {
			// The policy guard judged the body's organization (and the caller's own); the log is the employee's
			// organization's, so that organization's policy is the one that has to allow it.
			jest.spyOn(manualService as any, 'findEmployeeInTenant').mockResolvedValue({
				id: TARGET_EMPLOYEE_ID,
				organizationId: EMPLOYEE_ORGANIZATION_ID,
				organization: { id: EMPLOYEE_ORGANIZATION_ID, futureDateAllowed: true, allowManualTime: false }
			});

			await expect(manualService.addManualTime(request)).rejects.toThrow(
				"Manual time is not allowed in the employee's organization"
			);
			// Refused before any conflict is read, trimmed or written.
			expect(execute).not.toHaveBeenCalled();
		});

		describe("a team manager editing a member's log (no CHANGE_SELECTED_EMPLOYEE)", () => {
			// Stand-in for the per-request store withoutEmployeeFilter() keeps its state in.
			const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
			const originalClsService = RequestContext['clsService'];
			let memberLog = { id: 'log-1', employeeId: TARGET_EMPLOYEE_ID, organizationId: EMPLOYEE_ORGANIZATION_ID };
			let readsWithFilter: number;

			const inRequest = <R>(callback: () => Promise<R>) => requestStorage.run(new Map(), callback);

			beforeEach(() => {
				mockRequestContext({
					tenantId: TENANT_ID,
					user: { id: USER_ID, employeeId: CURRENT_EMPLOYEE_ID },
					canChangeSelectedEmployee: false
				});
				RequestContext['clsService'] = {
					get: (key: string) => requestStorage.getStore()?.get(key),
					set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} as any;
				readsWithFilter = 0;
				// The service's own-employee filter: with it on, the manager only ever finds their own logs.
				jest.spyOn(manualService, 'findOneByIdString').mockImplementation(async () => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					if ((manualService as any).getSkipEmployeeFilter()) return memberLog as any;
					readsWithFilter++;
					throw new Error('Record not found');
				});
			});

			afterEach(() => {
				RequestContext['clsService'] = originalClsService;
			});

			it("updates the member's log and reads it back", async () => {
				const updated = await inRequest(() => manualService.updateManualTime('log-1', { ...request }));

				expect(updated).toBe(memberLog);
				expect(readsWithFilter).toBe(0);
				expect(commandsOfType(TimeLogUpdateCommand)).toHaveLength(1);
			});

			it("CONTROL: a read under the employee filter does not find the member's log", async () => {
				await expect(inRequest(() => manualService.findOneByIdString('log-1'))).rejects.toThrow(
					'Record not found'
				);
				expect(readsWithFilter).toBe(1);
			});

			it('still refuses to move a log to another employee', async () => {
				memberLog.employeeId = CURRENT_EMPLOYEE_ID;
				try {
					await expect(inRequest(() => manualService.updateManualTime('log-1', { ...request }))).rejects.toThrow(
						'A time log cannot be moved to another employee'
					);
					expect(commandsOfType(TimeLogUpdateCommand)).toHaveLength(0);
				} finally {
					memberLog.employeeId = TARGET_EMPLOYEE_ID;
				}
			});
		});

		it("updateManualTime looks for conflicts in the employee's organization", async () => {
			jest.spyOn(manualService, 'findOneByIdString').mockResolvedValue({
				id: 'log-1',
				organizationId: EMPLOYEE_ORGANIZATION_ID
			} as any);

			await manualService.updateManualTime('log-1', { ...request });

			expect(commandsOfType(IGetConflictTimeLogCommand)[0].input).toMatchObject({
				organizationId: EMPLOYEE_ORGANIZATION_ID
			});
		});

		/**
		 * A log stays in its organization. `TimeLogUpdateHandler` keeps the stored row's organization, but
		 * `employeeId` is not a scope field, and a caller with CHANGE_SELECTED_EMPLOYEE reaches every employee of the
		 * tenant: naming an employee of ANOTHER organization re-pointed the log at them while it stayed in its own
		 * organization, and ran the overlap cleanup in theirs — deleting that organization's time slots, whose
		 * `allowModifyTime` nobody asked (the policy guard judges the log's organization).
		 */
		describe('updateManualTime keeps the log inside its own organization', () => {
			const OTHER_ORGANIZATION_ID = 'c9f3e8d0-2b5a-4d6e-9f3c-4e6a8b0d2c3f';
			const SAME_ORGANIZATION_EMPLOYEE_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
			const OTHER_ORGANIZATION_EMPLOYEE_ID = '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f';
			const CROSS_ORGANIZATION = 'A time log cannot be moved to an employee of another organization';

			/** The stored intervals the overlap lookup reads, across both organizations of the tenant. */
			let stored: Array<{ id: string; employeeId: string; organizationId: string; tenantId: string }>;
			let deleted: string[];

			const update = (employeeId: string, organizationId = EMPLOYEE_ORGANIZATION_ID) =>
				manualService.updateManualTime('log-1', { ...request, employeeId, organizationId });

			beforeEach(() => {
				deleted = [];
				// An interval overlapping the edit, per employee — the other organization's one included.
				stored = [
					{
						id: 'same-org-log',
						employeeId: SAME_ORGANIZATION_EMPLOYEE_ID,
						organizationId: EMPLOYEE_ORGANIZATION_ID,
						tenantId: TENANT_ID
					},
					{
						id: 'other-org-log',
						employeeId: OTHER_ORGANIZATION_EMPLOYEE_ID,
						organizationId: OTHER_ORGANIZATION_ID,
						tenantId: TENANT_ID
					}
				];

				const employees: Record<string, string> = {
					[TARGET_EMPLOYEE_ID]: EMPLOYEE_ORGANIZATION_ID,
					[SAME_ORGANIZATION_EMPLOYEE_ID]: EMPLOYEE_ORGANIZATION_ID,
					[OTHER_ORGANIZATION_EMPLOYEE_ID]: OTHER_ORGANIZATION_ID
				};
				jest.spyOn(manualService as any, 'findEmployeeInTenant').mockImplementation(
					async (employeeId: any) => ({
						id: employeeId,
						organizationId: employees[employeeId],
						organization: { id: employees[employeeId], futureDateAllowed: true, allowManualTime: true }
					})
				);
				// The stored log: the target employee's, in the employee organization.
				jest.spyOn(manualService, 'findOneByIdString').mockResolvedValue({
					id: 'log-1',
					employeeId: TARGET_EMPLOYEE_ID,
					organizationId: EMPLOYEE_ORGANIZATION_ID,
					tenantId: TENANT_ID
				} as any);
				// The overlap lookup answers as GetConflictTimeLogHandler filters (tenant, organization, employee), and
				// the trim records which interval's slot it deleted.
				execute.mockImplementation(async (command: unknown) => {
					if (command instanceof IGetConflictTimeLogCommand) {
						const { tenantId, organizationId, employeeId } = command.input;
						return stored
							.filter(
								(log) =>
									log.tenantId === tenantId &&
									log.organizationId === organizationId &&
									log.employeeId === employeeId
							)
							.map((log) => ({ ...log, timeSlots: [{ id: `${log.id}-slot` }] }));
					}
					if (command instanceof DeleteTimeSpanCommand) {
						deleted.push(command.timeLog.id);
					}
					return undefined;
				});
			});

			it('an update naming an employee of another organization is refused and writes nothing', async () => {
				const refusal = await update(OTHER_ORGANIZATION_EMPLOYEE_ID).catch((thrown) => thrown);

				// 403, as the move refusal for a caller without CHANGE_SELECTED_EMPLOYEE answers.
				expect(refusal).toBeInstanceOf(ForbiddenException);
				expect((refusal as ForbiddenException).message).toBe(CROSS_ORGANIZATION);
				expect(commandsOfType(TimeLogUpdateCommand)).toHaveLength(0);
				expect(commandsOfType(IGetConflictTimeLogCommand)).toHaveLength(0);
				expect(deleted).toEqual([]);
			});

			it("the conflict cleanup of an update never deletes another organization's slots", async () => {
				// Naming the other organization in the body as well changes nothing: the log is not moved there.
				const across = await update(OTHER_ORGANIZATION_EMPLOYEE_ID, OTHER_ORGANIZATION_ID).catch(
					(thrown) => thrown
				);
				expect(across).toBeInstanceOf(ForbiddenException);
				expect(deleted).toEqual([]);

				// The cleanup that does run looks in the log's own organization, whatever the body names.
				await update(SAME_ORGANIZATION_EMPLOYEE_ID, OTHER_ORGANIZATION_ID);

				expect(commandsOfType(IGetConflictTimeLogCommand).map((command) => command.input)).toEqual([
					expect.objectContaining({
						organizationId: EMPLOYEE_ORGANIZATION_ID,
						employeeId: SAME_ORGANIZATION_EMPLOYEE_ID
					})
				]);
				expect(deleted).toEqual(['same-org-log']);
			});

			it('CONTROL: an update moving the log to another employee of the same organization still works for a CHANGE_SELECTED_EMPLOYEE caller', async () => {
				await update(SAME_ORGANIZATION_EMPLOYEE_ID);

				expect(commandsOfType(TimeLogUpdateCommand).map((command) => command.input.employeeId)).toEqual([
					SAME_ORGANIZATION_EMPLOYEE_ID
				]);
			});
		});

		/**
		 * A move to another employee of the same organization stays allowed, and the log takes everything that is
		 * its own with it. `TimeLogUpdateHandler` wrote the new employee onto the row but kept the PREVIOUS employee
		 * for the timesheet, the time slots and the worked hours — so the log pointed at one employee while its
		 * timesheet, its slots and its hours stayed with the other. These run the real handler behind the real
		 * service, with the repositories and the other commands scripted as the handler specs script them.
		 */
		describe('a same-organization employee move (real TimeLogUpdateHandler)', () => {
			const PREVIOUS = TARGET_EMPLOYEE_ID;
			const NEXT = '4d5e6f7a-8b9c-4dae-9f0a-3b4c5d6e7f80';
			const STARTED_AT = new Date('2026-01-05T09:00:00.000Z');
			const STOPPED_AT = new Date('2026-01-05T10:00:00.000Z');
			const TRACKED = 'A time log with tracked activity or screenshots cannot be moved to another employee';

			type Slot = {
				id: string;
				employeeId: string;
				organizationId: string;
				tenantId: string;
				startedAt: Date;
				timeLogs: Array<{ id: string }>;
				screenshots: unknown[];
				activities: unknown[];
				timeSlotMinutes: unknown[];
				keyboard?: number;
				mouse?: number;
				deletedAt?: Date;
			};

			let row: TimeLog;
			let slots: Slot[];
			let recalculated: string[];
			let workedHours: string[];
			/** When set, saving the log fails with it (a lost connection, a constraint). */
			let saveFailure: Error | undefined;

			const slotsOf = (employeeId: string) =>
				slots.filter((slot) => !slot.deletedAt && slot.employeeId === employeeId);

			beforeEach(() => {
				recalculated = [];
				workedHours = [];
				saveFailure = undefined;
				// The log and the previous employee's six ten-minute slots of it, as the create left them.
				row = Object.assign(new TimeLog(), {
					id: 'log-1',
					tenantId: TENANT_ID,
					organizationId: EMPLOYEE_ORGANIZATION_ID,
					employeeId: PREVIOUS,
					timesheetId: `timesheet-${PREVIOUS}`,
					startedAt: STARTED_AT,
					stoppedAt: STOPPED_AT,
					logType: TimeLogType.MANUAL,
					source: TimeLogSourceEnum.WEB_TIMER
				});
				slots = generateTimeSlots(STARTED_AT, STOPPED_AT).map((slot, index) => ({
					id: `slot-${index}`,
					employeeId: PREVIOUS,
					organizationId: EMPLOYEE_ORGANIZATION_ID,
					tenantId: TENANT_ID,
					startedAt: new Date(slot.startedAt),
					timeLogs: [{ id: 'log-1' }],
					screenshots: [],
					activities: [],
					timeSlotMinutes: []
				}));

				jest.spyOn(manualService as any, 'findEmployeeInTenant').mockImplementation(
					async (employeeId: any) => ({
						id: employeeId,
						organizationId: EMPLOYEE_ORGANIZATION_ID,
						organization: { id: EMPLOYEE_ORGANIZATION_ID, futureDateAllowed: true, allowManualTime: true }
					})
				);
				// The stored log as the service reads it (its own instance), with the slots it is linked to.
				jest.spyOn(manualService, 'findOneByIdString').mockImplementation(async () =>
					Object.assign(new TimeLog(), row, {
						timeSlots: slots.filter(
							(slot) => !slot.deletedAt && slot.timeLogs.some((log) => log.id === row.id)
						)
					})
				);

				const timeLogRepository = {
					findOneBy: jest.fn(async (where: { id: string }) => (where.id === row.id ? row : null)),
					update: jest.fn(async (_where: unknown, changes: Partial<TimeLog>) => {
						Object.assign(row, changes);
						return { affected: 1 };
					}),
					// Saving a log with `timeSlots` makes them its slots (the join rows), as TypeORM persists the relation.
					save: jest.fn(async (log: TimeLog) => {
						if (saveFailure) {
							throw saveFailure;
						}
						// The saved columns are the row's (a move saves the log once, instead of an update).
						const { timeSlots: _relation, ...columns } = log as TimeLog & { timeSlots?: unknown };
						if (log.id === row.id && log !== row) {
							Object.assign(row, columns);
						}
						if (Array.isArray(log.timeSlots)) {
							const linked = new Set(log.timeSlots.map((slot) => slot.id));
							for (const slot of slots.filter((stored) => !stored.deletedAt)) {
								const others = slot.timeLogs.filter((timeLog) => timeLog.id !== log.id);
								slot.timeLogs = linked.has(slot.id) ? [...others, { id: log.id }] : others;
							}
						}
						return log;
					})
				};
				const timeSlotRepository = {
					createQueryBuilder: () => {
						const params: Record<string, any> = {};
						const builder = {
							alias: 'time_slot',
							leftJoinAndSelect: () => builder,
							where: (_sql: string, values: Record<string, unknown>) => (
								Object.assign(params, values),
								builder
							),
							andWhere: (_sql: string, values: Record<string, unknown>) => (
								Object.assign(params, values),
								builder
							),
							getParameters: () => params,
							// The join-row operations of `relation(TimeSlot, 'timeLogs').of(slot)`.
							relation: () => ({
								of: (slotId: string) => ({
									remove: async (timeLogId: string) => {
										const stored = slots.find((candidate) => candidate.id === slotId);
										if (stored) {
											stored.timeLogs = stored.timeLogs.filter((log) => log.id !== timeLogId);
										}
									}
								})
							}),
							getMany: async () =>
								slots.filter(
									(slot) =>
										!slot.deletedAt &&
										slot.organizationId === params.organizationId &&
										slot.tenantId === params.tenantId &&
										slot.employeeId === params.employeeId &&
										(!params.startTimes ||
											(params.startTimes as Date[]).some(
												(time) => time.getTime() === slot.startedAt.getTime()
											)) &&
										(!params.timeSlotsIds || (params.timeSlotsIds as string[]).includes(slot.id))
								)
						};
						return builder;
					},
					softRemove: jest.fn(async (removed: Slot | Slot[]) => {
						[removed].flat().forEach((slot) => (slot.deletedAt = new Date()));
						return removed;
					})
				};
				const timeSlotService = {
					generateTimeSlots: (start: Date, end: Date) => generateTimeSlots(start, end),
					// As TimeSlotBulkCreateHandler: a slot the employee already has at that start is not created again
					// (nor linked); a new one is linked to the slot's `timeLogId`; the employee's slots at those starts
					// are returned (what its merge answers).
					bulkCreate: jest.fn(async (created: any[], employeeId: string, organizationId: string) => {
						const starts = created.map((slot) => new Date(slot.startedAt).getTime());
						const missing = created.filter(
							(slot) =>
								!slotsOf(employeeId).some(
									(existing) => existing.startedAt.getTime() === new Date(slot.startedAt).getTime()
								)
						);
						slots.push(
							...missing.map((slot, index) => ({
								...slot,
								id: `slot-${employeeId}-${index}`,
								employeeId,
								organizationId,
								startedAt: new Date(slot.startedAt),
								// Linked only to a log already the employee's (the handler looks the log up by employee).
								timeLogs: row.employeeId === employeeId ? [{ id: slot.timeLogId }] : [],
								screenshots: [],
								activities: [],
								timeSlotMinutes: []
							}))
						);
						return slotsOf(employeeId).filter((slot) => starts.includes(slot.startedAt.getTime()));
					})
				};
				const handler = new TimeLogUpdateHandler(
					{ execute } as any,
					timeLogRepository as any,
					timeSlotRepository as any,
					{} as any,
					timeSlotService as any
				);
				Object.defineProperty(handler, 'ormType', { value: MultiORMEnum.TypeORM });
				// The slot cleanup the log-delete path uses, real, over the same scripted slots.
				const bulkDelete = new TimeSlotBulkDeleteHandler(timeSlotRepository as any, {} as any);
				Object.defineProperty(bulkDelete, 'ormType', { value: MultiORMEnum.TypeORM });
				jest.spyOn(console, 'log').mockImplementation(() => undefined);

				execute.mockImplementation(async (command: unknown) => {
					if (command instanceof TimeLogUpdateCommand) return handler.execute(command);
					if (command instanceof TimeSlotBulkDeleteCommand) return bulkDelete.execute(command);
					if (command instanceof IGetConflictTimeLogCommand) return [];
					if (command instanceof TimesheetFirstOrCreateCommand)
						return { id: `timesheet-${command.employeeId}` };
					if (command instanceof TimesheetRecalculateCommand)
						return void recalculated.push(String(command.id));
					if (command instanceof UpdateEmployeeTotalWorkedHoursCommand) {
						return void workedHours.push(String(command.employeeId));
					}
					return undefined;
				});
			});

			const move = (startedAt = STARTED_AT, stoppedAt = STOPPED_AT) =>
				manualService.updateManualTime('log-1', {
					...request,
					employeeId: NEXT,
					organizationId: EMPLOYEE_ORGANIZATION_ID,
					startedAt,
					stoppedAt
				});

			/** One stored slot of the scripted tenant. */
			const slot = (id: string, employeeId: string, at: string, logs: string[]): Slot => ({
				id,
				employeeId,
				organizationId: EMPLOYEE_ORGANIZATION_ID,
				tenantId: TENANT_ID,
				startedAt: new Date(at),
				timeLogs: logs.map((log) => ({ id: log })),
				screenshots: [],
				activities: [],
				timeSlotMinutes: []
			});
			const logsOf = (stored: Slot) => stored.timeLogs.map((log) => log.id).sort();

			it("moving one of two logs that share a slot keeps the other log's time for the previous employee", async () => {
				// 09:00–09:05 (this log) and 09:05–09:10 (log-2, the previous employee's too) share the 09:00 slot.
				Object.assign(row, {
					startedAt: new Date('2026-01-05T09:00:00.000Z'),
					stoppedAt: new Date('2026-01-05T09:05:00.000Z')
				});
				slots = [slot('shared', PREVIOUS, '2026-01-05T09:00:00.000Z', ['log-1', 'log-2'])];

				await move(row.startedAt, row.stoppedAt);

				// As deleting the log would: the slot log-2 still holds stays the previous employee's, without this log.
				expect(slotsOf(PREVIOUS).map((stored) => [stored.id, logsOf(stored)])).toEqual([['shared', ['log-2']]]);
				// ...and the log's time is the new employee's.
				expect(slotsOf(NEXT).map((stored) => [stored.startedAt.toISOString(), logsOf(stored)])).toEqual([
					['2026-01-05T09:00:00.000Z', ['log-1']]
				]);
			});

			it("keeps the previous employee's slot at one of the log's start times when another log holds it and this one does not", async () => {
				// 09:05–09:15 covers the 09:00 and 09:10 slots; the 09:10 slot is log-2's alone (this log was never
				// linked to it). The previous employee's slots are read by start time, so only the link decides.
				Object.assign(row, {
					startedAt: new Date('2026-01-05T09:05:00.000Z'),
					stoppedAt: new Date('2026-01-05T09:15:00.000Z')
				});
				slots = [
					slot('mine-0900', PREVIOUS, '2026-01-05T09:00:00.000Z', ['log-1']),
					slot('neighbour-0910', PREVIOUS, '2026-01-05T09:10:00.000Z', ['log-2'])
				];

				await move(row.startedAt, row.stoppedAt);

				expect(slotsOf(PREVIOUS).map((stored) => [stored.id, logsOf(stored)])).toEqual([
					['neighbour-0910', ['log-2']]
				]);
				expect(slots.find((stored) => stored.id === 'mine-0900')?.deletedAt).toBeInstanceOf(Date);
			});

			it("a moved log is linked to the new employee's existing slot at the same boundary", async () => {
				// The new employee already has the 09:00 slot (their own 09:00–09:05 log-3); this log is 09:05–09:10.
				Object.assign(row, {
					startedAt: new Date('2026-01-05T09:05:00.000Z'),
					stoppedAt: new Date('2026-01-05T09:10:00.000Z')
				});
				slots = [
					slot('previous-0900', PREVIOUS, '2026-01-05T09:00:00.000Z', ['log-1']),
					slot('next-0900', NEXT, '2026-01-05T09:00:00.000Z', ['log-3'])
				];

				await move(row.startedAt, row.stoppedAt);

				expect(slotsOf(PREVIOUS)).toEqual([]);
				// The slot is not created twice; the moved log is linked to the one the new employee has.
				expect(slotsOf(NEXT).map((stored) => [stored.id, logsOf(stored)])).toEqual([
					['next-0900', ['log-1', 'log-3']]
				]);
			});

			it("a same-organization employee move re-homes the log's timesheet and slots and recalculates both employees", async () => {
				await move();

				// The row, its timesheet and its slots are the new employee's.
				expect(row).toMatchObject({ employeeId: NEXT, timesheetId: `timesheet-${NEXT}` });
				expect(slotsOf(PREVIOUS)).toEqual([]);
				expect(slotsOf(NEXT).map((slot) => slot.startedAt.toISOString())).toEqual(
					generateTimeSlots(STARTED_AT, STOPPED_AT).map((slot) => new Date(slot.startedAt).toISOString())
				);
				expect(slotsOf(NEXT).every((slot) => slot.timeLogs.some((log) => log.id === 'log-1'))).toBe(true);
				// Both timesheets and both employees' worked hours are recalculated.
				expect([...recalculated].sort()).toEqual([`timesheet-${NEXT}`, `timesheet-${PREVIOUS}`].sort());
				expect([...workedHours].sort()).toEqual([NEXT, PREVIOUS].sort());
			});

			it.each(['keyboard', 'mouse'] as const)(
				'refuses to move a log one of whose slots carries %s activity alone',
				async (input) => {
					slots[4][input] = 12;

					const refusal = await move().catch((thrown) => thrown);

					expect(refusal).toBeInstanceOf(ForbiddenException);
					expect((refusal as ForbiddenException).message).toBe(TRACKED);
					expect(commandsOfType(TimeLogUpdateCommand)).toHaveLength(0);
					expect(slotsOf(PREVIOUS)).toHaveLength(6);
				}
			);

			it('refuses to move a log whose slots carry tracked screenshots or activity, before writing anything', async () => {
				slots[2].screenshots = [{ id: 'screenshot-1' }];

				const refusal = await move().catch((thrown) => thrown);

				// The capture is the previous employee's; moving it would attribute it to someone else.
				expect(refusal).toBeInstanceOf(ForbiddenException);
				expect((refusal as ForbiddenException).message).toBe(TRACKED);
				expect(commandsOfType(IGetConflictTimeLogCommand)).toHaveLength(0);
				expect(commandsOfType(TimeLogUpdateCommand)).toHaveLength(0);
				expect(row).toMatchObject({ employeeId: PREVIOUS, timesheetId: `timesheet-${PREVIOUS}` });
				expect(slotsOf(PREVIOUS)).toHaveLength(6);
			});

			it.each([TimeLogSourceEnum.WEB_TIMER, TimeLogSourceEnum.DESKTOP])(
				"shortening a log that shares a boundary slot with a neighbour keeps the neighbour's slot (%s)",
				async (source) => {
					// 09:00–09:15 holds the 09:00 slot alone and shares the 09:10 one with log-2 (09:15–09:20).
					Object.assign(row, {
						source,
						startedAt: new Date('2026-01-05T09:00:00.000Z'),
						stoppedAt: new Date('2026-01-05T09:15:00.000Z')
					});
					slots = [
						slot('mine-0900', PREVIOUS, '2026-01-05T09:00:00.000Z', ['log-1']),
						slot('shared-0910', PREVIOUS, '2026-01-05T09:10:00.000Z', ['log-1', 'log-2'])
					];

					// Shortened to 09:00–09:10: the 09:10 slot leaves this log, and stays log-2's.
					await manualService.updateManualTime('log-1', {
						...request,
						employeeId: PREVIOUS,
						organizationId: EMPLOYEE_ORGANIZATION_ID,
						startedAt: new Date('2026-01-05T09:00:00.000Z'),
						stoppedAt: new Date('2026-01-05T09:10:00.000Z')
					});

					expect(slotsOf(PREVIOUS).map((stored) => [stored.id, logsOf(stored)])).toEqual([
						['mine-0900', ['log-1']],
						['shared-0910', ['log-2']]
					]);
				}
			);

			it("a failed save during a move is reported and leaves the previous employee's slots untouched", async () => {
				saveFailure = new Error('connection lost');

				const failure = await move().catch((thrown) => thrown);

				// The route answers the failure instead of the row as if it had moved…
				expect(failure).toBeInstanceOf(Error);
				expect((failure as Error).message).toContain('connection lost');
				// …and nothing of the previous employee's was touched: the log, its timesheet and its six slots.
				expect(row).toMatchObject({ employeeId: PREVIOUS, timesheetId: `timesheet-${PREVIOUS}` });
				expect(slotsOf(PREVIOUS).map((stored) => logsOf(stored))).toEqual(Array(6).fill(['log-1']));
				expect(workedHours).toEqual([]);
			});

			it('a failed save during a same-employee edit is reported, before any slot is released', async () => {
				saveFailure = new Error('connection lost');

				// Shortened to 09:00–09:40: the 09:40 and 09:50 slots would be released after the save.
				const failure = await manualService
					.updateManualTime('log-1', {
						...request,
						employeeId: PREVIOUS,
						organizationId: EMPLOYEE_ORGANIZATION_ID,
						startedAt: STARTED_AT,
						stoppedAt: new Date('2026-01-05T09:40:00.000Z')
					})
					.catch((thrown) => thrown);

				expect(failure).toBeInstanceOf(Error);
				expect((failure as Error).message).toContain('connection lost');
				expect(slotsOf(PREVIOUS)).toHaveLength(6);
			});

			it('CONTROL: an edit that keeps the employee leaves the timesheet, the slots and the hours where they are', async () => {
				await manualService.updateManualTime('log-1', {
					...request,
					employeeId: PREVIOUS,
					organizationId: EMPLOYEE_ORGANIZATION_ID,
					startedAt: STARTED_AT,
					stoppedAt: STOPPED_AT
				});

				expect(row).toMatchObject({ employeeId: PREVIOUS, timesheetId: `timesheet-${PREVIOUS}` });
				expect(slotsOf(NEXT)).toEqual([]);
				expect(slotsOf(PREVIOUS)).toHaveLength(6);
				expect(recalculated).toEqual([`timesheet-${PREVIOUS}`]);
				expect(workedHours).toEqual([PREVIOUS]);
			});
		});
	});

	/**
	 * The GraphQL report resolvers pass every optional argument by name, so a query that omits
	 * `isEdited` reaches the service with the key present and its value `undefined`. The guard only
	 * checked `'isEdited' in request`, so that request was read as `isEdited: false` and every edited
	 * log was dropped from the report (`editedAt IS NULL`).
	 */
	describe('isEdited filter', () => {
		const request: IGetTimeLogReportInput = {
			organizationId: ORGANIZATION_ID,
			employeeIds: [TARGET_EMPLOYEE_ID],
			startDate: '2026-01-05T00:00:00.000Z',
			endDate: '2026-01-12T00:00:00.000Z',
			timeZone: 'UTC'
		};
		const editedFilters = (conditions: string[]) => conditions.filter((condition) => condition.includes('editedAt'));
		const buildMikroOrmWhere = (input: IGetTimeLogReportInput) =>
			(service as unknown as { buildMikroOrmTimeLogWhere(i: IGetTimeLogReportInput): Promise<any> })
				.buildMikroOrmTimeLogWhere(input);

		beforeEach(() => {
			mockRequestContext({
				tenantId: TENANT_ID,
				user: { id: USER_ID, employeeId: CURRENT_EMPLOYEE_ID },
				canChangeSelectedEmployee: true
			});
		});

		it.each([undefined, null])('TypeORM: an isEdited key set to %p applies no editedAt filter', async (value) => {
			await service.getTimeLogs({ ...request, isEdited: value } as IGetTimeLogReportInput);

			expect(editedFilters(executedFilters(builder).conditions)).toEqual([]);
		});

		it('TypeORM: isEdited false still keeps only unedited logs', async () => {
			await service.getTimeLogs({ ...request, isEdited: false });

			expect(editedFilters(executedFilters(builder).conditions)).toEqual(['"time_log"."editedAt" IS NULL']);
		});

		it('TypeORM: isEdited true still keeps only edited logs', async () => {
			await service.getTimeLogs({ ...request, isEdited: true });

			expect(editedFilters(executedFilters(builder).conditions)).toEqual(['"time_log"."editedAt" IS NOT NULL']);
		});

		it.each([undefined, null])('MikroORM: an isEdited key set to %p applies no editedAt filter', async (value) => {
			const where = await buildMikroOrmWhere({ ...request, isEdited: value } as IGetTimeLogReportInput);

			expect(where).not.toHaveProperty('editedAt');
		});

		it('MikroORM: isEdited false and true still filter on editedAt', async () => {
			expect(await buildMikroOrmWhere({ ...request, isEdited: false })).toHaveProperty('editedAt', null);
			expect(await buildMikroOrmWhere({ ...request, isEdited: true })).toHaveProperty('editedAt', { $ne: null });
		});
	});
});
