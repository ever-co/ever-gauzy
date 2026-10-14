import '../../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { IUser } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { CrudService } from '../../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskEstimationService } from './task-estimation.service';

/**
 * The task estimate is the average of every member's estimation. A plain `findAll` limits a caller without
 * CHANGE_SELECTED_EMPLOYEE to their own estimation, so `findAllForTask` must read them all.
 */
describe('TaskEstimationService.findAllForTask', () => {
	const caller = createTenantFixture({ user: { employeeId: 'caller-employee' } as IUser });

	// Stand-in for the per-request store withoutEmployeeFilter() keeps its state in
	const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
	const originalClsService = RequestContext['clsService'];

	let restore: () => void;
	let findAll: jest.SpyInstance;
	let service: TaskEstimationService;

	beforeEach(() => {
		// No CHANGE_SELECTED_EMPLOYEE: the employee filter applies to this caller
		({ restore } = asTenantUser(caller));
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
		findAll = jest.spyOn(CrudService.prototype, 'findAll').mockResolvedValue({
			items: [
				{ employeeId: 'caller-employee', estimate: 2 },
				{ employeeId: 'other-employee', estimate: 4 }
			],
			total: 2
		} as never);
		service = new TaskEstimationService(
			// The entity has tenantId and employeeId columns
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'task_estimation', hasColumnWithPropertyPath: () => true } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any
		);
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
		restore();
		jest.restoreAllMocks();
	});

	it("reads every member's estimation of the task, within the tenant", async () => {
		const estimations = await requestStorage.run(new Map(), () => service.findAllForTask('task-1'));

		const { where } = findAll.mock.calls[0][0];
		expect(where).toMatchObject({ taskId: 'task-1', tenantId: caller.tenantId });
		expect(where).not.toHaveProperty('employeeId');
		expect(estimations).toHaveLength(2);
	});

	it('is needed: a plain findAll is limited to the caller', async () => {
		await requestStorage.run(new Map(), () => service.findAll({ where: { taskId: 'task-1' } }));

		expect(findAll.mock.calls[0][0].where).toMatchObject({ taskId: 'task-1', employeeId: 'caller-employee' });
	});
});
