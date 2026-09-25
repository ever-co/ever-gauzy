import { EntityCaseNamingStrategy, EntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { MikroOrmBaseEntityRepository } from '../repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';

/**
 * `CrudService.create` and `save` link the rows a payload's to-many relations name, under MikroORM.
 *
 * `create()` builds a new row with a managed `em.create()` (so a nested `{ id }` is a reference to the stored
 * row, not a new one), and a managed entity's collections start uninitialised, as a stored row's would. A
 * product created with `tags` therefore had no pivot row written — or, with tag objects, failed with
 * `Collection<Tag> … not initialized` (the catalogue flows, under `DB_ORM=mikro-orm`). The store here is
 * MikroORM on in-memory better-sqlite3.
 */

class SpecTag {
	id!: string;
}

class SpecProduct {
	id!: string;
	name?: string;
	tags?: unknown;
}

const TagSchema = new EntitySchema<SpecTag>({
	class: SpecTag,
	tableName: 'spec_tag',
	properties: { id: { type: 'string', primary: true } }
});

const ProductSchema = new EntitySchema<SpecProduct>({
	class: SpecProduct,
	tableName: 'spec_product',
	properties: {
		id: { type: 'uuid', primary: true },
		name: { type: 'string', nullable: true },
		tags: {
			kind: 'm:n',
			entity: () => SpecTag,
			owner: true,
			pivotTable: 'spec_tag_product',
			joinColumn: 'productId',
			inverseJoinColumn: 'tagId'
		} as any
	}
});

class ProductService extends CrudService<any> {
	constructor(mikroOrmRepository: unknown) {
		super({} as any, mikroOrmRepository as any);
	}
}

describe('CrudService links to-many relations under MikroORM', () => {
	let orm: MikroORM<BetterSqliteDriver>;

	const service = () =>
		new ProductService(new MikroOrmBaseEntityRepository<SpecProduct>(orm.em.fork() as any, SpecProduct));
	const linked = async (productId: string): Promise<string[]> => {
		const rows: any[] = await orm.em
			.getConnection()
			.execute('SELECT tagId FROM spec_tag_product WHERE productId = ? ORDER BY tagId', [productId]);
		return rows.map((row) => row.tagId);
	};

	beforeAll(async () => {
		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [TagSchema, ProductSchema],
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true
		});
		await orm.schema.createSchema();
		await orm.em.fork().insertMany(SpecTag, [{ id: 't1' }, { id: 't2' }, { id: 't3' }]);
	});

	afterAll(async () => {
		await orm?.close(true);
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
	});

	afterEach(() => jest.restoreAllMocks());

	it('links the tags a new row names by id', async () => {
		const created = await service().create({ name: 'by-id', tags: ['t1', 't2'] });

		expect(await linked(created.id)).toEqual(['t1', 't2']);
	});

	it('links the tags a new row names as `{ id }` objects, without inserting them again', async () => {
		const created = await service().create({ name: 'by-object', tags: [{ id: 't2' }, { id: 't3' }] });

		expect(await linked(created.id)).toEqual(['t2', 't3']);
		const [{ count }]: any[] = await orm.em.getConnection().execute('SELECT count(*) AS count FROM spec_tag');
		expect(Number(count)).toBe(3);
	});

	it('links the tags of a new row that states its id', async () => {
		const id = '9b8f2f06-7b3a-4c1e-9f7e-1f5b6a0c2d11';
		await service().create({ id, name: 'stated', tags: ['t3'] });

		expect(await linked(id)).toEqual(['t3']);
	});

	it('replaces the tags of a stored row through save()', async () => {
		const created = await service().create({ name: 'resaved', tags: ['t1'] });

		await service().save({ id: created.id, tags: ['t2', 't3'] });

		expect(await linked(created.id)).toEqual(['t2', 't3']);
	});
});
