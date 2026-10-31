/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { ExecutionContext, Logger, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
	ID,
	ORGANIZATION_CONTACT_CREATE_PERMISSIONS,
	ORGANIZATION_CONTACT_DELETE_PERMISSIONS,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { PermissionGuard } from '../shared/guards/permission.guard';
import { OrganizationContactController } from './organization-contact.controller';
import { OrganizationContactResolver } from './organization-contact.resolver';
import { organizationContactCreateOptions } from './organization-contact.permissions';

/**
 * ever-co/ever-gauzy#5468: creating and deleting a contact get their own grants, `ORG_CONTACT_ADD` and
 * `ORG_CONTACT_DELETE`, as alternatives to `ORG_CONTACT_EDIT`, which keeps every right it had. These run the real
 * `PermissionGuard` over the real route and field metadata, for callers holding one grant each.
 */
const TENANT_ID = '1f3c5a7e-0000-4000-8000-000000000001';
const ROLE_ID = '1f3c5a7e-0000-4000-8000-0000000000aa';

type Surface = { target: Type<unknown>; handler: string };

const REST = (handler: string): Surface => ({ target: OrganizationContactController, handler });
const GRAPHQL = (handler: string): Surface => ({ target: OrganizationContactResolver, handler });

/** The route or field, with what it does to a contact. */
const OPERATIONS: Record<'create' | 'update' | 'delete' | 'softRemove' | 'softRecover', Surface[]> = {
	create: [REST('create'), GRAPHQL('createOrganizationContact')],
	update: [REST('update'), GRAPHQL('updateOrganizationContact')],
	delete: [REST('delete'), GRAPHQL('deleteOrganizationContact')],
	softRemove: [REST('softRemove'), GRAPHQL('softDeleteOrganizationContact')],
	softRecover: [REST('softRecover'), GRAPHQL('recoverOrganizationContact')]
};

function contextFor({ target, handler }: Surface): ExecutionContext {
	return {
		getType: () => 'http',
		getHandler: () => (target as any).prototype[handler],
		getClass: () => target,
		switchToHttp: () => ({ getRequest: () => ({ headers: {}, method: 'POST' }) })
	} as unknown as ExecutionContext;
}

function actAs(permissions: PermissionsEnum[]) {
	const user = {
		id: 'user-1',
		tenantId: TENANT_ID,
		roleId: ROLE_ID,
		role: { id: ROLE_ID, name: RolesEnum.EMPLOYEE, tenantId: TENANT_ID },
		permissions
	};
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as any);
	jest.spyOn(RequestContext, 'currentPermissions').mockReturnValue(permissions);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID as ID);
	jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(ROLE_ID as ID);
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1' as ID);
	jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(RolesEnum.EMPLOYEE);
}

const guard = () =>
	new PermissionGuard({ get: jest.fn(async () => null), set: jest.fn() } as any, new Reflector(), {
		checkRolePermission: jest.fn(async () => false)
	} as any);

async function allowed(permissions: PermissionsEnum[]): Promise<Record<string, boolean[]>> {
	actAs(permissions);
	const verdicts: Record<string, boolean[]> = {};
	for (const [operation, surfaces] of Object.entries(OPERATIONS)) {
		verdicts[operation] = await Promise.all(surfaces.map((surface) => guard().canActivate(contextFor(surface))));
	}
	return verdicts;
}

describe('Organization contact permissions (ever-co/ever-gauzy#5468)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		// The refusals are logged by the guard; the verdicts are what is asserted.
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});
	afterEach(() => jest.restoreAllMocks());

	it('states the create and the delete as alternatives to the edit grant', () => {
		expect(ORGANIZATION_CONTACT_CREATE_PERMISSIONS).toEqual([
			PermissionsEnum.ORG_CONTACT_ADD,
			PermissionsEnum.ORG_CONTACT_EDIT
		]);
		expect(ORGANIZATION_CONTACT_DELETE_PERMISSIONS).toEqual([
			PermissionsEnum.ORG_CONTACT_DELETE,
			PermissionsEnum.ORG_CONTACT_EDIT
		]);
	});

	it('lets a holder of ORG_CONTACT_EDIT do everything it did before, on both surfaces', async () => {
		expect(await allowed([PermissionsEnum.ORG_CONTACT_EDIT])).toEqual({
			create: [true, true],
			update: [true, true],
			delete: [true, true],
			softRemove: [true, true],
			softRecover: [true, true]
		});
	});

	it('lets a holder of ORG_CONTACT_ADD alone create a contact, and not edit or delete one', async () => {
		expect(await allowed([PermissionsEnum.ORG_CONTACT_ADD, PermissionsEnum.ORG_CONTACT_VIEW])).toEqual({
			create: [true, true],
			update: [false, false],
			delete: [false, false],
			softRemove: [false, false],
			softRecover: [false, false]
		});
	});

	it('lets a holder of ORG_CONTACT_DELETE alone delete, withdraw and restore a contact, and not create or edit one', async () => {
		expect(await allowed([PermissionsEnum.ORG_CONTACT_DELETE])).toEqual({
			create: [false, false],
			update: [false, false],
			delete: [true, true],
			softRemove: [true, true],
			softRecover: [true, true]
		});
	});

	it('lets a holder of ORG_CONTACT_VIEW alone change nothing', async () => {
		const verdicts = await allowed([PermissionsEnum.ORG_CONTACT_VIEW]);

		expect(Object.values(verdicts).flat()).not.toContain(true);
	});

	it('makes a create by a caller without ORG_CONTACT_EDIT create-only, and leaves an editor’s create as it was', () => {
		actAs([PermissionsEnum.ORG_CONTACT_ADD]);
		expect(organizationContactCreateOptions()).toEqual({ createOnly: true });

		actAs([PermissionsEnum.ORG_CONTACT_ADD, PermissionsEnum.ORG_CONTACT_EDIT]);
		expect(organizationContactCreateOptions()).toEqual({ createOnly: false });
	});
});
