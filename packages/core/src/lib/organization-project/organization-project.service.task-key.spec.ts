import '../core/entities/internal';

import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationProjectService } from './organization-project.service';

/**
 * A project created without a key is given the first letters of its name, unique in the organization. That includes
 * the alias every project still answers to (the derived key of its name), also of a project created with an explicit
 * `taskKey: null`: nothing will key it later, so its tasks keep opening as `FUL-n`, and a second project given `FUL`
 * would make those references ambiguous.
 */

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';

let saved: Record<string, unknown> | undefined;

beforeEach(() => {
	saved = undefined;
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('employee-me');
	jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue('role-admin');
	jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
	jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity) => {
		saved = entity as Record<string, unknown>;
		return { id: 'project-new', ...entity } as never;
	});
});

afterEach(() => jest.restoreAllMocks());

/** The service over an organization holding `projects`; the key check finds no holder of the key proposed. */
const serviceWith = (projects: Array<{ id: string; name: string; taskKey: string | null; taskKeyHistory?: string[] | null }>) => {
	const service = Object.create(OrganizationProjectService.prototype);
	const find = jest.fn().mockResolvedValue(projects);
	Object.assign(service, {
		typeOrmRepository: { find, findOne: jest.fn().mockResolvedValue(null) },
		_roleService: {
			findOneByIdString: jest.fn().mockRejectedValue(new Error('not an employee')),
			findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'role-manager' })
		},
		_employeeService: { findActiveEmployeesByEmployeeIds: jest.fn().mockResolvedValue([]) },
		_eventBus: { publish: jest.fn() },
		_activityLogService: { logActivity: jest.fn() }
	});
	return { service, find };
};

it('does not give a new project the alias of a project created without a key', async () => {
	const { service, find } = serviceWith([{ id: 'p-1', name: 'Fulfilment', taskKey: null }]);

	await service.create({ name: 'Fulfilment Ops', organizationId: ORGANIZATION } as never);

	expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: TENANT, organizationId: ORGANIZATION } }));
	expect(saved).toMatchObject({ name: 'Fulfilment Ops', taskKey: 'FUL2' });
});

it('does not give a new project the alias of a project with a blank key', async () => {
	const { service } = serviceWith([{ id: 'p-1', name: 'Blank', taskKey: '' }]);

	await service.create({ name: 'Blanket', organizationId: ORGANIZATION } as never);

	expect(saved).toMatchObject({ taskKey: 'BLA2' });
});

it('CONTROL: gives the first letters when no project answers to them', async () => {
	const { service } = serviceWith([{ id: 'p-1', name: 'Gauzy', taskKey: 'GAU' }]);

	await service.create({ name: 'Fulfilment Ops', organizationId: ORGANIZATION } as never);

	expect(saved).toMatchObject({ taskKey: 'FUL' });
});

it('CONTROL: keeps an explicit `taskKey: null` without a key', async () => {
	const { service, find } = serviceWith([]);

	await service.create({ name: 'Fulfilment', organizationId: ORGANIZATION, taskKey: null } as never);

	expect(find).not.toHaveBeenCalled();
	expect(saved).toMatchObject({ taskKey: null });
});
