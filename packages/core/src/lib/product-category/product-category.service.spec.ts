import '../core/entities/internal';

import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import {
	EntityCaseNamingStrategy,
	EntitySchema as MikroOrmEntitySchema,
	EventArgs,
	EventSubscriber,
	MikroORM,
	RequestContext as MikroOrmRequestContext
} from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../core/utils';
import { AddProductCategoryClosure1791000000550 } from '../database/migrations/1791000000550-AddProductCategoryClosure';
import { ProductCategory } from './product-category.entity';
import { ProductCategoryTranslation } from './product-category-translation.entity';
import { ProductCategoryService } from './product-category.service';

/**
 * The category tree (schema §2.2, task CE-97), through the real service, on a real database, under both
 * ORMs.
 *
 * Three rules, and this suite walks each of them. A parent a caller names has to exist, or the category
 * belongs to no tree at all and nothing about the row says so. A parent that is the category itself, or
 * one of its own descendants, has to be refused **before** anything is written — a cycle has no root
 * down that path. And removing a category has to detach its children first, which is the `SET NULL`
 * rule the schema promises and which SQLite cannot carry as a constraint.
 *
 * **Why the database is real.** The first version of this suite doubled the CRUD base class and the
 * tree repository, and the doubles answered what the real code did not: the tree double walked
 * `parentId`, so it could not see that TypeORM's closure table only ever received self-pairs (C7-3); the
 * `update` double did no pre-read, so it could not see that the detach step refused every leaf with a
 * 404 (C7-2); and nothing held the parent constraint, so it could not see that an edit — then a delete
 * and a re-insert — turned a parent's children into roots on Postgres and MySQL (C7-1). Each case here
 * therefore runs the real `ProductCategoryService` over the real `TenantAwareCrudService`, against an
 * in-memory SQLite database whose closure table is the one `1791000000550` creates, and reads the
 * outcome back from the tables.
 *
 * The tables are mapped by fixture schemas that carry exactly the mapping `ProductCategory` carries on
 * each ORM for the columns the tree touches: on TypeORM a closure-table tree whose `@TreeParent` joins on
 * the `parentId` column the entity also declares; on MikroORM, which has no tree strategy, `parentId` as
 * a plain persisted property (C7-4 — the entity itself is pinned by
 * `product-category.entity.mikro-orm.spec.ts`), with `tenant` and `organization` as the relations that
 * own their columns. The real entity cannot be mapped here: it reaches the whole application graph.
 *
 * **Every case runs four times**: under each ORM, and with the parent column as SQLite ships it (no
 * constraint) and as Postgres and MySQL carry it after `1791000000550` (`ON DELETE SET NULL`), because
 * the edit that flattened a branch did so only where the constraint exists.
 */

const TENANT_A = 'c7000000-0000-4000-8000-00000000000a';
const TENANT_B = 'c7000000-0000-4000-8000-00000000000b';
const ORGANIZATION_A = 'c7000000-0000-4000-8000-0000000000a1';
/** A second organization of the same tenant: a tree is one organization's taxonomy. */
const ORGANIZATION_A2 = 'c7000000-0000-4000-8000-0000000000a2';
const ORGANIZATION_B = 'c7000000-0000-4000-8000-0000000000b1';
const USER_A = { id: 'c7000000-0000-4000-8000-0000000000e1', tenantId: TENANT_A };
const USER_B = { id: 'c7000000-0000-4000-8000-0000000000e2', tenantId: TENANT_B };

/**
 * The tables, as the columns the tree reads and writes stand in production. `parentConstraint` adds
 * the self-referencing `SET NULL` rule 550 adds on Postgres and MySQL.
 */
function schemaStatements(parentConstraint: boolean): string[] {
	return [
		'CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL)',
		'CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar)',
		'CREATE TABLE "product_category" (' +
			'"id" varchar PRIMARY KEY NOT NULL, ' +
			`"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
			`"updatedAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
			'"deletedAt" datetime, ' +
			'"tenantId" varchar REFERENCES "tenant" ("id") ON DELETE CASCADE, ' +
			'"organizationId" varchar REFERENCES "organization" ("id") ON DELETE CASCADE, ' +
			`"parentId" varchar${parentConstraint ? ' REFERENCES "product_category" ("id") ON DELETE SET NULL' : ''}, ` +
			'"slug" varchar(255), ' +
			'"sortOrder" integer NOT NULL DEFAULT (0), ' +
			'"imageUrl" varchar)',
		'CREATE TABLE "product_category_translation" (' +
			'"id" varchar PRIMARY KEY NOT NULL, ' +
			`"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
			`"updatedAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
			'"tenantId" varchar REFERENCES "tenant" ("id") ON DELETE CASCADE, ' +
			'"organizationId" varchar REFERENCES "organization" ("id") ON DELETE CASCADE, ' +
			'"name" varchar NOT NULL, ' +
			'"description" varchar, ' +
			'"languageCode" varchar NOT NULL, ' +
			'"referenceId" varchar NOT NULL REFERENCES "product_category" ("id") ON DELETE CASCADE)',
		`INSERT INTO "tenant" ("id") VALUES ('${TENANT_A}'), ('${TENANT_B}')`,
		`INSERT INTO "organization" ("id", "tenantId") VALUES ('${ORGANIZATION_A}', '${TENANT_A}'), ` +
			`('${ORGANIZATION_A2}', '${TENANT_A}'), ('${ORGANIZATION_B}', '${TENANT_B}')`
	];
}

/*
|--------------------------------------------------------------------------
| TypeORM: `ProductCategory` bound to a schema that maps what the tree touches
|--------------------------------------------------------------------------
*/

const TypeOrmTenant = new EntitySchema<any>({
	name: 'Tenant',
	tableName: 'tenant',
	columns: { id: { type: 'varchar', primary: true } }
});

const TypeOrmOrganization = new EntitySchema<any>({
	name: 'Organization',
	tableName: 'organization',
	columns: { id: { type: 'varchar', primary: true }, tenantId: { type: 'varchar', nullable: true } }
});

// `target` binds the schema to the real classes, so the service's own `manager.update(ProductCategory,
// …)` and `getTreeRepository(ProductCategory)` resolve to it. Relations name their target by that
// class's name: a class handed to a relation is read as a thunk and called.
const TypeOrmCategory = new EntitySchema<any>({
	name: 'ProductCategory',
	target: ProductCategory,
	tableName: 'product_category',
	trees: [{ type: 'closure-table' }],
	columns: {
		id: { type: 'varchar', primary: true, generated: 'uuid' },
		createdAt: { type: 'datetime', createDate: true },
		updatedAt: { type: 'datetime', updateDate: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		parentId: { type: 'varchar', nullable: true },
		slug: { type: 'varchar', nullable: true },
		sortOrder: { type: 'int', default: 0 },
		imageUrl: { type: 'varchar', nullable: true }
	},
	relations: {
		tenant: { type: 'many-to-one', target: 'Tenant', joinColumn: { name: 'tenantId' }, nullable: true },
		organization: { type: 'many-to-one', target: 'Organization', joinColumn: { name: 'organizationId' }, nullable: true },
		parent: {
			type: 'many-to-one',
			target: 'ProductCategory',
			treeParent: true,
			joinColumn: { name: 'parentId' },
			onDelete: 'SET NULL',
			nullable: true
		},
		children: { type: 'one-to-many', target: 'ProductCategory', treeChildren: true, inverseSide: 'parent' },
		translations: {
			type: 'one-to-many',
			target: 'ProductCategoryTranslation',
			inverseSide: 'reference',
			eager: true,
			cascade: true
		}
	}
});

const TypeOrmTranslation = new EntitySchema<any>({
	name: 'ProductCategoryTranslation',
	target: ProductCategoryTranslation,
	tableName: 'product_category_translation',
	columns: {
		id: { type: 'varchar', primary: true, generated: 'uuid' },
		createdAt: { type: 'datetime', createDate: true },
		updatedAt: { type: 'datetime', updateDate: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		name: { type: 'varchar' },
		description: { type: 'varchar', nullable: true },
		languageCode: { type: 'varchar' },
		referenceId: { type: 'varchar' }
	},
	relations: {
		reference: {
			type: 'many-to-one',
			target: 'ProductCategory',
			joinColumn: { name: 'referenceId' },
			inverseSide: 'translations',
			onDelete: 'CASCADE'
		},
		tenant: { type: 'many-to-one', target: 'Tenant', joinColumn: { name: 'tenantId' }, nullable: true },
		organization: { type: 'many-to-one', target: 'Organization', joinColumn: { name: 'organizationId' }, nullable: true }
	}
});

/*
|--------------------------------------------------------------------------
| MikroORM: the same tables under the names the service addresses them by
|--------------------------------------------------------------------------
*/

const MikroOrmTenant = new MikroOrmEntitySchema<any>({
	name: 'Tenant',
	tableName: 'tenant',
	properties: { id: { type: 'string', primary: true } }
});

const MikroOrmOrganization = new MikroOrmEntitySchema<any>({
	name: 'Organization',
	tableName: 'organization',
	properties: { id: { type: 'string', primary: true }, tenantId: { type: 'string', nullable: true } }
});

// `tenantId` and `organizationId` are `persist: false` mirrors of the relations that own the columns,
// exactly as `relationId: true` makes them on `TenantOrganizationBaseEntity`; `parentId` is not, because
// on MikroORM nothing else maps that column (C7-4).
const MikroOrmCategory = new MikroOrmEntitySchema<any>({
	name: 'ProductCategory',
	tableName: 'product_category',
	properties: {
		id: { type: 'string', primary: true, onCreate: () => randomUUID() },
		createdAt: { type: 'Date', onCreate: () => new Date() },
		updatedAt: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
		deletedAt: { type: 'Date', nullable: true },
		tenant: { kind: 'm:1', entity: 'Tenant', nullable: true, fieldName: 'tenantId' },
		tenantId: { type: 'string', nullable: true, persist: false },
		organization: { kind: 'm:1', entity: 'Organization', nullable: true, fieldName: 'organizationId' },
		organizationId: { type: 'string', nullable: true, persist: false },
		parentId: { type: 'string', nullable: true },
		slug: { type: 'string', nullable: true },
		sortOrder: { type: 'number', default: 0 },
		imageUrl: { type: 'string', nullable: true },
		translations: { kind: '1:m', entity: 'ProductCategoryTranslation', mappedBy: 'reference', eager: true, cascade: ['persist'] as any }
	} as any
});

const MikroOrmTranslation = new MikroOrmEntitySchema<any>({
	name: 'ProductCategoryTranslation',
	tableName: 'product_category_translation',
	properties: {
		id: { type: 'string', primary: true, onCreate: () => randomUUID() },
		createdAt: { type: 'Date', onCreate: () => new Date() },
		updatedAt: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
		tenant: { kind: 'm:1', entity: 'Tenant', nullable: true, fieldName: 'tenantId' },
		organization: { kind: 'm:1', entity: 'Organization', nullable: true, fieldName: 'organizationId' },
		name: { type: 'string' },
		description: { type: 'string', nullable: true },
		languageCode: { type: 'string' },
		reference: { kind: 'm:1', entity: 'ProductCategory', fieldName: 'referenceId', deleteRule: 'cascade' }
	} as any
});

/**
 * What production's `TenantOrganizationBaseEntityEventSubscriber` does for a MikroORM insert: a row
 * created with only `organizationId` — the `persist: false` mirror — is filed under that organization
 * through the relation that owns the column.
 */
class OrganizationFromIdSubscriber implements EventSubscriber<any> {
	getSubscribedEntities() {
		return ['ProductCategory'];
	}

	beforeCreate({ entity, em }: EventArgs<any>): void {
		if (entity.organizationId && !entity.organization) {
			entity.organization = em.getReference('Organization', entity.organizationId);
		}
	}
}

/*
|--------------------------------------------------------------------------
| The harnesses
|--------------------------------------------------------------------------
*/

interface IHarness {
	/**
	 * Runs one call as one request: under MikroORM in a request context of its own, as the HTTP and
	 * GraphQL layers run every call, so a read is answered by the store and not by an identity map an
	 * earlier call filled.
	 */
	request<R>(work: (service: ProductCategoryService) => Promise<R>): Promise<R>;
	/** Reads rows straight from the database, outside the service. */
	rows(sql: string, parameters?: unknown[]): Promise<any[]>;
	/** Writes straight to the database, outside the service. */
	exec(sql: string, parameters?: unknown[]): Promise<void>;
	/** Spies on the TypeORM tree repository the service reads the closure table through. */
	spyOnTreeRepository(): jest.SpyInstance | null;
	close(): Promise<void>;
}

async function typeOrmHarness(parentConstraint: boolean): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TypeOrmTenant, TypeOrmOrganization, TypeOrmCategory, TypeOrmTranslation],
		synchronize: false,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	for (const statement of schemaStatements(parentConstraint)) {
		await dataSource.query(statement);
	}

	const queryRunner = dataSource.createQueryRunner();
	await new AddProductCategoryClosure1791000000550().up(queryRunner);
	await queryRunner.release();

	const service = new ProductCategoryService(dataSource.getRepository(ProductCategory) as any, {} as any);

	return {
		request: (work) => work(service),
		rows: (sql, parameters = []) => dataSource.query(sql, parameters),
		exec: async (sql, parameters = []) => {
			await dataSource.query(sql, parameters);
		},
		spyOnTreeRepository: () => jest.spyOn(dataSource.manager, 'getTreeRepository'),
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(parentConstraint: boolean): Promise<IHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [MikroOrmTenant, MikroOrmOrganization, MikroOrmCategory, MikroOrmTranslation],
		subscribers: [new OrganizationFromIdSubscriber()],
		// The soft-delete filter `SoftDeletableBaseEntity` registers, under the name `withDeleted` lifts.
		filters: {
			[SOFT_DELETABLE_FILTER]: { name: SOFT_DELETABLE_FILTER, cond: { deletedAt: null }, entity: ['ProductCategory'], default: true }
		},
		// The naming strategy production sets, so a relation and its mirror land on one column.
		namingStrategy: EntityCaseNamingStrategy,
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	const connection = orm.em.getConnection();

	for (const statement of schemaStatements(parentConstraint)) {
		await connection.execute(statement, [], 'run');
	}

	// 550's SQLite DDL, run through MikroORM's connection: the migration only ever calls `query`.
	await new AddProductCategoryClosure1791000000550().sqliteUpQueryRunner({
		query: (sql: string) => connection.execute(sql, [], 'run')
	} as any);

	// Bound to the global manager, as Nest injects it: inside `transactional()` its calls resolve to the
	// transaction's fork, which is what keeps the row and its closure pairs in one transaction.
	const service = new ProductCategoryService(
		// `TenantAwareCrudService` asks the TypeORM metadata whether the entity is tenant-scoped, whichever
		// ORM runs the query.
		{ metadata: { hasColumnWithPropertyPath: (path: string) => path === 'tenantId' } } as any,
		new MikroOrmBaseEntityRepository<any>(orm.em as any, 'ProductCategory') as any
	);

	return {
		request: (work) => MikroOrmRequestContext.create(orm.em, () => work(service)),
		rows: (sql, parameters = []) => connection.execute(sql, parameters, 'all'),
		exec: async (sql, parameters = []) => {
			await connection.execute(sql, parameters, 'run');
		},
		spyOnTreeRepository: () => null,
		close: () => orm.close(true)
	};
}

/*
|--------------------------------------------------------------------------
| Reading the outcome
|--------------------------------------------------------------------------
*/

/** The closure of a tree given as `child: parent`, self-pairs included, as sorted `ancestor>descendant`. */
function closureOf(tree: Record<string, string | null>): string[] {
	const pairs: string[] = [];

	for (const node of Object.keys(tree)) {
		let current: string | null = node;
		const seen = new Set<string>();

		while (current && !seen.has(current)) {
			seen.add(current);
			pairs.push(`${current}>${node}`);
			current = tree[current] ?? null;
		}
	}

	return pairs.sort();
}

describe.each([
	[MultiORMEnum.TypeORM, 'SQLite as shipped (no parent constraint)', typeOrmHarness, false],
	[MultiORMEnum.TypeORM, 'the parent constraint Postgres and MySQL carry', typeOrmHarness, true],
	[MultiORMEnum.MikroORM, 'SQLite as shipped (no parent constraint)', mikroOrmHarness, false],
	[MultiORMEnum.MikroORM, 'the parent constraint Postgres and MySQL carry', mikroOrmHarness, true]
] as const)('ProductCategoryService — %s, %s', (ormType, _dialect, createHarness, parentConstraint) => {
	let harness: IHarness;
	/** The ids of the categories a case planted, by the name the case uses for them. */
	let ids: Record<string, string>;
	let user: { id: string; tenantId: string };

	/** The name a case gave an id, so an assertion reads as the tree it describes. */
	const nameOf = (id: string) => Object.keys(ids).find((name) => ids[name] === id) ?? id;

	/** Creates a category as both surfaces do: by `parentId`, with one language. */
	async function create(
		name: string,
		parent: string | null,
		extra: Record<string, unknown> = {}
	): Promise<ProductCategory> {
		const created = await harness.request((service) =>
			service.create({
				organizationId: ORGANIZATION_A,
				slug: name.toLowerCase(),
				translations: [{ languageCode: 'en', name }],
				...(parent ? { parentId: ids[parent] } : {}),
				...extra
			} as any)
		);

		ids[name] = String(created.id);

		return created;
	}

	/** ROOT > BRANCH > LEAF, and OTHER beside them. */
	async function plantTree(): Promise<void> {
		await create('ROOT', null);
		await create('OTHER', null);
		await create('BRANCH', 'ROOT', { sortOrder: 3 });
		await create('LEAF', 'BRANCH');
	}

	/** Every closure pair, by name. */
	async function pairs(): Promise<string[]> {
		const rows = await harness.rows(
			'SELECT "id_ancestor" AS "ancestor", "id_descendant" AS "descendant" FROM "product_category_closure"'
		);

		return rows.map((row) => `${nameOf(row.ancestor)}>${nameOf(row.descendant)}`).sort();
	}

	/** A category's stored parent, by name, read from the table. */
	async function storedParentOf(name: string): Promise<string | null> {
		const [row] = await harness.rows('SELECT "parentId" FROM "product_category" WHERE "id" = ?', [ids[name]]);

		return row?.parentId ? nameOf(row.parentId) : null;
	}

	/** The names of a category's subtree as the service answers it, the category first. */
	async function subtreeOf(name: string): Promise<string[]> {
		const subtree = await harness.request((service) => service.findDescendants(ids[name]));

		return subtree.map((category) => nameOf(String(category.id)));
	}

	/** The subtree's first entry and the rest as a set: the service promises only the first place. */
	const asSubtree = (names: string[]) => [names[0], ...names.slice(1).sort()];

	beforeEach(async () => {
		user = USER_A;
		ids = {};

		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
		jest.spyOn(RequestContext, 'currentUser').mockImplementation(() => user as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockImplementation(() => user.tenantId);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

		harness = await createHarness(parentConstraint);
	});

	afterEach(async () => {
		await harness?.close();
		jest.restoreAllMocks();
	});

	describe('the parent a caller names', () => {
		it('refuses a parent that does not exist, naming the parent rather than the category', async () => {
			await plantTree();

			await expect(
				harness.request((service) =>
					service.create({ organizationId: ORGANIZATION_A, slug: 'orphan', parentId: randomUUID() } as any)
				)
			).rejects.toMatchObject({ response: { code: 'PRODUCT_CATEGORY_PARENT_NOT_FOUND' } });

			// Control: a service that wrote the row anyway would leave a category whose parent resolves to
			// nothing, and no read of the row would say so.
			expect(await harness.rows(`SELECT "id" FROM "product_category" WHERE "slug" = 'orphan'`)).toEqual([]);
		});

		it('creates a category under a parent that exists, and the parent is stored and read back (C7-4)', async () => {
			await plantTree();

			const created = await create('CHILD', 'ROOT');

			expect(created.parentId).toBe(ids.ROOT);
			// Stored: under MikroORM a `persist: false` parentId was dropped from the INSERT and the row
			// stored as a root.
			expect(await storedParentOf('CHILD')).toBe('ROOT');
			// And read: a fresh request answers the column, not the value the create was handed.
			const read = await harness.request((service) => service.findOneByIdString(ids.CHILD));
			expect(read.parentId).toBe(ids.ROOT);
		});

		it('refuses a parent of another tenant, which no read of this tree can see', async () => {
			await plantTree();
			user = USER_B;

			await expect(
				harness.request((service) =>
					service.create({ organizationId: ORGANIZATION_B, slug: 'intruder', parentId: ids.ROOT } as any)
				)
			).rejects.toMatchObject({ response: { code: 'PRODUCT_CATEGORY_PARENT_NOT_FOUND' } });

			expect(await harness.rows(`SELECT "id" FROM "product_category" WHERE "slug" = 'intruder'`)).toEqual([]);
		});

		it("refuses a parent of another of the tenant's organizations", async () => {
			await plantTree();
			await create('ELSEWHERE', null, { organizationId: ORGANIZATION_A2 });

			await expect(
				harness.request((service) =>
					service.create({ organizationId: ORGANIZATION_A, slug: 'crossed', parentId: ids.ELSEWHERE } as any)
				)
			).rejects.toMatchObject({ response: { code: 'PRODUCT_CATEGORY_PARENT_NOT_FOUND' } });
		});

		it('refuses a category as its own parent, before the write', async () => {
			await plantTree();

			await expect(
				harness.request((service) =>
					service.updateProductCategory(ids.ROOT, { id: ids.ROOT, parentId: ids.ROOT, slug: 'root' } as any)
				)
			).rejects.toMatchObject({ response: { code: 'PRODUCT_CATEGORY_CYCLE' } });

			// Control: a refusal that arrived after the write would have changed the row it refused.
			expect(await harness.rows('SELECT "id" FROM "product_category" WHERE "id" = ?', [ids.ROOT])).toHaveLength(1);
			expect(await storedParentOf('ROOT')).toBeNull();
		});

		it('refuses a parent inside the category being moved — the closure pairs the service wrote are what the guard reads (C7-3)', async () => {
			await plantTree();

			// The failure scenario: the tree was built from `parentId` alone, so under TypeORM the closure
			// held self-pairs only, `findDescendants(ROOT)` answered [ROOT], and this move was accepted.
			await expect(
				harness.request((service) =>
					service.updateProductCategory(ids.ROOT, { id: ids.ROOT, parentId: ids.LEAF, slug: 'root' } as any)
				)
			).rejects.toMatchObject({ response: { code: 'PRODUCT_CATEGORY_CYCLE' } });

			// The finding's own case, one level down: a direct child named as the parent of its parent.
			await expect(
				harness.request((service) =>
					service.updateProductCategory(ids.ROOT, { id: ids.ROOT, parentId: ids.BRANCH } as any)
				)
			).rejects.toMatchObject({ response: { code: 'PRODUCT_CATEGORY_CYCLE' } });

			expect(await storedParentOf('ROOT')).toBeNull();
			expect(await storedParentOf('LEAF')).toBe('BRANCH');
			expect(await pairs()).toEqual(closureOf({ ROOT: null, OTHER: null, BRANCH: 'ROOT', LEAF: 'BRANCH' }));
		});

		it('refuses a new parent that does not exist, before the write', async () => {
			await plantTree();

			await expect(
				harness.request((service) =>
					service.updateProductCategory(ids.BRANCH, { id: ids.BRANCH, parentId: randomUUID() } as any)
				)
			).rejects.toMatchObject({ response: { code: 'PRODUCT_CATEGORY_PARENT_NOT_FOUND' } });

			expect(await storedParentOf('BRANCH')).toBe('ROOT');
		});

		it('accepts a re-parent that moves a branch under another root, and its subtree moves with it', async () => {
			await plantTree();

			const moved = await harness.request((service) =>
				service.updateProductCategory(ids.BRANCH, { id: ids.BRANCH, parentId: ids.OTHER, slug: 'branch' } as any)
			);

			expect(moved.parentId).toBe(ids.OTHER);
			expect(await storedParentOf('BRANCH')).toBe('OTHER');
			expect(await storedParentOf('LEAF')).toBe('BRANCH');
			expect(await pairs()).toEqual(closureOf({ ROOT: null, OTHER: null, BRANCH: 'OTHER', LEAF: 'BRANCH' }));
			expect(asSubtree(await subtreeOf('OTHER'))).toEqual(['OTHER', 'BRANCH', 'LEAF']);
			expect(await subtreeOf('ROOT')).toEqual(['ROOT']);
		});

		it('makes a category a root when the edit states `parentId: null`', async () => {
			await plantTree();

			await harness.request((service) =>
				service.updateProductCategory(ids.BRANCH, { id: ids.BRANCH, parentId: null } as any)
			);

			expect(await storedParentOf('BRANCH')).toBeNull();
			expect(await pairs()).toEqual(closureOf({ ROOT: null, OTHER: null, BRANCH: null, LEAF: 'BRANCH' }));
		});
	});

	describe('the subtree', () => {
		it('records a pair for every ancestor of a category created from `parentId` alone, not only its self-pair (C7-3)', async () => {
			await plantTree();

			expect(await pairs()).toEqual(closureOf({ ROOT: null, OTHER: null, BRANCH: 'ROOT', LEAF: 'BRANCH' }));
			// The two pairs the defect never wrote: the leaf's grandparent and its parent.
			expect(await pairs()).toEqual(expect.arrayContaining(['ROOT>LEAF', 'BRANCH>LEAF']));
		});

		it('answers the whole subtree, the category itself first', async () => {
			await plantTree();

			// The service promises the category first; the order of the levels below is the store's.
			expect(asSubtree(await subtreeOf('ROOT'))).toEqual(['ROOT', 'BRANCH', 'LEAF']);
			expect(asSubtree(await subtreeOf('BRANCH'))).toEqual(['BRANCH', 'LEAF']);
			expect(await subtreeOf('LEAF')).toEqual(['LEAF']);
		});

		it('reads the subtree through the closure table on TypeORM and through `parentId` on MikroORM', async () => {
			await plantTree();
			const treeRepository = harness.spyOnTreeRepository();

			await subtreeOf('ROOT');

			// The TypeORM arm goes through `getTreeRepository`, the only reader of the closure table;
			// MikroORM has no closure strategy and walks the rows level by level.
			if (ormType === MultiORMEnum.TypeORM) {
				expect(treeRepository).toHaveBeenCalledWith(ProductCategory);
			} else {
				expect(treeRepository).toBeNull();
			}
		});

		it('knows a category is inside another, and that an unrelated one is not', async () => {
			await plantTree();

			const isDescendantOf = (ancestor: string, descendant: string) =>
				harness.request((service) => service.isDescendantOf(ids[ancestor], ids[descendant]));

			await expect(isDescendantOf('ROOT', 'LEAF')).resolves.toBe(true);
			await expect(isDescendantOf('ROOT', 'ROOT')).resolves.toBe(true);
			await expect(isDescendantOf('BRANCH', 'ROOT')).resolves.toBe(false);
			await expect(isDescendantOf('ROOT', 'OTHER')).resolves.toBe(false);
		});

		it('leaves out a row of another tenant, even one that names the category as its parent and has a pair', async () => {
			await plantTree();
			ids.FOREIGN = randomUUID();
			await harness.exec(
				'INSERT INTO "product_category" ("id", "tenantId", "organizationId", "parentId", "slug") VALUES (?, ?, ?, ?, ?)',
				[ids.FOREIGN, TENANT_B, ORGANIZATION_B, ids.ROOT, 'foreign']
			);
			await harness.exec('INSERT INTO "product_category_closure" ("id_ancestor", "id_descendant") VALUES (?, ?), (?, ?)', [
				ids.FOREIGN,
				ids.FOREIGN,
				ids.ROOT,
				ids.FOREIGN
			]);

			expect(await subtreeOf('ROOT')).not.toContain('FOREIGN');

			// And the other tenant cannot walk this tenant's tree at all.
			user = USER_B;
			await expect(subtreeOf('ROOT')).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe('editing a category (C7-1)', () => {
		it("renaming a parent keeps its children attached, and the pairs through it, on every dialect", async () => {
			await plantTree();
			const [before] = await harness.rows('SELECT "createdAt" FROM "product_category" WHERE "id" = ?', [ids.BRANCH]);

			// The failure scenario: an ordinary rename, stating the parent the category already has — as
			// the GraphQL input and a client echoing the row back do.
			const renamed = await harness.request((service) =>
				service.updateProductCategory(ids.BRANCH, {
					id: ids.BRANCH,
					organizationId: ORGANIZATION_A,
					parentId: ids.ROOT,
					slug: 'renamed',
					translations: [{ languageCode: 'en', name: 'Renamed' }]
				} as any)
			);

			expect(renamed.slug).toBe('renamed');
			expect(renamed.translations.map((translation) => translation.name)).toEqual(['Renamed']);
			// The child still names it — on Postgres and MySQL the removal's `SET NULL` used to make it a
			// root — and every pair through it is still there.
			expect(await storedParentOf('LEAF')).toBe('BRANCH');
			expect(await pairs()).toEqual(closureOf({ ROOT: null, OTHER: null, BRANCH: 'ROOT', LEAF: 'BRANCH' }));
			expect(asSubtree(await subtreeOf('ROOT'))).toEqual(['ROOT', 'BRANCH', 'LEAF']);
			// The row was updated where it stands, not removed and inserted again.
			const [after] = await harness.rows('SELECT "createdAt" FROM "product_category" WHERE "id" = ?', [ids.BRANCH]);
			expect(after.createdAt).toEqual(before.createdAt);
		});

		if (parentConstraint) {
			it('CONTROL: removing the parent row here does make its children roots — what the delivered delete-then-recreate did', async () => {
				await plantTree();

				await harness.exec('DELETE FROM "product_category" WHERE "id" = ?', [ids.BRANCH]);

				expect(await storedParentOf('LEAF')).toBeNull();
			});
		}

		it('leaves a member the caller does not state as it is', async () => {
			await plantTree();

			const edited = await harness.request((service) =>
				service.updateProductCategory(ids.BRANCH, { id: ids.BRANCH, slug: 'only-the-slug' } as any)
			);

			expect(edited.slug).toBe('only-the-slug');
			expect(edited.sortOrder).toBe(3);
			expect(edited.parentId).toBe(ids.ROOT);
			// Translations omitted are kept, not withdrawn with a removed row.
			expect(edited.translations.map((translation) => translation.name)).toEqual(['BRANCH']);
		});

		it('replaces the languages as a set when they are stated', async () => {
			await plantTree();

			const edited = await harness.request((service) =>
				service.updateProductCategory(ids.BRANCH, {
					id: ids.BRANCH,
					translations: [
						{ languageCode: 'fr', name: 'Branche' },
						{ languageCode: 'de', name: 'Zweig' }
					]
				} as any)
			);

			expect(edited.translations.map((translation) => translation.languageCode).sort()).toEqual(['de', 'fr']);
			expect(
				await harness.rows('SELECT "languageCode" FROM "product_category_translation" WHERE "referenceId" = ?', [ids.BRANCH])
			).toHaveLength(2);
		});

		it("cannot edit another tenant's category", async () => {
			await plantTree();
			user = USER_B;

			await expect(
				harness.request((service) =>
					service.updateProductCategory(ids.BRANCH, { id: ids.BRANCH, slug: 'taken', parentId: null } as any)
				)
			).rejects.toBeInstanceOf(NotFoundException);

			user = USER_A;
			expect(await storedParentOf('BRANCH')).toBe('ROOT');
			expect(await pairs()).toEqual(closureOf({ ROOT: null, OTHER: null, BRANCH: 'ROOT', LEAF: 'BRANCH' }));
		});
	});

	describe('removing a category', () => {
		it('removes a category that has no children (C7-2)', async () => {
			await plantTree();

			// The failure scenario: the detach step went through the inherited `update`, which reads a
			// matching row first and answered a leaf — no child names it — with a 404.
			const result = await harness.request((service) => service.delete(ids.LEAF));

			expect(result.affected).toBe(1);
			expect(await harness.rows('SELECT "id" FROM "product_category" WHERE "id" = ?', [ids.LEAF])).toEqual([]);
			expect(await pairs()).toEqual(closureOf({ ROOT: null, OTHER: null, BRANCH: 'ROOT' }));
		});

		it('detaches the children before the row is deleted, so they become roots with their own subtrees intact', async () => {
			await plantTree();
			await create('TWIG', 'LEAF');

			await harness.request((service) => service.delete(ids.BRANCH));

			// The order is the whole point — deleting first leaves nothing to detach the children by, and on
			// SQLite, which has no `SET NULL` constraint, they would keep naming a parent that is gone. The
			// first version of this case asserted the base class's `update` ran before its `delete`; the
			// outcome is what is asserted now, against tables that hold the constraint or do not.
			expect(await harness.rows('SELECT "id" FROM "product_category" WHERE "id" = ?', [ids.BRANCH])).toEqual([]);
			expect(await storedParentOf('LEAF')).toBeNull();
			expect(await storedParentOf('TWIG')).toBe('LEAF');
			expect(await pairs()).toEqual(closureOf({ ROOT: null, OTHER: null, LEAF: null, TWIG: 'LEAF' }));
			expect(await subtreeOf('ROOT')).toEqual(['ROOT']);
			expect(asSubtree(await subtreeOf('LEAF'))).toEqual(['LEAF', 'TWIG']);
		});

		it("cannot remove another tenant's category, or detach its children", async () => {
			await plantTree();
			user = USER_B;

			await expect(harness.request((service) => service.delete(ids.BRANCH))).rejects.toBeInstanceOf(NotFoundException);

			expect(await storedParentOf('BRANCH')).toBe('ROOT');
			expect(await storedParentOf('LEAF')).toBe('BRANCH');
			expect(await pairs()).toEqual(closureOf({ ROOT: null, OTHER: null, BRANCH: 'ROOT', LEAF: 'BRANCH' }));
		});

		it('removes a category by its identifier only', async () => {
			await plantTree();

			await expect(
				harness.request((service) => service.delete({ slug: 'root' } as any))
			).rejects.toBeInstanceOf(BadRequestException);

			expect(await harness.rows('SELECT "id" FROM "product_category"')).toHaveLength(4);
		});
	});
});
