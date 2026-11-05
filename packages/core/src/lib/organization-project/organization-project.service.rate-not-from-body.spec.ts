import '../core/entities/internal';

import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationProjectService } from './organization-project.service';

/**
 * The project create and update bodies are not whitelisted, and the service saves what they carry. A project's client
 * rate is written through the project rate route only, which checks who may: a rate stated in a create or update body
 * reaches no save.
 */

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';

let saved: Record<string, unknown> | undefined;

beforeEach(() => {
	saved = undefined;
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('employee-me');
	jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue('role-employee');
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
		(permission) => permission === PermissionsEnum.ORG_PROJECT_EDIT
	);
	jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({ id: 'project-1' } as never);
	jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity) => {
		saved = entity as Record<string, unknown>;
		return { id: 'project-1', name: 'Project', ...entity } as never;
	});
});

afterEach(() => jest.restoreAllMocks());

it('PUT /organization-projects/:id saves the other fields and not the rate, and logs no rate change', async () => {
	const logActivity = jest.fn();
	const service = Object.create(OrganizationProjectService.prototype);
	Object.assign(service, {
		_activityLogService: { logActivity },
		updateOrganizationProjectMembers: jest.fn()
	});

	await service.update('project-1', { name: 'Renamed', organizationId: ORGANIZATION, billRateValue: 500 } as never);

	expect(saved).toMatchObject({ id: 'project-1', name: 'Renamed' });
	expect(saved).not.toHaveProperty('billRateValue');
	const loggedNewValues = logActivity.mock.calls[0][9];
	expect(loggedNewValues).toMatchObject({ name: 'Renamed' });
	expect(loggedNewValues).not.toHaveProperty('billRateValue');
});

it('POST /organization-projects saves the project without the rate', async () => {
	const service = Object.create(OrganizationProjectService.prototype);
	Object.assign(service, {
		_roleService: {
			findOneByIdString: jest.fn().mockRejectedValue(new Error('not an employee')),
			findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'role-manager' })
		},
		_employeeService: { findActiveEmployeesByEmployeeIds: jest.fn().mockResolvedValue([]) },
		_eventBus: { publish: jest.fn() },
		_activityLogService: { logActivity: jest.fn() }
	});

	await service.create({ name: 'Project', organizationId: ORGANIZATION, billRateValue: 500 } as never);

	expect(saved).toMatchObject({ name: 'Project' });
	expect(saved).not.toHaveProperty('billRateValue');
});
