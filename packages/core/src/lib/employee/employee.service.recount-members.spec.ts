import '../core/entities/internal';

import { RequestContext } from '../core/context';
import { CrudService, TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import * as membersCount from '../organization-project/organization-project-members-count';
import { EmployeeService } from './employee.service';

/**
 * A soft delete, and its recovery, change whether an employee counts in the members of their projects
 * (`membersCount` counts working, undeleted employees) but run no update hook, so the service recounts after both.
 * A failed recount must not undo the write: the count is derived.
 */
describe('EmployeeService — project members count after a soft delete or a recovery', () => {
	const manager = { name: 'the TypeORM manager' };
	const params = { organizationId: 'organization-1', tenantId: 'tenant-1' };
	let service: EmployeeService;
	let recount: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(TenantAwareCrudService.prototype, 'softRemove').mockResolvedValue({ id: 'employee-1' } as never);
		jest.spyOn(TenantAwareCrudService.prototype, 'softRecover').mockResolvedValue({ id: 'employee-1' } as never);
		recount = jest.spyOn(membersCount, 'recountMembersOfEmployeeProjects').mockResolvedValue(undefined);

		service = Object.create(EmployeeService.prototype);
		Object.assign(service, { typeOrmRepository: { manager } });
	});

	afterEach(() => jest.restoreAllMocks());

	it('recounts the projects of a soft-deleted employee', async () => {
		await expect(service.softRemovedById('employee-1', params)).resolves.toEqual({ id: 'employee-1' });

		expect(recount).toHaveBeenCalledWith(manager, 'employee-1');
	});

	it('recounts the projects of a recovered employee', async () => {
		await expect(service.softRecoverById('employee-1', params)).resolves.toEqual({ id: 'employee-1' });

		expect(recount).toHaveBeenCalledWith(manager, 'employee-1');
	});

	it('keeps the soft delete when the recount fails', async () => {
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		recount.mockRejectedValueOnce(new Error('database busy'));

		await expect(service.softRemovedById('employee-1', params)).resolves.toEqual({ id: 'employee-1' });
	});
});
