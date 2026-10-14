/**
 * Deleting a bin and a zone on both ORMs, against real SQLite.
 *
 * Two defects meet in the two deletes, and each suite below proves both:
 *
 * - **Under `DB_ORM=mikro-orm` neither delete ran.** Both read only through their TypeORM repositories —
 *   the scoped read of the row, the count that guards the delete, and, for a bin, the closure statement
 *   that takes it out of the tree — and under MikroORM the TypeORM entities carry the base entity's columns
 *   alone. The MikroORM half runs every TypeORM repository as a proxy that throws on any member it is asked
 *   for, with MikroORM on `allowGlobalContext: false` as the platform configures it.
 * - **Under TypeORM a retired row did not block the delete.** `BIN_HAS_CHILDREN` and `ZONE_HAS_BINS`
 *   counted with TypeORM's `count`, which leaves soft-deleted rows out, while `FK_warehouse_bin_parent` and
 *   `FK_warehouse_bin_zone` are `ON DELETE SET NULL` whatever a row's `deletedAt` says. A position retired
 *   under a rack, or a bin retired in a zone, was silently detached by the hard delete and came back from
 *   `recover` with no parent or no zone. The foreign keys are declared on the fixture exactly so, and the
 *   cases read the retired row back after the refusal.
 *
 * The reads the rest of the two services make are driven too — the pick path, the walk of a zone, a tree
 * and a subtree through the closure table, and the detail reads — because they go through the same
 * per-ORM repository and the same raw-statement runner as the deletes. On MikroORM each row is also
 * checked to come back in TypeORM's shape: a relation only when the read asked for it, because the GraphQL
 * field resolver for `WarehouseBin.zone` returns whatever relation it finds on the row.
 *
 * The tables are fixture schemas carrying the columns the services read and write, mapped as each ORM maps
 * the production entities; on MikroORM `zoneId` and `warehouseId` are `persist: false` mirrors of their
 * relations and `parentId` is a plain column, as the entity states. `@gauzy/core` is doubled at the module
 * boundary as the package's other suites double it; the SQL helpers and the TypeORM-to-MikroORM criteria
 * translation are the kernel's own.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared, and mapped below by fixture schemas. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/**
	 * The CRUD base, reduced to what the two deletes reach of it: the ORM, and the kernel's own dual-ORM
	 * hard delete of one row.
	 */
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return mockOrm.current;
		}

		async delete(id: string): Promise<any> {
			if (mockOrm.current === 'mikro-orm') {
				return { affected: await this.mikroOrmRepository.nativeDelete({ id }) };
			}

			return await this.typeOrmRepository.delete({ id });
		}
	}

	const utils = jest.requireActual('@gauzy/core/src/lib/core/utils');
	const helpers = jest.requireActual('@gauzy/core/src/lib/database/database.helper');

	return {
		TenantAwareCrudService,
		MultiORMEnum: utils.MultiORMEnum,
		convertTypeORMWhereToMikroORM: utils.convertTypeORMWhereToMikroORM,
		parseOrderOptions: utils.parseOrderOptions,
		prepareSQLQuery: helpers.prepareSQLQuery,
		toPositionalStatement: helpers.toPositionalStatement,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		User: class User {},
		Warehouse: class Warehouse {},
		SequenceService: class SequenceService {},
		commitVersionedUpdate: async () => {
			throw new Error('no versioned write is made by a delete');
		},
		versionExpectationOf: () => undefined,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => mockCaller.tenantId,
			currentOrganizationId: () => mockCaller.organizationId,
			currentEmployeeId: () => null,
			currentRequest: () => null,
			hasPermission: () => false
		}
	};
});

/** The ORM the services report, as `CrudService.ormType` reports it. */
const mockOrm: { current: 'typeorm' | 'mikro-orm' } = { current: 'typeorm' };

/** The caller the request context answers with. */
const mockCaller: { tenantId: string | null; organizationId: string | null } = { tenantId: null, organizationId: null };

import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { EntityCaseNamingStrategy, EntitySchema as MikroOrmEntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { EntityRepository } from '@mikro-orm/knex';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { IWarehouseStockLedgerPort, WarehouseBinType, WarehouseZoneType } from './warehouse.types';
import { WarehouseBin } from './warehouse-bin/warehouse-bin.entity';
import { WarehouseBinService } from './warehouse-bin/warehouse-bin.service';
import { WarehouseZone } from './warehouse-zone/warehouse-zone.entity';
import { WarehouseZoneService } from './warehouse-zone/warehouse-zone.service';

type Row = Record<string, any>;

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';

/** The zone every bin below is filed under, and a second zone of the same location. */
const ZONE = '00000000-0000-4000-8000-000000000020';
const OTHER_ZONE = '00000000-0000-4000-8000-000000000021';

/** A rack, its two levels, and a bin of another organization. */
const RACK = '00000000-0000-4000-8000-000000000030';
const LEVEL_1 = '00000000-0000-4000-8000-000000000031';
const LEVEL_2 = '00000000-0000-4000-8000-000000000032';
const FOREIGN_BIN = '00000000-0000-4000-8000-000000000039';

/*
|--------------------------------------------------------------------------
| TypeORM: the two tables bound to the package's own classes
|--------------------------------------------------------------------------
*/

const typeOrmBase = () => ({
	id: { type: 'varchar', primary: true, generated: 'uuid' },
	createdAt: { type: 'datetime', createDate: true },
	updatedAt: { type: 'datetime', updateDate: true },
	deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
	isActive: { type: 'boolean', nullable: true, default: true },
	isArchived: { type: 'boolean', nullable: true, default: false },
	tenantId: { type: 'varchar', nullable: true },
	organizationId: { type: 'varchar', nullable: true },
	warehouseId: { type: 'varchar' },
	metadata: { type: 'simple-json', nullable: true },
	version: { type: 'int', default: 1 }
});

const TypeOrmZone = new EntitySchema<any>({
	name: 'WarehouseZone',
	target: WarehouseZone,
	tableName: 'warehouse_zone',
	columns: {
		...(typeOrmBase() as any),
		code: { type: 'varchar' },
		name: { type: 'varchar', nullable: true },
		type: { type: 'varchar', default: WarehouseZoneType.STORAGE },
		priority: { type: 'int', default: 0 },
		isPickable: { type: 'boolean', default: true },
		isReceivable: { type: 'boolean', default: true },
		isShippable: { type: 'boolean', default: false },
		isBlocked: { type: 'boolean', default: false }
	},
	relations: {
		bins: { type: 'one-to-many', target: 'WarehouseBin', inverseSide: 'zone' }
	}
});

const TypeOrmBin = new EntitySchema<any>({
	name: 'WarehouseBin',
	target: WarehouseBin,
	tableName: 'warehouse_bin',
	columns: {
		...(typeOrmBase() as any),
		zoneId: { type: 'varchar', nullable: true },
		parentId: { type: 'varchar', nullable: true },
		code: { type: 'varchar' },
		type: { type: 'varchar', default: WarehouseBinType.SHELF },
		isPickable: { type: 'boolean', default: true },
		isBlocked: { type: 'boolean', default: false },
		sortOrder: { type: 'int', default: 0 }
	},
	relations: {
		// `FK_warehouse_bin_zone` and `FK_warehouse_bin_parent`, as the migration declares them.
		zone: {
			type: 'many-to-one',
			target: 'WarehouseZone',
			joinColumn: { name: 'zoneId' },
			inverseSide: 'bins',
			nullable: true,
			onDelete: 'SET NULL'
		},
		parent: {
			type: 'many-to-one',
			target: 'WarehouseBin',
			joinColumn: { name: 'parentId' },
			inverseSide: 'children',
			nullable: true,
			onDelete: 'SET NULL'
		},
		children: { type: 'one-to-many', target: 'WarehouseBin', inverseSide: 'parent' }
	}
});

/*
|--------------------------------------------------------------------------
| MikroORM: the same tables, mapped the way the kernel's decorators map them
|--------------------------------------------------------------------------
*/

const softDelete = {
	[SOFT_DELETABLE_FILTER]: { name: SOFT_DELETABLE_FILTER, cond: { deletedAt: null }, default: true }
};

/** A many-to-one, and the `persist: false` relation id beside it on the same column. */
const relationWithId = (relation: string, entity: string, nullable = true, deleteRule?: string) => ({
	[relation]: {
		kind: 'm:1',
		entity,
		nullable,
		joinColumn: `${relation}Id`,
		referenceColumnName: 'id',
		...(deleteRule ? { deleteRule } : {})
	},
	[`${relation}Id`]: { type: 'string', nullable, persist: false }
});

const mikroOrmBase = () => ({
	id: { type: 'string', primary: true },
	createdAt: { type: 'Date', nullable: true },
	updatedAt: { type: 'Date', nullable: true },
	deletedAt: { type: 'Date', nullable: true },
	isActive: { type: 'boolean', nullable: true, default: true },
	isArchived: { type: 'boolean', nullable: true, default: false },
	tenantId: { type: 'string', nullable: true },
	organizationId: { type: 'string', nullable: true },
	...relationWithId('warehouse', 'Warehouse', false),
	metadata: { type: 'json', nullable: true },
	version: { type: 'integer', default: 1 }
});

const MikroOrmWarehouse = new MikroOrmEntitySchema<any>({
	name: 'Warehouse',
	tableName: 'warehouse',
	filters: softDelete as any,
	properties: {
		id: { type: 'string', primary: true },
		deletedAt: { type: 'Date', nullable: true },
		metadata: { type: 'json', nullable: true }
	} as any
});

const MikroOrmZone = new MikroOrmEntitySchema<any>({
	name: 'WarehouseZone',
	tableName: 'warehouse_zone',
	filters: softDelete as any,
	properties: {
		...mikroOrmBase(),
		code: { type: 'string' },
		name: { type: 'string', nullable: true },
		type: { type: 'string', default: WarehouseZoneType.STORAGE },
		priority: { type: 'integer', default: 0 },
		isPickable: { type: 'boolean', default: true },
		isReceivable: { type: 'boolean', default: true },
		isShippable: { type: 'boolean', default: false },
		isBlocked: { type: 'boolean', default: false },
		bins: { kind: '1:m', entity: 'WarehouseBin', mappedBy: 'zone' }
	} as any
});

const MikroOrmBin = new MikroOrmEntitySchema<any>({
	name: 'WarehouseBin',
	tableName: 'warehouse_bin',
	filters: softDelete as any,
	properties: {
		...mikroOrmBase(),
		...relationWithId('zone', 'WarehouseZone', true, 'set null'),
		// A plain persisted column on MikroORM: the parent is TypeORM's tree relation only.
		parentId: { type: 'string', nullable: true },
		code: { type: 'string' },
		type: { type: 'string', default: WarehouseBinType.SHELF },
		isPickable: { type: 'boolean', default: true },
		isBlocked: { type: 'boolean', default: false },
		sortOrder: { type: 'integer', default: 0 }
	} as any
});

/*
|--------------------------------------------------------------------------
| The harness
|--------------------------------------------------------------------------
*/

interface IHarness {
	bins: WarehouseBinService;
	zones: WarehouseZoneService;
	/** What the ledger double answers as a bin's contents, by bin. */
	contents: Map<string, Array<{ variantId: string; quantity: string }>>;
	/** One row as the table holds it, retired or not. */
	row(table: string, id: string): Promise<Row | undefined>;
	/** The closure pairs, as `ancestor>descendant`. */
	closure(): Promise<string[]>;
	/** Runs a statement beneath the services. */
	execute(sql: string, parameters?: unknown[]): Promise<any>;
	close(): Promise<void>;
}

/** A repository this half must never reach: any member it is asked for fails the case. */
function unreachable(name: string): any {
	return new Proxy(
		{},
		{
			get: (_target, property) => {
				throw new Error(`The ${name} was reached (${String(property)}).`);
			}
		}
	);
}

/** The inventory capability, reduced to the balances a bin's contents are read from. */
function ledgerDouble(contents: IHarness['contents']): IWarehouseStockLedgerPort {
	return {
		readBinBalances: async (binIds: string[]) => binIds.flatMap((binId) => contents.get(binId) ?? [])
	} as unknown as IWarehouseStockLedgerPort;
}

/** The rows every case starts from: a zone with a rack of two levels, an empty zone, and a foreign bin. */
async function seed(execute: IHarness['execute']): Promise<void> {
	const zone = `INSERT INTO "warehouse_zone" ("id", "tenantId", "organizationId", "warehouseId", "code", "type", "priority") VALUES (?, ?, ?, ?, ?, ?, ?)`;

	await execute(zone, [ZONE, TENANT, ORG, WAREHOUSE, 'A', WarehouseZoneType.STORAGE, 1]);
	await execute(zone, [OTHER_ZONE, TENANT, ORG, WAREHOUSE, 'B', WarehouseZoneType.STORAGE, 2]);

	const bin = `INSERT INTO "warehouse_bin" ("id", "tenantId", "organizationId", "warehouseId", "zoneId", "parentId", "code", "type", "sortOrder") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

	await execute(bin, [RACK, TENANT, ORG, WAREHOUSE, ZONE, null, 'A-01', WarehouseBinType.RACK, 1]);
	await execute(bin, [LEVEL_1, TENANT, ORG, WAREHOUSE, ZONE, RACK, 'A-01-1', WarehouseBinType.SHELF, 2]);
	await execute(bin, [LEVEL_2, TENANT, ORG, WAREHOUSE, ZONE, RACK, 'A-01-2', WarehouseBinType.SHELF, 3]);
	await execute(bin, [
		FOREIGN_BIN,
		TENANT,
		OTHER_ORG,
		WAREHOUSE,
		OTHER_ZONE,
		null,
		'X-01',
		WarehouseBinType.SHELF,
		1
	]);

	const pair = `INSERT INTO "warehouse_bin_closure" ("id_ancestor", "id_descendant") VALUES (?, ?)`;

	for (const [ancestor, descendant] of [
		[RACK, RACK],
		[LEVEL_1, LEVEL_1],
		[LEVEL_2, LEVEL_2],
		[RACK, LEVEL_1],
		[RACK, LEVEL_2],
		[FOREIGN_BIN, FOREIGN_BIN]
	]) {
		await execute(pair, [ancestor, descendant]);
	}
}

const CLOSURE_TABLE = `CREATE TABLE "warehouse_bin_closure" ("id_ancestor" varchar NOT NULL, "id_descendant" varchar NOT NULL, PRIMARY KEY ("id_ancestor", "id_descendant"))`;

async function typeOrmHarness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TypeOrmZone, TypeOrmBin],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});

	await dataSource.initialize();
	await dataSource.query(CLOSURE_TABLE);

	const execute: IHarness['execute'] = (sql, parameters = []) => dataSource.query(sql, parameters);
	const contents: IHarness['contents'] = new Map();

	await seed(execute);

	const binRepository = dataSource.getRepository(WarehouseBin);
	const zoneRepository = dataSource.getRepository(WarehouseZone);

	return {
		bins: new WarehouseBinService(
			binRepository as never,
			unreachable('MikroORM bin repository'),
			zoneRepository as never,
			ledgerDouble(contents)
		),
		zones: new WarehouseZoneService(
			zoneRepository as never,
			unreachable('MikroORM zone repository'),
			binRepository as never
		),
		contents,
		row: async (table, id) => (await execute(`SELECT * FROM "${table}" WHERE "id" = ?`, [id]))[0],
		closure: async () =>
			(await execute(`SELECT * FROM "warehouse_bin_closure" ORDER BY "id_ancestor", "id_descendant"`)).map(
				(pair: Row) => `${pair.id_ancestor}>${pair.id_descendant}`
			),
		execute,
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [MikroOrmWarehouse, MikroOrmZone, MikroOrmBin],
		// The naming strategy production sets, so a relation lands on the `<relation>Id` column it names.
		namingStrategy: EntityCaseNamingStrategy,
		allowGlobalContext: false,
		discovery: { warnWhenNoEntities: false }
	});

	await orm.getSchemaGenerator().createSchema();

	const execute: IHarness['execute'] = (sql, parameters = []) =>
		orm.em
			.fork()
			.getConnection()
			.execute(sql, parameters as any[]);
	const contents: IHarness['contents'] = new Map();

	await execute(CLOSURE_TABLE);
	await execute(`INSERT INTO "warehouse" ("id") VALUES (?)`, [WAREHOUSE]);
	await seed(execute);

	return {
		bins: new WarehouseBinService(
			unreachable('TypeORM bin repository'),
			new EntityRepository<any>(orm.em as any, 'WarehouseBin') as never,
			unreachable('TypeORM zone repository'),
			ledgerDouble(contents)
		),
		zones: new WarehouseZoneService(
			unreachable('TypeORM zone repository'),
			new EntityRepository<any>(orm.em as any, 'WarehouseZone') as never,
			unreachable('TypeORM bin repository')
		),
		contents,
		row: async (table, id) => (await execute(`SELECT * FROM "${table}" WHERE "id" = ?`, [id]))[0],
		closure: async () =>
			(await execute(`SELECT * FROM "warehouse_bin_closure" ORDER BY "id_ancestor", "id_descendant"`)).map(
				(pair: Row) => `${pair.id_ancestor}>${pair.id_descendant}`
			),
		execute,
		close: () => orm.close(true)
	};
}

/** The instant a row is retired at, in the spelling each ORM stores a date in on SQLite. */
function retiredAt(orm: 'typeorm' | 'mikro-orm'): string | number {
	return orm === 'typeorm' ? '2026-01-01 00:00:00.000' : Date.parse('2026-01-01T00:00:00.000Z');
}

describe.each([
	['TypeORM', 'typeorm', typeOrmHarness],
	['MikroORM', 'mikro-orm', mikroOrmHarness]
] as const)('Deleting a bin and a zone under %s (real SQLite)', (_label, orm, open) => {
	let harness: IHarness;

	beforeEach(async () => {
		mockOrm.current = orm;
		Object.assign(mockCaller, { tenantId: TENANT, organizationId: ORG });
		harness = await open();
	});

	afterEach(async () => {
		await harness?.close();
	});

	it('deletes an empty leaf, and takes it out of the tree', async () => {
		const result = await harness.bins.delete(LEVEL_2);

		expect(Number(result.affected)).toBe(1);
		expect(await harness.row('warehouse_bin', LEVEL_2)).toBeUndefined();
		expect((await harness.closure()).filter((pair) => pair.includes(LEVEL_2))).toEqual([]);
		// The rest of the tree is untouched.
		expect((await harness.closure()).sort()).toEqual(
			[`${FOREIGN_BIN}>${FOREIGN_BIN}`, `${LEVEL_1}>${LEVEL_1}`, `${RACK}>${LEVEL_1}`, `${RACK}>${RACK}`].sort()
		);
	});

	it('refuses a bin that still holds a live position', async () => {
		await expect(harness.bins.delete(RACK)).rejects.toThrow(
			/BIN_HAS_CHILDREN: the bin still holds 2 position\(s\)/
		);
		expect(await harness.row('warehouse_bin', RACK)).toBeDefined();
	});

	it('refuses a bin whose only positions are retired, and leaves them under it', async () => {
		for (const level of [LEVEL_1, LEVEL_2]) {
			await harness.execute(`UPDATE "warehouse_bin" SET "deletedAt" = ? WHERE "id" = ?`, [retiredAt(orm), level]);
		}

		// The rack reads as a leaf to anything that skips retired rows: the refusal is the count of every row
		// the foreign key would detach.
		await expect(harness.bins.delete(RACK)).rejects.toThrow(
			/BIN_HAS_CHILDREN: the bin still holds 2 position\(s\) under it, retired ones included/
		);

		expect(await harness.row('warehouse_bin', RACK)).toBeDefined();

		for (const level of [LEVEL_1, LEVEL_2]) {
			// Control: had the delete gone through, `ON DELETE SET NULL` would have left each level a root.
			expect((await harness.row('warehouse_bin', level)).parentId).toBe(RACK);
		}

		expect(await harness.closure()).toContain(`${RACK}>${LEVEL_1}`);
	});

	it('refuses a bin that holds stock', async () => {
		harness.contents.set(LEVEL_1, [{ variantId: 'variant-1', quantity: '2.000000' }]);

		await expect(harness.bins.delete(LEVEL_1)).rejects.toThrow(/BIN_HAS_CONTENT/);
		expect(await harness.row('warehouse_bin', LEVEL_1)).toBeDefined();
	});

	it('never reaches a bin or a zone of another organization', async () => {
		await expect(harness.bins.delete(FOREIGN_BIN)).rejects.toThrow(NotFoundException);
		expect(await harness.row('warehouse_bin', FOREIGN_BIN)).toBeDefined();

		mockCaller.organizationId = OTHER_ORG;

		await expect(harness.zones.delete(ZONE)).rejects.toThrow(NotFoundException);
		expect(await harness.row('warehouse_zone', ZONE)).toBeDefined();
	});

	it('deletes a zone that holds no bin', async () => {
		await harness.execute(`UPDATE "warehouse_bin" SET "zoneId" = NULL WHERE "zoneId" = ?`, [OTHER_ZONE]);

		const result = await harness.zones.delete(OTHER_ZONE);

		expect(Number(result.affected)).toBe(1);
		expect(await harness.row('warehouse_zone', OTHER_ZONE)).toBeUndefined();
	});

	it('refuses a zone that still holds a live bin', async () => {
		await expect(harness.zones.delete(ZONE)).rejects.toThrow(/ZONE_HAS_BINS: the zone still holds 3 position\(s\)/);
	});

	it('refuses a zone whose only bin is retired, and leaves the bin in it', async () => {
		// The foreign bin is the other zone's only bin, and it belongs to another organization: the count is
		// scoped to the caller, so it is moved into the caller's organization for this case.
		await harness.execute(`UPDATE "warehouse_bin" SET "organizationId" = ?, "deletedAt" = ? WHERE "id" = ?`, [
			ORG,
			retiredAt(orm),
			FOREIGN_BIN
		]);

		await expect(harness.zones.delete(OTHER_ZONE)).rejects.toThrow(
			/ZONE_HAS_BINS: the zone still holds 1 position\(s\), retired ones included/
		);

		expect(await harness.row('warehouse_zone', OTHER_ZONE)).toBeDefined();
		// Control: had the delete gone through, `ON DELETE SET NULL` would have left the bin with no zone.
		expect((await harness.row('warehouse_bin', FOREIGN_BIN)).zoneId).toBe(OTHER_ZONE);
	});

	it('reads the walk, the tree and a subtree through the ORM the installation runs', async () => {
		expect((await harness.bins.findInZone(ZONE)).map((bin) => bin.code)).toEqual(['A-01', 'A-01-1', 'A-01-2']);
		expect((await harness.bins.findPickableBins(WAREHOUSE, ZONE)).map((bin) => bin.code)).toEqual([
			'A-01',
			'A-01-1',
			'A-01-2'
		]);

		const [root] = await harness.bins.findTree(WAREHOUSE, ZONE);

		expect(root.code).toBe('A-01');
		expect(root.children.map((child) => child.code)).toEqual(['A-01-1', 'A-01-2']);

		// The subtree is walked through the closure table, and a retired position is read only when asked for.
		await harness.execute(`UPDATE "warehouse_bin" SET "deletedAt" = ? WHERE "id" = ?`, [retiredAt(orm), LEVEL_2]);

		expect((await harness.bins.findSubtree(RACK)).map((bin) => bin.code)).toEqual(['A-01', 'A-01-1']);
		expect((await harness.bins.findSubtree(RACK, { withDeleted: true })).map((bin) => bin.code)).toEqual([
			'A-01',
			'A-01-1',
			'A-01-2'
		]);

		expect((await harness.zones.findPickPath(WAREHOUSE)).map((zone) => zone.code)).toEqual(['A', 'B']);

		// A reorder writes each zone's position through the same repository, and the walk follows it.
		const reordered = await harness.zones.reorder(WAREHOUSE, [
			{ id: ZONE, priority: 5 },
			{ id: OTHER_ZONE, priority: 4 }
		]);

		expect(reordered.map((zone) => zone.code)).toEqual(['B', 'A']);
		expect(await harness.row('warehouse_zone', ZONE)).toMatchObject({ priority: 5, version: 2 });
	});

	it('answers the detail reads with the relations they ask for, and a scoped read with none', async () => {
		const level = await harness.bins.findOneDetailed(LEVEL_1);

		expect(level).toMatchObject({
			id: LEVEL_1,
			zoneId: ZONE,
			parentId: RACK,
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(level.zone).toMatchObject({ id: ZONE, code: 'A' });
		expect(level.parent).toMatchObject({ id: RACK, code: 'A-01' });
		expect(level.children).toEqual([]);

		const rack = await harness.bins.findOneDetailed(RACK);

		expect(rack.parent).toBeNull();
		expect(rack.children.map((child) => child.code).sort()).toEqual(['A-01-1', 'A-01-2']);

		// `WarehouseBin.zone` is resolved from the row when the row carries one, so a read that asked for no
		// relation must carry none — not a reference holding nothing but the zone's key.
		const scoped = await harness.bins.findOneScoped(LEVEL_1);

		expect(scoped.zone).toBeUndefined();
		expect(scoped).toMatchObject({ zoneId: ZONE, warehouseId: WAREHOUSE });

		const zone = await harness.zones.findOneDetailed(ZONE);

		expect(zone.bins.map((bin) => bin.code).sort()).toEqual(['A-01', 'A-01-1', 'A-01-2']);
	});
});
