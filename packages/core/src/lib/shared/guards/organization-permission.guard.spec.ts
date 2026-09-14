import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Brackets } from 'typeorm';
import { sign } from 'jsonwebtoken';
import { environment as env } from '@gauzy/config';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { OrganizationPermissionGuard, ORGANIZATION_POLICY_COLUMNS } from './organization-permission.guard';

/**
 * GHSA-rmq9-85v7-f365 — `OrganizationPermissionGuard` only enforced the organization's
 * time-tracking policy toggles when the caller's role was exactly `EMPLOYEE`; every other role fell
 * into an unconditional `isAuthorized = true`.
 *
 * Every arm below that expects `false` for a non-employee role is a CONTROL against the pre-fix
 * code: with the `role === RolesEnum.EMPLOYEE ? check : true` branch restored, each of them returns
 * `true`.
 */

const TENANT_ID = '6a5e8a1f-0000-4000-8000-000000000001';
const OTHER_TENANT_ID = '6a5e8a1f-0000-4000-8000-000000000002';

// `denyAll` has every policy switched off, `allowAll` has them on; `partial` is on for manual time
// only, which is what proves the OR across the declared permissions.
const ORGANIZATIONS = [
	{
		id: 'org-deny',
		tenantId: TENANT_ID,
		allowManualTime: false,
		allowModifyTime: false,
		allowDeleteTime: false
	},
	{ id: 'org-allow', tenantId: TENANT_ID, allowManualTime: true, allowModifyTime: true, allowDeleteTime: true },
	{
		id: 'org-partial',
		tenantId: TENANT_ID,
		allowManualTime: true,
		allowModifyTime: false,
		allowDeleteTime: false
	},
	{
		id: 'org-foreign',
		tenantId: OTHER_TENANT_ID,
		allowManualTime: true,
		allowModifyTime: true,
		allowDeleteTime: true
	}
];

const EMPLOYEES = [
	{ id: 'employee-in-deny', tenantId: TENANT_ID, organizationId: 'org-deny' },
	{ id: 'employee-in-allow', tenantId: TENANT_ID, organizationId: 'org-allow' },
	{ id: 'employee-foreign', tenantId: OTHER_TENANT_ID, organizationId: 'org-foreign' }
];

/**
 * A query-builder double that actually evaluates the criteria the guard builds against the fixture
 * table above, rather than returning a canned count. That way a guard that forgets the tenant
 * predicate, or ORs the wrong column, fails the suite.
 */
function createOrganizationQueryBuilderDouble() {
	const state: { ids: string[]; tenantId?: string; columns: string[] } = { ids: [], columns: [] };

	const qb: any = {
		alias: 'organization',
		where(_sql: string, params: { organizationIds: string[] }) {
			state.ids = params.organizationIds;
			return qb;
		},
		andWhere(arg: any, params?: { tenantId: string }) {
			if (typeof arg === 'string') {
				if (params?.tenantId) {
					state.tenantId = params.tenantId;
				}
			} else if (arg instanceof Brackets) {
				arg.whereFactory({
					orWhere: (sql: string) => {
						state.columns.push(sql.replace('organization.', '').replace(' = true', ''));
						return undefined as any;
					}
				} as any);
			}
			return qb;
		},
		async getCount() {
			return ORGANIZATIONS.filter(
				(organization: any) =>
					state.ids.includes(organization.id) &&
					organization.tenantId === state.tenantId &&
					state.columns.some((column: string) => organization[column] === true)
			).length;
		},
		state
	};

	return qb;
}

interface GuardHarness {
	guard: OrganizationPermissionGuard;
	cache: Map<string, boolean>;
	findOne: jest.Mock;
	createQueryBuilder: jest.Mock;
}

function createGuard(): GuardHarness {
	const cache = new Map<string, boolean>();

	const cacheManager: any = {
		get: jest.fn(async (key: string) => (cache.has(key) ? cache.get(key) : null)),
		set: jest.fn(async (key: string, value: boolean) => {
			cache.set(key, value);
		})
	};

	const findOne = jest.fn(async ({ where }: any) => {
		return EMPLOYEES.find((employee) => employee.id === where.id && employee.tenantId === where.tenantId) ?? null;
	});

	const createQueryBuilder = jest.fn(() => createOrganizationQueryBuilderDouble());

	const guard = new OrganizationPermissionGuard(
		cacheManager,
		new Reflector(),
		{ findOne } as any,
		{} as any,
		{ createQueryBuilder } as any,
		{} as any
	);

	return { guard, cache, findOne, createQueryBuilder };
}

/**
 * Builds an execution context whose handler/class carry the given permissions metadata, and whose
 * request carries the given body/query.
 */
function createContext(
	permissions: PermissionsEnum[] | undefined,
	request: { body?: any; query?: any; params?: any } = {}
): ExecutionContext {
	const handler = function handlerStub() {
		/* route handler */
	};

	class ControllerStub {}

	if (permissions) {
		Reflect.defineMetadata(PERMISSIONS_METADATA, permissions, handler);
	}

	return {
		getHandler: () => handler,
		getClass: () => ControllerStub,
		switchToHttp: () => ({ getRequest: () => request })
	} as unknown as ExecutionContext;
}

function signToken(payload: { role: string; employeeId?: string | null; id?: string }): string {
	return sign(
		{ id: payload.id ?? 'user-1', role: payload.role, employeeId: payload.employeeId ?? null },
		env.JWT_SECRET
	);
}

/**
 * Points `RequestContext` at a caller without needing a real HTTP request in flight.
 */
function asCaller(options: {
	role: string;
	employeeId?: string | null;
	tenantId?: string | null;
	organizationId?: string | null;
	isSuperAdmin?: boolean;
}) {
	jest.spyOn(RequestContext, 'currentToken').mockReturnValue(
		signToken({ role: options.role, employeeId: options.employeeId })
	);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(
		options.tenantId === undefined ? TENANT_ID : (options.tenantId as any)
	);
	jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue((options.organizationId ?? null) as any);
	jest.spyOn(RequestContext, 'hasRoles').mockImplementation(
		(roles: RolesEnum[]) => Boolean(options.isSuperAdmin) && roles.includes(RolesEnum.SUPER_ADMIN)
	);
}

describe('OrganizationPermissionGuard', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('maps exactly the three organization time-tracking policy permissions', () => {
		expect(ORGANIZATION_POLICY_COLUMNS).toEqual({
			[PermissionsEnum.ALLOW_MANUAL_TIME]: 'allowManualTime',
			[PermissionsEnum.ALLOW_MODIFY_TIME]: 'allowModifyTime',
			[PermissionsEnum.ALLOW_DELETE_TIME]: 'allowDeleteTime'
		});
	});

	describe('non-employee roles (the GHSA-rmq9-85v7-f365 bypass)', () => {
		// Every role here previously took the `else { isAuthorized = true; }` branch.
		it.each([RolesEnum.MANAGER, RolesEnum.DATA_ENTRY, RolesEnum.VIEWER, RolesEnum.ADMIN])(
			'denies %s when the organization has allowManualTime off',
			async (role) => {
				const { guard } = createGuard();
				asCaller({ role, employeeId: null });

				const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
					body: { organizationId: 'org-deny' }
				});

				await expect(guard.canActivate(context)).resolves.toBe(false);
			}
		);

		it.each([RolesEnum.MANAGER, RolesEnum.DATA_ENTRY, RolesEnum.VIEWER, RolesEnum.ADMIN])(
			'allows %s when the organization has allowManualTime on',
			async (role) => {
				const { guard } = createGuard();
				asCaller({ role, employeeId: null });

				const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
					body: { organizationId: 'org-allow' }
				});

				await expect(guard.canActivate(context)).resolves.toBe(true);
			}
		);

		it('denies a MANAGER deleting time when allowDeleteTime is off, reading organizationId from the query', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.MANAGER, employeeId: null });

			const context = createContext([PermissionsEnum.ALLOW_DELETE_TIME], {
				query: { organizationId: 'org-partial', logIds: ['1'] }
			});

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});

		it('allows a MANAGER adding manual time in an organization that only has allowManualTime on', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.MANAGER, employeeId: null });

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-partial' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(true);
		});

		it('falls back to the membership-validated organization pinned on the JWT', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.MANAGER, employeeId: null, organizationId: 'org-deny' });

			const context = createContext([PermissionsEnum.ALLOW_MODIFY_TIME], { body: { startedAt: 'now' } });

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});

		it('fails closed when no organization can be resolved at all', async () => {
			const { guard, createQueryBuilder } = createGuard();
			asCaller({ role: RolesEnum.MANAGER, employeeId: null, organizationId: null });

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], { body: {} });

			await expect(guard.canActivate(context)).resolves.toBe(false);
			expect(createQueryBuilder).not.toHaveBeenCalled();
		});

		it('fails closed for an organization of another tenant, even though its policy is permissive', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.MANAGER, employeeId: null });

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-foreign' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});
	});

	describe('employee callers keep their previous behaviour', () => {
		it('denies an EMPLOYEE whose own organization has the policy off', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.EMPLOYEE, employeeId: 'employee-in-deny' });

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-deny' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});

		it('allows an EMPLOYEE whose own organization has the policy on', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.EMPLOYEE, employeeId: 'employee-in-allow' });

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-allow' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(true);
		});

		it('denies an EMPLOYEE who points the request at a permissive sibling organization', async () => {
			// Both the employee's own organization and the organization named by the request have to
			// allow the action, so a permissive sibling cannot be used to launder a denied write.
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.EMPLOYEE, employeeId: 'employee-in-deny' });

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-allow' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});

		it('denies an EMPLOYEE-role caller that has no employee record', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.EMPLOYEE, employeeId: null, organizationId: 'org-allow' });

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-allow' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});

		it('denies a caller whose employee id belongs to another tenant', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.EMPLOYEE, employeeId: 'employee-foreign' });

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-allow' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});

		it('scopes the employee lookup to the caller tenant', async () => {
			const { guard, findOne } = createGuard();
			asCaller({ role: RolesEnum.EMPLOYEE, employeeId: 'employee-in-allow' });

			await guard.canActivate(createContext([PermissionsEnum.ALLOW_MANUAL_TIME], { body: {} }));

			expect(findOne).toHaveBeenCalledWith({
				where: { id: 'employee-in-allow', tenantId: TENANT_ID },
				select: { id: true, organizationId: true }
			});
		});
	});

	describe('fail-closed contract', () => {
		it('denies a route that applies the guard without declaring a permission', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.ADMIN, employeeId: null, organizationId: 'org-allow' });

			await expect(guard.canActivate(createContext(undefined, { body: {} }))).resolves.toBe(false);
		});

		it('denies a permission that is not an organization time-tracking policy', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.ADMIN, employeeId: null, organizationId: 'org-allow' });

			const context = createContext([PermissionsEnum.TIME_TRACKER], { body: { organizationId: 'org-allow' } });

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});

		it('denies when one of the declared permissions is outside the policy map', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.ADMIN, employeeId: null, organizationId: 'org-allow' });

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME, PermissionsEnum.ALL_ORG_EDIT], {
				body: { organizationId: 'org-allow' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});

		it('denies when the request carries no usable token', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.ADMIN, employeeId: null, organizationId: 'org-allow' });
			jest.spyOn(RequestContext, 'currentToken').mockReturnValue('not-a-jwt');

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-allow' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});

		it('denies when the request has no tenant', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.ADMIN, employeeId: null, tenantId: null, organizationId: 'org-allow' });

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-allow' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});
	});

	describe('super admin exemption', () => {
		it('exempts SUPER_ADMIN while allowSuperAdminRole is on', async () => {
			const { guard, createQueryBuilder } = createGuard();
			asCaller({ role: RolesEnum.SUPER_ADMIN, employeeId: null, isSuperAdmin: true });
			(env as any).allowSuperAdminRole = true;

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-deny' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(createQueryBuilder).not.toHaveBeenCalled();
		});

		it('enforces the policy for SUPER_ADMIN when allowSuperAdminRole is off', async () => {
			const previous = (env as any).allowSuperAdminRole;
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.SUPER_ADMIN, employeeId: null, isSuperAdmin: true });
			(env as any).allowSuperAdminRole = false;

			try {
				const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
					body: { organizationId: 'org-deny' }
				});

				await expect(guard.canActivate(context)).resolves.toBe(false);
			} finally {
				(env as any).allowSuperAdminRole = previous;
			}
		});
	});

	describe('caching', () => {
		it('keys the verdict by tenant, organization and permissions, so two organizations do not share it', async () => {
			const { guard, cache, createQueryBuilder } = createGuard();
			asCaller({ role: RolesEnum.MANAGER, employeeId: null });

			await expect(
				guard.canActivate(
					createContext([PermissionsEnum.ALLOW_MANUAL_TIME], { body: { organizationId: 'org-deny' } })
				)
			).resolves.toBe(false);

			await expect(
				guard.canActivate(
					createContext([PermissionsEnum.ALLOW_MANUAL_TIME], { body: { organizationId: 'org-allow' } })
				)
			).resolves.toBe(true);

			expect([...cache.keys()]).toEqual([
				`orgPermissions_${TENANT_ID}_org-deny_${PermissionsEnum.ALLOW_MANUAL_TIME}`,
				`orgPermissions_${TENANT_ID}_org-allow_${PermissionsEnum.ALLOW_MANUAL_TIME}`
			]);
			expect(createQueryBuilder).toHaveBeenCalledTimes(2);
		});

		it('serves a repeated verdict from the cache instead of re-querying', async () => {
			const { guard, createQueryBuilder } = createGuard();
			asCaller({ role: RolesEnum.MANAGER, employeeId: null });

			const build = () =>
				createContext([PermissionsEnum.ALLOW_MANUAL_TIME], { body: { organizationId: 'org-deny' } });

			await guard.canActivate(build());
			await guard.canActivate(build());

			expect(createQueryBuilder).toHaveBeenCalledTimes(1);
		});
	});
});
