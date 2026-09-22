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
import { Between, In } from 'typeorm';
import * as moment from 'moment';
import { IGetTimesheetInput } from '@gauzy/contracts';
import { getDateRangeFormat, MultiORMEnum } from '../../core/utils';
import {
	executedFilters,
	mockRequestContext,
	nextMacrotask,
	RecordingQueryBuilder
} from '../testing/recording-query-builder';
import { TypeOrmTimesheetRepository } from './repository/type-orm-timesheet.repository';
import { TimeSheetService } from './timesheet.service';

const TENANT_ID = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const ORGANIZATION_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const USER_ID = 'd4c3b2a1-0f9e-4d8c-7b6a-5f4e3d2c1b0a';
const CURRENT_EMPLOYEE_ID = '6f5e4d3c-2b1a-4098-8f7e-6d5c4b3a2918';
const TARGET_EMPLOYEE_ID = '3a4b5c6d-7e8f-4a9b-8c0d-1e2f3a4b5c6d';

describe('TimeSheetService', () => {
	let service: TimeSheetService;
	let builder: RecordingQueryBuilder;

	beforeEach(async () => {
		builder = new RecordingQueryBuilder('timesheet');

		const module: TestingModule = await Test.createTestingModule({
			providers: [TimeSheetService]
		})
			// Every dependency is mocked to an empty object, except the TypeORM repository, which hands out the recording builder.
			.useMocker((token) =>
				token === TypeOrmTimesheetRepository
					? { metadata: { tableName: 'timesheet' }, createQueryBuilder: () => builder }
					: {}
			)
			.compile();

		service = module.get<TimeSheetService>(TimeSheetService);
		// The ORM switch is resolved from DB_ORM at module load; pin it so the suite ignores the local .env.
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
	});

	afterEach(async () => {
		// Let a helper left dangling by an un-awaited call settle while the context mocks are still in
		// place, so a regression fails on the assertions instead of crashing the worker.
		await nextMacrotask();
		jest.restoreAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('timesheet queries', () => {
		const request: IGetTimesheetInput = {
			organizationId: ORGANIZATION_ID,
			employeeIds: [TARGET_EMPLOYEE_ID],
			startDate: '2026-01-01T00:00:00.000Z',
			endDate: '2026-01-31T23:59:59.999Z'
		};

		// The startedAt range and the employee predicate live in the object literal inside the `Brackets`.
		const { start, end } = getDateRangeFormat(moment.utc(request.startDate), moment.utc(request.endDate));
		const scopingConditions = [
			'Brackets',
			'"timesheet"."tenantId" = :tenantId',
			'"timesheet"."organizationId" = :organizationId'
		];

		const queries: Array<[string, (input: IGetTimesheetInput) => Promise<unknown>]> = [
			['getTimeSheetCount', (input) => service.getTimeSheetCount(input)],
			['getTimeSheets', (input) => service.getTimeSheets(input)]
		];

		/**
		 * getFilterTimesheetQuery has no awaited operation today, so calling it inside a
		 * synchronous `where(callback)` would still attach every clause in time. Suspend it before
		 * it runs, the way the first await added to it would, so the suite fails as soon as the
		 * helper is called without being awaited again.
		 */
		const suspendFilterHelper = () => {
			const original = TimeSheetService.prototype.getFilterTimesheetQuery;
			jest.spyOn(service, 'getFilterTimesheetQuery').mockImplementation(async (qb, input) => {
				await nextMacrotask();
				return original.call(service, qb, input);
			});
		};

		it.each<[string, (input: IGetTimesheetInput) => Promise<unknown>]>(queries)(
			'%s applies the tenant, organization and date filters before executing',
			async (_name, run) => {
				mockRequestContext({
					tenantId: TENANT_ID,
					user: { id: USER_ID, employeeId: CURRENT_EMPLOYEE_ID },
					canChangeSelectedEmployee: false
				});
				suspendFilterHelper();

				await run(request);

				const { conditions, parameters, clauses } = executedFilters(builder);
				expect(conditions).toEqual(expect.arrayContaining(scopingConditions));
				expect(parameters).toEqual(
					expect.objectContaining({ tenantId: TENANT_ID, organizationId: ORGANIZATION_ID })
				);
				// A caller without CHANGE_SELECTED_EMPLOYEE is narrowed to their own employee id.
				expect(clauses.map(({ condition }) => condition)).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							startedAt: Between(start, end),
							employeeId: In([CURRENT_EMPLOYEE_ID])
						})
					])
				);
			}
		);
	});
});
