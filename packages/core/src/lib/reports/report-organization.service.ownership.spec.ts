import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { asTenantUser } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { ReportOrganization } from './report-organization.entity';
import { ReportOrganizationService } from './report-organization.service';

/**
 * Owner decision 2 (2026-10-22), GHSA-v79w-54p2-wmh5: `POST /report/menu-item` (and `updateReportMenu`) states no
 * permission, so any member of the tenant could hide or show any report in the menu of the whole organization. An
 * entry is now switched only by its author (`createdByUserId`; the entries made with the organization are its
 * creator's) or a tenant administrator, and only a tenant administrator adds a missing one.
 */
describe('ReportOrganizationService.updateReportMenu — only the author or a tenant administrator switches an entry', () => {
	const TENANT = 'a0000000-0000-4000-8000-000000000001';
	const ORGANIZATION = 'b0000000-0000-4000-8000-000000000001';
	const REPORT = 'e0000000-0000-4000-8000-000000000001';
	const NEW_REPORT = 'e0000000-0000-4000-8000-000000000002';
	const ENTRY = 'c0000000-0000-4000-8000-000000000001';

	const AUTHOR: Partial<IUser> = { id: 'author-user', employeeId: 'author-employee' };
	const OTHER_MEMBER: Partial<IUser> = { id: 'other-user', employeeId: 'other-employee' };
	const ADMIN: Partial<IUser> = { id: 'admin-user' };

	let service: ReportOrganizationService;
	let save: jest.SpyInstance;
	let create: jest.SpyInstance;

	/**
	 * Signs a user in, the way a request does: tenant, the organization of their token (`lastOrganizationId`, which the
	 * CRUD base's organization boundary keeps a non-admin inside), employee, permissions, and the role they hold now.
	 */
	const signIn = (user: Partial<IUser>, role: RolesEnum, permissions: PermissionsEnum[] = []) => {
		asTenantUser(
			{
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				user: { ...user, tenantId: TENANT, lastOrganizationId: ORGANIZATION } as IUser
			},
			{ permissions }
		);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(user.id);
		jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(role);
	};

	const switchOff = (reportId = REPORT) =>
		service.updateReportMenu({ reportId, organizationId: ORGANIZATION, isEnabled: false });

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		const repository = new InMemoryTenantRepository<ReportOrganization>(
			new Set(['id', 'tenantId', 'organizationId', 'reportId'])
		);
		repository.seed({
			id: ENTRY,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			reportId: REPORT,
			isEnabled: true,
			createdByUserId: AUTHOR.id
		} as ReportOrganization);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new ReportOrganizationService({} as any, {} as any, repository as any, {} as any);

		save = jest
			.spyOn(TenantAwareCrudService.prototype, 'save')
			.mockImplementation(async (entity) => entity as never);
		create = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (entity) => entity as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('lets the author switch the entry', async () => {
		signIn(AUTHOR, RolesEnum.MANAGER);

		await switchOff();

		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0][0]).toMatchObject({ id: ENTRY, isEnabled: false });
	});

	it('refuses another member, and switches nothing', async () => {
		signIn(OTHER_MEMBER, RolesEnum.EMPLOYEE);

		await expect(switchOff()).rejects.toBeInstanceOf(ForbiddenException);
		expect(save).not.toHaveBeenCalled();
		expect(create).not.toHaveBeenCalled();
	});

	it('lets a tenant administrator switch anyone’s entry', async () => {
		signIn(ADMIN, RolesEnum.ADMIN, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await switchOff();

		expect(save.mock.calls[0][0]).toMatchObject({ id: ENTRY, isEnabled: false });
	});

	it('refuses a member who would add a missing entry, which speaks for the whole organization', async () => {
		signIn(OTHER_MEMBER, RolesEnum.EMPLOYEE);

		await expect(switchOff(NEW_REPORT)).rejects.toBeInstanceOf(ForbiddenException);
		expect(create).not.toHaveBeenCalled();
	});

	it('lets a tenant administrator add a missing entry', async () => {
		signIn(ADMIN, RolesEnum.SUPER_ADMIN, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await switchOff(NEW_REPORT);

		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][0]).toMatchObject({ reportId: NEW_REPORT, isEnabled: false });
	});

	it('writes only the switch of an entry, never the tenant or the author a body states', async () => {
		signIn(AUTHOR, RolesEnum.MANAGER);

		await service.updateReportMenu({
			reportId: REPORT,
			organizationId: ORGANIZATION,
			isEnabled: false,
			tenantId: 'a0000000-0000-4000-8000-000000000002',
			createdByUserId: OTHER_MEMBER.id
		} as never);

		expect(save.mock.calls[0][0]).toMatchObject({ tenantId: TENANT, createdByUserId: AUTHOR.id, isEnabled: false });
	});
});
