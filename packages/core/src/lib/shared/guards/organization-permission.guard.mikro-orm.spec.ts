import '../../core/entities/internal';

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RelationId } from 'typeorm';
import { EntityCaseNamingStrategy, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SqlEntityManager } from '@mikro-orm/knex';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { environment as env } from '@gauzy/config';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';
import {
	IOrganizationPolicyTarget,
	ORGANIZATION_POLICY_TARGET_METADATA
} from '../decorators/organization-policy-target.decorator';
import { OrganizationPermissionGuard } from './organization-permission.guard';

// The guard picks its ORM branch once, at import time; the platform decorators pick theirs when a class is
// decorated. Both read `DB_ORM=mikro-orm` here, as they do on a MikroORM install.
jest.mock('../../core/utils', () => ({
	...jest.requireActual('../../core/utils'),
	getORMType: () => 'mikro-orm'
}));

/**
 * `OrganizationPermissionGuard` on MikroORM, against a real in-memory better-sqlite3 store (#10668).
 *
 * **The defect.** The guard read the organization of the record a route addresses with
 * `fields: ['id', 'organizationId']`. Under MikroORM `organizationId` is the `persist: false` mirror of the
 * `organization` relation, and MikroORM drops a mirror from a `fields` list, so every record came back
 * without its organization: `PUT /timesheet/time-log/:id` and `PUT /timesheet/time-slot/:id` were refused for
 * every caller (the exempt SUPER_ADMIN included), and the bulk delete routes checked none of the
 * organizations of the records they delete. The arms marked RED fail with the old lookups and pass with the
 * fix; the others are controls that pass on both.
 *
 * **The mapping is the platform's own**: `MultiORMManyToOne` for the tenant and organization relations and,
 * beside each, `@RelationId` plus `MultiORMColumn({ nullable: true, relationId: true })`, exactly as
 * `TenantBaseEntity` and `TenantOrganizationBaseEntity` declare them, soft-deletable like every base entity,
 * under the naming strategy the platform configures. The tables are created as the platform's SQLite
 * migrations leave them, rather than by MikroORM's schema generator.
 */

@MultiORMEntity('policy_guard_tenant')
class PolicyGuardTenant {
	@PrimaryKey({ type: 'uuid' })
	id?: string;
}

@MultiORMEntity('policy_guard_organization')
class PolicyGuardOrganization {
	@PrimaryKey({ type: 'uuid' })
	id?: string;

	@MultiORMManyToOne(() => PolicyGuardTenant, { nullable: true, onDelete: 'CASCADE' })
	tenant?: PolicyGuardTenant;

	@RelationId((it: PolicyGuardOrganization) => it.tenant)
	@MultiORMColumn({ nullable: true, relationId: true })
	tenantId?: string;

	@MultiORMColumn({ default: true })
	allowManualTime?: boolean;

	@MultiORMColumn({ default: true })
	allowModifyTime?: boolean;

	@MultiORMColumn({ default: true })
	allowDeleteTime?: boolean;
}

@SoftDeletable(() => PolicyGuardTimeLog, 'deletedAt', () => new Date())
@MultiORMEntity('policy_guard_time_log')
class PolicyGuardTimeLog {
	@PrimaryKey({ type: 'uuid' })
	id?: string;

	@Property({ nullable: true })
	deletedAt?: Date;

	@MultiORMManyToOne(() => PolicyGuardTenant, { nullable: true, onDelete: 'CASCADE' })
	tenant?: PolicyGuardTenant;

	@RelationId((it: PolicyGuardTimeLog) => it.tenant)
	@MultiORMColumn({ nullable: true, relationId: true })
	tenantId?: string;

	@MultiORMManyToOne(() => PolicyGuardOrganization, { nullable: true, onUpdate: 'CASCADE', onDelete: 'CASCADE' })
	organization?: PolicyGuardOrganization;

	@RelationId((it: PolicyGuardTimeLog) => it.organization)
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationId?: string;
}

const TENANT_A = '66900000-0000-4000-8000-00000000000a';
const TENANT_B = '66900000-0000-4000-8000-00000000000b';

/** Every policy on; every policy off; another tenant's organization, every policy off. */
const ORGANIZATION_ALLOW = '66900000-0000-4000-8000-0000000000a1';
const ORGANIZATION_DENY = '66900000-0000-4000-8000-0000000000a2';
const ORGANIZATION_FOREIGN = '66900000-0000-4000-8000-0000000000b1';

const LOG_ALLOW = '66900000-0000-4000-8000-000000000001';
const LOG_DENY = '66900000-0000-4000-8000-000000000002';
const LOG_DENY_RETIRED = '66900000-0000-4000-8000-000000000003';
const LOG_FOREIGN = '66900000-0000-4000-8000-000000000004';

/** What `PUT /timesheet/time-log/:id` and `DELETE /timesheet/time-log` declare, on the fixture entity. */
const SINGLE_TARGET: IOrganizationPolicyTarget = { entity: PolicyGuardTimeLog, param: 'id' };
const BULK_TARGET: IOrganizationPolicyTarget = { entity: PolicyGuardTimeLog, param: 'logIds', source: 'query' };

describe('OrganizationPermissionGuard on MikroORM', () => {
	let orm: MikroORM;
	let previousAllowSuperAdminRole: unknown;

	beforeAll(async () => {
		orm = await MikroORM.init({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [PolicyGuardTenant, PolicyGuardOrganization, PolicyGuardTimeLog],
			extensions: [SoftDeleteHandler],
			// The platform's own naming strategy (packages/config/src/lib/database.ts).
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false }
		});

		const connection = orm.em.getConnection();
		await connection.execute('CREATE TABLE policy_guard_tenant (id varchar PRIMARY KEY NOT NULL)');
		await connection.execute(
			`CREATE TABLE policy_guard_organization (
				id varchar PRIMARY KEY NOT NULL,
				tenantId varchar NULL REFERENCES policy_guard_tenant (id) ON DELETE CASCADE,
				allowManualTime boolean NOT NULL DEFAULT (1),
				allowModifyTime boolean NOT NULL DEFAULT (1),
				allowDeleteTime boolean NOT NULL DEFAULT (1)
			)`
		);
		await connection.execute(
			`CREATE TABLE policy_guard_time_log (
				id varchar PRIMARY KEY NOT NULL,
				deletedAt datetime NULL,
				tenantId varchar NULL REFERENCES policy_guard_tenant (id) ON DELETE CASCADE,
				organizationId varchar NULL REFERENCES policy_guard_organization (id) ON DELETE CASCADE
			)`
		);

		for (const id of [TENANT_A, TENANT_B]) {
			await connection.execute('INSERT INTO policy_guard_tenant (id) VALUES (?)', [id]);
		}
		for (const [id, tenantId, allowed] of [
			[ORGANIZATION_ALLOW, TENANT_A, 1],
			[ORGANIZATION_DENY, TENANT_A, 0],
			[ORGANIZATION_FOREIGN, TENANT_B, 0]
		]) {
			await connection.execute(
				'INSERT INTO policy_guard_organization (id, tenantId, allowManualTime, allowModifyTime, allowDeleteTime) VALUES (?, ?, ?, ?, ?)',
				[id, tenantId, allowed, allowed, allowed]
			);
		}
		for (const [id, tenantId, organizationId, deletedAt] of [
			[LOG_ALLOW, TENANT_A, ORGANIZATION_ALLOW, null],
			[LOG_DENY, TENANT_A, ORGANIZATION_DENY, null],
			[LOG_DENY_RETIRED, TENANT_A, ORGANIZATION_DENY, new Date().toISOString()],
			[LOG_FOREIGN, TENANT_B, ORGANIZATION_FOREIGN, null]
		]) {
			await connection.execute(
				'INSERT INTO policy_guard_time_log (id, tenantId, organizationId, deletedAt) VALUES (?, ?, ?, ?)',
				[id, tenantId, organizationId, deletedAt]
			);
		}
	});

	afterAll(async () => {
		await orm?.close(true);
	});

	beforeEach(() => {
		previousAllowSuperAdminRole = (env as any).allowSuperAdminRole;
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		(env as any).allowSuperAdminRole = previousAllowSuperAdminRole;
		jest.restoreAllMocks();
	});

	/**
	 * A guard over a fresh entity manager, so no test reads what another loaded. Only the MikroORM
	 * organization repository is reached: the callers below have no employee record.
	 */
	function createGuard(): OrganizationPermissionGuard {
		const em = orm.em.fork() as SqlEntityManager;
		const cache = new Map<string, boolean>();
		const cacheManager: any = {
			get: async (key: string) => (cache.has(key) ? cache.get(key) : null),
			set: async (key: string, value: boolean) => {
				cache.set(key, value);
			}
		};
		const organizationRepository = {
			getEntityManager: () => em,
			createQueryBuilder: (alias: string) => em.createQueryBuilder(PolicyGuardOrganization, alias)
		};

		return new OrganizationPermissionGuard(
			cacheManager,
			new Reflector(),
			{} as any,
			{} as any,
			{} as any,
			organizationRepository as any
		);
	}

	function createContext(
		permission: PermissionsEnum,
		request: { body?: any; query?: any; params?: any },
		target: IOrganizationPolicyTarget
	): ExecutionContext {
		const handler = function handlerStub() {
			/* route handler */
		};
		class ControllerStub {}

		Reflect.defineMetadata(PERMISSIONS_METADATA, [permission], handler);
		Reflect.defineMetadata(ORGANIZATION_POLICY_TARGET_METADATA, target, handler);

		return {
			getHandler: () => handler,
			getClass: () => ControllerStub,
			switchToHttp: () => ({ getRequest: () => request })
		} as unknown as ExecutionContext;
	}

	/** A caller of tenant A with no employee record, so only the record and the request name organizations. */
	function asCaller(role: RolesEnum, options: { exemptSuperAdmin?: boolean } = {}) {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: 'user-1',
			tenantId: TENANT_A,
			employeeId: null,
			role: { name: role }
		} as any);
		jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(role);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null as any);
		jest.spyOn(RequestContext, 'hasRoles').mockImplementation(
			(roles: RolesEnum[]) => role === RolesEnum.SUPER_ADMIN && roles.includes(RolesEnum.SUPER_ADMIN)
		);
		(env as any).allowSuperAdminRole = !!options.exemptSuperAdmin;
	}

	describe('a route that addresses one record (PUT /timesheet/time-log/:id)', () => {
		it('RED: allows editing a time log of an organization that allows modifying time', async () => {
			asCaller(RolesEnum.ADMIN);

			const context = createContext(
				PermissionsEnum.ALLOW_MODIFY_TIME,
				{ params: { id: LOG_ALLOW }, body: {} },
				SINGLE_TARGET
			);

			await expect(createGuard().canActivate(context)).resolves.toBe(true);
		});

		it('refuses editing a time log of an organization that does not, whatever the body names', async () => {
			asCaller(RolesEnum.ADMIN);

			const context = createContext(
				PermissionsEnum.ALLOW_MODIFY_TIME,
				{ params: { id: LOG_DENY }, body: { organizationId: ORGANIZATION_ALLOW } },
				SINGLE_TARGET
			);

			await expect(createGuard().canActivate(context)).resolves.toBe(false);
		});

		it('refuses a time log of another tenant', async () => {
			asCaller(RolesEnum.ADMIN);

			const context = createContext(
				PermissionsEnum.ALLOW_MODIFY_TIME,
				{ params: { id: LOG_FOREIGN }, body: { organizationId: ORGANIZATION_ALLOW } },
				SINGLE_TARGET
			);

			await expect(createGuard().canActivate(context)).resolves.toBe(false);
		});

		it('RED: lets the exempt SUPER_ADMIN edit a time log of their own tenant', async () => {
			asCaller(RolesEnum.SUPER_ADMIN, { exemptSuperAdmin: true });

			const context = createContext(
				PermissionsEnum.ALLOW_MODIFY_TIME,
				{ params: { id: LOG_DENY }, body: {} },
				SINGLE_TARGET
			);

			await expect(createGuard().canActivate(context)).resolves.toBe(true);
		});

		it('refuses the exempt SUPER_ADMIN a time log of another tenant', async () => {
			asCaller(RolesEnum.SUPER_ADMIN, { exemptSuperAdmin: true });

			const context = createContext(
				PermissionsEnum.ALLOW_MODIFY_TIME,
				{ params: { id: LOG_FOREIGN }, body: {} },
				SINGLE_TARGET
			);

			await expect(createGuard().canActivate(context)).resolves.toBe(false);
		});
	});

	describe('a bulk route that addresses records by a query of ids (DELETE /timesheet/time-log)', () => {
		it('RED: refuses a delete that spans an organization whose policy is off, while the query names one whose policy is on', async () => {
			asCaller(RolesEnum.ADMIN);

			const context = createContext(
				PermissionsEnum.ALLOW_DELETE_TIME,
				{ query: { organizationId: ORGANIZATION_ALLOW, logIds: [LOG_ALLOW, LOG_DENY] } },
				BULK_TARGET
			);

			await expect(createGuard().canActivate(context)).resolves.toBe(false);
		});

		it('RED: counts a soft-deleted record too, which a force delete can still remove', async () => {
			asCaller(RolesEnum.ADMIN);

			const context = createContext(
				PermissionsEnum.ALLOW_DELETE_TIME,
				{ query: { organizationId: ORGANIZATION_ALLOW, logIds: [LOG_ALLOW, LOG_DENY_RETIRED] } },
				BULK_TARGET
			);

			await expect(createGuard().canActivate(context)).resolves.toBe(false);
		});

		it('allows a delete whose records all belong to an organization that allows it', async () => {
			asCaller(RolesEnum.ADMIN);

			const context = createContext(
				PermissionsEnum.ALLOW_DELETE_TIME,
				{ query: { organizationId: ORGANIZATION_ALLOW, logIds: [LOG_ALLOW] } },
				BULK_TARGET
			);

			await expect(createGuard().canActivate(context)).resolves.toBe(true);
		});

		it('reads no record of another tenant: its organization is not checked', async () => {
			asCaller(RolesEnum.ADMIN);

			// Were the foreign record read, its organization (another tenant's, policy off) would be counted
			// and the verdict would be a refusal.
			const context = createContext(
				PermissionsEnum.ALLOW_DELETE_TIME,
				{ query: { organizationId: ORGANIZATION_ALLOW, logIds: [LOG_ALLOW, LOG_FOREIGN] } },
				BULK_TARGET
			);

			await expect(createGuard().canActivate(context)).resolves.toBe(true);
		});
	});
});
