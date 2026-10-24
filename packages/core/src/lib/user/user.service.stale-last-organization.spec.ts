// Only the shape of UserService is needed here; same technique as user.service.organization-preference.spec.ts.
jest.mock('./user.entity', () => ({ User: class User {} }));
jest.mock('./repository/type-orm-user.repository', () => ({ TypeOrmUserRepository: class TypeOrmUserRepository {} }));
jest.mock('./repository/mikro-orm-user.repository', () => ({
	MikroOrmUserRepository: class MikroOrmUserRepository {}
}));
jest.mock('../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../tasks/task.service', () => ({ TaskService: class TaskService {} }));
jest.mock('../activity-log/activity-log.service', () => ({ ActivityLogService: class ActivityLogService {} }));
jest.mock('../password-hash/password-hash.service', () => ({ PasswordHashService: class PasswordHashService {} }));
jest.mock('./../core/crud', () => ({ TenantAwareCrudService: class TenantAwareCrudService {} }));

import { UserService } from './user.service';

/**
 * The two lookups sign-in uses to replace a stored organization (`lastOrganizationId`) the user is no longer a
 * member of (see `AuthService.resolveStoredOrganizationId`). Both read and write by the ids given, never through the
 * request's tenant: a workspace switch runs while the request still names the tenant being left.
 */
describe('UserService — replacing a stale stored organization', () => {
	const TENANT = 'tenant-1';
	const USER = 'user-1';
	const ORG_FIRST = 'org-first';
	const ORG_STALE = 'org-stale';

	function build(ormType: 'typeorm' | 'mikro-orm') {
		const membership = { organizationId: ORG_FIRST };
		const typeOrmFindOne = jest.fn(async (_entity: string, _options: any) => membership);
		const mikroOrmFindOne = jest.fn(async (_entity: string, _where: any, _options: any) => membership);
		const typeOrmUpdate = jest.fn(async (_criteria: any, _partial: any) => ({ affected: 1 }));
		const nativeUpdate = jest.fn(async (_criteria: any, _partial: any) => 1);

		const service: UserService = Object.create(UserService.prototype);
		Object.assign(service, {
			ormType,
			typeOrmRepository: { manager: { findOne: typeOrmFindOne }, update: typeOrmUpdate },
			mikroOrmRepository: { getEntityManager: () => ({ findOne: mikroOrmFindOne }), nativeUpdate }
		});
		return { service, typeOrmFindOne, mikroOrmFindOne, typeOrmUpdate, nativeUpdate };
	}

	describe('findFirstActiveOrganizationId', () => {
		it('reads the oldest active, non-archived membership of the given tenant (TypeORM)', async () => {
			const { service, typeOrmFindOne } = build('typeorm');

			await expect(service.findFirstActiveOrganizationId(USER, TENANT)).resolves.toBe(ORG_FIRST);
			expect(typeOrmFindOne).toHaveBeenCalledWith('UserOrganization', {
				where: { userId: USER, tenantId: TENANT, isActive: true, isArchived: false },
				order: { createdAt: 'ASC' }
			});
		});

		it('reads the oldest active, non-archived membership of the given tenant (MikroORM)', async () => {
			const { service, mikroOrmFindOne } = build('mikro-orm');

			await expect(service.findFirstActiveOrganizationId(USER, TENANT)).resolves.toBe(ORG_FIRST);
			expect(mikroOrmFindOne).toHaveBeenCalledWith(
				'UserOrganization',
				{ userId: USER, tenantId: TENANT, isActive: true, isArchived: false },
				{ orderBy: { createdAt: 'ASC' } }
			);
		});

		it('reads the organization from the relation when the row carries no column (MikroORM)', async () => {
			const { service, mikroOrmFindOne } = build('mikro-orm');
			mikroOrmFindOne.mockResolvedValueOnce({ organization: { id: ORG_FIRST } } as any);

			await expect(service.findFirstActiveOrganizationId(USER, TENANT)).resolves.toBe(ORG_FIRST);
		});

		it('answers null when the user has no active membership', async () => {
			const { service, typeOrmFindOne } = build('typeorm');
			typeOrmFindOne.mockResolvedValueOnce(null as any);

			await expect(service.findFirstActiveOrganizationId(USER, TENANT)).resolves.toBeNull();
		});

		it('answers null without a lookup when the user or the tenant is missing', async () => {
			const { service, typeOrmFindOne } = build('typeorm');

			await expect(service.findFirstActiveOrganizationId(USER, null)).resolves.toBeNull();
			await expect(service.findFirstActiveOrganizationId(null, TENANT)).resolves.toBeNull();
			expect(typeOrmFindOne).not.toHaveBeenCalled();
		});
	});

	describe('replaceStaleLastOrganization', () => {
		it('writes only while the stored value is still the stale one (TypeORM)', async () => {
			const { service, typeOrmUpdate } = build('typeorm');

			await service.replaceStaleLastOrganization(USER, ORG_STALE, ORG_FIRST);

			expect(typeOrmUpdate).toHaveBeenCalledWith(
				{ id: USER, lastOrganizationId: ORG_STALE },
				{ lastOrganizationId: ORG_FIRST }
			);
		});

		it('clears the stored value when there is no replacement (MikroORM)', async () => {
			const { service, nativeUpdate } = build('mikro-orm');

			await service.replaceStaleLastOrganization(USER, ORG_STALE, null);

			expect(nativeUpdate).toHaveBeenCalledWith(
				{ id: USER, lastOrganizationId: ORG_STALE },
				{ lastOrganizationId: null }
			);
		});
	});
});
