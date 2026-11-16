import '../core/entities/internal';

import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import { OrganizationProjectService } from './organization-project.service';

/**
 * CORE-27 (ever-co/ever-gauzy#12031): the records that name a project the caller may not see answer it as its id, and
 * the history of a time entry quotes it by name, so the service tells which projects are hidden, with their names, by
 * the rule the project routes keep private projects with (ever-co/ever-gauzy#11465).
 */

const TENANT = 'tenant-1';
const JORDAN = 'employee-jordan';
const MARIE = 'employee-marie';
const CONFIDENTIAL = 'project-client-x-redesign';
const INTERNAL = 'project-internal-audit';

describe('OrganizationProjectService.hiddenProjects', () => {
	let service: OrganizationProjectService;
	let privateProjectsRead: jest.Mock;
	let permissions: PermissionsEnum[];
	let employeeId: string | null;

	beforeEach(() => {
		permissions = [];
		employeeId = JORDAN;
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUser').mockImplementation(
			() => ({ id: 'user-jordan', tenantId: TENANT, employeeId }) as never
		);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockImplementation(() => employeeId);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
			permissions.includes(permission)
		);
		// Two private projects of an organization with the setting on: Marie is on the first, Jordan on the second
		privateProjectsRead = jest.fn().mockResolvedValue([
			{ id: CONFIDENTIAL, name: 'Client X redesign', members: [{ employeeId: MARIE }] },
			{ id: INTERNAL, name: 'Internal audit', members: [{ employeeId: JORDAN }] }
		]);
		service = Object.create(OrganizationProjectService.prototype);
		Object.assign(service, { typeOrmRepository: { find: privateProjectsRead } });
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('answers the private projects the caller is not on, with their names, and not the one they are on', async () => {
		expect(await service.hiddenProjects()).toEqual(new Map([[CONFIDENTIAL, 'Client X redesign']]));
		expect(privateProjectsRead).toHaveBeenCalledWith({
			select: { id: true, name: true, members: { id: true, employeeId: true } },
			where: { tenantId: TENANT, public: false, organization: { enforcePrivateProjects: true } },
			relations: { members: true }
		});
	});

	it('answers none to a member of every private project', async () => {
		privateProjectsRead.mockResolvedValue([
			{ id: CONFIDENTIAL, name: 'Client X redesign', members: [{ employeeId: JORDAN }] }
		]);

		expect(await service.hiddenProjects()).toEqual(new Map());
	});

	it('reads nothing for a caller who holds ACCESS_PRIVATE_PROJECTS, nor without a user in the request', async () => {
		permissions = [PermissionsEnum.ACCESS_PRIVATE_PROJECTS];
		expect(await service.hiddenProjects()).toEqual(new Map());

		permissions = [];
		(RequestContext.currentUser as jest.Mock).mockReturnValue(null);
		expect(await service.hiddenProjects()).toEqual(new Map());

		expect(privateProjectsRead).not.toHaveBeenCalled();
	});

	it('hides the same projects as the project routes do', async () => {
		const hidden = await service.hiddenProjects();

		expect([...hidden.keys()]).toEqual(await service.hiddenProjectIds());
	});
});
