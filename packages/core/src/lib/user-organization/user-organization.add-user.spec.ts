// Prime the entity graph first, as the other suites in this folder do.
import '../core/entities/internal';

import { IUser, RolesEnum } from '@gauzy/contracts';
import { UserOrganizationService } from './user-organization.services';

/**
 * `addUserToOrganization` inserted a new `user_organization` row on every call. Creating an employee for a
 * user who already belongs to the organization (or inviting a Super Admin who already belongs to some of the
 * tenant's organizations) therefore left the user with duplicate memberships. An existing active membership is
 * now reused, and only the missing ones are created.
 */
describe('UserOrganizationService.addUserToOrganization', () => {
	const TENANT_ID = '81000000-0000-4000-8000-000000000001';
	const USER_ID = '81000000-0000-4000-8000-000000000002';
	const ORG_A = '81000000-0000-4000-8000-0000000000a1';
	const ORG_B = '81000000-0000-4000-8000-0000000000b1';

	const userWithRole = (role: RolesEnum) => ({ id: USER_ID, tenantId: TENANT_ID, role: { name: role } } as IUser);

	/** The service over scripted user organization and organization repositories. */
	function surfaces(existing: any[] = [], organizations: any[] = []) {
		const userOrganizationRepository = {
			findOne: jest.fn(
				async ({ where }: any) => existing.find((row) => row.organizationId === where.organizationId) ?? null
			),
			find: jest.fn().mockResolvedValue(existing),
			save: jest.fn(async (entity: any) => entity)
		};
		const organizationRepository = { find: jest.fn().mockResolvedValue(organizations) };
		const service = new UserOrganizationService(
			userOrganizationRepository as any,
			{} as any,
			organizationRepository as any,
			{} as any
		);
		return { service, userOrganizationRepository };
	}

	it('returns the existing membership instead of inserting a duplicate', async () => {
		const membership = { id: 'membership-a', userId: USER_ID, organizationId: ORG_A, tenantId: TENANT_ID };
		const { service, userOrganizationRepository } = surfaces([membership]);

		const result = await service.addUserToOrganization(userWithRole(RolesEnum.EMPLOYEE), ORG_A);

		expect(result).toBe(membership);
		expect(userOrganizationRepository.findOne).toHaveBeenCalledWith({
			where: { userId: USER_ID, organizationId: ORG_A, tenantId: TENANT_ID, isActive: true }
		});
		expect(userOrganizationRepository.save).not.toHaveBeenCalled();
	});

	it('creates the membership when the user does not belong to the organization yet', async () => {
		const { service, userOrganizationRepository } = surfaces();

		await service.addUserToOrganization(userWithRole(RolesEnum.EMPLOYEE), ORG_A);

		expect(userOrganizationRepository.save).toHaveBeenCalledTimes(1);
		expect(userOrganizationRepository.save.mock.calls[0][0]).toMatchObject({
			userId: USER_ID,
			organizationId: ORG_A,
			tenantId: TENANT_ID
		});
	});

	it('adds a Super Admin only to the organizations they are not a member of yet', async () => {
		const membership = { id: 'membership-a', userId: USER_ID, organizationId: ORG_A, tenantId: TENANT_ID };
		const { service, userOrganizationRepository } = surfaces([membership], [{ id: ORG_A }, { id: ORG_B }]);

		const result = await service.addUserToOrganization(userWithRole(RolesEnum.SUPER_ADMIN), ORG_A);

		expect(userOrganizationRepository.save).toHaveBeenCalledTimes(1);
		const saved = userOrganizationRepository.save.mock.calls[0][0];
		expect(saved).toHaveLength(1);
		expect(saved[0]).toMatchObject({ userId: USER_ID, organizationId: ORG_B, tenantId: TENANT_ID });
		expect(result).toHaveLength(2);
	});

	it('saves nothing for a Super Admin who already belongs to every organization', async () => {
		const memberships = [ORG_A, ORG_B].map((organizationId) => ({
			userId: USER_ID,
			organizationId,
			tenantId: TENANT_ID
		}));
		const { service, userOrganizationRepository } = surfaces(memberships, [{ id: ORG_A }, { id: ORG_B }]);

		const result = await service.addUserToOrganization(userWithRole(RolesEnum.SUPER_ADMIN), ORG_A);

		expect(userOrganizationRepository.save).not.toHaveBeenCalled();
		expect(result).toEqual(memberships);
	});
});
