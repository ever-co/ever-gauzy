import { randomUUID } from 'node:crypto';
import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../context';

export interface ITenantFixture {
	tenantId: string;
	organizationId: string;
	user: IUser;
}

/**
 * Builds one self-consistent tenant/organization/user triple with fresh random ids. Pass
 * `overrides.user` to layer on extra fields (e.g. `employeeId`) a particular test needs.
 */
export function createTenantFixture(overrides: Partial<ITenantFixture> = {}): ITenantFixture {
	const tenantId = overrides.tenantId ?? overrides.user?.tenantId ?? randomUUID();
	const organizationId = overrides.organizationId ?? randomUUID();
	// `tenantId` goes last: in production `RequestContext.currentTenantId()` is `currentUser().tenantId`,
	// so a user override must never leave the two pointing at different tenants.
	const user = {
		id: randomUUID(),
		...overrides.user,
		tenantId
	} as IUser;

	return { tenantId, organizationId, user };
}

/**
 * Two distinct, non-overlapping tenants — the standard "attacker / victim" pair for isolation
 * tests: seed Tenant B's data directly (bypassing the service under test), then act as Tenant A
 * and assert it stays out of reach.
 */
export function createCrossTenantFixture(): { tenantA: ITenantFixture; tenantB: ITenantFixture } {
	return { tenantA: createTenantFixture(), tenantB: createTenantFixture() };
}

/**
 * Points `RequestContext` at the given tenant for the duration of a test, the same way every
 * production request does via the JWT-derived `req.user` — this is the established pattern for
 * "switching tenants" in a unit test (see `managed-employee.service.profile-view.spec.ts`,
 * `tenant-aware-crud.service.spec.ts`), generalized here so it isn't re-implemented per spec file.
 *
 * Call `restore()` in `afterEach` to avoid leaking mocks into the next test.
 */
export function asTenantUser(fixture: ITenantFixture, options: { permissions?: PermissionsEnum[] } = {}) {
	const grantedPermissions = new Set(options.permissions ?? []);

	const spies = [
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(fixture.user),
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(fixture.tenantId),
		// Same rule as the production `currentEmployeeId()`: null for a CHANGE_SELECTED_EMPLOYEE holder.
		jest
			.spyOn(RequestContext, 'currentEmployeeId')
			.mockImplementation(() =>
				grantedPermissions.has(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
					? null
					: fixture.user.employeeId || null
			),
		jest
			.spyOn(RequestContext, 'hasPermission')
			.mockImplementation((permission) => grantedPermissions.has(permission))
	];

	return { restore: () => spies.forEach((spy) => spy.mockRestore()) };
}
