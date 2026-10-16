import '../../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { RequestContext } from '../../core/context';
import { TenantAwareCrudService } from '../../core/crud/tenant-aware-crud.service';
import { MultiORMEnum } from '../../core/utils';
import { DailyPlanService } from './daily-plan.service';

const TENANT_ID = '2a5d5f2e-0c4e-4f2b-9a0b-3d6a4b2f1c11';
const ORGANIZATION_ID = '8b1f0e3a-7c2d-4a5e-b6f7-1d2e3f4a5b6c';
const MANAGED_TEAM_ID = '5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9';
const OTHER_TEAM_ID = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const PLAN_WITHOUT_TEAM = 'd4c3b2a1-f6e5-4d7c-8b9a-0f1e2d3c4b5a';
const PLAN_OF_MANAGED_TEAM = 'e5d4c3b2-a1f6-4e5d-9c8b-1a0f2e3d4c5b';
const PLAN_OF_OTHER_TEAM = 'f6e5d4c3-b2a1-4f6e-8d9c-2b1a0f3e4d5c';
const TASK_ID = '0f1e2d3c-4b5a-4968-8776-655443322110';
const OTHER_TASK_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const MANAGER_ID = '6c5b4a39-2817-4f6e-9d8c-7b6a5f4e3d2c';
const MEMBER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

/**
 * #10726 — `PUT /daily-plan/:taskId/remove` and the `removeTaskFromDailyPlans` mutation take a task out of many
 * plans of one employee. A request without `plansIds` (the MCP tool, ever-teams "Remove from all plans") answered
 * 400 on `plansIds.length`, the mutation always did because it sends the list as `planIds`, and without a team the
 * TypeORM query compared the plan's team with NULL and never found a plan.
 *
 * Without a team the plans of every team (and of none) are read, and each is kept only when its own team lets the
 * caller manage the owner — the rule a single plan follows. A team manager without CHANGE_SELECTED_EMPLOYEE acts
 * here on a member who also has a plan in a team the manager does not manage.
 */
describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'DailyPlanService.removeTaskFromManyPlans (%s)',
	(ormType) => {
		let service: DailyPlanService;
		let stored: Array<{ id: string; organizationTeamId: string | null; tasks: Array<{ id: string }> }>;
		/** The conditions the TypeORM query was given, a subquery recorded as `subquery`. */
		let conditions: Array<{ condition: string; parameters?: Record<string, unknown> }>;
		let mikroOrmFind: jest.Mock;
		let managedEmployeeService: { canManageEmployee: jest.Mock };
		let saved: jest.SpyInstance;

		beforeEach(() => {
			stored = [
				{ id: PLAN_WITHOUT_TEAM, organizationTeamId: null, tasks: [{ id: TASK_ID }, { id: OTHER_TASK_ID }] },
				{ id: PLAN_OF_MANAGED_TEAM, organizationTeamId: MANAGED_TEAM_ID, tasks: [{ id: TASK_ID }] },
				{ id: PLAN_OF_OTHER_TEAM, organizationTeamId: OTHER_TEAM_ID, tasks: [{ id: TASK_ID }] }
			];
			conditions = [];

			const record = (condition: unknown, parameters?: Record<string, unknown>) => {
				conditions.push({ condition: typeof condition === 'string' ? condition : 'subquery', parameters });
				return query;
			};
			const query = {
				alias: 'daily_plan',
				leftJoinAndSelect: () => query,
				where: record,
				andWhere: record,
				getMany: async () => stored
			};
			mikroOrmFind = jest.fn(async () => stored);

			// The manager manages the member in MANAGED_TEAM_ID, and in "any team" for a plan without one
			managedEmployeeService = {
				canManageEmployee: jest.fn(async (_employeeId: string, teamId?: string) => teamId !== OTHER_TEAM_ID)
			};

			service = new DailyPlanService(
				{ metadata: { tableName: 'daily_plan' }, createQueryBuilder: () => query } as any,
				{ find: mikroOrmFind } as any,
				{} as any,
				{ findOneByIdString: jest.fn(async () => ({ id: TASK_ID })) } as any,
				managedEmployeeService as any
			);
			Object.defineProperty(service, 'ormType', { value: ormType });
			jest.spyOn(DailyPlanService.prototype as any, 'serialize').mockImplementation((entity: object) => entity);
			saved = jest
				.spyOn(TenantAwareCrudService.prototype, 'saveMany')
				.mockImplementation(async (entities) => entities as never);

			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(MANAGER_ID);
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: 'c0ffee00-0000-4000-8000-000000000001',
				tenantId: TENANT_ID,
				employeeId: MANAGER_ID
			} as any);
		});

		afterEach(() => jest.restoreAllMocks());

		const remove = (input: Record<string, unknown>) =>
			service.removeTaskFromManyPlans(TASK_ID, {
				employeeId: MEMBER_ID,
				organizationId: ORGANIZATION_ID,
				...input
			} as any);

		/** The plans that reached the save, with the tasks they keep. */
		const savedPlans = () =>
			(saved.mock.calls[0][0] as typeof stored).map(({ id, tasks }) => ({
				id,
				tasks: tasks.map((task) => task.id)
			}));

		/** Whether the read was narrowed to a team. */
		const readByTeam = () =>
			ormType === MultiORMEnum.TypeORM
				? conditions.some(({ condition }) => condition.includes('organizationTeamId'))
				: 'organizationTeamId' in mikroOrmFind.mock.calls[0][0];

		it('takes the task out of every plan holding it when no list is sent (MCP, ever-teams)', async () => {
			await remove({});

			if (ormType === MultiORMEnum.TypeORM) {
				expect(conditions).toContainEqual({ condition: 'subquery', parameters: undefined });
				expect(conditions.some(({ condition }) => condition.includes(':...plansIds'))).toBe(false);
			} else {
				expect(mikroOrmFind.mock.calls[0][0]).toMatchObject({ tasks: { id: TASK_ID } });
				expect(mikroOrmFind.mock.calls[0][0]).not.toHaveProperty('id');
			}
			expect(savedPlans()).toEqual([
				{ id: PLAN_WITHOUT_TEAM, tasks: [OTHER_TASK_ID] },
				{ id: PLAN_OF_MANAGED_TEAM, tasks: [] }
			]);
		});

		it('reads the list the GraphQL mutation sends as planIds', async () => {
			stored = stored.slice(0, 1);

			await remove({ planIds: [PLAN_WITHOUT_TEAM] });

			if (ormType === MultiORMEnum.TypeORM) {
				expect(conditions).toContainEqual(
					expect.objectContaining({ parameters: { plansIds: [PLAN_WITHOUT_TEAM] } })
				);
			} else {
				expect(mikroOrmFind.mock.calls[0][0]).toMatchObject({ id: { $in: [PLAN_WITHOUT_TEAM] } });
			}
			expect(savedPlans()).toEqual([{ id: PLAN_WITHOUT_TEAM, tasks: [OTHER_TASK_ID] }]);
		});

		it('without a team, reads the plans of every team and saves only those whose team lets the caller manage the owner', async () => {
			await remove({ plansIds: [] });

			expect(readByTeam()).toBe(false);
			expect(managedEmployeeService.canManageEmployee).toHaveBeenCalledWith(
				MEMBER_ID,
				OTHER_TEAM_ID,
				ORGANIZATION_ID
			);
			expect(savedPlans().map(({ id }) => id)).toEqual([PLAN_WITHOUT_TEAM, PLAN_OF_MANAGED_TEAM]);
		});

		it('answers not found, and saves nothing, when no plan read lets the caller manage the owner', async () => {
			stored = stored.slice(2);

			await expect(remove({ plansIds: [] })).rejects.toBeInstanceOf(BadRequestException);
			expect(saved).not.toHaveBeenCalled();
		});

		it("with a team, reads that team's plans and checks the owner once, as before", async () => {
			stored = stored.slice(1, 2);

			await remove({ plansIds: [], organizationTeamId: MANAGED_TEAM_ID });

			expect(readByTeam()).toBe(true);
			expect(managedEmployeeService.canManageEmployee).toHaveBeenCalledTimes(1);
			expect(managedEmployeeService.canManageEmployee).toHaveBeenCalledWith(
				MEMBER_ID,
				MANAGED_TEAM_ID,
				ORGANIZATION_ID
			);
			expect(savedPlans()).toEqual([{ id: PLAN_OF_MANAGED_TEAM, tasks: [] }]);
		});
	}
);
