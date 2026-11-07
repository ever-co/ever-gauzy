import '../../core/entities/internal';
import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { IGetTimeLogReportInput } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { executedFilters, mockRequestContext, RecordingQueryBuilder } from '../testing/recording-query-builder';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { TimeLogService } from './time-log.service';

const TENANT_ID = '5a1c2f0e-6d3b-4c8a-9e2f-1b7d4a6c8e90';
const ORGANIZATION_ID = '0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f';
const USER_ID = 'c3b2a190-8f7e-4d6c-9b5a-4e3d2c1b0a9f';
const EMPLOYEE_ID = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928';

/**
 * How a time-log query is held to the log's time slots.
 *
 * `getTimeLogs` used to INNER JOIN the slots to require one (and to filter on its activity), and when the caller
 * also asked for the `timeSlots` relation TypeORM joined them again: every log came back once per (slot × slot) —
 * on production 120 logs became 21,291 rows (5.8 s a call on average). The list now asks with an EXISTS sub-query
 * and joins the slots once at most, for the relation. The report queries, which read the slots' activity figures
 * through the `timeSlots` join, keep their conditions on that join.
 */
describe('TimeLogService — the time-slot scope of a query', () => {
	let service: TimeLogService;
	let builder: RecordingQueryBuilder;

	const request: IGetTimeLogReportInput = {
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		employeeIds: [EMPLOYEE_ID],
		startDate: '2026-11-01T00:00:00.000Z',
		endDate: '2026-11-08T00:00:00.000Z'
	};

	beforeEach(async () => {
		builder = new RecordingQueryBuilder('time_log');

		const module: TestingModule = await Test.createTestingModule({ providers: [TimeLogService] })
			.useMocker((token) => {
				if (token === TypeOrmTimeLogRepository) {
					return { metadata: { tableName: 'time_log' }, createQueryBuilder: () => builder };
				}
				if (token === ManagedEmployeeService) {
					return { canManageEmployees: jest.fn().mockResolvedValue(true) };
				}
				if (token === CommandBus) {
					return { execute: jest.fn().mockResolvedValue([]) };
				}
				return {};
			})
			.compile();

		service = module.get<TimeLogService>(TimeLogService);
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
		mockRequestContext({
			tenantId: TENANT_ID,
			user: { id: USER_ID, employeeId: EMPLOYEE_ID },
			canChangeSelectedEmployee: false
		});
	});

	afterEach(() => jest.restoreAllMocks());

	const slotScope = (conditions: string[]) => conditions.filter((condition) => condition.includes('slot'));

	describe('getTimeLogs', () => {
		it('joins the employee only: the slots are not joined onto the log rows', async () => {
			const innerJoin = jest.spyOn(builder, 'innerJoin');

			await service.getTimeLogs({ ...request, relations: ['project', 'timeSlots'] });

			expect(innerJoin.mock.calls.map(([, alias]) => alias)).toEqual(['employee']);
		});

		it('requires a slot of the organization with an EXISTS sub-query', async () => {
			await service.getTimeLogs(request);

			const { conditions, parameters } = executedFilters(builder);
			// The double renders the table and alias names as given; typeorm quotes them for the database.
			expect(slotScope(conditions)).toEqual([
				'EXISTS (SELECT 1 FROM time_slot_time_logs slotLog INNER JOIN time_slot slot ON "slot"."id" = "slotLog"."timeSlotId" WHERE "slotLog"."timeLogId" = "time_log"."id" AND "slot"."deletedAt" IS NULL AND "slot"."tenantId" = :slotTenantId AND "slot"."organizationId" = :slotOrganizationId)'
			]);
			expect(parameters).toEqual(
				expect.objectContaining({ slotTenantId: TENANT_ID, slotOrganizationId: ORGANIZATION_ID })
			);
			expect(parameters).not.toHaveProperty('slotActivityStart');
		});

		it('holds the slot to the activity range inside the sub-query, in slot seconds', async () => {
			await service.getTimeLogs({ ...request, activityLevel: { start: 10, end: 50 } });

			const { conditions, parameters } = executedFilters(builder);
			expect(slotScope(conditions)).toEqual([
				expect.stringContaining(
					'AND "slot"."overall" BETWEEN :slotActivityStart AND :slotActivityEnd)'
				)
			]);
			expect(parameters).toEqual(expect.objectContaining({ slotActivityStart: 60, slotActivityEnd: 300 }));
			expect(conditions).not.toContain('"timeSlots"."overall" BETWEEN :start AND :end');
		});
	});

	describe('the report queries', () => {
		it.each([
			['weekly', (s: TimeLogService, r: IGetTimeLogReportInput) => s.getWeeklyReport(r)],
			['daily', (s: TimeLogService, r: IGetTimeLogReportInput) => s.getDailyReport(r)],
			['daily chart', (s: TimeLogService, r: IGetTimeLogReportInput) => s.getDailyReportCharts(r)],
			['owed amount', (s: TimeLogService, r: IGetTimeLogReportInput) => s.getOwedAmountReport(r)],
			['owed amount chart', (s: TimeLogService, r: IGetTimeLogReportInput) => s.getOwedAmountReportCharts(r)],
			['time limit', (s: TimeLogService, r: IGetTimeLogReportInput) => s.getTimeLimit(r as any)]
		])('%s: joins the employee only and requires a slot in the activity range with EXISTS', async (_name, run) => {
			await run(service, { ...request, activityLevel: { start: 10, end: 50 } });

			expect(builder.expressionMap.joinAttributes.map(({ alias }) => alias.name)).toEqual(['employee']);
			const { conditions, parameters } = executedFilters(builder);
			expect(slotScope(conditions)).toEqual([
				'EXISTS (SELECT 1 FROM time_slot_time_logs slotLog INNER JOIN time_slot slot ON "slot"."id" = "slotLog"."timeSlotId" WHERE "slotLog"."timeLogId" = "time_log"."id" AND "slot"."deletedAt" IS NULL AND "slot"."tenantId" = :slotTenantId AND "slot"."organizationId" = :slotOrganizationId AND "slot"."overall" BETWEEN :slotActivityStart AND :slotActivityEnd)'
			]);
			expect(parameters).toEqual(expect.objectContaining({ slotActivityStart: 60, slotActivityEnd: 300 }));
			expect(conditions).not.toContain('"timeSlots"."overall" BETWEEN :start AND :end');
		});

		it('a query that does join the slots keeps its conditions on that join', async () => {
			builder.innerJoin('time_log.timeSlots', 'timeSlots');

			await service.getFilterTimeLogQuery(builder as any, { ...request, activityLevel: { start: 10, end: 50 } });
			await builder.getMany();

			const { conditions, parameters } = executedFilters(builder);
			expect(conditions).toEqual(
				expect.arrayContaining([
					'"timeSlots"."overall" BETWEEN :start AND :end',
					'"timeSlots"."tenantId" = :tenantId',
					'"timeSlots"."organizationId" = :organizationId'
				])
			);
			expect(parameters).toEqual(expect.objectContaining({ start: 60, end: 300 }));
			expect(slotScope(conditions).filter((condition) => condition.startsWith('EXISTS'))).toEqual([]);
		});
	});
});
