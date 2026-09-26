import { EntityCaseNamingStrategy, EntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { MikroOrmBaseEntityRepository } from '../repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';

/**
 * `CrudService` reads answer, under MikroORM, the shape TypeORM answers: a to-one relation the read did not load
 * is left out.
 *
 * MikroORM serializes an unloaded reference as its primary key (`kind: 'k1'`); a TypeORM row has no such member,
 * only the `kindId` column beside it. A GraphQL selection of the relation (`productType { name }`) then got a
 * string where an object type is declared. The store here is MikroORM on in-memory better-sqlite3.
 */

class SpecOwner {
	id!: string;
	name?: string;
}

class SpecKind {
	id!: string;
	name?: string;
	owner?: unknown;
}

class SpecLabel {
	id!: string;
	kind?: unknown;
}

class SpecItem {
	id!: string;
	kind?: unknown;
	kindId?: string;
	labels?: unknown;
}

const schemas = [
	new EntitySchema<SpecOwner>({
		class: SpecOwner,
		tableName: 'spec_owner',
		properties: { id: { type: 'string', primary: true }, name: { type: 'string', nullable: true } }
	}),
	new EntitySchema<SpecKind>({
		class: SpecKind,
		tableName: 'spec_kind',
		properties: {
			id: { type: 'string', primary: true },
			name: { type: 'string', nullable: true },
			owner: { kind: 'm:1', entity: () => SpecOwner, nullable: true, joinColumn: 'ownerId' } as any
		}
	}),
	new EntitySchema<SpecLabel>({
		class: SpecLabel,
		tableName: 'spec_label',
		properties: {
			id: { type: 'string', primary: true },
			kind: { kind: 'm:1', entity: () => SpecKind, nullable: true, joinColumn: 'kindId' } as any
		}
	}),
	new EntitySchema<SpecItem>({
		class: SpecItem,
		tableName: 'spec_item',
		properties: {
			id: { type: 'string', primary: true },
			kind: { kind: 'm:1', entity: () => SpecKind, nullable: true, joinColumn: 'kindId' } as any,
			kindId: { type: 'string', persist: false, nullable: true },
			labels: {
				kind: 'm:n',
				entity: () => SpecLabel,
				owner: true,
				pivotTable: 'spec_item_label',
				joinColumn: 'itemId',
				inverseJoinColumn: 'labelId'
			} as any
		}
	})
];

class ItemService extends CrudService<any> {
	constructor(mikroOrmRepository: unknown) {
		super({ metadata: undefined } as any, mikroOrmRepository as any);
	}
}

describe('CrudService serializes MikroORM rows as TypeORM answers them', () => {
	let orm: MikroORM<BetterSqliteDriver>;

	const service = () => new ItemService(new MikroOrmBaseEntityRepository<SpecItem>(orm.em.fork() as any, SpecItem));

	beforeAll(async () => {
		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: schemas,
			namingStrategy: EntityCaseNamingStrategy,
			autoJoinRefsForFilters: false,
			allowGlobalContext: true
		});
		await orm.schema.createSchema();
		const connection = orm.em.getConnection();
		await connection.execute(`INSERT INTO spec_owner (id, name) VALUES ('o1', 'owner')`);
		await connection.execute(`INSERT INTO spec_kind (id, name, ownerId) VALUES ('k1', 'kind', 'o1')`);
		await connection.execute(`INSERT INTO spec_label (id, kindId) VALUES ('l1', 'k1')`);
		await connection.execute(`INSERT INTO spec_item (id, kindId) VALUES ('i1', 'k1'), ('i2', NULL)`);
		await connection.execute(`INSERT INTO spec_item_label (itemId, labelId) VALUES ('i1', 'l1')`);
	});

	afterAll(async () => {
		await orm?.close(true);
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
	});

	afterEach(() => jest.restoreAllMocks());

	it('leaves out a relation the read did not load, and keeps its `xId` column', async () => {
		const row = await service().findOneByIdString('i1');

		expect(row).not.toHaveProperty('kind');
		expect(row.kindId).toBe('k1');
	});

	it('answers a loaded relation, without the relations it did not load in turn', async () => {
		const row = await service().findOneByIdString('i1', { relations: { kind: true } } as any);

		expect(row.kind).toEqual({ id: 'k1', name: 'kind' });
		expect(row.kind).not.toHaveProperty('owner');
	});

	it('answers a relation loaded two levels deep', async () => {
		const row = await service().findOneByIdString('i1', { relations: { kind: { owner: true } } } as any);

		expect(row.kind.owner).toEqual({ id: 'o1', name: 'owner' });
	});

	it("leaves out the unloaded relations of a loaded collection's items", async () => {
		const row = await service().findOneByIdString('i1', { relations: { labels: true } } as any);

		expect(row.labels).toEqual([{ id: 'l1' }]);
	});

	it('keeps a relation that is stored as null', async () => {
		const row = await service().findOneByIdString('i2', { relations: { kind: true } } as any);

		expect(row.kind).toBeNull();
	});

	it('answers list reads in the same shape', async () => {
		const { items } = await service().findAll({ order: { id: 'ASC' } } as any);

		// `i1`'s reference is left out. `i2`'s relation is NULL in the table, and MikroORM answers `null` for it
		// whether or not the read loaded it, so it stays `null` (TypeORM leaves it out): falsy either way.
		expect(items.map((item: Record<string, unknown>) => item.kind)).toEqual([undefined, null]);
	});
});
