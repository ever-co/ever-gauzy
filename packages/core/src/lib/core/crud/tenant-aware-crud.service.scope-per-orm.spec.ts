import '../entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, DeleteDateColumn, EntitySchema, PrimaryGeneratedColumn, RelationId, Repository } from 'typeorm';
import { EntityCaseNamingStrategy, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../context';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../decorators/entity';
import { MikroOrmBaseEntityRepository } from '../repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';
import { TenantAwareCrudService } from './tenant-aware-crud.service';

/**
 * `TenantAwareCrudService` scopes every statement to the caller's tenant on BOTH ORMs, against a real
 * in-memory better-sqlite3 store per ORM.
 *
 * **The defect.** The tenant-aware base decided whether an entity has a `tenantId` (or `employeeId`) column
 * by asking TypeORM — `this.typeOrmRepository.metadata.hasColumnWithPropertyPath(...)` — whichever ORM ran
 * the statement. `MultiORMColumn` and the relation decorators apply only the active ORM's decorator, so under
 * `DB_ORM=mikro-orm` TypeORM holds a skeleton of every entity and answers "no" for every entity there is. No
 * tenant condition was then added to any read, update, delete or soft-delete on MikroORM, no employee
 * restriction either, nothing written was stamped with the caller's tenant, and the guard that refuses to
 * overwrite another tenant's row by id stood aside. Every case that reaches for another tenant's row, or that
 * expects the caller's tenant or employee to be applied, fails on the MikroORM branch before the fix; the
 * controls, and the cases about a criterion the caller states, pass there before and after it. The TypeORM
 * branch answers every case the same before and after.
 *
 * **The mapping is the platform's own.** The rows are declared with the platform's decorators —
 * `MultiORMEntity`, `MultiORMManyToOne` for the tenant, organization and employee relations, and beside each
 * one `@RelationId` plus `MultiORMColumn({ nullable: true, relationId: true })`, exactly as
 * `TenantBaseEntity` and `TenantOrganizationBaseEntity` declare them — once under each ORM, because those
 * decorators read `DB_ORM` when the class is defined and register with that ORM alone. MikroORM therefore
 * sees what it sees in production: the relation owns the `tenantId` column, and `tenantId` is its
 * `persist: false` mirror. MikroORM runs with the naming strategy the platform configures, which is what puts
 * the relation's join column and its mirror on one physical column.
 *
 * **Each ORM is given what it has in production.** On the MikroORM branch the service's TypeORM repository is
 * a real TypeORM repository over the skeleton TypeORM builds under `DB_ORM=mikro-orm`: the identifier and the
 * soft-delete column of the base entity, and nothing the `MultiORM*` decorators declare. The MikroORM tables
 * are created as the platform's SQLite migrations leave them — the identifier has no database default — rather
 * than from MikroORM's schema generator, whose `gen_random_uuid()` default SQLite does not have.
 *
 * **Organization scoping is the caller's criterion**, which the tenant-aware base does not add itself: the
 * services that scope by organization state `organizationId` in their `where`. The cases that name it prove
 * that on both ORMs such a criterion narrows every read and write, and that nothing the base merges in
 * widens it.
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

/**
 * The fixture's classes as one ORM maps them. The two sets are stated separately rather than built by one
 * factory: MikroORM keys decorator metadata by class name, so the two must not share names.
 */
interface IScopeEntities {
	Tenant: new () => object;
	Organization: new () => object;
	Employee: new () => object;
	Row: new () => IScopeRow;
}

/** A row as the store holds it. */
interface IScopeRow {
	id?: string;
	name?: string;
	version?: number;
	tenantId?: string;
	organizationId?: string;
	employeeId?: string;
	deletedAt?: Date | null;
}

const TYPEORM_ENTITIES: IScopeEntities = mappedFor(MultiORMEnum.TypeORM, () => {
	@MultiORMEntity('scope_tenant')
	class TypeOrmScopeTenant {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@MultiORMEntity('scope_organization')
	class TypeOrmScopeOrganization {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@MultiORMEntity('scope_employee')
	class TypeOrmScopeEmployee {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@SoftDeletable(() => TypeOrmScopeRow, 'deletedAt', () => new Date())
	@MultiORMEntity('scope_row')
	class TypeOrmScopeRow implements IScopeRow {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;

		@DeleteDateColumn()
		@Property({ nullable: true })
		deletedAt?: Date;

		@MultiORMColumn({ nullable: true })
		name?: string;

		@MultiORMColumn({ type: 'integer', nullable: true })
		version?: number;

		@MultiORMManyToOne(() => TypeOrmScopeTenant, { nullable: true, onDelete: 'CASCADE' })
		tenant?: TypeOrmScopeTenant;

		@RelationId((it: TypeOrmScopeRow) => it.tenant)
		@MultiORMColumn({ nullable: true, relationId: true })
		tenantId?: string;

		@MultiORMManyToOne(() => TypeOrmScopeOrganization, { nullable: true, onUpdate: 'CASCADE', onDelete: 'CASCADE' })
		organization?: TypeOrmScopeOrganization;

		@RelationId((it: TypeOrmScopeRow) => it.organization)
		@MultiORMColumn({ nullable: true, relationId: true })
		organizationId?: string;

		@MultiORMManyToOne(() => TypeOrmScopeEmployee, { nullable: true, onDelete: 'CASCADE' })
		employee?: TypeOrmScopeEmployee;

		@RelationId((it: TypeOrmScopeRow) => it.employee)
		@MultiORMColumn({ nullable: true, relationId: true })
		employeeId?: string;
	}

	return {
		Tenant: TypeOrmScopeTenant,
		Organization: TypeOrmScopeOrganization,
		Employee: TypeOrmScopeEmployee,
		Row: TypeOrmScopeRow
	};
});

const MIKRO_ORM_ENTITIES: IScopeEntities = mappedFor(MultiORMEnum.MikroORM, () => {
	@MultiORMEntity('scope_tenant')
	class MikroOrmScopeTenant {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@MultiORMEntity('scope_organization')
	class MikroOrmScopeOrganization {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@MultiORMEntity('scope_employee')
	class MikroOrmScopeEmployee {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@SoftDeletable(() => MikroOrmScopeRow, 'deletedAt', () => new Date())
	@MultiORMEntity('scope_row')
	class MikroOrmScopeRow implements IScopeRow {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;

		@DeleteDateColumn()
		@Property({ nullable: true })
		deletedAt?: Date;

		@MultiORMColumn({ nullable: true })
		name?: string;

		@MultiORMColumn({ type: 'integer', nullable: true })
		version?: number;

		@MultiORMManyToOne(() => MikroOrmScopeTenant, { nullable: true, onDelete: 'CASCADE' })
		tenant?: MikroOrmScopeTenant;

		@RelationId((it: MikroOrmScopeRow) => it.tenant)
		@MultiORMColumn({ nullable: true, relationId: true })
		tenantId?: string;

		@MultiORMManyToOne(() => MikroOrmScopeOrganization, {
			nullable: true,
			onUpdate: 'CASCADE',
			onDelete: 'CASCADE'
		})
		organization?: MikroOrmScopeOrganization;

		@RelationId((it: MikroOrmScopeRow) => it.organization)
		@MultiORMColumn({ nullable: true, relationId: true })
		organizationId?: string;

		@MultiORMManyToOne(() => MikroOrmScopeEmployee, { nullable: true, onDelete: 'CASCADE' })
		employee?: MikroOrmScopeEmployee;

		@RelationId((it: MikroOrmScopeRow) => it.employee)
		@MultiORMColumn({ nullable: true, relationId: true })
		employeeId?: string;
	}

	return {
		Tenant: MikroOrmScopeTenant,
		Organization: MikroOrmScopeOrganization,
		Employee: MikroOrmScopeEmployee,
		Row: MikroOrmScopeRow
	};
});

/** What TypeORM builds for the row under `DB_ORM=mikro-orm`: the base entity's raw TypeORM columns only. */
const SkeletonScopeRowSchema = new EntitySchema<{ id: string; deletedAt?: Date }>({
	name: 'SkeletonScopeRow',
	tableName: 'scope_row',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	}
});

/** The caller's tenant, organization and employee; a sibling organization and a second employee; another tenant. */
const TENANT_A = '65000000-0000-4000-8000-00000000000a';
const TENANT_B = '65000000-0000-4000-8000-00000000000b';
const ORGANIZATION_A1 = '65000000-0000-4000-8000-0000000000a1';
const ORGANIZATION_A2 = '65000000-0000-4000-8000-0000000000a2';
const ORGANIZATION_B1 = '65000000-0000-4000-8000-0000000000b1';
const EMPLOYEE_1 = '65000000-0000-4000-8000-0000000000e1';
const EMPLOYEE_2 = '65000000-0000-4000-8000-0000000000e2';
const EMPLOYEE_B = '65000000-0000-4000-8000-0000000000eb';

/** The rows: two of the caller's organization, one of a sibling organization, one of another tenant. */
const OWN = '65000000-0000-4000-8000-000000000001';
const OWN_OTHER_EMPLOYEE = '65000000-0000-4000-8000-000000000002';
const SIBLING = '65000000-0000-4000-8000-000000000003';
const FOREIGN = '65000000-0000-4000-8000-000000000004';

/**
 * `OWN` and `FOREIGN` share a name, so a criterion on it matches a row of each tenant. `FOREIGN` is stored
 * first, so an unscoped lookup by that criterion settles on it rather than on the caller's row.
 */
const SEED: ReadonlyArray<Required<Omit<IScopeRow, 'deletedAt'>>> = [
	{
		id: FOREIGN,
		name: 'shared',
		version: 1,
		tenantId: TENANT_B,
		organizationId: ORGANIZATION_B1,
		employeeId: EMPLOYEE_B
	},
	{
		id: OWN,
		name: 'shared',
		version: 1,
		tenantId: TENANT_A,
		organizationId: ORGANIZATION_A1,
		employeeId: EMPLOYEE_1
	},
	{
		id: OWN_OTHER_EMPLOYEE,
		name: 'second',
		version: 1,
		tenantId: TENANT_A,
		organizationId: ORGANIZATION_A1,
		employeeId: EMPLOYEE_2
	},
	{
		id: SIBLING,
		name: 'sibling',
		version: 1,
		tenantId: TENANT_A,
		organizationId: ORGANIZATION_A2,
		employeeId: EMPLOYEE_1
	}
];

/** The rows of tenant A, which is every row a scoped statement may reach. */
const TENANT_A_ROWS = [OWN, OWN_OTHER_EMPLOYEE, SIBLING].sort();

class ScopeRowService extends TenantAwareCrudService<any> {
	constructor(typeOrmRepository: unknown, mikroOrmRepository: unknown) {
		super(typeOrmRepository as any, mikroOrmRepository as any);
	}
}

/** One ORM's store: a service over it, and a reader of the stored rows that bypasses the service. */
interface IScopeHarness {
	service(): ScopeRowService;
	stored(id: string): Promise<IScopeRow | undefined>;
	retire(id: string): Promise<void>;
	reset(): Promise<void>;
	close(): Promise<void>;
}

/** Plain SQL, the same on both stores, so the fixture rows do not depend on the code under test. */
const DELETE_ROWS = 'DELETE FROM scope_row';
const INSERT_ROW =
	'INSERT INTO scope_row (id, name, version, tenantId, organizationId, employeeId) VALUES (?, ?, ?, ?, ?, ?)';
const SELECT_ROW =
	'SELECT id, name, version, tenantId, organizationId, employeeId, deletedAt FROM scope_row WHERE id = ?';
const RETIRE_ROW = 'UPDATE scope_row SET deletedAt = ? WHERE id = ?';

/** The referenced rows every seeded row points at. */
const REFERENCED: ReadonlyArray<[table: string, ids: string[]]> = [
	['scope_tenant', [TENANT_A, TENANT_B]],
	['scope_organization', [ORGANIZATION_A1, ORGANIZATION_A2, ORGANIZATION_B1]],
	['scope_employee', [EMPLOYEE_1, EMPLOYEE_2, EMPLOYEE_B]]
];

async function typeOrmHarness(): Promise<IScopeHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [
			TYPEORM_ENTITIES.Tenant,
			TYPEORM_ENTITIES.Organization,
			TYPEORM_ENTITIES.Employee,
			TYPEORM_ENTITIES.Row
		],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();
	for (const [table, ids] of REFERENCED) {
		for (const id of ids) {
			await dataSource.query(`INSERT INTO ${table} (id) VALUES (?)`, [id]);
		}
	}

	const rows: Repository<any> = dataSource.getRepository(TYPEORM_ENTITIES.Row);

	return {
		service: () => new ScopeRowService(rows, {}),
		stored: async (id) => (await dataSource.query(SELECT_ROW, [id]))[0],
		retire: async (id) => {
			await dataSource.query(RETIRE_ROW, [new Date().toISOString(), id]);
		},
		reset: async () => {
			await dataSource.query(DELETE_ROWS);
			for (const row of SEED) {
				await dataSource.query(INSERT_ROW, [
					row.id,
					row.name,
					row.version,
					row.tenantId,
					row.organizationId,
					row.employeeId
				]);
			}
		},
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IScopeHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [
			MIKRO_ORM_ENTITIES.Tenant,
			MIKRO_ORM_ENTITIES.Organization,
			MIKRO_ORM_ENTITIES.Employee,
			MIKRO_ORM_ENTITIES.Row
		],
		extensions: [SoftDeleteHandler],
		// The platform's own naming strategy (packages/config/src/lib/database.ts).
		namingStrategy: EntityCaseNamingStrategy,
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	const connection = orm.em.getConnection();
	for (const [table, ids] of REFERENCED) {
		await connection.execute(`CREATE TABLE ${table} (id varchar PRIMARY KEY NOT NULL)`);
		for (const id of ids) {
			await connection.execute(`INSERT INTO ${table} (id) VALUES (?)`, [id]);
		}
	}
	await connection.execute(
		`CREATE TABLE scope_row (
			id varchar PRIMARY KEY NOT NULL,
			deletedAt datetime NULL,
			name varchar NULL,
			version integer NULL,
			tenantId varchar NULL REFERENCES scope_tenant (id) ON DELETE CASCADE,
			organizationId varchar NULL REFERENCES scope_organization (id) ON DELETE CASCADE,
			employeeId varchar NULL REFERENCES scope_employee (id) ON DELETE CASCADE
		)`
	);

	// TypeORM under `DB_ORM=mikro-orm`: a real repository over the skeleton it builds for the row.
	const skeleton = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [SkeletonScopeRowSchema],
		synchronize: true,
		logging: false
	});
	await skeleton.initialize();
	const skeletonRows = skeleton.getRepository(SkeletonScopeRowSchema);

	return {
		// A fresh context per service, so an answer is the store's rather than a previous call's identity map.
		service: () =>
			new ScopeRowService(
				skeletonRows,
				new MikroOrmBaseEntityRepository<IScopeRow>(orm.em.fork(), MIKRO_ORM_ENTITIES.Row)
			),
		stored: async (id) => (await connection.execute(SELECT_ROW, [id]))[0],
		retire: async (id) => {
			await connection.execute(RETIRE_ROW, [new Date().toISOString(), id]);
		},
		reset: async () => {
			await connection.execute(DELETE_ROWS);
			for (const row of SEED) {
				await connection.execute(INSERT_ROW, [
					row.id,
					row.name,
					row.version,
					row.tenantId,
					row.organizationId,
					row.employeeId
				]);
			}
		},
		close: async () => {
			await skeleton.destroy();
			await orm.close(true);
		}
	};
}

/** The caller the request context answers with; each case may narrow it. */
const caller: { employeeId: string | null; mayChangeEmployee: boolean } = { employeeId: null, mayChangeEmployee: true };

/** The ids a read answered, sorted. */
const idsOf = (rows: ReadonlyArray<{ id?: string }>): string[] => rows.map((row) => row.id).sort();

describe.each([
	['TypeORM', MultiORMEnum.TypeORM, typeOrmHarness],
	['MikroORM', MultiORMEnum.MikroORM, mikroOrmHarness]
] as const)('TenantAwareCrudService keeps every statement inside the caller’s tenant (%s)', (_label, ormType, open) => {
	let harness: IScopeHarness;
	let service: ScopeRowService;

	beforeAll(async () => {
		harness = await open();
	});

	afterAll(async () => {
		await harness?.close();
	});

	beforeEach(async () => {
		await harness.reset();
		caller.employeeId = null;
		caller.mayChangeEmployee = true;

		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-a', tenantId: TENANT_A } as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION_A1);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockImplementation(() => caller.employeeId);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(() => caller.mayChangeEmployee);

		service = harness.service();
	});

	afterEach(() => jest.restoreAllMocks());

	/*
	|--------------------------------------------------------------------------
	| Reads
	|--------------------------------------------------------------------------
	*/

	it('lists and counts the caller’s tenant only', async () => {
		expect(idsOf(await service.find())).toEqual(TENANT_A_ROWS);

		const page = await service.findAll();
		expect(idsOf(page.items)).toEqual(TENANT_A_ROWS);
		expect(page.total).toBe(3);

		const paginated = await service.paginate({ take: 10 } as any);
		expect(idsOf(paginated.items)).toEqual(TENANT_A_ROWS);
		expect(paginated.total).toBe(3);

		await expect(service.count()).resolves.toBe(3);
		// Both rows named 'shared' exist; only the caller's is counted.
		await expect(service.countBy({ name: 'shared' } as any)).resolves.toBe(1);
	});

	it('does not let a criterion naming another tenant widen a read', async () => {
		// The caller's tenant is merged over whatever the criteria state, never beside it.
		expect(idsOf(await service.find({ where: { tenantId: TENANT_B } } as any))).not.toContain(FOREIGN);
		expect(idsOf(await service.find({ where: [{ id: FOREIGN }, { id: OWN }] } as any))).toEqual([OWN]);
	});

	it('answers another tenant’s row as not found, by every single-row read', async () => {
		await expect(service.findOneByIdString(FOREIGN)).rejects.toThrow(NotFoundException);
		await expect(service.findOneByOptions({ where: { id: FOREIGN } } as any)).rejects.toThrow(NotFoundException);
		await expect(service.findOneByWhereOptions({ id: FOREIGN } as any)).rejects.toThrow(NotFoundException);
		expect((await service.findOneOrFailByIdString(FOREIGN)).success).toBe(false);
		expect((await service.findOneOrFailByOptions({ where: { id: FOREIGN } } as any)).success).toBe(false);
		expect((await service.findOneOrFailByWhereOptions({ id: FOREIGN } as any)).success).toBe(false);

		// Control: the same reads find the caller's own row, so the refusals above are the scope's.
		await expect(service.findOneByIdString(OWN)).resolves.toMatchObject({ id: OWN });
		await expect(service.findOneByOptions({ where: { id: OWN } } as any)).resolves.toMatchObject({ id: OWN });
		await expect(service.findOneByWhereOptions({ id: OWN } as any)).resolves.toMatchObject({ id: OWN });
		expect((await service.findOneOrFailByIdString(OWN)).success).toBe(true);
	});

	it('keeps an organization criterion the caller states', async () => {
		expect(idsOf(await service.find({ where: { organizationId: ORGANIZATION_A1 } } as any))).toEqual(
			[OWN, OWN_OTHER_EMPLOYEE].sort()
		);
		await expect(
			service.findOneByIdString(SIBLING, { where: { organizationId: ORGANIZATION_A1 } } as any)
		).rejects.toThrow(NotFoundException);
	});

	it('restricts a caller who may not act for other employees to their own employee’s rows', async () => {
		caller.employeeId = EMPLOYEE_1;
		caller.mayChangeEmployee = false;

		expect(idsOf(await service.find())).toEqual([OWN, SIBLING].sort());
		await expect(service.findOneByIdString(OWN_OTHER_EMPLOYEE)).rejects.toThrow(NotFoundException);
	});

	/*
	|--------------------------------------------------------------------------
	| Updates
	|--------------------------------------------------------------------------
	*/

	it('updates the caller’s own row', async () => {
		await service.update(OWN, { name: 'renamed' } as any);

		expect((await harness.stored(OWN)).name).toBe('renamed');
	});

	it('refuses to update another tenant’s row by id, and leaves it unchanged', async () => {
		await expect(service.update(FOREIGN, { name: 'claimed' } as any)).rejects.toThrow(NotFoundException);

		expect((await harness.stored(FOREIGN)).name).toBe('shared');
	});

	it('scopes the UPDATE statement itself, not only the read before it', async () => {
		// A criterion naming a `version` skips the read, so the statement's own scope is all there is.
		const result = (await service.update({ id: FOREIGN, version: 1 } as any, { name: 'claimed' } as any)) as any;

		expect(result.affected).toBe(0);
		expect((await harness.stored(FOREIGN)).name).toBe('shared');

		// Control: the same statement on the caller's own row is applied.
		const own = (await service.update({ id: OWN, version: 1 } as any, { name: 'renamed' } as any)) as any;
		expect(own.affected).toBe(1);
		expect((await harness.stored(OWN)).name).toBe('renamed');
	});

	it('keeps an organization criterion on an update', async () => {
		await expect(
			service.update({ id: SIBLING, organizationId: ORGANIZATION_A1 } as any, { name: 'claimed' } as any)
		).rejects.toThrow(NotFoundException);

		const result = (await service.update(
			{ id: SIBLING, organizationId: ORGANIZATION_A1, version: 1 } as any,
			{ name: 'claimed' } as any
		)) as any;
		expect(result.affected).toBe(0);
		expect((await harness.stored(SIBLING)).name).toBe('sibling');
	});

	/*
	|--------------------------------------------------------------------------
	| Deletes
	|--------------------------------------------------------------------------
	*/

	it('deletes the caller’s own row', async () => {
		await expect(service.delete(OWN)).resolves.toMatchObject({ affected: 1 });

		expect(await harness.stored(OWN)).toBeUndefined();
	});

	it('deletes nothing of another tenant, or of an organization the criterion excludes', async () => {
		await expect(service.delete(FOREIGN)).resolves.toMatchObject({ affected: 0 });
		await expect(service.delete({ id: SIBLING, organizationId: ORGANIZATION_A1 } as any)).resolves.toMatchObject({
			affected: 0
		});

		expect(await harness.stored(FOREIGN)).toBeDefined();
		expect(await harness.stored(SIBLING)).toBeDefined();
	});

	it('deletes only the caller’s rows of a batch', async () => {
		await expect(service.deleteMany([OWN, FOREIGN])).resolves.toMatchObject({ affected: 1 });

		expect(await harness.stored(OWN)).toBeUndefined();
		expect(await harness.stored(FOREIGN)).toBeDefined();
	});

	/*
	|--------------------------------------------------------------------------
	| The soft-delete pair
	|--------------------------------------------------------------------------
	*/

	it('retires the caller’s own row, and refuses another tenant’s', async () => {
		await expect(service.softDelete(FOREIGN)).rejects.toThrow(NotFoundException);
		await expect(service.softRemove(FOREIGN)).rejects.toThrow(NotFoundException);
		expect((await harness.stored(FOREIGN)).deletedAt ?? null).toBeNull();

		await expect(service.softRemove(OWN)).resolves.toMatchObject({ id: OWN });
		expect((await harness.stored(OWN)).deletedAt).toBeTruthy();
	});

	it('refuses to retire a row an organization criterion excludes', async () => {
		await expect(
			service.softRemove(SIBLING, { where: { organizationId: ORGANIZATION_A1 } } as any)
		).rejects.toThrow(NotFoundException);
		await expect(service.softDelete({ id: SIBLING, organizationId: ORGANIZATION_A1 } as any)).rejects.toThrow(
			NotFoundException
		);

		expect((await harness.stored(SIBLING)).deletedAt ?? null).toBeNull();
	});

	// On TypeORM the base class used to hand the criteria to `Repository.softDelete` raw, which retired EVERY
	// row that matched them, the other tenant's included: the read before it only proved the caller had one.
	// The statement now carries the caller's scope on both ORMs, so this holds everywhere.
	it(
		'retires only the caller’s row when the criteria match another tenant’s too',
		async () => {
			await service.softDelete({ name: 'shared' } as any);

			expect((await harness.stored(OWN)).deletedAt).toBeTruthy();
			expect((await harness.stored(FOREIGN)).deletedAt ?? null).toBeNull();
		}
	);

	it('restores the caller’s own retired row, and refuses another tenant’s or an excluded organization’s', async () => {
		await harness.retire(OWN);
		await harness.retire(SIBLING);
		await harness.retire(FOREIGN);

		await expect(service.softRecover(FOREIGN)).rejects.toThrow(NotFoundException);
		await expect(
			service.softRecover(SIBLING, { where: { organizationId: ORGANIZATION_A1 } } as any)
		).rejects.toThrow(NotFoundException);
		expect((await harness.stored(FOREIGN)).deletedAt).toBeTruthy();
		expect((await harness.stored(SIBLING)).deletedAt).toBeTruthy();

		await expect(service.softRecover(OWN)).resolves.toMatchObject({ id: OWN });
		expect((await harness.stored(OWN)).deletedAt ?? null).toBeNull();
	});

	/*
	|--------------------------------------------------------------------------
	| Writes
	|--------------------------------------------------------------------------
	*/

	it('stamps the caller’s tenant on the rows it creates', async () => {
		const created = await service.create({ name: 'created', organization: { id: ORGANIZATION_A1 } } as any);
		const [first, second] = await service.createMany([{ name: 'first' }, { name: 'second-created' }] as any);

		for (const row of [created, first, second]) {
			expect((await harness.stored(row.id)).tenantId).toBe(TENANT_A);
		}
		expect((await harness.stored(created.id)).organizationId).toBe(ORGANIZATION_A1);
	});

	it('stamps the caller’s employee on the rows it creates when they may not act for others', async () => {
		caller.employeeId = EMPLOYEE_1;
		caller.mayChangeEmployee = false;

		const created = await service.create({ name: 'mine' } as any);

		expect(await harness.stored(created.id)).toMatchObject({ tenantId: TENANT_A, employeeId: EMPLOYEE_1 });
	});

	it('refuses to overwrite another tenant’s row through create, save or saveMany', async () => {
		await expect(service.save({ id: FOREIGN, name: 'claimed' } as any)).rejects.toThrow(ForbiddenException);
		await expect(service.create({ id: FOREIGN, name: 'claimed' } as any)).rejects.toThrow(ForbiddenException);
		await expect(service.saveMany([{ id: FOREIGN, name: 'claimed' }] as any)).rejects.toThrow(ForbiddenException);

		expect(await harness.stored(FOREIGN)).toMatchObject({ name: 'shared', tenantId: TENANT_B });
	});

	it('writes the caller’s own existing rows through create, save and saveMany', async () => {
		await service.create({ id: OWN, name: 'through-create' } as any);
		expect(await harness.stored(OWN)).toMatchObject({ name: 'through-create', tenantId: TENANT_A });

		await service.save({ id: OWN, name: 'through-save' } as any);
		expect(await harness.stored(OWN)).toMatchObject({ name: 'through-save', tenantId: TENANT_A });

		await service.saveMany([
			{ id: OWN, name: 'through-save-many' },
			{ id: SIBLING, name: 'sibling-through-save-many' }
		] as any);
		expect(await harness.stored(OWN)).toMatchObject({ name: 'through-save-many', tenantId: TENANT_A });
		expect(await harness.stored(SIBLING)).toMatchObject({ name: 'sibling-through-save-many', tenantId: TENANT_A });
	});

	it('stamps the caller’s tenant over one the payload states, on a new row and on an existing one', async () => {
		const NEW_ROW = '65000000-0000-4000-8000-000000000005';

		await service.save({ id: NEW_ROW, name: 'new', tenantId: TENANT_B, tenant: { id: TENANT_B } } as any);
		await service.save({ id: OWN, name: 'moved', tenantId: TENANT_B } as any);
		const created = await service.create({ name: 'created', tenantId: TENANT_B, tenant: { id: TENANT_B } } as any);

		expect(await harness.stored(NEW_ROW)).toMatchObject({ name: 'new', tenantId: TENANT_A });
		expect(await harness.stored(OWN)).toMatchObject({ name: 'moved', tenantId: TENANT_A });
		expect(await harness.stored(created.id)).toMatchObject({ name: 'created', tenantId: TENANT_A });
	});
});
