import '../core/entities/internal';

import { In } from 'typeorm';
import { ActionTypeEnum, BaseEntityEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService, TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import { OrganizationProjectService } from './organization-project.service';

/**
 * A project the organization finished with is archived: it keeps everything it holds and stays readable by its
 * id, but no list offers it — the Projects page, the pickers, the timers, the counts — unless the caller asks
 * for archived projects. Deleting is still there for a project created by mistake.
 */

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';

let service: OrganizationProjectService;
let logActivity: jest.Mock;

beforeEach(() => {
	jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);

	logActivity = jest.fn();
	service = Object.create(OrganizationProjectService.prototype);
	Object.assign(service, {
		// Every project read here is read without its members
		_employeeService: { find: jest.fn().mockResolvedValue([]) },
		_activityLogService: { logActivity }
	});
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('OrganizationProjectService lists — archived projects are left out unless asked', () => {
	let paginate: jest.SpyInstance;
	let findAll: jest.SpyInstance;
	let countBy: jest.SpyInstance;

	beforeEach(() => {
		paginate = jest
			.spyOn(TenantAwareCrudService.prototype, 'paginate')
			.mockResolvedValue({ items: [], total: 0 } as never);
		findAll = jest
			.spyOn(TenantAwareCrudService.prototype, 'findAll')
			.mockResolvedValue({ items: [], total: 0 } as never);
		countBy = jest.spyOn(TenantAwareCrudService.prototype, 'countBy').mockResolvedValue(0);
	});

	const whereOf = (spy: jest.SpyInstance) => spy.mock.calls[0][0].where;

	it('pagination (the Projects page) reads the projects that are not archived', async () => {
		await service.pagination({ where: { organizationId: ORGANIZATION } } as never);

		expect(whereOf(paginate)).toEqual({ organizationId: ORGANIZATION, isArchived: false });
	});

	it('pagination reads archived projects too with "Include Archived"', async () => {
		await service.pagination({ where: { organizationId: ORGANIZATION, isArchived: ['false', 'true'] } } as never);

		expect(whereOf(paginate)).toEqual({ organizationId: ORGANIZATION, isArchived: In([false, true]) });
	});

	it('findAll (the pickers, GraphQL) reads the projects that are not archived, with or without a `where`', async () => {
		await service.findAll({ where: { organizationId: ORGANIZATION } } as never);
		await service.findAll(undefined);

		expect(findAll.mock.calls[0][0].where).toEqual({ organizationId: ORGANIZATION, isArchived: false });
		expect(findAll.mock.calls[1][0].where).toEqual({ isArchived: false });
	});

	it('findAll reads the archived projects when the caller asks for them', async () => {
		await service.findAll({ where: { organizationId: ORGANIZATION, isArchived: 'true' } } as never);

		expect(whereOf(findAll)).toEqual({ organizationId: ORGANIZATION, isArchived: true });
	});

	it('countBy counts the projects that are not archived', async () => {
		await service.countBy({ organizationId: ORGANIZATION } as never);

		expect(countBy).toHaveBeenCalledWith({ organizationId: ORGANIZATION, isArchived: false });
	});

	it('findByEmployee (the timer, the employee pickers) reads the projects that are not archived', async () => {
		const query = {
			alias: 'organization_project',
			setFindOptions: jest.fn(),
			innerJoin: jest.fn().mockReturnThis(),
			leftJoin: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([])
		};
		Object.assign(service, {
			assertRelationsPermitted: jest.fn(),
			typeOrmRepository: {
				metadata: { tableName: 'organization_project' },
				createQueryBuilder: jest.fn().mockReturnValue(query)
			}
		});

		await service.findByEmployee('employee-1', { organizationId: ORGANIZATION } as never);

		expect(query.andWhere).toHaveBeenCalledWith(expect.stringContaining('isArchived'), { isArchived: [false] });
	});
});

describe('OrganizationProjectService.setArchived', () => {
	const stored = { id: 'project-1', name: 'Ever Works', organizationId: ORGANIZATION, tenantId: TENANT };
	let saved: Record<string, any>;
	let create: jest.SpyInstance;

	beforeEach(() => {
		saved = undefined;
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({ ...stored } as never);
		// The narrow write: `update(id, columns)`, which runs no save over the whole row
		jest.spyOn(TenantAwareCrudService.prototype, 'update').mockImplementation(async (id, columns) => {
			saved = { id, ...(columns as object) };
			return { affected: 1 } as never;
		});
		create = jest.spyOn(TenantAwareCrudService.prototype, 'create');
	});

	it('archives the project, stamping when, and writes the two archive columns alone', async () => {
		const archived = await service.setArchived('project-1', true);

		expect(Object.keys(saved).sort()).toEqual(['archivedAt', 'id', 'isArchived']);
		expect(saved).toMatchObject({ id: 'project-1', isArchived: true });
		expect(saved.archivedAt).toBeInstanceOf(Date);
		expect(create).not.toHaveBeenCalled();
		expect(archived).toMatchObject({ id: 'project-1', name: 'Ever Works', isArchived: true });
		expect(logActivity).toHaveBeenCalledWith(
			BaseEntityEnum.OrganizationProject,
			ActionTypeEnum.Updated,
			expect.anything(),
			'project-1',
			'Ever Works',
			expect.objectContaining({ isArchived: true }),
			ORGANIZATION,
			TENANT,
			expect.objectContaining({ id: 'project-1' }),
			{ isArchived: true }
		);
	});

	it('unarchives the project, clearing the stamp', async () => {
		const unarchived = await service.setArchived('project-1', false);

		expect(saved).toMatchObject({ id: 'project-1', isArchived: false, archivedAt: null });
		expect(unarchived).toMatchObject({ id: 'project-1', isArchived: false, archivedAt: null });
	});

	it('acts only on a project the caller’s tenant reads', async () => {
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockRejectedValueOnce(new Error('not found'));

		await expect(service.setArchived('project-of-another-tenant', true)).rejects.toThrow('not found');
		expect(saved).toBeUndefined();
	});
});

describe('OrganizationProjectService.update — links to archived teams', () => {
	it('keeps the archived teams the edit could not see, as the team list offers none', async () => {
		let saved: Record<string, any>;
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({
			id: 'project-1',
			name: 'Ever Works',
			teams: [
				{ id: 'team-active', isArchived: false },
				{ id: 'team-archived', isArchived: true }
			]
		} as never);
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity) => {
			saved = entity;
			return { id: 'project-1', ...entity } as never;
		});

		// The edit form lists active teams only: it states the active team it kept and a new one
		await service.update('project-1', {
			name: 'Ever Works',
			organizationId: ORGANIZATION,
			teams: [{ id: 'team-new' }]
		} as never);

		expect(saved.teams.map(({ id }) => id)).toEqual(['team-new', 'team-archived']);
	});

	it('leaves the teams alone when the edit does not state them', async () => {
		let saved: Record<string, any>;
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({
			id: 'project-1',
			teams: [{ id: 'team-archived', isArchived: true }]
		} as never);
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity) => {
			saved = entity;
			return { id: 'project-1', ...entity } as never;
		});

		await service.update('project-1', { name: 'Renamed', organizationId: ORGANIZATION } as never);

		expect(saved).not.toHaveProperty('teams');
	});
});
