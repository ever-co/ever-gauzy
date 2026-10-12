import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { sign } from 'jsonwebtoken';
import { RequestContext } from '../../core/context';
import { RoleGuard } from './role.guard';

/**
 * GHSA-m8xc-8pwr-89fj — `@Roles(SUPER_ADMIN)` routes such as `PUT /tenant`, `DELETE /tenant` and the
 * billing endpoints are guarded by RoleGuard alone. RoleGuard asked RequestContext.hasRoles(), which
 * read the `role` claim out of the raw bearer token, so a demoted super admin kept destroying tenants
 * until the token expired. The guard must follow the role the user holds in the database.
 */
describe('RoleGuard', () => {
	const staleSuperAdminToken = sign(
		{ id: 'user-1', role: RolesEnum.SUPER_ADMIN, permissions: [PermissionsEnum.SUPER_ADMIN_EDIT] },
		env.JWT_SECRET
	);

	/** Builds a guard whose route metadata declares `roles`, for a request authenticated as `user`. */
	function build(roles: RolesEnum[], user: unknown) {
		const store = new Map<string, unknown>();

		RequestContext.setClsService({
			get: (key: string) => store.get(key),
			set: (key: string, value: unknown) => store.set(key, value)
		} as any);

		store.set(
			RequestContext.name,
			new RequestContext({
				req: { headers: { authorization: `Bearer ${staleSuperAdminToken}` }, user } as any
			})
		);

		const reflector = { getAllAndOverride: jest.fn(() => roles) };
		const context = { getHandler: () => jest.fn(), getClass: () => jest.fn() };

		return { guard: new RoleGuard(reflector as any), context: context as any };
	}

	afterEach(() => {
		RequestContext.setClsService(undefined as any);
	});

	it('denies a demoted user whose token still claims SUPER_ADMIN', async () => {
		const { guard, context } = build([RolesEnum.SUPER_ADMIN], {
			id: 'user-1',
			roleId: 'role-employee',
			role: { id: 'role-employee', name: RolesEnum.EMPLOYEE }
		});

		await expect(guard.canActivate(context)).resolves.toBe(false);
	});

	it('allows a user who is a SUPER_ADMIN in the database', async () => {
		const { guard, context } = build([RolesEnum.SUPER_ADMIN], {
			id: 'user-1',
			roleId: 'role-sa',
			role: { id: 'role-sa', name: RolesEnum.SUPER_ADMIN }
		});

		await expect(guard.canActivate(context)).resolves.toBe(true);
	});

	it('allows a promoted user whose token still claims the lesser role', async () => {
		// The inverse case: the claim is not trusted in either direction.
		const { guard, context } = build([RolesEnum.ADMIN], {
			id: 'user-1',
			roleId: 'role-admin',
			role: { id: 'role-admin', name: RolesEnum.ADMIN }
		});

		await expect(guard.canActivate(context)).resolves.toBe(true);
	});

	it('allows a route that declares no roles at all', async () => {
		const { guard, context } = build([], { id: 'user-1' });
		await expect(guard.canActivate(context)).resolves.toBe(true);
	});
});
