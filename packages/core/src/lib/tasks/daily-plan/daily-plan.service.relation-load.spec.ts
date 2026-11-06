import '../../core/entities/internal';

import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { DailyPlanService } from './daily-plan.service';

const TENANT_ID = '2a5d5f2e-0c4e-4f2b-9a0b-3d6a4b2f1c11';
const ORGANIZATION_ID = '8b1f0e3a-7c2d-4a5e-b6f7-1d2e3f4a5b6c';
const TEAM_ID = '5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9';
const EMPLOYEE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const TASK_ID = '0f1e2d3c-4b5a-4968-8776-655443322110';

/** The query-builder calls a plan list makes, kept for the assertions. */
class PlanListQueryBuilder {
	readonly alias = 'daily_plan';
	readonly joins: Array<{ kind: 'leftJoin' | 'leftJoinAndSelect'; path: string; alias: string }> = [];
	findOptions: Record<string, unknown> | undefined;

	leftJoin(path: string, alias: string): this {
		this.joins.push({ kind: 'leftJoin', path, alias });
		return this;
	}

	leftJoinAndSelect(path: string, alias: string): this {
		this.joins.push({ kind: 'leftJoinAndSelect', path, alias });
		return this;
	}

	setFindOptions(options: Record<string, unknown>): this {
		this.findOptions = options;
		return this;
	}

	where(): this {
		return this;
	}

	andWhere(): this {
		return this;
	}

	orderBy(): this {
		return this;
	}

	addOrderBy(): this {
		return this;
	}

	skip(): this {
		return this;
	}

	take(): this {
		return this;
	}

	subQuery(): PlanListQueryBuilder {
		return this;
	}

	select(): this {
		return this;
	}

	from(): this {
		return this;
	}

	distinct(): this {
		return this;
	}

	getQuery(): string {
		return '(SELECT 1)';
	}

	async getManyAndCount(): Promise<[unknown[], number]> {
		return [[], 0];
	}
}

/**
 * Joined onto the plan rows, the relations the Teams app asks for (`employee.user`, `tasks.members.user`)
 * multiplied each plan by its tasks and each task by its members (49 plans came back as 2,033 rows on
 * production). The lists now load their relations with one query per relation.
 */
describe('DailyPlanService — how a plan list loads its relations', () => {
	let service: DailyPlanService;
	let builder: PlanListQueryBuilder;

	beforeEach(() => {
		builder = new PlanListQueryBuilder();
		service = new DailyPlanService(
			{
				metadata: {
					tableName: 'daily_plan',
					hasColumnWithPropertyPath: (path: string) =>
						['employeeId', 'tenantId', 'organizationId', 'organizationTeamId'].includes(path)
				},
				createQueryBuilder: () => builder
			} as any,
			{} as any,
			{} as any,
			{} as any,
			{ isMemberOfTeam: jest.fn(async () => true), canManageEmployee: jest.fn(async () => true) } as any
		);
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE_ID);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1', employeeId: EMPLOYEE_ID } as any);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
	});

	afterEach(() => jest.restoreAllMocks());

	const where = { tenantId: TENANT_ID, organizationId: ORGANIZATION_ID, organizationTeamId: TEAM_ID };
	const teamsRelations = ['employee', 'tasks', 'employee.user', 'tasks.members', 'tasks.members.user'];

	describe('getMyPlans (GET /daily-plan/me)', () => {
		it('loads the requested relations with one query per relation, not joined', async () => {
			await service.getMyPlans({ where, relations: teamsRelations } as any);

			expect(builder.findOptions).toMatchObject({
				relations: { employee: { user: true }, tasks: { members: { user: true } } },
				relationLoadStrategy: 'query'
			});
			// No join at all: one row per plan.
			expect(builder.joins).toEqual([]);
		});

		it('states no load strategy, and joins as before, when no relation is asked for', async () => {
			await service.getMyPlans({ where } as any);

			expect(builder.findOptions).not.toHaveProperty('relationLoadStrategy');
			expect(builder.findOptions).not.toHaveProperty('relations');
			expect(builder.joins.map(({ kind }) => kind)).toEqual(['leftJoin', 'leftJoin']);
		});
	});

	describe('getTeamDailyPlans (GET /daily-plan)', () => {
		it('loads employee, tasks and the requested relations with one query each', async () => {
			await service.getTeamDailyPlans({ where, relations: ['tasks'] } as any);

			expect(builder.findOptions).toMatchObject({
				relations: { employee: true, tasks: true },
				relationLoadStrategy: 'query'
			});
			// No join at all: the relations carry the rows, one row per plan.
			expect(builder.joins).toEqual([]);
		});

		it('keeps a deeper request at its depth', async () => {
			await service.getTeamDailyPlans({ where, relations: teamsRelations } as any);

			expect(builder.findOptions).toMatchObject({
				relations: { employee: { user: true }, tasks: { members: { user: true } } }
			});
		});

		it('joins and selects employee and tasks itself when no relation is asked for', async () => {
			await service.getTeamDailyPlans({ where } as any);

			expect(builder.findOptions).not.toHaveProperty('relationLoadStrategy');
			expect(builder.joins.map(({ kind }) => kind)).toEqual(['leftJoinAndSelect', 'leftJoinAndSelect']);
		});
	});

	describe('getDailyPlansByTask (GET /daily-plan/task/:id)', () => {
		it('loads the employee, their user and the tasks with one query each', async () => {
			await service.getDailyPlansByTask({ where } as any, TASK_ID);

			expect(builder.findOptions).toEqual({
				relations: { employee: { user: true }, tasks: true },
				relationLoadStrategy: 'query'
			});
			expect(builder.joins).toEqual([]);
		});
	});
});
