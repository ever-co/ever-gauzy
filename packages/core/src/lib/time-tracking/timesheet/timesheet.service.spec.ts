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
import { IGetTimesheetInput, IUser, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { TypeOrmTimesheetRepository } from './repository/type-orm-timesheet.repository';
import { TimeSheetService } from './timesheet.service';

const TENANT_ID = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const ORGANIZATION_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const USER_ID = 'd4c3b2a1-0f9e-4d8c-7b6a-5f4e3d2c1b0a';
const CURRENT_EMPLOYEE_ID = '6f5e4d3c-2b1a-4098-8f7e-6d5c4b3a2918';
const TARGET_EMPLOYEE_ID = '3a4b5c6d-7e8f-4a9b-8c0d-1e2f3a4b5c6d';

type RecordedClause = { condition: unknown; parameters?: Record<string, unknown> };

/**
 * Stand-in for TypeORM's SelectQueryBuilder that keeps only what matters here: `where(callback)`
 * clears the clause list and runs the callback synchronously, and the terminal calls render
 * whatever clauses exist at that instant. Same double as in time-log.service.spec.ts, since both
 * services attach their tenant scoping through the same filter-helper pattern.
 */
class RecordingQueryBuilder {
	readonly alias = 'timesheet';
	/** Clauses present when the query executed, i.e. the ones that would have reached the SQL. */
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

	async getCount(): Promise<number> {
		this.executedClauses = [...this.clauses];
		return 0;
	}

	async getMany(): Promise<never[]> {
		this.executedClauses = [...this.clauses];
		return [];
	}
}

describe('TimeSheetService', () => {
	let service: TimeSheetService;
	let builder: RecordingQueryBuilder;

	beforeEach(async () => {
		builder = new RecordingQueryBuilder();

		const module: TestingModule = await Test.createTestingModule({
			providers: [TimeSheetService]
		})
			// Every dependency is automocked except the TypeORM repository, which hands out the recording builder.
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

	afterEach(() => {
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

		// The `Brackets` entry carries the startedAt range together with the status and employee predicates.
		const scopingConditions = [
			'Brackets',
			'"timesheet"."tenantId" = :tenantId',
			'"timesheet"."organizationId" = :organizationId'
		];

		const queries: Array<[string, (input: IGetTimesheetInput) => Promise<unknown>]> = [
			['getTimeSheetCount', (input) => service.getTimeSheetCount(input)],
			['getTimeSheets', (input) => service.getTimeSheets(input)]
		];

		const actAsEmployee = () => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: USER_ID,
				employeeId: CURRENT_EMPLOYEE_ID
			} as IUser);
			jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
				(permission) => permission !== PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);
		};

		it.each<[string, (input: IGetTimesheetInput) => Promise<unknown>]>(queries)(
			'%s applies the tenant, organization and date filters before executing',
			async (_name, run) => {
				actAsEmployee();

				await run(request);

				expect(builder.executedClauses).not.toBeNull();
				const clauses = builder.executedClauses as RecordedClause[];
				const conditions = clauses.map(({ condition }) =>
					typeof condition === 'string'
						? condition.replace(/`/g, '"')
						: (condition as object).constructor.name
				);
				expect(conditions).toEqual(expect.arrayContaining(scopingConditions));
				expect(Object.assign({}, ...clauses.map(({ parameters }) => parameters ?? {}))).toEqual(
					expect.objectContaining({ tenantId: TENANT_ID, organizationId: ORGANIZATION_ID })
				);
			}
		);
	});
});
