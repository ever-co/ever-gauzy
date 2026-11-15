import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { And, Equal, In, Not } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService, TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import { OrganizationProjectService } from './organization-project.service';
import { hiddenProjectIdsOf, whereWithoutHiddenProjects } from './organization-project-visibility';

/**
 * Private projects (ever-co/ever-gauzy#11465). Where an organization turns `enforcePrivateProjects` on, a project
 * stated private (`public` false) is kept to its members and managers and to those who hold `ACCESS_PRIVATE_PROJECTS`:
 * no list, count or read by id answers it to anyone else, and they cannot edit, archive or delete it. Off, the
 * default, every read runs exactly as before.
 */

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const PAUL = 'employee-paul';
const MARIE = 'employee-marie';
const CONFIDENTIAL = 'project-client-x-redesign';

describe('hiddenProjectIdsOf', () => {
	const privateProject = { id: CONFIDENTIAL, members: [{ employeeId: MARIE }] };

	it('hides a private project from someone who is neither its member nor its manager', () => {
		expect(hiddenProjectIdsOf([privateProject], PAUL)).toEqual([CONFIDENTIAL]);
	});

	it('shows it to a member, and to a manager (a membership with `isManager`)', () => {
		expect(hiddenProjectIdsOf([privateProject], MARIE)).toEqual([]);
		expect(
			hiddenProjectIdsOf([{ id: CONFIDENTIAL, members: [{ employeeId: PAUL, isManager: true } as never] }], PAUL)
		).toEqual([]);
	});

	it('reads a membership as MikroORM loads it, through its employee relation', () => {
		const mikroOrmProject = { id: CONFIDENTIAL, members: [{ employee: { id: MARIE } }, { employee: PAUL }] };

		expect(hiddenProjectIdsOf([mikroOrmProject], MARIE)).toEqual([]);
		expect(hiddenProjectIdsOf([mikroOrmProject], PAUL)).toEqual([]);
		expect(hiddenProjectIdsOf([mikroOrmProject], 'employee-other')).toEqual([CONFIDENTIAL]);
	});

	it('hides every private project from a user without an employee, who belongs to none', () => {
		expect(hiddenProjectIdsOf([privateProject], null)).toEqual([CONFIDENTIAL]);
	});
});

describe('whereWithoutHiddenProjects', () => {
	it('hands back the very same conditions when nothing is hidden', () => {
		const where = { organizationId: ORGANIZATION, isArchived: false };

		expect(whereWithoutHiddenProjects(where, [], MultiORMEnum.TypeORM)).toBe(where);
		expect(whereWithoutHiddenProjects(where, [], MultiORMEnum.MikroORM)).toBe(where);
		expect(whereWithoutHiddenProjects(undefined, [], MultiORMEnum.TypeORM)).toBeUndefined();
	});

	it('TypeORM: leaves the hidden projects out beside the caller own condition on the id', () => {
		expect(
			whereWithoutHiddenProjects({ organizationId: ORGANIZATION }, [CONFIDENTIAL], MultiORMEnum.TypeORM)
		).toEqual({
			organizationId: ORGANIZATION,
			id: Not(In([CONFIDENTIAL]))
		});
		expect(whereWithoutHiddenProjects({ id: 'project-1' }, [CONFIDENTIAL], MultiORMEnum.TypeORM)).toEqual({
			id: And(Equal('project-1'), Not(In([CONFIDENTIAL])))
		});
		expect(whereWithoutHiddenProjects({ id: In(['a', 'b']) }, [CONFIDENTIAL], MultiORMEnum.TypeORM)).toEqual({
			id: And(In(['a', 'b']), Not(In([CONFIDENTIAL])))
		});
	});

	it('TypeORM: each alternative leaves them out, and an empty list of alternatives is no filter', () => {
		expect(
			whereWithoutHiddenProjects([{ name: 'a' }, { name: 'b' }], [CONFIDENTIAL], MultiORMEnum.TypeORM)
		).toEqual([
			{ name: 'a', id: Not(In([CONFIDENTIAL])) },
			{ name: 'b', id: Not(In([CONFIDENTIAL])) }
		]);
		expect(whereWithoutHiddenProjects([], [CONFIDENTIAL], MultiORMEnum.TypeORM)).toEqual({
			id: Not(In([CONFIDENTIAL]))
		});
	});

	it('MikroORM: adds `$nin` to the entity-level `$and`, keeping a conjunction already there', () => {
		expect(
			whereWithoutHiddenProjects({ organizationId: ORGANIZATION }, [CONFIDENTIAL], MultiORMEnum.MikroORM)
		).toEqual({
			organizationId: ORGANIZATION,
			$and: [{ id: { $nin: [CONFIDENTIAL] } }]
		});
		expect(
			whereWithoutHiddenProjects({ $and: [{ name: 'a' }] } as never, [CONFIDENTIAL], MultiORMEnum.MikroORM)
		).toEqual({ $and: [{ name: 'a' }, { id: { $nin: [CONFIDENTIAL] } }] });
	});
});

describe('OrganizationProjectService with private projects', () => {
	let service: OrganizationProjectService;
	let privateProjectsRead: jest.Mock;
	let permissions: PermissionsEnum[];
	let employeeId: string | null;
	let ormType: jest.SpyInstance;

	beforeEach(() => {
		permissions = [];
		employeeId = PAUL;
		ormType = jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUser').mockImplementation(
			() => ({ id: 'user-paul', tenantId: TENANT, employeeId }) as never
		);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockImplementation(() => employeeId);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
			permissions.includes(permission)
		);

		// The only private project of an organization with the setting on: Marie is its one member
		privateProjectsRead = jest.fn().mockResolvedValue([{ id: CONFIDENTIAL, members: [{ employeeId: MARIE }] }]);
		service = Object.create(OrganizationProjectService.prototype);
		Object.assign(service, {
			typeOrmRepository: { find: privateProjectsRead },
			_employeeService: { find: jest.fn().mockResolvedValue([]) },
			_activityLogService: { logActivity: jest.fn() },
			_employeeRecentVisitService: { emitSaveEmployeeRecentVisitEvent: jest.fn() }
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('which projects it reads as private', () => {
		it('reads only projects stated private (`public` false, so unset counts as public) of organizations with the setting on', async () => {
			await service.hiddenProjectIds();

			expect(privateProjectsRead).toHaveBeenCalledWith({
				select: { id: true, members: { id: true, employeeId: true } },
				where: { tenantId: TENANT, public: false, organization: { enforcePrivateProjects: true } },
				relations: { members: true }
			});
		});

		it('reads nothing for a caller who holds ACCESS_PRIVATE_PROJECTS (admins by default), who sees them all', async () => {
			permissions = [PermissionsEnum.ACCESS_PRIVATE_PROJECTS];

			expect(await service.hiddenProjectIds()).toEqual([]);
			expect(privateProjectsRead).not.toHaveBeenCalled();
		});

		it('reads nothing without a user in the request (a job, a public route)', async () => {
			(RequestContext.currentUser as jest.Mock).mockReturnValue(null);

			expect(await service.hiddenProjectIds()).toEqual([]);
			expect(privateProjectsRead).not.toHaveBeenCalled();
		});

		it('recognises a manager who may act for others (no current employee) by the employee of their user', async () => {
			employeeId = MARIE;
			(RequestContext.currentEmployeeId as jest.Mock).mockReturnValue(null);

			expect(await service.hiddenProjectIds()).toEqual([]);
		});

		it('reads the memberships through TypeORM under MikroORM too, so a member keeps their private project', async () => {
			// A MikroORM membership leaves `employeeId` unset and its serialized row drops the unloaded `employee`
			ormType.mockReturnValue(MultiORMEnum.MikroORM);
			const mikroOrmFind = jest.fn();
			Object.assign(service, { mikroOrmRepository: { find: mikroOrmFind } });

			employeeId = MARIE;
			expect(await service.hiddenProjectIds()).toEqual([]);
			employeeId = PAUL;
			expect(await service.hiddenProjectIds()).toEqual([CONFIDENTIAL]);
			expect(privateProjectsRead).toHaveBeenCalledTimes(2);
			expect(mikroOrmFind).not.toHaveBeenCalled();
		});
	});

	describe('lists and counts', () => {
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

		it('leave the private project out for Paul, who is not on it', async () => {
			await service.pagination({ where: { organizationId: ORGANIZATION } } as never);
			await service.findAll({ where: { organizationId: ORGANIZATION } } as never);
			await service.countBy({ organizationId: ORGANIZATION } as never);

			const expected = { organizationId: ORGANIZATION, isArchived: false, id: Not(In([CONFIDENTIAL])) };
			expect(paginate.mock.calls[0][0].where).toEqual(expected);
			expect(findAll.mock.calls[0][0].where).toEqual(expected);
			expect(countBy).toHaveBeenCalledWith(expected);
		});

		it('read as before for Marie, its member, and where no organization keeps projects private', async () => {
			employeeId = MARIE;
			await service.pagination({ where: { organizationId: ORGANIZATION } } as never);

			employeeId = PAUL;
			privateProjectsRead.mockResolvedValue([]);
			await service.findAll({ where: { organizationId: ORGANIZATION } } as never);
			await service.countBy({ organizationId: ORGANIZATION } as never);

			const before = { organizationId: ORGANIZATION, isArchived: false };
			expect(paginate.mock.calls[0][0].where).toEqual(before);
			expect(findAll.mock.calls[0][0].where).toEqual(before);
			expect(countBy).toHaveBeenCalledWith(before);
		});

		it('an employee project list (the timer, the pickers) leaves it out too', async () => {
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
					find: privateProjectsRead,
					metadata: { tableName: 'organization_project' },
					createQueryBuilder: jest.fn().mockReturnValue(query)
				}
			});

			await service.findByEmployee(MARIE, { organizationId: ORGANIZATION } as never);

			expect(query.andWhere).toHaveBeenCalledWith(expect.stringContaining('NOT IN (:...hiddenProjectIds)'), {
				hiddenProjectIds: [CONFIDENTIAL]
			});
		});

		it('MikroORM synced projects leave it out beside the caller own `where[id]`, never over it', async () => {
			ormType.mockReturnValue(MultiORMEnum.MikroORM);
			const findAndCount = jest.fn().mockResolvedValue([[], 0]);
			Object.assign(service, { mikroOrmMapsCustomField: () => true, mikroOrmRepository: { findAndCount } });

			await service.findSyncedProjects({ where: { id: 'project-1' } } as never);

			expect(findAndCount).toHaveBeenCalledWith(
				{
					id: 'project-1',
					tenantId: TENANT,
					customFields: { repository: { id: 'project-1', tenantId: TENANT } },
					$and: [{ id: { $nin: [CONFIDENTIAL] } }]
				},
				expect.anything()
			);
		});
	});

	describe('one project by its id', () => {
		let findOneByIdString: jest.SpyInstance;

		beforeEach(() => {
			findOneByIdString = jest
				.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString')
				.mockResolvedValue({ id: CONFIDENTIAL, organizationId: ORGANIZATION, tenantId: TENANT } as never);
		});

		it('is answered to Paul as a project that does not exist', async () => {
			await expect(service.findById(CONFIDENTIAL)).rejects.toThrow('The requested record was not found');
			expect(findOneByIdString).not.toHaveBeenCalled();
		});

		it('is answered to Marie', async () => {
			employeeId = MARIE;

			await expect(service.findById(CONFIDENTIAL)).resolves.toMatchObject({ id: CONFIDENTIAL });
		});

		it('cannot be edited, archived or deleted by Paul, and nothing is written', async () => {
			const remove = jest
				.spyOn(TenantAwareCrudService.prototype, 'delete')
				.mockResolvedValue({ raw: [], affected: 1 });

			await expect(
				service.update(CONFIDENTIAL, { organizationId: ORGANIZATION } as never)
			).rejects.toBeInstanceOf(NotFoundException);
			await expect(service.setArchived(CONFIDENTIAL, true)).rejects.toBeInstanceOf(NotFoundException);
			await expect(service.delete(CONFIDENTIAL)).rejects.toBeInstanceOf(NotFoundException);
			expect(findOneByIdString).not.toHaveBeenCalled();
			expect(remove).not.toHaveBeenCalled();
		});

		it('is deleted for someone who may see it', async () => {
			permissions = [PermissionsEnum.ACCESS_PRIVATE_PROJECTS];
			const remove = jest
				.spyOn(TenantAwareCrudService.prototype, 'delete')
				.mockResolvedValue({ raw: [], affected: 1 });

			await expect(service.delete(CONFIDENTIAL)).resolves.toEqual({ raw: [], affected: 1 });
			expect(remove).toHaveBeenCalledWith(CONFIDENTIAL, undefined);
		});

		it('cannot be withdrawn or restored by Paul, and the restore check reads withdrawn projects too', async () => {
			const softRemove = jest.spyOn(CrudService.prototype, 'softRemove').mockResolvedValue({} as never);
			const softRecover = jest.spyOn(CrudService.prototype, 'softRecover').mockResolvedValue({} as never);

			await expect(service.softRemove(CONFIDENTIAL)).rejects.toBeInstanceOf(NotFoundException);
			await expect(service.softRecover(CONFIDENTIAL)).rejects.toBeInstanceOf(NotFoundException);
			expect(privateProjectsRead).toHaveBeenLastCalledWith(expect.objectContaining({ withDeleted: true }));
			expect(softRemove).not.toHaveBeenCalled();
			expect(softRecover).not.toHaveBeenCalled();
		});

		it('is withdrawn and restored for Marie, its member', async () => {
			employeeId = MARIE;
			const softRemove = jest.spyOn(CrudService.prototype, 'softRemove').mockResolvedValue({} as never);
			const softRecover = jest.spyOn(CrudService.prototype, 'softRecover').mockResolvedValue({} as never);

			await service.softRemove(CONFIDENTIAL);
			await service.softRecover(CONFIDENTIAL);

			expect(softRemove).toHaveBeenCalledWith(CONFIDENTIAL, undefined, undefined);
			expect(softRecover).toHaveBeenCalledWith(CONFIDENTIAL, undefined, undefined);
		});

		it('Paul can neither join it nor take anyone off it through the by-employee edit, and nothing is written', async () => {
			const find = jest.spyOn(TenantAwareCrudService.prototype, 'find').mockResolvedValue([]);
			const removeMembership = jest.fn();
			Object.assign(service, { typeOrmOrganizationProjectEmployeeRepository: { delete: removeMembership } });

			await expect(
				service.updateByEmployee({
					organizationId: ORGANIZATION,
					addedProjectIds: [CONFIDENTIAL],
					member: { id: PAUL }
				} as never)
			).rejects.toBeInstanceOf(NotFoundException);
			await expect(
				service.updateByEmployee({
					organizationId: ORGANIZATION,
					removedProjectIds: [CONFIDENTIAL],
					member: { id: MARIE }
				} as never)
			).rejects.toBeInstanceOf(NotFoundException);
			expect(find).not.toHaveBeenCalled();
			expect(removeMembership).not.toHaveBeenCalled();
		});

		it('Marie, its member, still changes its memberships through the by-employee edit', async () => {
			employeeId = MARIE;
			const removeMembership = jest.fn().mockResolvedValue({ raw: [], affected: 1 });
			Object.assign(service, { typeOrmOrganizationProjectEmployeeRepository: { delete: removeMembership } });

			await expect(
				service.updateByEmployee({
					organizationId: ORGANIZATION,
					removedProjectIds: [CONFIDENTIAL],
					member: { id: MARIE }
				} as never)
			).resolves.toBe(true);
			expect(removeMembership).toHaveBeenCalledWith(
				expect.objectContaining({ employeeId: MARIE, organizationId: ORGANIZATION, tenantId: TENANT })
			);
		});
	});
});
