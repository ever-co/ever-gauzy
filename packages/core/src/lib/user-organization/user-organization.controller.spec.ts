import '../core/entities/internal';

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { sign } from 'jsonwebtoken';
import { environment as env } from '@gauzy/config';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { PermissionGuard } from '../shared/guards';
import { UserOrganizationController } from './user-organization.controller';

const TENANT_ID = 'e1c9a7d2-4b3f-4a8e-9c0d-5f6a7b8c9d01';
const ROLE_ID = '2f3e4d5c-6b7a-4980-8a1b-2c3d4e5f6a70';

/**
 * `PermissionGuard` authorizes any route whose permission metadata is empty, so a mutating route
 * that declares no `@Permissions` is reachable by every authenticated member of the tenant.
 *
 * `DELETE /user-organization/:id` is not a membership tidy-up: when the target belongs to a single
 * organization the handler deletes the USER ACCOUNT. It, and the write routes inherited from
 * `CrudController`, must therefore require the same permission the Users page gates its own
 * edit and delete actions on.
 */
describe('UserOrganizationController permission gates', () => {
	let guard: PermissionGuard;
	let checkRolePermission: jest.Mock;

	const contextFor = (handler: Function): ExecutionContext =>
		({
			getHandler: () => handler,
			getClass: () => UserOrganizationController
		} as unknown as ExecutionContext);

	beforeEach(() => {
		checkRolePermission = jest.fn(async () => false);
		const cache = { get: jest.fn(async () => null), set: jest.fn(async () => undefined) };
		guard = new PermissionGuard(cache as any, new Reflector(), { checkRolePermission } as any);

		jest.spyOn(RequestContext, 'currentToken').mockReturnValue(
			sign({ id: 'c0ffee00-0000-4000-8000-000000000001', role: 'EMPLOYEE' }, env.JWT_SECRET)
		);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(ROLE_ID);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const mutatingRoutes: [string, Function][] = [
		['delete (deletes the account when it is the last membership)', UserOrganizationController.prototype.delete],
		['create', UserOrganizationController.prototype.create],
		['update', UserOrganizationController.prototype.update],
		['softRemove', UserOrganizationController.prototype.softRemove],
		['softRecover', UserOrganizationController.prototype.softRecover]
	];

	it.each(mutatingRoutes)('refuses %s to a caller without ORG_USERS_EDIT', async (_name, handler) => {
		await expect(guard.canActivate(contextFor(handler))).resolves.toBe(false);

		expect(checkRolePermission).toHaveBeenCalledWith(
			TENANT_ID,
			ROLE_ID,
			[PermissionsEnum.ORG_USERS_EDIT],
			true
		);
	});

	it.each(mutatingRoutes)('allows %s to a caller holding ORG_USERS_EDIT', async (_name, handler) => {
		checkRolePermission.mockResolvedValue(true);

		await expect(guard.canActivate(contextFor(handler))).resolves.toBe(true);
	});

	it('leaves the listing open so every member can still resolve their own organizations', async () => {
		// The organization selector calls GET /user-organization for the signed-in user, whatever
		// their role, and the listing is already scoped to the caller's tenant. Gating it would log
		// every non-admin out of the organization picker.
		await expect(guard.canActivate(contextFor(UserOrganizationController.prototype.findAll))).resolves.toBe(true);

		expect(checkRolePermission).not.toHaveBeenCalled();
	});
});
