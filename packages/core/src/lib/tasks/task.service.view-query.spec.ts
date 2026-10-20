import '../core/entities/internal';

jest.mock('@gauzy/config', () => {
	const actual = jest.requireActual('@gauzy/config');
	return { ...actual, isSqlite: jest.fn(actual.isSqlite) };
});

import { isSqlite } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { TaskService } from './task.service';

/**
 * `TaskService.findTasksByViewQuery` parsed the view's `queryParams` on SQLite without a fallback. A view saved
 * without query params stores null, `JSON.parse(null)` gives null, and destructuring the filters threw, so the
 * view's tasks were refused with a 400. The other databases already fell back to no filters.
 */
describe('TaskService.findTasksByViewQuery — views without query params on SQLite', () => {
	const TENANT_ID = 'tenant-1';
	const VIEW_ID = 'view-1';
	const ORGANIZATION_ID = 'organization-1';

	let findAll: jest.SpyInstance;
	let service: TaskService;

	const withView = (queryParams: unknown) => {
		service = Object.create(TaskService.prototype);
		Object.assign(service, {
			_taskViewService: {
				findOneByWhereOptions: jest
					.fn()
					.mockResolvedValue({ id: VIEW_ID, tenantId: TENANT_ID, organizationId: ORGANIZATION_ID, queryParams })
			}
		});
	};

	beforeEach(() => {
		(isSqlite as jest.Mock).mockReturnValue(true);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		findAll = jest
			.spyOn(TenantAwareCrudService.prototype, 'findAll')
			.mockResolvedValue({ items: [{ id: 'task-1' }], total: 1 } as never);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('returns the tasks of a view whose query params are null', async () => {
		withView(null);

		await expect(service.findTasksByViewQuery(VIEW_ID)).resolves.toEqual({ items: [{ id: 'task-1' }], total: 1 });
		expect(findAll).toHaveBeenCalledTimes(1);
		expect(findAll.mock.calls[0][0].where).toEqual({ organizationId: ORGANIZATION_ID, tenantId: TENANT_ID });
	});

	it('returns the tasks of a view whose query params are the JSON null literal', async () => {
		withView('null');

		await expect(service.findTasksByViewQuery(VIEW_ID)).resolves.toEqual({ items: [{ id: 'task-1' }], total: 1 });
		expect(findAll.mock.calls[0][0].where).toEqual({ organizationId: ORGANIZATION_ID, tenantId: TENANT_ID });
	});

	it('still parses the stored JSON string of a view with query params', async () => {
		withView(JSON.stringify({ statuses: [], projects: ['project-1'] }));

		await service.findTasksByViewQuery(VIEW_ID);

		expect(findAll.mock.calls[0][0].where).toMatchObject({ tenantId: TENANT_ID, organizationId: ORGANIZATION_ID });
		expect(findAll.mock.calls[0][0].where.projectId).toBeDefined();
	});

	it('still refuses a view whose stored query params are not valid JSON', async () => {
		withView('{not json');

		await expect(service.findTasksByViewQuery(VIEW_ID)).rejects.toMatchObject({ status: 400 });
		expect(findAll).not.toHaveBeenCalled();
	});

	it('uses query params that are already an object', async () => {
		withView({ statuses: [], projects: ['project-1'] });

		await service.findTasksByViewQuery(VIEW_ID);

		expect(findAll.mock.calls[0][0].where).toMatchObject({ tenantId: TENANT_ID, organizationId: ORGANIZATION_ID });
		expect(findAll.mock.calls[0][0].where.projectId).toBeDefined();
	});

	it.each(['42', '"text"', '[]'])('refuses stored query params that are not an object (%s)', async (stored) => {
		withView(stored);

		await expect(service.findTasksByViewQuery(VIEW_ID)).rejects.toMatchObject({ status: 400 });
		expect(findAll).not.toHaveBeenCalled();
	});
});
