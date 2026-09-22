import 'reflect-metadata';
import { MikroORM, PrimaryKey, wrap } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { getMetadataArgsStorage } from 'typeorm';
import { MultiORMColumn } from './column.decorator';
import { MultiORMEntity } from './entity.decorator';

/**
 * GHSA-hh83-hq74-gh9f — `@MultiORMColumn({ hidden: true })` must reach MikroORM's `@Property()`.
 *
 * Under DB_ORM=mikro-orm, `CrudService.serialize()` returns `wrap(entity).toJSON()` plain objects, so
 * class-transformer's `@Exclude` never applies; MikroORM's own `hidden` is what keeps a credential
 * column out of that output. This drives the REAL decorator against an in-memory SQLite database and
 * also pins down the one side effect callers must know: `hidden` does not stop the column being
 * loaded (the entity still carries it), but it IS dropped from every `toJSON()` result — including
 * the ones services read back from `CrudService.find*`.
 *
 * The decorator reads `DB_ORM` when the class is DECORATED, so the fixtures are declared inside
 * functions after the variable is set, and the variable is restored straight away.
 */
function declareUnder<T>(orm: 'mikro-orm' | 'typeorm', declare: () => T): T {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = orm;
	try {
		return declare();
	} finally {
		if (previous === undefined) {
			delete process.env.DB_ORM;
		} else {
			process.env.DB_ORM = previous;
		}
	}
}

const HiddenFixture = declareUnder('mikro-orm', () => {
	@MultiORMEntity('multi_orm_hidden_fixture')
	class HiddenFixture {
		@PrimaryKey({ type: 'varchar' })
		id!: string;

		@MultiORMColumn({ type: 'varchar' })
		email!: string;

		@MultiORMColumn({ type: 'varchar', nullable: true, hidden: true })
		secret?: string;

		// CONTROL: the same column without `hidden`, which toJSON() emits.
		@MultiORMColumn({ type: 'varchar', nullable: true })
		visibleSecret?: string;
	}
	return HiddenFixture;
});

describe('MultiORMColumn hidden (GHSA-hh83-hq74-gh9f)', () => {
	describe('MikroORM', () => {
		let orm: MikroORM;

		beforeAll(async () => {
			orm = await MikroORM.init({
				driver: BetterSqliteDriver,
				dbName: ':memory:',
				entities: [HiddenFixture],
				allowGlobalContext: true,
				discovery: { warnWhenNoEntities: false }
			});
			await orm.getSchemaGenerator().createSchema();
			const em = orm.em.fork();
			em.create(HiddenFixture, { id: 'row-1', email: 'ada@example.com', secret: 'secret-value', visibleSecret: 'secret-value' });
			await em.flush();
		});

		afterAll(async () => {
			await orm?.close(true);
		});

		it('forwards hidden to the MikroORM property metadata', () => {
			const meta = orm.getMetadata().get(HiddenFixture.name);
			expect(meta.properties['secret'].hidden).toBe(true);
			expect(meta.properties['visibleSecret'].hidden).toBeFalsy();
		});

		it('still loads the column: the entity carries it for server-side reads', async () => {
			const row = await orm.em.fork().findOneOrFail(HiddenFixture, { id: 'row-1' });
			expect(row.secret).toBe('secret-value');
		});

		it('drops it from toJSON(), the shape CrudService.serialize() returns', async () => {
			const row = await orm.em.fork().findOneOrFail(HiddenFixture, { id: 'row-1' });
			const json: any = wrap(row).toJSON();

			expect(json).not.toHaveProperty('secret');
			// CONTROL: without `hidden`, the value is serialized verbatim.
			expect(json.visibleSecret).toBe('secret-value');
			expect(json.email).toBe('ada@example.com');
		});
	});

	describe('TypeORM', () => {
		it('does not forward the MikroORM-only option to @Column()', () => {
			const TypeOrmFixture = declareUnder('typeorm', () => {
				class TypeOrmHiddenFixture {
					@MultiORMColumn({ type: 'varchar', nullable: true, hidden: true })
					secret?: string;
				}
				return TypeOrmHiddenFixture;
			});

			const column = getMetadataArgsStorage().columns.find(
				(args) => args.target === TypeOrmFixture && args.propertyName === 'secret'
			);
			expect(column).toBeDefined();
			expect(column.options).not.toHaveProperty('hidden');
			expect(column.options.nullable).toBe(true);
		});
	});
});
