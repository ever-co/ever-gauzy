import '../../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { NotFoundException } from '@nestjs/common';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { DailyPlanService } from './daily-plan.service';

const TENANT_ID = '2a5d5f2e-0c4e-4f2b-9a0b-3d6a4b2f1c11';
const ORGANIZATION_ID = '8b1f0e3a-7c2d-4a5e-b6f7-1d2e3f4a5b6c';
const TEAM_ID = '5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9';
const PLAN_ID = 'd4c3b2a1-f6e5-4d7c-8b9a-0f1e2d3c4b5a';
const TASK_ID = '0f1e2d3c-4b5a-4968-8776-655443322110';
const MANAGER_ID = '6c5b4a39-2817-4f6e-9d8c-7b6a5f4e3d2c';
const MEMBER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const MANAGER_FILTER = { employee: { id: MANAGER_ID }, employeeId: MANAGER_ID };

/** Stands in for nestjs-cls, which stores values per async context rather than per process. */
const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
const inRequest = <R>(callback: () => Promise<R>): Promise<R> => requestStorage.run(new Map(), callback);

/**
 * A team manager without CHANGE_SELECTED_EMPLOYEE acting on a member's daily plan. The service
 * must look the plan up by its OWNER (the automatic employee filter would otherwise pin the lookup
 * to the caller and the manager path could never run), decide access from the stored plan, and
 * only then return or write anything.
 */
describe('DailyPlanService manager access', () => {
	const originalClsService = RequestContext['clsService'];
	let service: DailyPlanService;
	let repository: { metadata: unknown; findOne: jest.Mock; findOneOrFail: jest.Mock; save: jest.Mock };
	let managedEmployeeService: { canManageEmployee: jest.Mock };
	let taskService: { findOneByIdString: jest.Mock };
	let plan: Record<string, unknown>;

	beforeEach(() => {
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
		} as any;

		plan = {
			id: PLAN_ID,
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: MEMBER_ID,
			organizationTeamId: null,
			tasks: []
		};

		repository = {
			metadata: {
				tableName: 'daily_plan',
				hasColumnWithPropertyPath: (path: string) => ['employeeId', 'tenantId', 'organizationId'].includes(path)
			},
			findOne: jest.fn(async () => plan),
			findOneOrFail: jest.fn(async () => plan),
			save: jest.fn(async (entity: unknown) => entity)
		};
		managedEmployeeService = { canManageEmployee: jest.fn(async () => true) };
		taskService = { findOneByIdString: jest.fn(async () => ({ id: TASK_ID })) };

		service = new DailyPlanService(
			repository as any,
			{} as any,
			{} as any,
			taskService as any,
			managedEmployeeService as any
		);
		// The ORM switch is resolved from DB_ORM at module load; pin it so the suite ignores the local .env.
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });

		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(MANAGER_ID);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: 'c0ffee00-0000-4000-8000-000000000001',
			tenantId: TENANT_ID,
			employeeId: MANAGER_ID
		} as any);
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
		jest.restoreAllMocks();
	});

	const addTask = (input: Record<string, unknown>) => service.addTaskToPlan(PLAN_ID, input as any);

	it('looks the plan up by its owner, not the caller, and decides access before returning it', async () => {
		await inRequest(async () => {
			const result = await addTask({ employeeId: MEMBER_ID, taskId: TASK_ID, organizationId: ORGANIZATION_ID });

			expect(repository.findOneOrFail).toHaveBeenCalledTimes(1);
			const { where } = repository.findOneOrFail.mock.calls[0][0];
			expect(where).toEqual(
				expect.objectContaining({
					id: PLAN_ID,
					employeeId: MEMBER_ID,
					tenantId: TENANT_ID,
					organizationId: ORGANIZATION_ID
				})
			);
			// The caller's own employee scope must not have been injected into the lookup.
			expect(where.employee).toBeUndefined();

			expect(managedEmployeeService.canManageEmployee).toHaveBeenCalledWith(MEMBER_ID, null, ORGANIZATION_ID);
			expect(repository.save).toHaveBeenCalledTimes(1);
			expect(result.tasks).toEqual([{ id: TASK_ID }]);
		});
	});

	it('anchors the manager check on the stored plan rather than the request body', async () => {
		plan.organizationTeamId = TEAM_ID;

		await inRequest(async () => {
			await addTask({ taskId: TASK_ID });

			expect(managedEmployeeService.canManageEmployee).toHaveBeenCalledWith(MEMBER_ID, TEAM_ID, ORGANIZATION_ID);
		});
	});

	it('throws NotFound and writes nothing when the caller cannot manage the plan owner', async () => {
		managedEmployeeService.canManageEmployee.mockResolvedValue(false);

		await inRequest(async () => {
			await expect(
				addTask({ employeeId: MEMBER_ID, taskId: TASK_ID, organizationId: ORGANIZATION_ID })
			).rejects.toBeInstanceOf(NotFoundException);

			expect(repository.findOne).not.toHaveBeenCalled();
			expect(taskService.findOneByIdString).not.toHaveBeenCalled();
			expect(repository.save).not.toHaveBeenCalled();
		});
	});

	it('throws the same NotFound when the plan does not exist, without consulting the manager check', async () => {
		repository.findOneOrFail.mockRejectedValue(new Error('EntityNotFound'));

		await inRequest(async () => {
			await expect(
				addTask({ employeeId: MEMBER_ID, taskId: TASK_ID, organizationId: ORGANIZATION_ID })
			).rejects.toBeInstanceOf(NotFoundException);

			expect(managedEmployeeService.canManageEmployee).not.toHaveBeenCalled();
			expect(repository.save).not.toHaveBeenCalled();
		});
	});

	it('restores the employee filter once the lookup is done', async () => {
		await inRequest(async () => {
			await addTask({ employeeId: MEMBER_ID, taskId: TASK_ID, organizationId: ORGANIZATION_ID });

			expect(service['findConditionsWithEmployeeByUser']()).toEqual(MANAGER_FILTER);
		});
	});

	it('skips the manager check for a caller with CHANGE_SELECTED_EMPLOYEE', async () => {
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

		await inRequest(async () => {
			await addTask({ employeeId: MEMBER_ID, taskId: TASK_ID, organizationId: ORGANIZATION_ID });

			expect(repository.findOneOrFail).not.toHaveBeenCalled();
			expect(managedEmployeeService.canManageEmployee).not.toHaveBeenCalled();
			expect(repository.save).toHaveBeenCalledTimes(1);
		});
	});
});
