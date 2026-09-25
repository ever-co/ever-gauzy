import '../core/entities/internal';

import {
	EntityCaseNamingStrategy,
	MikroORM,
	PrimaryKey,
	Property,
	RequestContext as MikroOrmRequestContext,
	Utils
} from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { DeleteDateColumn, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { IFindMembersInput, IRole, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { IAuthenticatedUser } from '../core/context/types';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../core/utils';
import { EmployeeService } from '../employee/employee.service';
import { UserService } from '../user/user.service';
import { RoleAuthorizationService } from './role-authorization.service';

/**
 * The role `JwtStrategy` pins onto the caller stays an entity under MikroORM.
 *
 * **The defect.** Under `DB_ORM=mikro-orm` the GraphQL field `employeeMembers` answered
 * `INTERNAL_ERROR: Cannot read properties of undefined (reading '__identifier')`, logged by MikroORM as a
 * "JIT runtime error" of its generated snapshot function. `JwtStrategy.validate` loads the caller through
 * `UserService.getIfExists`, which under MikroORM is `findOne` on the request's own fork, so the user on the
 * request is the entity that fork's unit of work manages. `RoleAuthorizationService.attachAuthorizationState`
 * then set its `role` — a many-to-one relation — to the lean `{ id, name, tenantId }` it caches. Any later read
 * in the same request that returns the caller's row again merges into that managed user
 * (`EntityFactory.mergeData`), which snapshots it; the snapshot of a to-one relation reads
 * `entity.role.__helper.__identifier`, and a plain object has no `__helper`. `findMembers` populates `user` on
 * every member, and the caller is one of them.
 *
 * **What is real here.** MikroORM on in-memory better-sqlite3, with the rows declared through the platform's own
 * decorators under `DB_ORM=mikro-orm` (so the `roleId` / `userId` mirrors are the `persist: false` properties the
 * platform maps), soft-deletable as `SoftDeletableBaseEntity` makes every entity, with the naming strategy and the
 * soft-delete extension the platform configures, under either `autoJoinRefsForFilters`. The steps are the
 * platform's own code, in the order one request runs them: `UserService.getIfExists` and
 * `RoleAuthorizationService.attachAuthorizationState` (lines 60 and 76 of `jwt.strategy.ts`), then
 * `EmployeeService.findMembers` (the `employeeMembers` resolver and `GET /employee/members`), inside one MikroORM
 * request context as `bootstrap` mounts one on `/graphql`.
 */

/** Sets `DB_ORM` for the decorators applied while `define` runs, which is when they choose their ORM. */
function mappedFor<R>(orm: MultiORMEnum, define: () => R): R {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = orm;
	try {
		return define();
	} finally {
		if (previous === undefined) {
			delete process.env.DB_ORM;
		} else {
			process.env.DB_ORM = previous;
		}
	}
}

/** The rows as MikroORM sees them in production: each relation owns its column, the `*Id` property mirrors it. */
const MIKRO_ORM = mappedFor(MultiORMEnum.MikroORM, () => {
	@SoftDeletable(() => AuthzRole, 'deletedAt', () => new Date())
	@MultiORMEntity('authz_role')
	class AuthzRole {
		@PrimaryKey({ type: 'uuid' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;

		@DeleteDateColumn()
		@Property({ nullable: true })
		deletedAt?: Date;

		@MultiORMColumn()
		name?: string;

		@MultiORMColumn({ nullable: true })
		tenantId?: string;

		@MultiORMOneToMany(() => AuthzRolePermission, (it: AuthzRolePermission) => it.role, { cascade: true })
		rolePermissions?: AuthzRolePermission[];
	}

	@SoftDeletable(() => AuthzRolePermission, 'deletedAt', () => new Date())
	@MultiORMEntity('authz_role_permission')
	class AuthzRolePermission {
		@PrimaryKey({ type: 'uuid' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;

		@DeleteDateColumn()
		@Property({ nullable: true })
		deletedAt?: Date;

		@MultiORMColumn()
		permission?: string;

		@MultiORMColumn({ type: Boolean, nullable: true })
		enabled?: boolean;

		@MultiORMColumn({ type: Boolean, nullable: true })
		isActive?: boolean;

		@MultiORMColumn({ type: Boolean, nullable: true })
		isArchived?: boolean;

		@MultiORMManyToOne(() => AuthzRole, (it: AuthzRole) => it.rolePermissions, { onDelete: 'CASCADE' })
		role?: AuthzRole;

		@RelationId((it: AuthzRolePermission) => it.role)
		@MultiORMColumn({ relationId: true })
		roleId?: string;
	}

	@SoftDeletable(() => AuthzUser, 'deletedAt', () => new Date())
	@MultiORMEntity('authz_user')
	class AuthzUser {
		@PrimaryKey({ type: 'uuid' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;

		@DeleteDateColumn()
		@Property({ nullable: true })
		deletedAt?: Date;

		@MultiORMColumn({ nullable: true })
		tenantId?: string;

		@MultiORMColumn({ nullable: true })
		firstName?: string;

		@MultiORMColumn({ type: Boolean, nullable: true })
		isActive?: boolean;

		@MultiORMColumn({ type: Boolean, nullable: true })
		isArchived?: boolean;

		@MultiORMManyToOne(() => AuthzRole, { nullable: true, onDelete: 'SET NULL' })
		role?: IRole;

		@RelationId((it: AuthzUser) => it.role)
		@MultiORMColumn({ nullable: true, relationId: true })
		roleId?: string;
	}

	@SoftDeletable(() => AuthzEmployee, 'deletedAt', () => new Date())
	@MultiORMEntity('authz_employee')
	class AuthzEmployee {
		@PrimaryKey({ type: 'uuid' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;

		@DeleteDateColumn()
		@Property({ nullable: true })
		deletedAt?: Date;

		@MultiORMColumn({ nullable: true })
		tenantId?: string;

		@MultiORMColumn({ nullable: true })
		organizationId?: string;

		@MultiORMColumn({ type: Boolean, nullable: true })
		isActive?: boolean;

		@MultiORMColumn({ type: Boolean, nullable: true })
		isArchived?: boolean;

		@MultiORMColumn({ type: Boolean, nullable: true })
		isOnline?: boolean;

		@MultiORMColumn({ type: Boolean, nullable: true })
		isAway?: boolean;

		@MultiORMManyToOne(() => AuthzUser, { nullable: true, onDelete: 'CASCADE' })
		user?: AuthzUser;

		@RelationId((it: AuthzEmployee) => it.user)
		@MultiORMColumn({ nullable: true, relationId: true })
		userId?: string;
	}

	return { Role: AuthzRole, RolePermission: AuthzRolePermission, User: AuthzUser, Employee: AuthzEmployee };
});

const TENANT = '6c000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '6c000000-0000-4000-8000-00000000000b';
const ROLE = '6c000000-0000-4000-8000-0000000000a1';
const CALLER = '6c000000-0000-4000-8000-0000000000c1';
const COLLEAGUE = '6c000000-0000-4000-8000-0000000000c2';
const CALLER_EMPLOYEE = '6c000000-0000-4000-8000-0000000000e1';
const COLLEAGUE_EMPLOYEE = '6c000000-0000-4000-8000-0000000000e2';

/** What `RequestContext.currentRoleName()` reads off `request.user`. */
const roleNameOf = (user: IAuthenticatedUser): string | undefined =>
	typeof user.role === 'string' ? user.role : user.role?.name;

describe.each([
	['MikroORM 6 default (autoJoinRefsForFilters on)', true],
	['autoJoinRefsForFilters off', false]
])('RoleAuthorizationService under MikroORM, %s', (_label, autoJoinRefsForFilters) => {
	let orm: MikroORM<BetterSqliteDriver>;

	/** The cache `RoleAuthorizationService` keeps the per-role state in, shared by every request as the platform's. */
	let cache: Map<string, unknown>;

	const cacheManager = {
		get: async (key: string) => cache.get(key),
		set: async (key: string, value: unknown) => {
			cache.set(key, value);
		}
	};

	/** The services a request resolves, over repositories bound to the global EntityManager, as Nest injects them. */
	const services = () => {
		const employees = new EmployeeService(
			{} as any,
			new MikroOrmBaseEntityRepository<any>(orm.em, MIKRO_ORM.Employee) as any
		);
		const users = new UserService(
			{} as any,
			new MikroOrmBaseEntityRepository<any>(orm.em, MIKRO_ORM.User) as any,
			employees,
			{} as any,
			{} as any
		);
		// `RoleAuthorizationService` reads its ORM from `DB_ORM` when it is constructed. TypeORM is never asked.
		const typeOrmRoleRepository = {
			findOne: async () => {
				throw new Error('TypeORM was asked under MikroORM');
			}
		};
		const authorization = mappedFor(
			MultiORMEnum.MikroORM,
			() =>
				new RoleAuthorizationService(
					typeOrmRoleRepository as any,
					new MikroOrmBaseEntityRepository<any>(orm.em, MIKRO_ORM.Role) as any,
					cacheManager as any
				)
		);
		return { users, employees, authorization };
	};

	/** One request: its own fork, as `RequestContext.create(orm.em, next)` gives each GraphQL operation. */
	const request = <R>(work: () => Promise<R>): Promise<R> =>
		MikroOrmRequestContext.create(orm.em, work) as Promise<R>;

	/** `JwtStrategy.validate`, lines 60 and 76: load the caller, then pin the role it holds right now. */
	const authenticate = async (service: ReturnType<typeof services>): Promise<IAuthenticatedUser> => {
		const user = (await service.users.getIfExists(CALLER)) as IAuthenticatedUser;
		await service.authorization.attachAuthorizationState(user);
		return user;
	};

	/** The `employeeMembers` resolver's read. */
	const members = (service: ReturnType<typeof services>) =>
		service.employees.findMembers({ organizationId: ORGANIZATION, tenantId: TENANT } as IFindMembersInput);

	/** The caller's stored role column, read past MikroORM. */
	const storedRoleId = async (): Promise<string | null> => {
		const [row]: any[] = await orm.em
			.getConnection()
			.execute('SELECT roleId FROM authz_user WHERE id = ?', [CALLER]);
		return row.roleId;
	};

	beforeAll(async () => {
		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [MIKRO_ORM.Role, MIKRO_ORM.RolePermission, MIKRO_ORM.User, MIKRO_ORM.Employee],
			extensions: [SoftDeleteHandler],
			autoJoinRefsForFilters,
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: false,
			discovery: { warnWhenNoEntities: false }
		});
		await orm.schema.createSchema();

		const connection = orm.em.getConnection();
		await connection.execute('INSERT INTO authz_role (id, name, tenantId) VALUES (?, ?, ?)', [
			ROLE,
			RolesEnum.EMPLOYEE,
			TENANT
		]);
		await connection.execute(
			'INSERT INTO authz_role_permission (id, permission, enabled, isActive, isArchived, roleId) VALUES (?, ?, 1, 1, 0, ?)',
			['6c000000-0000-4000-8000-0000000000f1', PermissionsEnum.ORG_MEMBERS_VIEW, ROLE]
		);
		for (const [id, firstName] of [
			[CALLER, 'Caller'],
			[COLLEAGUE, 'Colleague']
		]) {
			await connection.execute(
				'INSERT INTO authz_user (id, tenantId, firstName, isActive, isArchived, roleId) VALUES (?, ?, ?, 1, 0, ?)',
				[id, TENANT, firstName, ROLE]
			);
		}
		for (const [id, userId] of [
			[CALLER_EMPLOYEE, CALLER],
			[COLLEAGUE_EMPLOYEE, COLLEAGUE]
		]) {
			await connection.execute(
				'INSERT INTO authz_employee (id, tenantId, organizationId, isActive, isArchived, isOnline, isAway, userId) VALUES (?, ?, ?, 1, 0, 0, 0, ?)',
				[id, TENANT, ORGANIZATION, userId]
			);
		}
	});

	afterAll(async () => {
		await orm?.close(true);
	});

	beforeEach(() => {
		cache = new Map();
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each([
		['the role state is read from the database', false],
		['the role state comes from the cache', true]
	])('when %s', (_state, warm) => {
		beforeEach(async () => {
			if (warm) {
				// An earlier request resolved the role, so the next one reads the lean state from the cache.
				await request(() => authenticate(services()));
				expect(cache.size).toBe(1);
			}
		});

		it('answers employeeMembers in the request the caller was authenticated in', async () => {
			const answer = await request(async () => {
				const service = services();
				await authenticate(service);
				return members(service);
			});

			expect(answer.total).toBe(2);
			expect(answer.items.map((member) => member.id).sort()).toEqual([CALLER_EMPLOYEE, COLLEAGUE_EMPLOYEE]);
			expect(answer.items.find((member) => member.id === CALLER_EMPLOYEE)?.user?.id).toBe(CALLER);
		});

		it('pins the role the caller holds as the managed entity, with its name and permissions', async () => {
			await request(async () => {
				const user = await authenticate(services());

				expect(Utils.isEntity(user.role)).toBe(true);
				expect(user.role?.id).toBe(ROLE);
				expect(roleNameOf(user)).toBe(RolesEnum.EMPLOYEE);
				expect(user.permissions).toEqual([PermissionsEnum.ORG_MEMBERS_VIEW]);
			});
		});

		it('leaves the unit of work nothing to write for the caller', async () => {
			await request(async () => {
				const user = await authenticate(services());
				const unitOfWork = orm.em.getUnitOfWork();

				unitOfWork.computeChangeSets();
				expect(unitOfWork.getChangeSets().filter((changeSet) => changeSet.entity === user)).toEqual([]);

				await orm.em.flush();
			});

			expect(await storedRoleId()).toBe(ROLE);
		});
	});

	it('fails closed when the cached role has been soft-deleted since, and still answers employeeMembers', async () => {
		await request(() => authenticate(services()));
		await orm.em
			.getConnection()
			.execute('UPDATE authz_role SET deletedAt = ? WHERE id = ?', [new Date().toISOString(), ROLE]);

		try {
			const answer = await request(async () => {
				const service = services();
				const user = await authenticate(service);

				expect(roleNameOf(user)).toBeFalsy();
				expect(user.permissions).toEqual([]);

				const read = await members(service);
				await orm.em.flush();
				return read;
			});

			expect(answer.total).toBe(2);
			expect(await storedRoleId()).toBe(ROLE);
		} finally {
			await orm.em.getConnection().execute('UPDATE authz_role SET deletedAt = NULL WHERE id = ?', [ROLE]);
		}
	});

	it('pins the lean state onto a user no unit of work manages', async () => {
		await request(async () => {
			const service = services();
			const user = { id: CALLER, roleId: ROLE } as IAuthenticatedUser;

			await service.authorization.attachAuthorizationState(user);

			expect(Utils.isEntity(user.role)).toBe(false);
			expect(user.role).toEqual({ id: ROLE, name: RolesEnum.EMPLOYEE, tenantId: TENANT });
			expect(user.permissions).toEqual([PermissionsEnum.ORG_MEMBERS_VIEW]);
		});
	});
});

describe('RoleAuthorizationService under TypeORM', () => {
	it('pins the lean state onto the user, exactly as before', async () => {
		const role = {
			id: ROLE,
			name: RolesEnum.EMPLOYEE,
			tenantId: TENANT,
			rolePermissions: [
				{ permission: PermissionsEnum.ORG_MEMBERS_VIEW, enabled: true, isActive: true, isArchived: false }
			]
		};
		const typeOrmRoleRepository = { findOne: jest.fn(async () => role) };
		const mikroOrmRoleRepository = { findOne: jest.fn() };
		const cache = new Map<string, unknown>();
		const authorization = mappedFor(
			MultiORMEnum.TypeORM,
			() =>
				new RoleAuthorizationService(
					typeOrmRoleRepository as any,
					mikroOrmRoleRepository as any,
					{
						get: async (key: string) => cache.get(key),
						set: async (key: string, value: unknown) => {
							cache.set(key, value);
						}
					} as any
				)
		);

		for (const _request of [1, 2]) {
			const user = { id: CALLER, roleId: ROLE } as IAuthenticatedUser;

			await authorization.attachAuthorizationState(user);

			expect(user.role).toEqual({ id: ROLE, name: RolesEnum.EMPLOYEE, tenantId: TENANT });
			expect(user.role).toBe((cache.get(`authz_role_state_${ROLE}`) as { role: IRole }).role);
			expect(user.permissions).toEqual([PermissionsEnum.ORG_MEMBERS_VIEW]);
		}
		expect(typeOrmRoleRepository.findOne).toHaveBeenCalledTimes(1);
		expect(mikroOrmRoleRepository.findOne).not.toHaveBeenCalled();
	});
});
