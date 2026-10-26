import { ForbiddenException } from '@nestjs/common';
import { IUser, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import {
	assertCallerIsAuthorOrTenantAdmin,
	isCallerAuthor,
	isCallerTenantAdmin,
	withoutAuthorChange
} from './author-or-tenant-admin';

/**
 * Owner decision 2 (2026-10-22): a per-user row — a mention, a resource link, an entity subscription, a key-result
 * progress update — is changed only by its author or a tenant administrator (`SUPER_ADMIN` or `ADMIN`, as decision 1
 * defines one). These are the predicates every one of those services asks.
 */
describe('author or tenant admin', () => {
	const signIn = (user: Partial<IUser> | null, role: RolesEnum | null) => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as IUser);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(user?.id ?? null);
		jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(role);
	};

	afterEach(() => jest.restoreAllMocks());

	it('counts SUPER_ADMIN and ADMIN as tenant administrators, and no other role', () => {
		for (const role of Object.values(RolesEnum)) {
			signIn({ id: 'user' }, role);
			expect({ role, admin: isCallerTenantAdmin() }).toEqual({
				role,
				admin: role === RolesEnum.SUPER_ADMIN || role === RolesEnum.ADMIN
			});
		}

		signIn(null, null);
		expect(isCallerTenantAdmin()).toBe(false);
	});

	it('names the caller the author by the user who created the row, or by the employee the row names', () => {
		signIn({ id: 'user-a', employeeId: 'employee-a' }, RolesEnum.EMPLOYEE);

		expect(isCallerAuthor({ userId: 'user-a' })).toBe(true);
		expect(isCallerAuthor({ employeeId: 'employee-a' })).toBe(true);
		expect(isCallerAuthor({ userId: 'user-b', employeeId: 'employee-b' })).toBe(false);
		// An author column that is empty matches nobody, including a caller with no employee record.
		expect(isCallerAuthor({ userId: null, employeeId: null })).toBe(false);

		signIn({ id: 'user-c' }, RolesEnum.VIEWER);
		expect(isCallerAuthor({ employeeId: null })).toBe(false);
		expect(isCallerAuthor({ employeeId: undefined, userId: undefined })).toBe(false);
	});

	it('refuses everyone else with 403, and lets the author and a tenant administrator through', () => {
		signIn({ id: 'user-b', employeeId: 'employee-b' }, RolesEnum.MANAGER);
		expect(() =>
			assertCallerIsAuthorOrTenantAdmin({ userId: 'user-a', employeeId: 'employee-a' }, 'a mention')
		).toThrow(ForbiddenException);

		signIn({ id: 'user-a', employeeId: 'employee-a' }, RolesEnum.EMPLOYEE);
		expect(() => assertCallerIsAuthorOrTenantAdmin({ userId: 'user-a' }, 'a mention')).not.toThrow();

		signIn({ id: 'admin' }, RolesEnum.ADMIN);
		expect(() => assertCallerIsAuthorOrTenantAdmin({ userId: 'user-a' }, 'a mention')).not.toThrow();
	});

	it('takes the author out of a patch, and the author employee too unless the caller administers the tenant', () => {
		signIn({ id: 'user-a', employeeId: 'employee-a' }, RolesEnum.EMPLOYEE);
		expect(
			withoutAuthorChange({ title: 'x', createdByUserId: 'user-b', employeeId: 'employee-b' }, ['employeeId'])
		).toEqual({ title: 'x' });

		signIn({ id: 'admin' }, RolesEnum.ADMIN);
		expect(
			withoutAuthorChange({ title: 'x', createdByUserId: 'user-b', employeeId: 'employee-b' }, ['employeeId'])
		).toEqual({ title: 'x', employeeId: 'employee-b' });
	});

	it('takes the posting-user relation out of a patch as well, for every caller', () => {
		// A save writes `createdByUserId` from the relation, so dropping only the column left the author changeable.
		signIn({ id: 'admin' }, RolesEnum.ADMIN);
		expect(withoutAuthorChange({ title: 'x', createdByUser: { id: 'user-b' } })).toEqual({ title: 'x' });
	});
});
