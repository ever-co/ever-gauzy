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
import { IGetTimeLogReportInput, IUser, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { TimeLogService } from './time-log.service';

const TENANT_ID = '5a1c2f0e-6d3b-4c8a-9e2f-1b7d4a6c8e90';
const ORGANIZATION_ID = '0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f';
const USER_ID = 'c3b2a190-8f7e-4d6c-9b5a-4e3d2c1b0a9f';
const CURRENT_EMPLOYEE_ID = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928';
const TARGET_EMPLOYEE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

type RecordedClause = { condition: unknown; parameters?: Record<string, unknown> };

/**
 * Stand-in for TypeORM's SelectQueryBuilder that keeps only what the regression depends on:
 * `where(callback)` clears the clause list and runs the callback synchronously (typeorm
 * `SelectQueryBuilder.where` -> `QueryBuilder.getWhereCondition`), and `getMany()` renders whatever
 * clauses exist at that instant. A filter added by a promise still pending when `getMany()` runs
 * never reaches the SQL, which is the defect this suite guards against.
 */
class RecordingQueryBuilder {
	readonly alias = 'time_log';
	/** Clauses present when `getMany()` ran, i.e. the ones that would have reached the SQL. */
	executedClauses: RecordedClause[] | null = null;
	private clauses: RecordedClause[] = [];

	innerJoin(): this {
		return this;
	}

	setFindOptions(): this {
		return this;
	}

	where(where: unknown, parameters?: Record<string, unknown>): this {
		this.clauses = [];
		if (typeof where === 'function') {
			where(this);
		} else {
			this.clauses.push({ condition: where, parameters });
		}
		return this;
	}

	andWhere(condition: unknown, parameters?: Record<string, unknown>): this {
		this.clauses.push({ condition, parameters });
		return this;
	}

	async getMany(): Promise<never[]> {
		this.executedClauses = [...this.clauses];
		return [];
	}
}

describe('TimeLogService', () => {
	let service: TimeLogService;
	let builder: RecordingQueryBuilder;
	let canManageEmployees: jest.Mock;

	beforeEach(async () => {
		builder = new RecordingQueryBuilder();
		canManageEmployees = jest.fn();

		const module: TestingModule = await Test.createTestingModule({
			providers: [TimeLogService]
		})
			/**
			 * Every dependency is automocked to an empty object, except the three the report
			 * methods actually touch: the TypeORM repository (hands out the recording builder),
			 * the manager check, and the command bus used by `getDailyReport` to group results.
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

		// The `Brackets` entry is the startedAt date range.
		const scopingConditions = [
			'"time_log"."tenantId" = :tenantId',
			'"time_log"."organizationId" = :organizationId',
			'"time_log"."employeeId" IN (:...employeeIds)',
			'Brackets'
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

		const actAs = (caller: { canChangeSelectedEmployee: boolean }) => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: USER_ID,
				employeeId: CURRENT_EMPLOYEE_ID
			} as IUser);
			jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
				(permission) =>
					caller.canChangeSelectedEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);
		};

		/** Resolves on a later macrotask, like the repository round-trip behind the real manager check. */
		const resolveLater = (value: boolean) => () =>
			new Promise<boolean>((resolve) => setImmediate(() => resolve(value)));

		const executedFilters = () => {
			expect(builder.executedClauses).not.toBeNull();
			const clauses = builder.executedClauses as RecordedClause[];
			return {
				conditions: clauses.map(({ condition }) =>
					typeof condition === 'string'
						? condition.replace(/`/g, '"')
						: (condition as object).constructor.name
				),
				parameters: Object.assign({}, ...clauses.map(({ parameters }) => parameters ?? {}))
			};
		};

		it.each<[string, (input: IGetTimeLogReportInput) => Promise<unknown>]>(reportMethods)(
			'%s applies the tenant, organization, employee and date filters before executing for a manager',
			async (_name, run) => {
				actAs({ canChangeSelectedEmployee: false });
				canManageEmployees.mockImplementation(resolveLater(true));

				await run(request);

				expect(canManageEmployees).toHaveBeenCalledWith([TARGET_EMPLOYEE_ID], []);
				const { conditions, parameters } = executedFilters();
				expect(conditions).toEqual(expect.arrayContaining(scopingConditions));
				expect(parameters).toEqual(
					expect.objectContaining({
						tenantId: TENANT_ID,
						organizationId: ORGANIZATION_ID,
						employeeIds: [TARGET_EMPLOYEE_ID]
					})
				);
			}
		);

		it('narrows a caller who does not manage the requested employees to their own logs', async () => {
			actAs({ canChangeSelectedEmployee: false });
			canManageEmployees.mockImplementation(resolveLater(false));

			await service.getDailyReport(request);

			const { conditions, parameters } = executedFilters();
			expect(conditions).toEqual(expect.arrayContaining(scopingConditions));
			expect(parameters).toEqual(expect.objectContaining({ employeeIds: [CURRENT_EMPLOYEE_ID] }));
		});

		it('keeps the requested employees for a caller with CHANGE_SELECTED_EMPLOYEE', async () => {
			actAs({ canChangeSelectedEmployee: true });

			await service.getDailyReport(request);

			expect(canManageEmployees).not.toHaveBeenCalled();
			const { conditions, parameters } = executedFilters();
			expect(conditions).toEqual(expect.arrayContaining(scopingConditions));
			expect(parameters).toEqual(expect.objectContaining({ employeeIds: [TARGET_EMPLOYEE_ID] }));
		});

		it('honours onlyMe without consulting the manager check', async () => {
			actAs({ canChangeSelectedEmployee: false });

			await service.getDailyReport({ ...request, onlyMe: true });

			expect(canManageEmployees).not.toHaveBeenCalled();
			const { conditions, parameters } = executedFilters();
			expect(conditions).toEqual(expect.arrayContaining(scopingConditions));
			expect(parameters).toEqual(expect.objectContaining({ employeeIds: [CURRENT_EMPLOYEE_ID] }));
		});
	});
});
