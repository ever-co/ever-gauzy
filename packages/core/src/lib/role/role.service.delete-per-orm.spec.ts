import '../core/entities/internal';

import { DataSource, DeleteDateColumn, EntitySchema, PrimaryGeneratedColumn, RelationId, Repository } from 'typeorm';
import { EntityCaseNamingStrategy, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { RolesEnum } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../core/utils';
import { RoleService } from './role.service';

// The repositories are handed to the services below as instances over the fixture's stores. Their modules are
// replaced so that loading the unique-name constraint on its own (see `roleNameIsFree`) does not load the whole
// core entity graph a second time; `RoleService` names them only as constructor types.
jest.mock('./repository/type-orm-role.repository', () => ({
	TypeOrmRoleRepository: class TypeOrmRoleRepository {}
}));
jest.mock('./repository/mikro-orm-role.repository', () => ({
	MikroOrmRoleRepository: class MikroOrmRoleRepository {}
}));

/**
 * A tenant's own role can be deleted on BOTH ORMs, and its name can then be used again.
 *
 * **The defect.** `tools/scripts/authorization-probe.mjs` creates a throwaway role and deletes it with
 * `DELETE /api/roles/:id` when it is done. Under `DB_ORM=mikro-orm` it passed 14/14 once, and the next run failed
 * at its first step: `HTTP 400 The role name 'Authorization probe (read only)' is already in use` — the
 * `IsRoleAlreadyExist` check on `CreateRoleDTO.name` still found the role the previous run had deleted.
 *
 * It had not been deleted. `RoleService.delete` guards the system roles with `name: Not(In(SYSTEM_DEFAULT_ROLES))`,
 * and the MikroORM branch of `CrudService.delete` translates that with `convertTypeORMWhereToMikroORM` into
 * `{ name: { $not: { $in: [...] } } }` — a `$not` on a property, which MikroORM's SQL drivers do not have: knex
 * refuses the statement with `The operator "not" is not permitted`. `CrudService.delete` answers that as
 * `The record was not found`, `RoleController.delete` as `403 Deletion of role with ID ... is forbidden`, and the
 * probe only prints its cleanup status — so the run passed and left the role behind. On TypeORM the same criteria
 * is `NOT ("name" IN (...))`, and the probe re-runs cleanly.
 *
 * **The fixture.** The role is declared with the platform's decorators — `MultiORMEntity`, `MultiORMColumn` for
 * `name` and `isSystem` as `Role` declares them, and the `tenant` relation beside its `relationId` mirror as
 * `TenantBaseEntity` declares it — once under each ORM, because those decorators read `DB_ORM` when the class is
 * defined. Each store is an in-memory better-sqlite3 database; the MikroORM table is created as the platform's
 * SQLite migrations leave `role`. The service is the real `RoleService`, and the name check is the real
 * `RoleAlreadyExistConstraint`, loaded under each ORM as the API loads it.
 *
 * The fix is in the translation (`convertTypeORMConditionToMikroORM` lifts a negation to the entity level, where
 * MikroORM negates; `core/find-operator.negation-per-orm.spec.ts` pins it for every negation the platform writes).
 * Every case passes on TypeORM before and after it. On MikroORM every case fails before it, because every delete
 * rejects with `The record was not found`; after it the first two delete the role, and the last two show that the
 * guard and the tenant scope still hold — the negation is applied, not dropped.
 */

/** Sets `DB_ORM` for the decorators applied, or the module evaluated, while `define` runs. */
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

/** A role as the store holds it. */
interface IProbeRole {
	id?: string;
	name?: string;
	isSystem?: boolean;
	tenantId?: string;
	deletedAt?: Date | null;
}

/** The fixture's classes as one ORM maps them; MikroORM keys decorator metadata by class name, so the names differ. */
interface IRoleEntities {
	Tenant: new () => object;
	Role: new () => IProbeRole;
}

const TYPEORM_ENTITIES: IRoleEntities = mappedFor(MultiORMEnum.TypeORM, () => {
	@MultiORMEntity('tenant')
	class TypeOrmProbeTenant {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@SoftDeletable(() => TypeOrmProbeRole, 'deletedAt', () => new Date())
	@MultiORMEntity('role')
	class TypeOrmProbeRole implements IProbeRole {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;

		@DeleteDateColumn()
		@Property({ nullable: true })
		deletedAt?: Date;

		@MultiORMColumn()
		name?: string;

		@MultiORMColumn({ default: false })
		isSystem?: boolean;

		@MultiORMManyToOne(() => TypeOrmProbeTenant, { nullable: true, onDelete: 'CASCADE' })
		tenant?: TypeOrmProbeTenant;

		@RelationId((it: TypeOrmProbeRole) => it.tenant)
		@MultiORMColumn({ nullable: true, relationId: true })
		tenantId?: string;
	}

	return { Tenant: TypeOrmProbeTenant, Role: TypeOrmProbeRole };
});

const MIKRO_ORM_ENTITIES: IRoleEntities = mappedFor(MultiORMEnum.MikroORM, () => {
	@MultiORMEntity('tenant')
	class MikroOrmProbeTenant {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@SoftDeletable(() => MikroOrmProbeRole, 'deletedAt', () => new Date())
	@MultiORMEntity('role')
	class MikroOrmProbeRole implements IProbeRole {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;

		@DeleteDateColumn()
		@Property({ nullable: true })
		deletedAt?: Date;

		@MultiORMColumn()
		name?: string;

		@MultiORMColumn({ default: false })
		isSystem?: boolean;

		@MultiORMManyToOne(() => MikroOrmProbeTenant, { nullable: true, onDelete: 'CASCADE' })
		tenant?: MikroOrmProbeTenant;

		@RelationId((it: MikroOrmProbeRole) => it.tenant)
		@MultiORMColumn({ nullable: true, relationId: true })
		tenantId?: string;
	}

	return { Tenant: MikroOrmProbeTenant, Role: MikroOrmProbeRole };
});

/** What TypeORM builds for `role` under `DB_ORM=mikro-orm`: the base entity's raw TypeORM columns only. */
const SkeletonRoleSchema = new EntitySchema<{ id: string; deletedAt?: Date }>({
	name: 'SkeletonProbeRole',
	tableName: 'role',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	}
});

/** The name the authorization probe gives its throwaway role. */
const PROBE_ROLE = 'Authorization probe (read only)';

/** The caller's tenant, and another one. */
const TENANT_A = '66000000-0000-4000-8000-00000000000a';
const TENANT_B = '66000000-0000-4000-8000-00000000000b';

/** Seeded roles: the caller's system roles, and another tenant's custom role named as the probe names its own. */
const SUPER_ADMIN = '66000000-0000-4000-8000-000000000001';
const LEGACY_ADMIN = '66000000-0000-4000-8000-000000000002';
const FOREIGN_PROBE = '66000000-0000-4000-8000-000000000003';

/** A custom role of the caller's tenant that a case stores itself. */
const OWN_CUSTOM = '66000000-0000-4000-8000-000000000004';

/**
 * `LEGACY_ADMIN` is a default role whose `isSystem` flag is not set — a row written before the flag existed — so
 * only the `Not(In(SYSTEM_DEFAULT_ROLES))` half of the guard protects it.
 */
const SEED: ReadonlyArray<Required<Omit<IProbeRole, 'deletedAt'>>> = [
	{ id: SUPER_ADMIN, name: RolesEnum.SUPER_ADMIN, isSystem: true, tenantId: TENANT_A },
	{ id: LEGACY_ADMIN, name: RolesEnum.ADMIN, isSystem: false, tenantId: TENANT_A },
	{ id: FOREIGN_PROBE, name: PROBE_ROLE, isSystem: false, tenantId: TENANT_B }
];

class ProbeRoleService extends RoleService {
	constructor(typeOrmRepository: unknown, mikroOrmRepository: unknown) {
		super(typeOrmRepository as any, mikroOrmRepository as any, {} as any);
	}
}

/** One ORM's store: the service over it, the name check the create route runs, and SQL that bypasses both. */
interface IRoleHarness {
	service(): ProbeRoleService;
	nameIsFree(name: string): Promise<boolean>;
	stored(id: string): Promise<IProbeRole | undefined>;
	insert(role: Required<Omit<IProbeRole, 'deletedAt'>>): Promise<void>;
	reset(): Promise<void>;
	close(): Promise<void>;
}

/** Plain SQL, the same on both stores, so the fixture rows do not depend on the code under test. */
const DELETE_ROLES = 'DELETE FROM role';
const INSERT_ROLE = 'INSERT INTO role (id, name, isSystem, tenantId) VALUES (?, ?, ?, ?)';
const SELECT_ROLE = 'SELECT id, name, isSystem, tenantId, deletedAt FROM role WHERE id = ?';

/**
 * The `IsRoleAlreadyExist` check as the API runs it under `ormType`: the constraint picks its ORM once, from
 * `DB_ORM`, when its module is evaluated, so it is loaded in a module registry of its own under that value.
 *
 * @returns Whether the name passes the check — the create route answers 400 when it does not.
 */
async function roleNameIsFree(
	ormType: MultiORMEnum,
	typeOrmRoles: unknown,
	mikroOrmRoles: unknown,
	name: string
): Promise<boolean> {
	let constraint: { validate(name: string): Promise<boolean> };
	mappedFor(ormType, () =>
		jest.isolateModules(() => {
			const isolated = require('../core/context/request-context');
			isolated.RequestContext.currentTenantId = () => TENANT_A;

			const {
				RoleAlreadyExistConstraint
			} = require('../shared/validators/constraints/role-already-exist.constraint');
			constraint = new RoleAlreadyExistConstraint(typeOrmRoles, mikroOrmRoles);
		})
	);
	return constraint.validate(name);
}

async function typeOrmHarness(): Promise<IRoleHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TYPEORM_ENTITIES.Tenant, TYPEORM_ENTITIES.Role],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();
	for (const id of [TENANT_A, TENANT_B]) {
		await dataSource.query('INSERT INTO tenant (id) VALUES (?)', [id]);
	}

	const roles: Repository<any> = dataSource.getRepository(TYPEORM_ENTITIES.Role);
	const insert: IRoleHarness['insert'] = async (role) => {
		await dataSource.query(INSERT_ROLE, [role.id, role.name, role.isSystem ? 1 : 0, role.tenantId]);
	};

	return {
		service: () => new ProbeRoleService(roles, {}),
		nameIsFree: (name) => roleNameIsFree(MultiORMEnum.TypeORM, roles, {}, name),
		stored: async (id) => (await dataSource.query(SELECT_ROLE, [id]))[0],
		insert,
		reset: async () => {
			await dataSource.query(DELETE_ROLES);
			for (const role of SEED) {
				await insert(role);
			}
		},
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IRoleHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [MIKRO_ORM_ENTITIES.Tenant, MIKRO_ORM_ENTITIES.Role],
		extensions: [SoftDeleteHandler],
		// The platform's own naming strategy (packages/config/src/lib/database.ts).
		namingStrategy: EntityCaseNamingStrategy,
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	const connection = orm.em.getConnection();
	await connection.execute('CREATE TABLE tenant (id varchar PRIMARY KEY NOT NULL)');
	for (const id of [TENANT_A, TENANT_B]) {
		await connection.execute('INSERT INTO tenant (id) VALUES (?)', [id]);
	}
	// As the platform's SQLite migrations leave `role`, for the columns the fixture maps.
	await connection.execute(
		`CREATE TABLE role (
			id varchar PRIMARY KEY NOT NULL,
			deletedAt datetime NULL,
			name varchar NOT NULL,
			isSystem boolean NOT NULL DEFAULT (0),
			tenantId varchar NULL REFERENCES tenant (id) ON DELETE CASCADE
		)`
	);

	// TypeORM under `DB_ORM=mikro-orm`: a real repository over the skeleton it builds for the role.
	const skeleton = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [SkeletonRoleSchema],
		synchronize: true,
		logging: false
	});
	await skeleton.initialize();
	const skeletonRoles = skeleton.getRepository(SkeletonRoleSchema);

	// A fresh context per repository, so an answer is the store's rather than a previous call's identity map.
	const roles = () => new MikroOrmBaseEntityRepository<IProbeRole>(orm.em.fork(), MIKRO_ORM_ENTITIES.Role);
	const insert: IRoleHarness['insert'] = async (role) => {
		await connection.execute(INSERT_ROLE, [role.id, role.name, role.isSystem ? 1 : 0, role.tenantId]);
	};

	return {
		service: () => new ProbeRoleService(skeletonRoles, roles()),
		nameIsFree: (name) => roleNameIsFree(MultiORMEnum.MikroORM, skeletonRoles, roles(), name),
		stored: async (id) => (await connection.execute(SELECT_ROLE, [id]))[0],
		insert,
		reset: async () => {
			await connection.execute(DELETE_ROLES);
			for (const role of SEED) {
				await insert(role);
			}
		},
		close: async () => {
			await skeleton.destroy();
			await orm.close(true);
		}
	};
}

describe.each([
	['TypeORM', MultiORMEnum.TypeORM, typeOrmHarness],
	['MikroORM', MultiORMEnum.MikroORM, mikroOrmHarness]
] as const)('RoleService.delete removes a tenant’s own role (%s)', (_label, ormType, open) => {
	let harness: IRoleHarness;

	beforeAll(async () => {
		harness = await open();
	});

	afterAll(async () => {
		await harness?.close();
	});

	beforeEach(async () => {
		await harness.reset();

		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-a', tenantId: TENANT_A } as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
	});

	afterEach(() => jest.restoreAllMocks());

	it('deletes the probe’s role, so a second run can create it again', async () => {
		// The probe's first step.
		await expect(harness.nameIsFree(PROBE_ROLE)).resolves.toBe(true);
		const created = await harness.service().create({ name: PROBE_ROLE } as any);
		expect(created.id).toBeDefined();

		// Control: while the role exists its name is taken, which is the 400 the second run was answered with.
		await expect(harness.nameIsFree(PROBE_ROLE)).resolves.toBe(false);

		// The probe's cleanup.
		await expect(harness.service().delete(created.id)).resolves.toMatchObject({ affected: 1 });
		expect(await harness.stored(created.id)).toBeUndefined();

		// The next run's first step.
		await expect(harness.nameIsFree(PROBE_ROLE)).resolves.toBe(true);
		const again = await harness.service().create({ name: PROBE_ROLE } as any);
		expect(again.id).toBeDefined();
		expect(again.id).not.toBe(created.id);
	});

	it('deletes a custom role the store already holds, whatever wrote it', async () => {
		await harness.insert({ id: OWN_CUSTOM, name: 'Auditor', isSystem: false, tenantId: TENANT_A });

		await expect(harness.service().delete(OWN_CUSTOM)).resolves.toMatchObject({ affected: 1 });
		expect(await harness.stored(OWN_CUSTOM)).toBeUndefined();
	});

	it('keeps the system roles: one flagged `isSystem`, and a default role whose flag is not set', async () => {
		await expect(harness.service().delete(SUPER_ADMIN)).resolves.toMatchObject({ affected: 0 });
		await expect(harness.service().delete(LEGACY_ADMIN)).resolves.toMatchObject({ affected: 0 });

		expect(await harness.stored(SUPER_ADMIN)).toMatchObject({ name: RolesEnum.SUPER_ADMIN });
		expect(await harness.stored(LEGACY_ADMIN)).toMatchObject({ name: RolesEnum.ADMIN });
	});

	it('keeps another tenant’s role of the same name', async () => {
		await expect(harness.service().delete(FOREIGN_PROBE)).resolves.toMatchObject({ affected: 0 });

		expect(await harness.stored(FOREIGN_PROBE)).toMatchObject({ name: PROBE_ROLE, tenantId: TENANT_B });
	});
});
