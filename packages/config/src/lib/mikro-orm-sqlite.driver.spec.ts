import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EntityCaseNamingStrategy, EntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { DataSource, EntitySchema as TypeOrmEntitySchema, LessThan } from 'typeorm';
import { toTypeOrmSqliteDate, TypeOrmCompatibleBetterSqliteDriver } from './mikro-orm-sqlite.driver';

/**
 * On one SQLite file, MikroORM stores, reads and compares dates as TypeORM does.
 *
 * Under `DB_ORM=mikro-orm` TypeORM still writes the same file (the migrations' defaults, the seed, the services still
 * on TypeORM). MikroORM's own driver stored dates as epoch milliseconds and read TypeORM's UTC text as local time, and
 * because SQLite orders every number before every text, a date predicate never matched a row the other ORM wrote.
 * Both ORMs run here on one temporary file, with the options the platform's SQLite profile sets.
 */

interface IEvent {
	id: string;
	at?: Date | null;
	label?: string | null;
}

class Event implements IEvent {
	id!: string;
	at?: Date | null;
	label?: string | null;
}

const NOON = new Date('2026-01-01T12:00:00.000Z');
const MIDNIGHT = new Date('2026-01-01T00:00:00.000Z');

describe('TypeOrmCompatibleBetterSqliteDriver', () => {
	const file = join(tmpdir(), `mikro-orm-sqlite-driver-${process.pid}-${Date.now()}.sqlite`);
	let orm: MikroORM;
	let dataSource: DataSource;

	const raw = async (id: string): Promise<unknown> => {
		const rows: any[] = await dataSource.query('SELECT at FROM event WHERE id = ?', [id]);
		return rows[0]?.at;
	};

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: file,
			entities: [
				new TypeOrmEntitySchema<IEvent>({
					name: 'Event',
					tableName: 'event',
					columns: {
						id: { type: 'varchar', primary: true },
						at: { type: 'datetime', nullable: true },
						label: { type: 'varchar', nullable: true }
					}
				})
			],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();

		orm = await MikroORM.init({
			driver: TypeOrmCompatibleBetterSqliteDriver,
			forceUtcTimezone: true,
			dbName: file,
			entities: [
				new EntitySchema<Event>({
					class: Event,
					tableName: 'event',
					properties: {
						id: { type: 'string', primary: true },
						at: { type: 'Date', nullable: true },
						label: { type: 'string', nullable: true }
					}
				})
			],
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true
		});
	});

	afterAll(async () => {
		await orm?.close(true);
		await dataSource?.destroy();
		for (const candidate of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(candidate, { force: true });
	});

	beforeEach(async () => {
		await dataSource.query('DELETE FROM event');
		// As TypeORM writes a date on SQLite.
		await dataSource.getRepository<IEvent>('Event').insert({ id: 'typeorm', at: MIDNIGHT, label: 'typeorm' });
		const em = orm.em.fork();
		em.create(Event, { id: 'mikroorm', at: MIDNIGHT, label: 'mikroorm' });
		await em.flush();
	});

	it('is a BetterSqliteDriver, so everything that recognises that driver recognises it', () => {
		expect(TypeOrmCompatibleBetterSqliteDriver.prototype).toBeInstanceOf(BetterSqliteDriver);
		expect(orm.em.getDriver()).toBeInstanceOf(BetterSqliteDriver);
	});

	it('stores a date as TypeORM stores it: UTC text', async () => {
		expect(await raw('typeorm')).toBe('2026-01-01 00:00:00.000');
		expect(await raw('mikroorm')).toBe(toTypeOrmSqliteDate(MIDNIGHT));
	});

	it('reads the text TypeORM wrote as UTC, whatever the machine’s time zone', async () => {
		const events = await orm.em.fork().find(Event, {}, { orderBy: { id: 'asc' } });

		expect(events.map((event) => [event.id, event.at?.toISOString()])).toEqual([
			['mikroorm', MIDNIGHT.toISOString()],
			['typeorm', MIDNIGHT.toISOString()]
		]);
	});

	it('matches rows either ORM wrote with a MikroORM date predicate', async () => {
		expect(await orm.em.fork().count(Event, { at: { $lt: NOON } })).toBe(2);
		expect(await orm.em.fork().count(Event, { at: { $gt: NOON } })).toBe(0);
	});

	it('matches rows either ORM wrote with a TypeORM date predicate', async () => {
		expect(await dataSource.getRepository<IEvent>('Event').count({ where: { at: LessThan(NOON) } })).toBe(2);
	});

	it('writes a date through nativeUpdate as TypeORM text too', async () => {
		await orm.em.fork().nativeUpdate(Event, { id: 'typeorm' }, { at: NOON });

		expect(await raw('typeorm')).toBe('2026-01-01 12:00:00.000');
	});

	it('does not see an unchanged date as changed', async () => {
		const em = orm.em.fork();
		const event = await em.findOneOrFail(Event, 'typeorm');
		em.getUnitOfWork().computeChangeSets();

		expect(em.getUnitOfWork().getChangeSets()).toHaveLength(0);
		event.label = 'relabelled';
		em.getUnitOfWork().computeChangeSets();
		expect(
			em
				.getUnitOfWork()
				.getChangeSets()
				.map((set) => Object.keys(set.payload))
		).toEqual([['label']]);
	});

	it('still reads a date stored as epoch milliseconds as the same instant', async () => {
		await dataSource.query('UPDATE event SET at = ? WHERE id = ?', [MIDNIGHT.getTime(), 'typeorm']);

		const event = await orm.em.fork().findOneOrFail(Event, 'typeorm');
		expect(event.at?.toISOString()).toBe(MIDNIGHT.toISOString());
	});
});
