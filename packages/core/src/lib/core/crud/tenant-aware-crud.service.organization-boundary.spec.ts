import '../entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
	DataSource,
	DeleteDateColumn,
	EntitySchema,
	In,
	PrimaryGeneratedColumn,
	RelationId,
	Repository
} from 'typeorm';
import { EntityCaseNamingStrategy, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../decorators/entity';
import { MikroOrmBaseEntityRepository } from '../repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';
import { TenantAwareCrudService } from './tenant-aware-crud.service';

/**
 * The organization boundary of `TenantAwareCrudService`, on both ORMs, against a real in-memory better-sqlite3 store
 * per ORM.
 *
 * **The rule (owner decision, 2026-10-22).** A tenant admin (`SUPER_ADMIN`, `ADMIN`) reaches every organization of
 * the tenant. Anyone else reaches only the organization of their token, `RequestContext.currentOrganizationId()`.
 * Before this base stated it, every service that wanted it built it for itself — the commerce plugins each with their
 * own base, which narrowed admins to the token organization too — and a service that did not reached every
 * organization of the tenant by id: a member of organization A1 read, changed, retired and deleted the rows of a
 * sibling organization A2 by naming their ids.
 *
 * **What is proven here.** A service that applies the boundary keeps a member inside it on every read, write and
 * delete this base answers, answers a row of a sibling organization exactly as a missing row, keeps the rows stored
 * without an organization in reach, narrows an organization the caller states rather than widening it, and lets a
 * tenant admin reach every organization of the tenant (and still no other tenant). The mapping is the platform's
 * own, declared once under each ORM, as `tenant-aware-crud.service.scope-per-orm.spec.ts` explains.
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

/** A row as the store holds it. */
interface IBoundaryRow {
	id?: string;
	name?: string;
	version?: number;
	tenantId?: string;
	organizationId?: string | null;
	deletedAt?: Date | null;
}

interface IBoundaryEntities {
	Tenant: new () => object;
	Organization: new () => object;
	Row: new () => IBoundaryRow;
}

const TYPEORM_ENTITIES: IBoundaryEntities = mappedFor(MultiORMEnum.TypeORM, () => {
	@MultiORMEntity('boundary_tenant')
	class TypeOrmBoundaryTenant {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@MultiORMEntity('boundary_organization')
	class TypeOrmBoundaryOrganization {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@SoftDeletable(() => TypeOrmBoundaryRow, 'deletedAt', () => new Date())
	@MultiORMEntity('boundary_row')
	class TypeOrmBoundaryRow implements IBoundaryRow {
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

		@MultiORMManyToOne(() => TypeOrmBoundaryTenant, { nullable: true, onDelete: 'CASCADE' })
		tenant?: TypeOrmBoundaryTenant;

		@RelationId((it: TypeOrmBoundaryRow) => it.tenant)
		@MultiORMColumn({ nullable: true, relationId: true })
		tenantId?: string;

		@MultiORMManyToOne(() => TypeOrmBoundaryOrganization, {
			nullable: true,
			onUpdate: 'CASCADE',
			onDelete: 'CASCADE'
		})
		organization?: TypeOrmBoundaryOrganization;

		@RelationId((it: TypeOrmBoundaryRow) => it.organization)
		@MultiORMColumn({ nullable: true, relationId: true })
		organizationId?: string;
	}

	return { Tenant: TypeOrmBoundaryTenant, Organization: TypeOrmBoundaryOrganization, Row: TypeOrmBoundaryRow };
});

const MIKRO_ORM_ENTITIES: IBoundaryEntities = mappedFor(MultiORMEnum.MikroORM, () => {
	@MultiORMEntity('boundary_tenant')
	class MikroOrmBoundaryTenant {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@MultiORMEntity('boundary_organization')
	class MikroOrmBoundaryOrganization {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@SoftDeletable(() => MikroOrmBoundaryRow, 'deletedAt', () => new Date())
	@MultiORMEntity('boundary_row')
	class MikroOrmBoundaryRow implements IBoundaryRow {
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

		@MultiORMManyToOne(() => MikroOrmBoundaryTenant, { nullable: true, onDelete: 'CASCADE' })
		tenant?: MikroOrmBoundaryTenant;

		@RelationId((it: MikroOrmBoundaryRow) => it.tenant)
		@MultiORMColumn({ nullable: true, relationId: true })
		tenantId?: string;

		@MultiORMManyToOne(() => MikroOrmBoundaryOrganization, {
			nullable: true,
			onUpdate: 'CASCADE',
			onDelete: 'CASCADE'
		})
		organization?: MikroOrmBoundaryOrganization;

		@RelationId((it: MikroOrmBoundaryRow) => it.organization)
		@MultiORMColumn({ nullable: true, relationId: true })
		organizationId?: string;
	}

	return { Tenant: MikroOrmBoundaryTenant, Organization: MikroOrmBoundaryOrganization, Row: MikroOrmBoundaryRow };
});

/** What TypeORM builds for the row under `DB_ORM=mikro-orm`: the base entity's raw TypeORM columns only. */
const SkeletonBoundaryRowSchema = new EntitySchema<{ id: string; deletedAt?: Date }>({
	name: 'SkeletonBoundaryRow',
	tableName: 'boundary_row',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	}
});

/** The caller's tenant and organization, a sibling organization of that tenant, and another tenant. */
const TENANT_A = '66000000-0000-4000-8000-00000000000a';
const TENANT_B = '66000000-0000-4000-8000-00000000000b';
const ORGANIZATION_A1 = '66000000-0000-4000-8000-0000000000a1';
const ORGANIZATION_A2 = '66000000-0000-4000-8000-0000000000a2';
const ORGANIZATION_B1 = '66000000-0000-4000-8000-0000000000b1';

/** Two rows of the caller's organization, one of a sibling organization, one of no organization, one of another tenant. */
const OWN = '66000000-0000-4000-8000-000000000001';
const OWN_SECOND = '66000000-0000-4000-8000-000000000002';
const SIBLING = '66000000-0000-4000-8000-000000000003';
const TENANT_WIDE = '66000000-0000-4000-8000-000000000004';
const FOREIGN = '66000000-0000-4000-8000-000000000005';

/** `OWN` and `SIBLING` share a name, so a criterion on it matches a row of each organization. */
const SEED: ReadonlyArray<Required<Omit<IBoundaryRow, 'deletedAt'>>> = [
	{ id: SIBLING, name: 'shared', version: 1, tenantId: TENANT_A, organizationId: ORGANIZATION_A2 },
	{ id: OWN, name: 'shared', version: 1, tenantId: TENANT_A, organizationId: ORGANIZATION_A1 },
	{ id: OWN_SECOND, name: 'second', version: 1, tenantId: TENANT_A, organizationId: ORGANIZATION_A1 },
	{ id: TENANT_WIDE, name: 'tenant-wide', version: 1, tenantId: TENANT_A, organizationId: null },
	{ id: FOREIGN, name: 'shared', version: 1, tenantId: TENANT_B, organizationId: ORGANIZATION_B1 }
];

/** What a member of `ORGANIZATION_A1` reaches: its rows and the row of no organization. */
const MEMBER_ROWS = [OWN, OWN_SECOND, TENANT_WIDE].sort();

/** What a tenant admin reaches: every row of tenant A. */
const TENANT_A_ROWS = [OWN, OWN_SECOND, SIBLING, TENANT_WIDE].sort();

/** A service that does not apply the boundary: the base's behaviour for every service that does not ask for it. */
class UnboundedRowService extends TenantAwareCrudService<any> {
	constructor(typeOrmRepository: unknown, mikroOrmRepository: unknown) {
		super(typeOrmRepository as any, mikroOrmRepository as any);
	}
}

/** A service that applies the boundary. */
class BoundedRowService extends UnboundedRowService {
	protected override appliesOrganizationBoundary(): boolean {
		return true;
	}

	/** A read made after the service checked the caller's reach by other means. */
	readOutsideBoundary(id: string): Promise<IBoundaryRow> {
		return this.withoutOrganizationBoundary(() => this.findOneByIdString(id));
	}
}

type ServiceClass = new (typeOrmRepository: unknown, mikroOrmRepository: unknown) => UnboundedRowService;

/** One ORM's store: a service over it, and a reader of the stored rows that bypasses the service. */
interface IBoundaryHarness {
	service<S extends UnboundedRowService>(Service: ServiceClass): S;
	stored(id: string): Promise<IBoundaryRow | undefined>;
	retire(id: string): Promise<void>;
	reset(): Promise<void>;
	close(): Promise<void>;
}

const DELETE_ROWS = 'DELETE FROM boundary_row';
const INSERT_ROW = 'INSERT INTO boundary_row (id, name, version, tenantId, organizationId) VALUES (?, ?, ?, ?, ?)';
const SELECT_ROW = 'SELECT id, name, version, tenantId, organizationId, deletedAt FROM boundary_row WHERE id = ?';
const RETIRE_ROW = 'UPDATE boundary_row SET deletedAt = ? WHERE id = ?';

const REFERENCED: ReadonlyArray<[table: string, ids: string[]]> = [
	['boundary_tenant', [TENANT_A, TENANT_B]],
	['boundary_organization', [ORGANIZATION_A1, ORGANIZATION_A2, ORGANIZATION_B1]]
];

/** The parameters of {@link INSERT_ROW} for a seeded row. */
const insertParameters = (row: (typeof SEED)[number]) => [
	row.id,
	row.name,
	row.version,
	row.tenantId,
	row.organizationId
];

async function typeOrmHarness(): Promise<IBoundaryHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TYPEORM_ENTITIES.Tenant, TYPEORM_ENTITIES.Organization, TYPEORM_ENTITIES.Row],
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
		service: <S extends UnboundedRowService>(Service: ServiceClass) => new Service(rows, {}) as S,
		stored: async (id) => (await dataSource.query(SELECT_ROW, [id]))[0],
		retire: async (id) => {
			await dataSource.query(RETIRE_ROW, [new Date().toISOString(), id]);
		},
		reset: async () => {
			await dataSource.query(DELETE_ROWS);
			for (const row of SEED) {
				await dataSource.query(INSERT_ROW, insertParameters(row));
			}
		},
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IBoundaryHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [MIKRO_ORM_ENTITIES.Tenant, MIKRO_ORM_ENTITIES.Organization, MIKRO_ORM_ENTITIES.Row],
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
		`CREATE TABLE boundary_row (
			id varchar PRIMARY KEY NOT NULL,
			deletedAt datetime NULL,
			name varchar NULL,
			version integer NULL,
			tenantId varchar NULL REFERENCES boundary_tenant (id) ON DELETE CASCADE,
			organizationId varchar NULL REFERENCES boundary_organization (id) ON DELETE CASCADE
		)`
	);

	// TypeORM under `DB_ORM=mikro-orm`: a real repository over the skeleton it builds for the row.
	const skeleton = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [SkeletonBoundaryRowSchema],
		synchronize: true,
		logging: false
	});
	await skeleton.initialize();
	const skeletonRows = skeleton.getRepository(SkeletonBoundaryRowSchema);

	return {
		// A fresh context per service, so an answer is the store's rather than a previous call's identity map.
		service: <S extends UnboundedRowService>(Service: ServiceClass) =>
			new Service(
				skeletonRows,
				new MikroOrmBaseEntityRepository<IBoundaryRow>(orm.em.fork(), MIKRO_ORM_ENTITIES.Row)
			) as S,
		stored: async (id) => (await connection.execute(SELECT_ROW, [id]))[0],
		retire: async (id) => {
			await connection.execute(RETIRE_ROW, [new Date().toISOString(), id]);
		},
		reset: async () => {
			await connection.execute(DELETE_ROWS);
			for (const row of SEED) {
				await connection.execute(INSERT_ROW, insertParameters(row));
			}
		},
		close: async () => {
			await skeleton.destroy();
			await orm.close(true);
		}
	};
}

/** The caller the request context answers with; each case may change it. */
const caller: { signedIn: boolean; role: RolesEnum; organizationId: string | null } = {
	signedIn: true,
	role: RolesEnum.EMPLOYEE,
	organizationId: ORGANIZATION_A1
};

/** The ids a read answered, sorted. */
const idsOf = (rows: ReadonlyArray<{ id?: string }>): string[] => rows.map((row) => row.id).sort();

describe.each([
	['TypeORM', MultiORMEnum.TypeORM, typeOrmHarness],
	['MikroORM', MultiORMEnum.MikroORM, mikroOrmHarness]
] as const)(
	'TenantAwareCrudService keeps a caller inside their organization boundary (%s)',
	(_label, ormType, open) => {
		let harness: IBoundaryHarness;
		let service: BoundedRowService;
		const cls = new Map<string, unknown>();

		beforeAll(async () => {
			harness = await open();
		});

		afterAll(async () => {
			await harness?.close();
		});

		beforeEach(async () => {
			await harness.reset();
			caller.signedIn = true;
			caller.role = RolesEnum.EMPLOYEE;
			caller.organizationId = ORGANIZATION_A1;
			cls.clear();

			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
			jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
			jest.spyOn(RequestContext, 'currentUser').mockImplementation(() =>
				caller.signedIn ? ({ id: 'user-a', tenantId: TENANT_A } as any) : null
			);
			jest.spyOn(RequestContext, 'currentTenantId').mockImplementation(() => (caller.signedIn ? TENANT_A : null));
			jest.spyOn(RequestContext, 'currentOrganizationId').mockImplementation(() => caller.organizationId);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
			// The caller may act for every employee, so the employee scope stays out of these cases.
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
			jest.spyOn(RequestContext, 'hasRoles').mockImplementation(
				(roles: RolesEnum[]) => caller.signedIn && roles.includes(caller.role)
			);
			// The request-scoped store `withoutOrganizationBoundary` counts its open blocks in.
			(RequestContext as any).clsService = {
				get: (key: string) => cls.get(key),
				set: (key: string, value: unknown) => cls.set(key, value)
			};

			service = harness.service<BoundedRowService>(BoundedRowService);
		});

		afterEach(() => {
			jest.restoreAllMocks();
			delete (RequestContext as any).clsService;
		});

		/*
	|--------------------------------------------------------------------------
	| Reads
	|--------------------------------------------------------------------------
	*/

		it('lists and counts the caller’s organization and the rows of no organization only', async () => {
			expect(idsOf(await service.find())).toEqual(MEMBER_ROWS);

			const page = await service.findAll();
			expect(idsOf(page.items)).toEqual(MEMBER_ROWS);
			expect(page.total).toBe(3);

			const paginated = await service.paginate({ take: 10 } as any);
			expect(idsOf(paginated.items)).toEqual(MEMBER_ROWS);
			expect(paginated.total).toBe(3);

			await expect(service.count()).resolves.toBe(3);
			// `OWN` and `SIBLING` are both named 'shared'; only the caller's organization's is counted.
			await expect(service.countBy({ name: 'shared' } as any)).resolves.toBe(1);
		});

		it('answers a row of a sibling organization as not found, by every single-row read', async () => {
			await expect(service.findOneByIdString(SIBLING)).rejects.toThrow(NotFoundException);
			await expect(service.findOneByOptions({ where: { id: SIBLING } } as any)).rejects.toThrow(
				NotFoundException
			);
			await expect(service.findOneByWhereOptions({ id: SIBLING } as any)).rejects.toThrow(NotFoundException);
			expect((await service.findOneOrFailByIdString(SIBLING)).success).toBe(false);
			expect((await service.findOneOrFailByOptions({ where: { id: SIBLING } } as any)).success).toBe(false);
			expect((await service.findOneOrFailByWhereOptions({ id: SIBLING } as any)).success).toBe(false);

			// Control: the same reads find the caller's own row and the row of no organization.
			await expect(service.findOneByIdString(OWN)).resolves.toMatchObject({ id: OWN });
			await expect(service.findOneByIdString(TENANT_WIDE)).resolves.toMatchObject({ id: TENANT_WIDE });
			await expect(service.findOneByWhereOptions({ name: 'shared' } as any)).resolves.toMatchObject({ id: OWN });
			expect((await service.findOneOrFailByIdString(OWN)).success).toBe(true);
		});

		it('narrows an organization the caller states, and never widens to it', async () => {
			expect(idsOf(await service.find({ where: { organizationId: ORGANIZATION_A2 } } as any))).toEqual([]);
			expect(
				idsOf(await service.find({ where: { organizationId: In([ORGANIZATION_A1, ORGANIZATION_A2]) } } as any))
			).toEqual([OWN, OWN_SECOND].sort());
			expect(idsOf(await service.find({ where: { organizationId: ORGANIZATION_A1 } } as any))).toEqual(
				[OWN, OWN_SECOND].sort()
			);
			await expect(
				service.findOneByIdString(SIBLING, { where: { organizationId: ORGANIZATION_A2 } } as any)
			).rejects.toThrow(NotFoundException);
		});

		it('keeps every condition of a list of conditions inside the boundary', async () => {
			expect(idsOf(await service.find({ where: [{ id: SIBLING }, { id: OWN }] } as any))).toEqual([OWN]);
		});

		it('still keeps the caller in their tenant', async () => {
			await expect(service.findOneByIdString(FOREIGN)).rejects.toThrow(NotFoundException);
			expect(idsOf(await service.find({ where: { organizationId: ORGANIZATION_B1 } } as any))).toEqual([]);
		});

		/*
	|--------------------------------------------------------------------------
	| Updates, the soft-delete pair and deletes
	|--------------------------------------------------------------------------
	*/

		it('does not update a row of a sibling organization, and updates the caller’s own', async () => {
			await expect(service.update(SIBLING, { name: 'claimed' } as any)).rejects.toThrow(NotFoundException);
			await expect(service.update({ id: SIBLING } as any, { name: 'claimed' } as any)).rejects.toThrow(
				NotFoundException
			);

			// A criterion naming a `version` skips the read, so the statement's own boundary is all there is.
			const result = (await service.update(
				{ id: SIBLING, version: 1 } as any,
				{ name: 'claimed' } as any
			)) as any;
			expect(result.affected).toBe(0);
			expect((await harness.stored(SIBLING)).name).toBe('shared');

			await service.update(OWN, { name: 'renamed' } as any);
			expect((await harness.stored(OWN)).name).toBe('renamed');
		});

		it('updates only the caller’s organization’s rows when the criteria match a sibling organization’s too', async () => {
			const result = (await service.update(
				{ name: 'shared', version: 1 } as any,
				{ name: 'renamed' } as any
			)) as any;

			expect(result.affected).toBe(1);
			expect((await harness.stored(OWN)).name).toBe('renamed');
			expect((await harness.stored(SIBLING)).name).toBe('shared');
		});

		it('keeps a row inside the boundary when the payload moves it to another organization, or to none', async () => {
			await service.update(OWN, { name: 'moved', organizationId: ORGANIZATION_A2 } as any);
			expect(await harness.stored(OWN)).toMatchObject({ name: 'moved', organizationId: ORGANIZATION_A1 });

			await service.update(OWN, { organization: { id: ORGANIZATION_A2 } } as any);
			await service.update({ id: OWN, version: 1 } as any, { organizationId: null } as any);
			expect((await harness.stored(OWN)).organizationId).toBe(ORGANIZATION_A1);

			// Control: a payload that names the caller's own organization is written as given.
			await service.update(TENANT_WIDE, { organizationId: ORGANIZATION_A1 } as any);
			expect((await harness.stored(TENANT_WIDE)).organizationId).toBe(ORGANIZATION_A1);
		});

		it('does not retire or restore a row of a sibling organization', async () => {
			await expect(service.softDelete(SIBLING)).rejects.toThrow(NotFoundException);
			await expect(service.softRemove(SIBLING)).rejects.toThrow(NotFoundException);
			expect((await harness.stored(SIBLING)).deletedAt ?? null).toBeNull();

			await harness.retire(SIBLING);
			await expect(service.softRecover(SIBLING)).rejects.toThrow(NotFoundException);
			expect((await harness.stored(SIBLING)).deletedAt).toBeTruthy();

			await expect(service.softRemove(OWN)).resolves.toMatchObject({ id: OWN });
			expect((await harness.stored(OWN)).deletedAt).toBeTruthy();
		});

		it('retires only the caller’s organization’s row when the criteria match a sibling organization’s too', async () => {
			await service.softDelete({ name: 'shared' } as any);

			expect((await harness.stored(OWN)).deletedAt).toBeTruthy();
			expect((await harness.stored(SIBLING)).deletedAt ?? null).toBeNull();
		});

		it('does not delete a row of a sibling organization, alone or in a batch', async () => {
			await expect(service.delete(SIBLING)).resolves.toMatchObject({ affected: 0 });
			// The criteria match `OWN` and `SIBLING`: only the caller's organization's row goes.
			await expect(service.delete({ name: 'shared' } as any)).resolves.toMatchObject({ affected: 1 });
			await expect(service.deleteMany([OWN_SECOND, SIBLING])).resolves.toMatchObject({ affected: 1 });

			expect(await harness.stored(SIBLING)).toBeDefined();
			expect(await harness.stored(OWN)).toBeUndefined();
			expect(await harness.stored(OWN_SECOND)).toBeUndefined();
		});

		/*
	|--------------------------------------------------------------------------
	| Writes
	|--------------------------------------------------------------------------
	*/

		it('refuses to write a row into a sibling organization', async () => {
			await expect(service.create({ name: 'new', organizationId: ORGANIZATION_A2 } as any)).rejects.toThrow(
				ForbiddenException
			);
			await expect(service.create({ name: 'new', organization: { id: ORGANIZATION_A2 } } as any)).rejects.toThrow(
				ForbiddenException
			);
			await expect(service.createMany([{ name: 'new', organizationId: ORGANIZATION_A2 }] as any)).rejects.toThrow(
				ForbiddenException
			);
			await expect(service.save({ name: 'new', organizationId: ORGANIZATION_A2 } as any)).rejects.toThrow(
				ForbiddenException
			);

			// Control: the caller's own organization, and no organization, are written.
			const own = await service.create({ name: 'own', organizationId: ORGANIZATION_A1 } as any);
			const tenantWide = await service.create({ name: 'tenant-wide-new' } as any);
			expect((await harness.stored(own.id)).organizationId).toBe(ORGANIZATION_A1);
			expect((await harness.stored(tenantWide.id)).organizationId ?? null).toBeNull();
		});

		it('refuses to overwrite a row of a sibling organization through create, save or saveMany', async () => {
			await expect(service.create({ id: SIBLING, name: 'claimed' } as any)).rejects.toThrow(ForbiddenException);
			await expect(service.save({ id: SIBLING, name: 'claimed' } as any)).rejects.toThrow(ForbiddenException);
			await expect(
				service.saveMany([
					{ id: OWN, name: 'own' },
					{ id: SIBLING, name: 'claimed' }
				] as any)
			).rejects.toThrow(ForbiddenException);

			expect(await harness.stored(SIBLING)).toMatchObject({ name: 'shared', organizationId: ORGANIZATION_A2 });
			expect((await harness.stored(OWN)).name).toBe('shared');
		});

		/*
	|--------------------------------------------------------------------------
	| Who the boundary applies to
	|--------------------------------------------------------------------------
	*/

		it.each([RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN])(
			'lets a tenant admin (%s) reach every organization of the tenant, and no other tenant',
			async (role) => {
				caller.role = role;

				expect(idsOf(await service.find())).toEqual(TENANT_A_ROWS);
				await expect(service.findOneByIdString(SIBLING)).resolves.toMatchObject({ id: SIBLING });
				await service.update(SIBLING, { name: 'renamed', organizationId: ORGANIZATION_A1 } as any);
				expect(await harness.stored(SIBLING)).toMatchObject({
					name: 'renamed',
					organizationId: ORGANIZATION_A1
				});

				const created = await service.create({ name: 'new', organizationId: ORGANIZATION_A2 } as any);
				expect((await harness.stored(created.id)).organizationId).toBe(ORGANIZATION_A2);

				await expect(service.delete(OWN_SECOND)).resolves.toMatchObject({ affected: 1 });

				await expect(service.findOneByIdString(FOREIGN)).rejects.toThrow(NotFoundException);
			}
		);

		it('confines a member with no organization in their token to the rows of no organization', async () => {
			caller.organizationId = null;

			expect(idsOf(await service.find())).toEqual([TENANT_WIDE]);
			await expect(service.findOneByIdString(OWN)).rejects.toThrow(NotFoundException);
			await expect(service.create({ name: 'new', organizationId: ORGANIZATION_A1 } as any)).rejects.toThrow(
				ForbiddenException
			);
		});

		it('lifts the boundary inside withoutOrganizationBoundary, and only there', async () => {
			await expect(service.readOutsideBoundary(SIBLING)).resolves.toMatchObject({ id: SIBLING });
			await expect(service.findOneByIdString(SIBLING)).rejects.toThrow(NotFoundException);
		});

		it('leaves a service that does not apply the boundary as it was', async () => {
			const unbounded = harness.service<UnboundedRowService>(UnboundedRowService);

			expect(idsOf(await unbounded.find())).toEqual(TENANT_A_ROWS);
			await expect(unbounded.findOneByIdString(SIBLING)).resolves.toMatchObject({ id: SIBLING });
		});
	}
);
