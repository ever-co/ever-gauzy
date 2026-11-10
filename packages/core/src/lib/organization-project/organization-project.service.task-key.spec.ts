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

/**
 * A key another project answers to is refused (409 `PROJECT_KEY_TAKEN`): its key, a key it held before (old references
 * keep resolving to it), and the key derived from its name (its tasks keep answering to it). Otherwise `API-42` could
 * name two projects, and the resolver would open whichever one holds the number.
 */
describe('a key another project answers to', () => {
	const projects = [
		{ id: 'p-gateway', name: 'Gateway', taskKey: 'GW', taskKeyHistory: ['API'] },
		{ id: 'p-beehive', name: 'Beehive', taskKey: 'BEE', taskKeyHistory: null },
		{ id: 'p-ops', name: 'Operations', taskKey: 'OPS', taskKeyHistory: null }
	];

	/** The service over the organization's projects; `find` leaves out the project a `Not(id)` names. */
	const serviceOver = (rows: Array<Record<string, unknown>>) => {
		const { service } = serviceWith([]);
		const find = jest.fn(async ({ where }: { where: { id?: { type?: string; value?: string } } }) =>
			rows.filter((row) => !(where.id?.type === 'not' && where.id.value === row.id))
		);
		service.typeOrmRepository.find = find;
		return { service, find };
	};

	const storedAs = (row: Record<string, unknown>) =>
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({ ...row, teams: [] } as never);

	it("is refused when it was another project's key", async () => {
		const { service, find } = serviceOver(projects);

		await expect(service.create({ name: 'New API', organizationId: ORGANIZATION, taskKey: 'api' } as never)).rejects.toThrow(
			/PROJECT_KEY_TAKEN: the key API was a key of the project "Gateway"/
		);
		expect(saved).toBeUndefined();
		// Deleted projects count: their keys stay in the unique index, and a restored project answers to them again.
		expect(find).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
	});

	it("is refused when another project's name derives it", async () => {
		const { service } = serviceOver(projects);

		await expect(
			service.create({ name: 'Bees', organizationId: ORGANIZATION, taskKey: 'OPE' } as never)
		).rejects.toThrow(/PROJECT_KEY_TAKEN: the tasks of the project "Operations" answer to OPE/);
		expect(saved).toBeUndefined();
	});

	it("is refused when it is another project's key", async () => {
		const { service } = serviceOver(projects);

		await expect(service.create({ name: 'Bees', organizationId: ORGANIZATION, taskKey: 'BEE' } as never)).rejects.toThrow(
			/PROJECT_KEY_TAKEN: the key BEE belongs to the project "Beehive"/
		);
	});

	it('is refused on an update too, with the history stored as JSON text (SQLite)', async () => {
		const rows = [...projects, { id: 'p-legacy', name: 'Legacy', taskKey: 'LEG', taskKeyHistory: '["OLD"]' }];
		const { service } = serviceOver(rows);
		storedAs({ id: 'p-ops', name: 'Operations', taskKey: 'OPS', taskKeyHistory: null });

		await expect(service.update('p-ops', { organizationId: ORGANIZATION, taskKey: 'OLD' } as never)).rejects.toThrow(
			/the key OLD was a key of the project "Legacy"/
		);
		expect(saved).toBeUndefined();
	});

	it('lets a project take back a key it held before, and keeps the replaced key in its history', async () => {
		const { service, find } = serviceOver(projects);
		storedAs(projects[0]);

		await service.update('p-gateway', { organizationId: ORGANIZATION, taskKey: 'API' } as never);

		expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: expect.anything() }) }));
		expect(saved).toMatchObject({ taskKey: 'API', taskKeyHistory: ['GW'] });
	});

	it("CONTROL: a body that sends the project's own key back is not checked again", async () => {
		// `Gateway` held API before: a project keyed API before keys were reserved keeps its key through a whole-project save.
		const { service, find } = serviceOver([...projects, { id: 'p-api', name: 'Public API', taskKey: 'API', taskKeyHistory: null }]);
		storedAs({ id: 'p-api', name: 'Public API', taskKey: 'API', taskKeyHistory: null });

		await service.update('p-api', { organizationId: ORGANIZATION, name: 'Public API v2', taskKey: 'api' } as never);

		expect(find).not.toHaveBeenCalled();
		expect(saved).toMatchObject({ taskKey: 'API' });
		expect(saved).not.toHaveProperty('taskKeyHistory');
	});

	it('CONTROL: a key nobody answers to is given', async () => {
		const { service } = serviceOver(projects);

		await service.create({ name: 'Bees', organizationId: ORGANIZATION, taskKey: 'HIVE' } as never);

		expect(saved).toMatchObject({ taskKey: 'HIVE' });
	});
});

/**
 * The key check reads the projects of ONE organization: the stored project's own on an update (whatever the body
 * states), the one the create names otherwise. Without one it would read every organization of the tenant and name
 * another organization's project in the refusal, so it is refused instead.
 */
describe('the organization a key is checked in', () => {
	const findIn = () => jest.fn(async (_options: { where: Record<string, unknown> }) => [] as unknown[]);

	it("checks an update's key in the stored project's organization, when the body names none", async () => {
		const { service } = serviceWith([]);
		const find = findIn();
		service.typeOrmRepository.find = find;
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({
			id: 'p-ops',
			name: 'Operations',
			organizationId: ORGANIZATION,
			taskKey: 'OPS',
			teams: []
		} as never);

		await service.update('p-ops', { taskKey: 'RUN' } as never);

		expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT, organizationId: ORGANIZATION }) }));
		expect(saved).toMatchObject({ taskKey: 'RUN' });
	});

	it('takes the organization a create states as an object', async () => {
		const { service } = serviceWith([]);
		const find = findIn();
		service.typeOrmRepository.find = find;

		await service.create({ name: 'Runbooks', organization: { id: ORGANIZATION }, taskKey: 'RUN' } as never);

		expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: ORGANIZATION }) }));
	});

	it('refuses a key it has no organization to check in, without reading the tenant', async () => {
		const { service } = serviceWith([]);
		const find = findIn();
		service.typeOrmRepository.find = find;

		await expect(service.create({ name: 'Runbooks', taskKey: 'RUN' } as never)).rejects.toThrow(/PROJECT_KEY_SCOPE_REQUIRED/);
		expect(find).not.toHaveBeenCalled();
		expect(saved).toBeUndefined();
	});
});
