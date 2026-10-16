/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { BulkExecutor } from '../api/bulk-executor.service';
import { readBulkOperation } from '../api/bulk.decorator';
import { FieldVisibility } from '../api/field-visibility.service';
import { RequestContext } from '../core/context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { IDEMPOTENT_METADATA_KEY } from '../idempotency/idempotency.policy';
import { RoleShouldExistConstraint } from '../shared/validators/constraints/role-should-exist.constraint';
import { UserCreateHandler } from './commands/handlers/user.create.handler';
import { UserController } from './user.controller';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

/**
 * `POST /user/bulk` and `bulkCreateUsers`: many users in one request, each created exactly as `POST /user`
 * and `createUser` create one.
 *
 * A user create is where a role is granted, so the batch is held to the one property that matters most:
 * **it can grant no role the caller could not grant one user at a time.** The handler under the batch is
 * the real `UserCreateHandler`, and the role decision is the real `UserService.assertCanAssignRoles` over
 * a scripted lookup of the tenant's roles — so an item asking for the super-admin role is refused by the
 * same code, with the same reason, that refuses a single create asking for it. And no member of a created
 * user — no credential, no hash — is ever part of a batch's answer.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const EMPLOYEE_ROLE = '00000000-0000-4000-8000-000000000031';
const SUPER_ADMIN_ROLE = '00000000-0000-4000-8000-000000000032';
const FOREIGN_ROLE = '00000000-0000-4000-8000-000000000033';
const ADMIN_USER = '00000000-0000-4000-8000-000000000040';

/** The roles of the caller's tenant, by id, as `resolveRoleName` reads them from the database. */
const ROLES: Record<string, RolesEnum> = {
	[EMPLOYEE_ROLE]: RolesEnum.EMPLOYEE,
	[SUPER_ADMIN_ROLE]: RolesEnum.SUPER_ADMIN
};

/** The grants of the caller, as the platform's field visibility reads them. */
function visibilityFor(granted: PermissionsEnum[]): FieldVisibility {
	return {
		canSee: (permission: PermissionsEnum) => granted.includes(permission),
		assertCanSee: (permission: PermissionsEnum) => {
			if (!granted.includes(permission)) {
				throw new ApiException(403, ApiErrorCode.PERMISSION_DENIED, 'Denied.', { permission });
			}
		}
	} as unknown as FieldVisibility;
}

/**
 * Both surfaces over the real create handler and the real role decision, with the users it writes kept the
 * way a database keeps them: a transaction that threw leaves nothing behind.
 */
function surfaces(options: { granted?: PermissionsEnum[] } = {}) {
	const users: Array<Record<string, any>> = [];
	const userService = {
		resolveRoleName: jest.fn(async (roleId: string) => ROLES[roleId]),
		create: jest.fn(async (payload: Record<string, any>) => {
			const row = {
				...payload,
				id: `user-${users.length + 1}`,
				tenantId: TENANT,
				// What a stored user carries beside the payload, and what an answer must never repeat.
				hash: '$2b$10$stored-password-digest'
			};
			users.push(row);

			return row;
		})
	} as Record<string, any>;
	// The real role decision, over the scripted lookup above.
	userService.assertCanAssignRoles = UserService.prototype.assertCanAssignRoles.bind(userService);

	const handler = new UserCreateHandler(userService as never);
	const commandBus = { execute: jest.fn((command) => handler.execute(command)) };

	const executor = new BulkExecutor(visibilityFor(options.granted ?? [PermissionsEnum.ORG_USERS_EDIT]));

	return {
		users,
		userService,
		controller: new UserController(userService as never, {} as never, commandBus as never, executor),
		resolver: new UserResolver(userService as never, {} as never, commandBus as never, executor)
	};
}

/** Whether the caller holds `SUPER_ADMIN_EDIT`, which is what may grant the super-admin role. */
function callerMayGrantSuperAdmin(may: boolean): void {
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
		permission === PermissionsEnum.SUPER_ADMIN_EDIT ? may : false
	);
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	callerMayGrantSuperAdmin(false);
	// The route's validator checks the role exists in the caller's tenant, as the single route's does.
	jest.spyOn(RoleShouldExistConstraint.prototype, 'validate').mockImplementation(async (role: unknown) => {
		const id = typeof role === 'string' ? role : (role as { id?: string })?.id;

		return !!id && id in ROLES;
	});
});

afterEach(() => jest.restoreAllMocks());

describe('POST /user/bulk — each item is POST /user', () => {
	it('refuses an item asking for a role the caller may not grant, with the single create’s reason, and creates the rest', async () => {
		const { controller, users } = surfaces();

		const result = await controller.bulk({
			items: [
				{ email: 'ada@example.com', roleId: EMPLOYEE_ROLE },
				{ email: 'mallory@example.com', roleId: SUPER_ADMIN_ROLE },
				{ email: 'eve@example.com', role: { id: SUPER_ADMIN_ROLE } as never }
			]
		});

		expect(result.succeeded.map((entry) => entry.index)).toEqual([0]);
		// Both spellings of the role are checked, as the single create checks them.
		expect(result.failed).toEqual([
			expect.objectContaining({
				index: 1,
				code: ApiErrorCode.PERMISSION_DENIED,
				message: 'Only a super admin may assign the super admin role.'
			}),
			expect.objectContaining({
				index: 2,
				code: ApiErrorCode.PERMISSION_DENIED,
				message: 'Only a super admin may assign the super admin role.'
			})
		]);
		expect(users.map((user) => [user.email, user.roleId])).toEqual([['ada@example.com', EMPLOYEE_ROLE]]);
	});

	it('CONTROL: grants the same role in a batch to a caller who may grant it one user at a time', async () => {
		callerMayGrantSuperAdmin(true);
		const { controller, users } = surfaces();

		const result = await controller.bulk({ items: [{ email: 'root@example.com', roleId: SUPER_ADMIN_ROLE }] });

		expect(result.succeededCount).toBe(1);
		expect(users.map((user) => user.roleId)).toEqual([SUPER_ADMIN_ROLE]);
	});

	it('refuses a role of another tenant, and a role and a roleId that disagree, as the single create does', async () => {
		const { controller, users } = surfaces();

		// Nothing applies, so the batch answers 422 with every item's own refusal beside it.
		const refusal = await controller
			.bulk({
				items: [
					{ email: 'a@example.com', roleId: FOREIGN_ROLE },
					{ email: 'b@example.com', roleId: EMPLOYEE_ROLE, role: { id: SUPER_ADMIN_ROLE } as never }
				]
			})
			.catch((thrown) => thrown);

		expect((refusal as ApiException).getStatus()).toBe(422);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ALL_ITEMS_FAILED);
		expect((refusal as ApiException).details).toMatchObject({
			items: [
				{ index: 0, code: ApiErrorCode.VALIDATION_FAILED },
				{
					index: 1,
					code: ApiErrorCode.VALIDATION_FAILED,
					message: 'The role and roleId fields must reference the same role.'
				}
			]
		});
		expect(users).toEqual([]);
	});

	it('refuses an atomic batch before writing anything — the role check of no item is even reached', async () => {
		const { controller, users, userService } = surfaces();

		const refusal = await controller
			.bulk({
				atomic: true,
				items: [
					{ email: 'ada@example.com', roleId: EMPLOYEE_ROLE },
					{ email: 'mallory@example.com', roleId: SUPER_ADMIN_ROLE }
				]
			})
			.catch((thrown) => thrown);

		// Each item is UserCreateCommand, which writes through its own repositories: no transaction could roll
		// the batch back as one, so the route refuses the flag before item 0.
		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ATOMIC_UNSUPPORTED);
		expect((refusal as ApiException).details).toEqual({ field: 'atomic', resource: 'user' });
		expect(userService.resolveRoleName).not.toHaveBeenCalled();
		expect(users).toEqual([]);
	});

	it('keeps credentials, a stated id and a stated tenant out of the write, and every member of the row out of the answer', async () => {
		const { controller, userService } = surfaces();

		const result = await controller.bulk({
			items: [
				{
					email: 'ada@example.com',
					roleId: EMPLOYEE_ROLE,
					hash: 'clear-text-password',
					password: 'clear-text-password',
					id: ADMIN_USER,
					tenantId: '00000000-0000-4000-8000-000000000099'
				} as never
			]
		});

		const written = userService.create.mock.calls[0][0];

		expect(written).not.toHaveProperty('hash');
		expect(written).not.toHaveProperty('password');
		expect(written).not.toHaveProperty('id');
		expect(written).not.toHaveProperty('tenantId');
		expect(result.succeeded).toEqual([{ index: 0, id: 'user-1', resource: 'user' }]);
		expect(JSON.stringify(result)).not.toMatch(/hash|password|stored-password-digest|clear-text/);
	});

	it('refuses a batch above its cap, and a caller without the create route’s grant, before creating anything', async () => {
		const capped = surfaces();
		const denied = surfaces({ granted: [PermissionsEnum.ORG_USERS_VIEW] });

		const tooMany = await capped.controller
			.bulk({
				items: Array.from({ length: 51 }, (_unused, index) => ({
					email: `u${index}@example.com`,
					roleId: EMPLOYEE_ROLE
				}))
			})
			.catch((thrown) => thrown);
		const refused = await denied.controller
			.bulk({ items: [{ email: 'ada@example.com', roleId: EMPLOYEE_ROLE }] })
			.catch((thrown) => thrown);

		// The cap is 50, not the platform's 200: a user create is the batch with the most at stake.
		expect((tooMany as ApiException).code).toBe(ApiErrorCode.BULK_LIMIT_EXCEEDED);
		expect((tooMany as ApiException).details).toEqual({ limit: 50, actual: 51 });
		expect((refused as ApiException).code).toBe(ApiErrorCode.PERMISSION_DENIED);
		expect(capped.users).toEqual([]);
		expect(denied.users).toEqual([]);
	});
});

describe('bulkCreateUsers — the same batch over GraphQL, each item `createUser`', () => {
	it('refuses an item asking for a role the caller may not grant, and answers ids only', async () => {
		const { resolver, users } = surfaces();

		const payload = await resolver.bulkCreateUsers({
			items: [
				{ email: 'ada@example.com', roleId: EMPLOYEE_ROLE },
				{ email: 'mallory@example.com', roleId: SUPER_ADMIN_ROLE }
			]
		});

		expect(payload).toMatchObject({ succeeded: 1, failed: 1, total: 2 });
		expect(payload.results[1]).toMatchObject({
			ok: false,
			error: {
				code: ApiErrorCode.PERMISSION_DENIED,
				message: 'Only a super admin may assign the super admin role.',
				path: ['items', '1']
			}
		});
		expect(users.map((user) => user.email)).toEqual(['ada@example.com']);
		expect(JSON.stringify(payload)).not.toMatch(/hash|stored-password-digest/);
	});

	it('refuses an atomic batch before writing anything, exactly as the route does', async () => {
		const { resolver, users } = surfaces();

		const refusal = await resolver
			.bulkCreateUsers({ atomic: true, items: [{ email: 'ada@example.com', roleId: EMPLOYEE_ROLE }] })
			.catch((thrown) => thrown);

		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ATOMIC_UNSUPPORTED);
		expect(users).toEqual([]);
	});
});

describe('the declarations both surfaces run the batch from', () => {
	it('declares the batch as a POST on its own path, under the create route’s grant and guards', () => {
		expect(Reflect.getMetadata(PATH_METADATA, UserController.prototype.bulk)).toBe('/bulk');
		expect(Reflect.getMetadata(METHOD_METADATA, UserController.prototype.bulk)).toBe(RequestMethod.POST);
		expect(readBulkOperation(UserController.prototype, 'bulk')).toEqual({
			resource: 'user',
			maxItems: 50,
			permission: PermissionsEnum.ORG_USERS_EDIT,
			atomic: false
		});
		for (const [route, field] of [
			[UserController.prototype.bulk, UserResolver.prototype.bulkCreateUsers],
			[UserController.prototype.create, UserResolver.prototype.createUser]
		]) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, route)).toEqual([PermissionsEnum.ORG_USERS_EDIT]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, field)).toEqual([PermissionsEnum.ORG_USERS_EDIT]);
		}
		expect(Reflect.getMetadata('__guards__', UserController.prototype.bulk)).toEqual(
			Reflect.getMetadata('__guards__', UserController.prototype.create)
		);
		expect(Reflect.getMetadata('__guards__', UserResolver.prototype.bulkCreateUsers)).toEqual(
			Reflect.getMetadata('__guards__', UserResolver.prototype.createUser)
		);
	});

	it('declares one retry scope on both surfaces, honoured and not demanded', () => {
		const route = Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, UserController.prototype.bulk);

		expect(route).toEqual({ scope: 'user.bulk', required: false, resourceType: 'user' });
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, UserResolver.prototype.bulkCreateUsers)).toEqual(route);
	});
});
