import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { Entity, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { ValueTransformer } from 'typeorm';
import { ColumnNumericTransformerPipe } from '../../../shared/pipes';
import { parseMikroOrmColumnOptions } from './column.helper';

/**
 * A real MikroORM round trip for the transformer bridge: schema DDL, write conversion and hydration.
 * The unit spec next to this one covers the option mapping; this one proves MikroORM actually uses it.
 */
const statusTransformer: ValueTransformer = {
	to: (value: string) => (value === 'ON' ? 1 : 0),
	from: (value: number) => (value === 1 ? 'ON' : 'OFF')
};

const columnOptions = (type: string, options: Record<string, unknown>) =>
	parseMikroOrmColumnOptions({ type, options }) as any;

@Entity({ tableName: 'value_transformer_fixture' })
class ValueTransformerFixture {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Property(
		columnOptions('numeric', {
			nullable: true,
			precision: 14,
			scale: 2,
			transformer: new ColumnNumericTransformerPipe(2)
		})
	)
	rate?: number;

	@Property(columnOptions('int', { nullable: true, transformer: statusTransformer }))
	status?: string;
}

describe('MikroORM transformer bridge (better-sqlite round trip)', () => {
	let orm: MikroORM;

	beforeAll(async () => {
		orm = await MikroORM.init({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [ValueTransformerFixture],
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false }
		});
		await orm.schema.createSchema();
	});

	afterAll(async () => {
		await orm?.close(true);
	});

	it('generates the declared DDL for a transformed column', async () => {
		const sql = await orm.schema.getCreateSchemaSQL();

		expect(sql).toMatch(/numeric\(14, ?2\)/i);
	});

	it('rounds on write, stores the transformed value and hydrates it back', async () => {
		const em = orm.em.fork();
		em.persist(em.create(ValueTransformerFixture, { id: 'fixture-1', rate: 10.499, status: 'ON' }));
		await em.flush();
		em.clear();

		const [stored] = await orm.em
			.getConnection()
			.execute('SELECT rate, status FROM value_transformer_fixture WHERE id = ?', ['fixture-1']);
		expect(Number(stored.rate)).toBe(10.5);
		expect(stored.status).toBe(1);

		const loaded = await em.findOneOrFail(ValueTransformerFixture, { id: 'fixture-1' });
		expect(loaded.rate).toBe(10.5);
		expect(loaded.status).toBe('ON');
	});

	it('keeps null as null in both directions', async () => {
		const em = orm.em.fork();
		em.persist(em.create(ValueTransformerFixture, { id: 'fixture-2', rate: null, status: null }));
		await em.flush();
		em.clear();

		const loaded = await em.findOneOrFail(ValueTransformerFixture, { id: 'fixture-2' });
		expect(loaded.rate).toBeNull();
	});
});
