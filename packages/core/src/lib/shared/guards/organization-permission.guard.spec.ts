import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Brackets } from 'typeorm';
import { environment as env } from '@gauzy/config';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { ORGANIZATION_POLICY_TARGET_METADATA } from '../decorators/organization-policy-target.decorator';
import { OrganizationPermissionGuard, ORGANIZATION_POLICY_COLUMNS } from './organization-permission.guard';

// The guard picks its ORM branch once, at import time, from `DB_ORM`. The doubles below model the
// TypeORM repositories, so pin that branch rather than let a developer's `DB_ORM=mikro-orm` flip every
// verdict of this suite to the fail-closed path.
jest.mock('../../core/utils', () => ({
	...jest.requireActual('../../core/utils'),
	getORMType: () => 'typeorm'
}));

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

/** Records a route can address by id; `TimeLogStub` stands in for the entity class the route declares. */
class TimeLogStub {}

const TIME_LOGS = [
	{ id: 'log-in-deny', tenantId: TENANT_ID, organizationId: 'org-deny' },
	{ id: 'log-in-allow', tenantId: TENANT_ID, organizationId: 'org-allow' },
	{ id: 'log-foreign', tenantId: OTHER_TENANT_ID, organizationId: 'org-foreign' }
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
	findTarget: jest.Mock;
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

	const findTarget = jest.fn(async (entity: unknown, { where }: any) => {
		if (entity !== TimeLogStub) {
			return null;
		}
		return TIME_LOGS.find((log) => log.id === where.id && log.tenantId === where.tenantId) ?? null;
	});

	const guard = new OrganizationPermissionGuard(
		cacheManager,
		new Reflector(),
		{ findOne } as any,
		{} as any,
		{ createQueryBuilder, manager: { findOne: findTarget } } as any,
		{} as any
	);

	return { guard, cache, findOne, createQueryBuilder, findTarget };
}

/**
 * Builds an execution context whose handler/class carry the given permissions metadata, and whose
 * request carries the given body/query.
 */
function createContext(
	permissions: PermissionsEnum[] | undefined,
	request: { body?: any; query?: any; params?: any } = {},
	target?: { entity: unknown; param: string }
): ExecutionContext {
	const handler = function handlerStub() {
		/* route handler */
	};

	class ControllerStub {}

	if (permissions) {
		Reflect.defineMetadata(PERMISSIONS_METADATA, permissions, handler);
	}

	if (target) {
		Reflect.defineMetadata(ORGANIZATION_POLICY_TARGET_METADATA, target, handler);
	}

	return {
		getHandler: () => handler,
		getClass: () => ControllerStub,
		switchToHttp: () => ({ getRequest: () => request })
	} as unknown as ExecutionContext;
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
	// The guard reads the DB-fresh user JwtStrategy attaches to the request, never the token's claims.
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: 'user-1',
		tenantId: options.tenantId === undefined ? TENANT_ID : options.tenantId,
		employeeId: options.employeeId ?? null,
		role: { name: options.role }
	} as any);
	jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(options.role as RolesEnum);
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

	describe('routes that mutate a record addressed by id', () => {
		// PUT /timesheet/time-log/:id and PUT /timesheet/time-slot/:id load their target by id alone, so
		// the organization named by the request is not necessarily the one the write lands in.
		const target = { entity: TimeLogStub, param: 'id' };

		it('denies a caller with no employee record who names a permissive organization for a record of a denied one', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.ADMIN, employeeId: null });

			const context = createContext(
				[PermissionsEnum.ALLOW_MODIFY_TIME],
				{ params: { id: 'log-in-deny' }, body: { organizationId: 'org-allow' } },
				target
			);

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});

		it('denies when the request names no organization and the record lives in a denied one', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.ADMIN, employeeId: null, organizationId: 'org-allow' });

			const context = createContext(
				[PermissionsEnum.ALLOW_MODIFY_TIME],
				{ params: { id: 'log-in-deny' }, body: {} },
				target
			);

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});

		it('allows when the record and the named organization both allow the action', async () => {
			const { guard, findTarget } = createGuard();
			asCaller({ role: RolesEnum.ADMIN, employeeId: null });

			const context = createContext(
				[PermissionsEnum.ALLOW_MODIFY_TIME],
				{ params: { id: 'log-in-allow' }, body: { organizationId: 'org-allow' } },
				target
			);

			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(findTarget).toHaveBeenCalledWith(TimeLogStub, {
				where: { id: 'log-in-allow', tenantId: TENANT_ID },
				select: { id: true, organizationId: true }
			});
		});

		it('denies a record of another tenant, even though its organization is permissive', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.ADMIN, employeeId: null });

			const context = createContext(
				[PermissionsEnum.ALLOW_MODIFY_TIME],
				{ params: { id: 'log-foreign' }, body: { organizationId: 'org-allow' } },
				target
			);

			await expect(guard.canActivate(context)).resolves.toBe(false);
		});

		it('denies when the route param carrying the record id is missing', async () => {
			const { guard, createQueryBuilder } = createGuard();
			asCaller({ role: RolesEnum.ADMIN, employeeId: null });

			const context = createContext(
				[PermissionsEnum.ALLOW_MODIFY_TIME],
				{ params: {}, body: { organizationId: 'org-allow' } },
				target
			);

			await expect(guard.canActivate(context)).resolves.toBe(false);
			expect(createQueryBuilder).not.toHaveBeenCalled();
		});

		it('denies an EMPLOYEE editing a record of a denied organization from their permissive one', async () => {
			const { guard } = createGuard();
			asCaller({ role: RolesEnum.EMPLOYEE, employeeId: 'employee-in-allow' });

			const context = createContext(
				[PermissionsEnum.ALLOW_MODIFY_TIME],
				{ params: { id: 'log-in-deny' }, body: { organizationId: 'org-allow' } },
				target
			);

			await expect(guard.canActivate(context)).resolves.toBe(false);
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

		it('denies an unauthenticated request', async () => {
			const { guard, createQueryBuilder } = createGuard();
			asCaller({ role: RolesEnum.ADMIN, employeeId: null, organizationId: 'org-allow' });
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null);

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-allow' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(false);
			expect(createQueryBuilder).not.toHaveBeenCalled();
		});

		// GHSA-m8xc-8pwr-89fj: the role comes from the database. When it cannot be resolved — the
		// user's roleId is NULL, the role row is gone, or it carries no name — no verdict can be
		// reached, and the guard must deny rather than guess, even for a permissive organization.
		it.each([
			['a user whose role no longer resolves', null],
			['a user whose role carries no name', undefined]
		])('denies %s', async (_label, resolvedRole) => {
			const { guard, createQueryBuilder } = createGuard();
			asCaller({ role: RolesEnum.ADMIN, employeeId: null, organizationId: 'org-allow' });
			jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(resolvedRole as any);

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-allow' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(false);
			expect(createQueryBuilder).not.toHaveBeenCalled();
		});

		it('decides from the role the user holds now, not the one their token was issued with', async () => {
			// A former admin demoted to employee, still carrying an admin-era token, no longer takes the
			// no-employee path: the employee record's organization is what gets checked.
			const { guard, findOne } = createGuard();
			asCaller({ role: RolesEnum.EMPLOYEE, employeeId: 'employee-in-deny', organizationId: 'org-allow' });

			const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
				body: { organizationId: 'org-allow' }
			});

			await expect(guard.canActivate(context)).resolves.toBe(false);
			expect(findOne).toHaveBeenCalled();
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
			const previous = (env as any).allowSuperAdminRole;
			const { guard, createQueryBuilder } = createGuard();
			asCaller({ role: RolesEnum.SUPER_ADMIN, employeeId: null, isSuperAdmin: true });
			(env as any).allowSuperAdminRole = true;

			try {
				const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
					body: { organizationId: 'org-deny' }
				});

				await expect(guard.canActivate(context)).resolves.toBe(true);
				expect(createQueryBuilder).not.toHaveBeenCalled();
			} finally {
				(env as any).allowSuperAdminRole = previous;
			}
		});

		it('denies a tenant-less SUPER_ADMIN even on a route with no policy target', async () => {
			// The exemption is granted before any tenant-scoped lookup, so it must not be granted to a
			// request whose tenant cannot be resolved at all (nothing downstream can scope such a call).
			const previous = (env as any).allowSuperAdminRole;
			const { guard, createQueryBuilder } = createGuard();
			asCaller({ role: RolesEnum.SUPER_ADMIN, employeeId: null, isSuperAdmin: true, tenantId: null });
			(env as any).allowSuperAdminRole = true;

			try {
				const context = createContext([PermissionsEnum.ALLOW_MANUAL_TIME], {
					body: { organizationId: 'org-allow' }
				});

				await expect(guard.canActivate(context)).resolves.toBe(false);
				expect(createQueryBuilder).not.toHaveBeenCalled();
			} finally {
				(env as any).allowSuperAdminRole = previous;
			}
		});

		// GHSA-6qvm-3wg4-26w4: every tenant owner is a SUPER_ADMIN. The early return used to skip the
		// tenant-scoped target lookup, which is the only ownership check on PUT /timesheet/time-slot/:id.
		// CONTROL: with the pre-fix `return true` restored, the foreign-record arm resolves to `true`.
		describe('on a route that addresses a record by id', () => {
			const target = { entity: TimeLogStub, param: 'id' };

			const asExemptSuperAdmin = () => {
				asCaller({ role: RolesEnum.SUPER_ADMIN, employeeId: null, isSuperAdmin: true });
				(env as any).allowSuperAdminRole = true;
			};

			let previous: unknown;
			beforeEach(() => {
				previous = (env as any).allowSuperAdminRole;
			});
			afterEach(() => {
				(env as any).allowSuperAdminRole = previous;
			});

			it('denies a record of another tenant', async () => {
				const { guard, findTarget } = createGuard();
				asExemptSuperAdmin();

				const context = createContext(
					[PermissionsEnum.ALLOW_MODIFY_TIME],
					{ params: { id: 'log-foreign' }, body: {} },
					target
				);

				await expect(guard.canActivate(context)).resolves.toBe(false);
				expect(findTarget).toHaveBeenCalledWith(TimeLogStub, {
					where: { id: 'log-foreign', tenantId: TENANT_ID },
					select: { id: true, organizationId: true }
				});
			});

			it('still exempts a record of its own tenant from the organization policy', async () => {
				const { guard, createQueryBuilder } = createGuard();
				asExemptSuperAdmin();

				// The record's organization has allowModifyTime off: the policy stays exempt.
				const context = createContext(
					[PermissionsEnum.ALLOW_MODIFY_TIME],
					{ params: { id: 'log-in-deny' }, body: {} },
					target
				);

				await expect(guard.canActivate(context)).resolves.toBe(true);
				expect(createQueryBuilder).not.toHaveBeenCalled();
			});

			it('denies when the request has no tenant', async () => {
				const { guard } = createGuard();
				asCaller({ role: RolesEnum.SUPER_ADMIN, employeeId: null, isSuperAdmin: true, tenantId: null });
				(env as any).allowSuperAdminRole = true;

				const context = createContext(
					[PermissionsEnum.ALLOW_MODIFY_TIME],
					{ params: { id: 'log-in-allow' }, body: {} },
					target
				);

				await expect(guard.canActivate(context)).resolves.toBe(false);
			});
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
