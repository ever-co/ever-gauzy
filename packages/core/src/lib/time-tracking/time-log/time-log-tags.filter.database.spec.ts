import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { EntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { ITimeLogFilters } from '@gauzy/contracts';
import { CreateTagTimeLogTable1791000019250 } from '../../database/migrations/1791000019250-CreateTagTimeLogTable';
import { mikroOrmTimeLogTagsKey, timeLogTagsCondition } from './time-log-tags';

/**
 * The tag filter of the time log reads (`timeLogTagsCondition`, and `mikroOrmTimeLogTagsKey` built on it) run on a real
 * database through both ORMs: `tag_time_log` as its migration creates it, under a minimal fixture of the `time_log` and
 * `tag` keys in the column type each dialect stores a uuid in. The ids are stored in lowercase, as Gauzy generates
 * every key.
 *
 * Asked for a tag in capitals, as stored, or both, the filter keeps the logs the tag is on, and `untagged` the logs
 * without a live tag. SQLite keeps a uuid as text compared by case, so a tag asked in capitals found no log there
 * until the filter bound the stored form as well. PostgreSQL compares `uuid` values whatever their case: its answers
 * were already these, and stay so.
 *
 * SQLite runs by default. PostgreSQL runs when a database is given; the spec works in a schema of its own, which it
 * drops afterwards:
 *
 *   GAUZY_TIME_LOG_TAGS_SPEC_POSTGRES_URL=postgres://user:password@host:port/database \
 *     node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/core/jest.config.ts <this file>
 */

const POSTGRES_URL = process.env.GAUZY_TIME_LOG_TAGS_SPEC_POSTGRES_URL;

const TIMEOUT = 5 * 60 * 1000;

const MEETING = '99999999-9999-4999-8999-9999999999a1';
const SUPPORT = '99999999-9999-4999-8999-9999999999a2';
const DELETED = '99999999-9999-4999-8999-9999999999a4';
const MEETING_LOG = '77777777-7777-4777-8777-777777777771';
const SUPPORT_LOG = '77777777-7777-4777-8777-777777777772';
const DELETED_TAG_LOG = '77777777-7777-4777-8777-777777777773';
const BARE_LOG = '77777777-7777-4777-8777-777777777774';

/** The tags each log carries: the last one's only tag is deleted, the bare one has none. */
const LINKS: Array<[string, string]> = [
	[MEETING_LOG, MEETING],
	[SUPPORT_LOG, SUPPORT],
	[DELETED_TAG_LOG, DELETED]
];

/** The time log as MikroORM reads it here: its key is all the filter needs. */
interface TimeLogRow {
	id: string;
}

const TimeLogRowSchema = new EntitySchema<TimeLogRow>({
	name: 'TimeLogRow',
	tableName: 'time_log',
	properties: { id: { type: 'uuid', primary: true } }
});

type Filter = Pick<ITimeLogFilters, 'tagIds' | 'untagged'>;

/** The two connections to one database, the column types a uuid and a date take there, and how to let it go. */
interface Database {
	dataSource: DataSource;
	orm: MikroORM;
	uuidType: string;
	dateType: string;
	close: () => Promise<void>;
}

/** One SQLite file, opened by both ORMs. */
async function sqlite(): Promise<Database> {
	const file = path.join(os.tmpdir(), `gauzy-time-log-tags-filter-${process.pid}-${Date.now()}.sqlite3`);
	const dataSource = new DataSource({ type: 'better-sqlite3', database: file });
	await dataSource.initialize();
	const orm = await MikroORM.init<BetterSqliteDriver>({
		driver: BetterSqliteDriver,
		dbName: file,
		entities: [TimeLogRowSchema],
		allowGlobalContext: true
	});
	return {
		dataSource,
		orm,
		uuidType: 'varchar',
		dateType: 'datetime',
		close: async () => {
			await orm.close(true);
			await dataSource.destroy();
			fs.rmSync(file, { force: true });
		}
	};
}

/** A schema of its own in the PostgreSQL database given, which both ORMs search first, and which is dropped after. */
async function postgres(url: string): Promise<Database> {
	const schema = `time_log_tags_spec_${process.pid}_${Date.now()}`;
	const searchPath = `-c search_path=${schema}`;
	const dataSource = new DataSource({ type: 'postgres', url, extra: { options: searchPath } });
	await dataSource.initialize();
	await dataSource.query(`CREATE SCHEMA "${schema}"`);
	const orm = await MikroORM.init<PostgreSqlDriver>({
		driver: PostgreSqlDriver,
		clientUrl: url,
		entities: [TimeLogRowSchema],
		allowGlobalContext: true,
		driverOptions: { connection: { options: searchPath } }
	});
	return {
		dataSource,
		orm,
		uuidType: 'uuid',
		dateType: 'timestamp',
		close: async () => {
			await orm.close(true);
			await dataSource.query(`DROP SCHEMA "${schema}" CASCADE`);
			await dataSource.destroy();
		}
	};
}

/** The ids of the logs a TypeORM read keeps, in order. */
async function typeOrmRead(dataSource: DataSource, filter: Filter): Promise<string[]> {
	const { condition, parameters } = timeLogTagsCondition('"time_log"."id"', filter);
	const rows: Array<{ id: string }> = await dataSource
		.createQueryBuilder()
		.select('"time_log"."id"', 'id')
		.from('time_log', 'time_log')
		.where(condition, parameters)
		.orderBy('"time_log"."id"', 'ASC')
		.getRawMany();
	return rows.map((row) => String(row.id));
}

/** The ids of the logs a MikroORM read keeps, in order. */
async function mikroOrmRead(orm: MikroORM, filter: Filter): Promise<string[]> {
	const where = { [mikroOrmTimeLogTagsKey(filter)]: [] };
	const rows = await orm.em.fork().find(TimeLogRowSchema, where as any, { orderBy: { id: 'asc' } });
	return rows.map((row) => String(row.id));
}

function exercise(open: () => Promise<Database>): void {
	let database: Database;

	beforeAll(async () => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		database = await open();
		const { dataSource, uuidType, dateType } = database;
		await dataSource.query(`CREATE TABLE "time_log" ("id" ${uuidType} PRIMARY KEY NOT NULL)`);
		await dataSource.query(
			`CREATE TABLE "tag" ("id" ${uuidType} PRIMARY KEY NOT NULL, "deletedAt" ${dateType} NULL)`
		);
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new CreateTagTimeLogTable1791000019250().up(queryRunner);
		} finally {
			await queryRunner.release();
		}
		const logs = [MEETING_LOG, SUPPORT_LOG, DELETED_TAG_LOG, BARE_LOG];
		await dataSource.query(`INSERT INTO "time_log" ("id") VALUES ${logs.map((id) => `('${id}')`).join(', ')}`);
		await dataSource.query(
			`INSERT INTO "tag" ("id", "deletedAt") VALUES ('${MEETING}', NULL), ('${SUPPORT}', NULL), ` +
				`('${DELETED}', '2026-11-01 00:00:00')`
		);
		await dataSource.query(
			`INSERT INTO "tag_time_log" ("timeLogId", "tagId") VALUES ` +
				LINKS.map(([timeLogId, tagId]) => `('${timeLogId}', '${tagId}')`).join(', ')
		);
	}, TIMEOUT);

	afterAll(async () => {
		await database?.close();
		jest.restoreAllMocks();
	});

	describe.each<['TypeORM' | 'MikroORM']>([['TypeORM'], ['MikroORM']])('through %s', (name) => {
		const read = (filter: Filter): Promise<string[]> =>
			name === 'TypeORM' ? typeOrmRead(database.dataSource, filter) : mikroOrmRead(database.orm, filter);

		it('keeps the logs of a tag asked as stored', async () => {
			expect(await read({ tagIds: [MEETING] })).toEqual([MEETING_LOG]);
		});

		it('keeps the logs of a tag asked in capitals', async () => {
			expect(await read({ tagIds: [MEETING.toUpperCase()] })).toEqual([MEETING_LOG]);
		});

		it('keeps each log once when the tag is asked in both spellings, or beside another tag', async () => {
			expect(await read({ tagIds: [MEETING.toUpperCase(), MEETING] })).toEqual([MEETING_LOG]);
			expect(await read({ tagIds: [MEETING.toUpperCase(), SUPPORT] })).toEqual([MEETING_LOG, SUPPORT_LOG]);
		});

		it('keeps the logs without a live tag, alone or beside a tag asked in capitals', async () => {
			expect(await read({ untagged: true })).toEqual([DELETED_TAG_LOG, BARE_LOG]);
			expect(await read({ tagIds: [MEETING.toUpperCase()], untagged: true })).toEqual([
				MEETING_LOG,
				DELETED_TAG_LOG,
				BARE_LOG
			]);
		});

		it('keeps no log for a deleted tag, in whatever case it is asked', async () => {
			expect(await read({ tagIds: [DELETED] })).toEqual([]);
			expect(await read({ tagIds: [DELETED.toUpperCase()] })).toEqual([]);
		});
	});
}

describe('The time log tag filter on SQLite', () => {
	exercise(sqlite);
});

(POSTGRES_URL ? describe : describe.skip)('The time log tag filter on PostgreSQL', () => {
	exercise(() => postgres(POSTGRES_URL));
});
