import '../core/entities/internal';

import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { OrganizationProjectModuleService } from './organization-project-module.service';

/**
 * Editing a module and its tasks.
 *
 * `update()` defaulted an absent task list to `[]`, so an edit that only renamed the module took every
 * task out of it, and because the module's tasks were loaded without their own modules, each task was
 * saved with `modules: []` and so left every other module too. The tasks to add were the stated tasks
 * NOT found in the database. An update that does not state a task list now leaves the set as it is; a
 * stated task that exists and is not yet in the module is added; a removed task keeps its other modules.
 */
describe('OrganizationProjectModuleService.update — tasks', () => {
	const MODULE_ID = 'module-1';
	const OTHER_MODULE = { id: 'module-2' };

	let service: OrganizationProjectModuleService;
	let taskService: { find: jest.Mock; update: jest.Mock };

	beforeEach(() => {
		const existingModule = {
			id: MODULE_ID,
			organizationId: 'organization-1',
			tasks: [{ id: 'task-in-module' }]
		};
		const tasksInDatabase: Record<string, any> = {
			'task-in-module': { id: 'task-in-module', modules: [{ id: MODULE_ID }, OTHER_MODULE] },
			'task-new': { id: 'task-new', modules: [OTHER_MODULE] }
		};

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(
			async (entity) => ({ ...existingModule, ...entity }) as never
		);

		taskService = {
			find: jest.fn(async ({ where }) =>
				(where.id as any).value.map((id: string) => tasksInDatabase[id]).filter(Boolean)
			),
			update: jest.fn().mockResolvedValue({})
		};

		service = Object.create(OrganizationProjectModuleService.prototype);
		Object.assign(service, {
			_taskService: taskService,
			findOneByIdString: jest.fn().mockResolvedValue(existingModule),
			logModuleActivity: jest.fn()
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('leaves the tasks alone when the update does not state a task list', async () => {
		await service.update(MODULE_ID, { name: 'Renamed' } as any);

		expect(taskService.update).not.toHaveBeenCalled();
	});

	it('adds a stated task that exists and is not yet in the module', async () => {
		await service.update(MODULE_ID, { tasks: [{ id: 'task-in-module' }, { id: 'task-new' }] } as any);

		expect(taskService.update).toHaveBeenCalledTimes(1);
		expect(taskService.update).toHaveBeenCalledWith('task-new', {
			modules: [OTHER_MODULE, expect.objectContaining({ id: MODULE_ID })]
		});
	});

	it('removes an unstated task from this module only', async () => {
		await service.update(MODULE_ID, { tasks: [] } as any);

		expect(taskService.update).toHaveBeenCalledTimes(1);
		expect(taskService.update).toHaveBeenCalledWith('task-in-module', { modules: [OTHER_MODULE] });
	});
});
