import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { CreateTagTimeLogTable1791000019250 } from './migrations/1791000019250-CreateTagTimeLogTable';

/**
 * `tag_time_log`, run for real on SQLite against a minimal fixture of the two tables it points at: it links logs and
 * tags, deleting either side removes its links and nothing else, an up that runs again changes nothing, and down
 * removes the table without touching a log or a tag.
 */
describe('tag_time_log migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;
	const migration = new CreateTagTimeLogTable1791000019250();

	const tables = async (): Promise<string[]> =>
		(await dataSource.query(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)).map(
			(row: { name: string }) => row.name
		);

	const links = async (): Promise<Array<{ timeLogId: string; tagId: string }>> =>
		dataSource.query(`SELECT "timeLogId", "tagId" FROM "tag_time_log" ORDER BY "timeLogId", "tagId"`);

	const run = async (step: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await migration[step](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-tag-time-log-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query('PRAGMA foreign_keys = ON');
		await dataSource.query('CREATE TABLE "time_log" ("id" varchar PRIMARY KEY NOT NULL, "duration" integer)');
		await dataSource.query('CREATE TABLE "tag" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar)');
		await dataSource.query(`INSERT INTO "time_log" VALUES ('tuesday-meeting', 7200), ('tuesday-design', 10800)`);
		await dataSource.query(`INSERT INTO "tag" VALUES ('meeting', 'meeting'), ('design', 'design')`);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	it('links a log to its tags, once each', async () => {
		await run('up');

		await dataSource.query(
			`INSERT INTO "tag_time_log" VALUES ('tuesday-meeting', 'meeting'), ('tuesday-design', 'design'), ` +
				`('tuesday-design', 'meeting')`
		);

		expect(await links()).toEqual([
			{ timeLogId: 'tuesday-design', tagId: 'design' },
			{ timeLogId: 'tuesday-design', tagId: 'meeting' },
			{ timeLogId: 'tuesday-meeting', tagId: 'meeting' }
		]);
		await expect(
			dataSource.query(`INSERT INTO "tag_time_log" VALUES ('tuesday-meeting', 'meeting')`)
		).rejects.toThrow();
	});

	it('takes a deleted tag off every log, and keeps the logs and their durations', async () => {
		await run('up');
		await dataSource.query(
			`INSERT INTO "tag_time_log" VALUES ('tuesday-meeting', 'meeting'), ('tuesday-design', 'design')`
		);

		await dataSource.query(`DELETE FROM "tag" WHERE "id" = 'design'`);

		expect(await links()).toEqual([{ timeLogId: 'tuesday-meeting', tagId: 'meeting' }]);
		expect(await dataSource.query(`SELECT "id", "duration" FROM "time_log" ORDER BY "id"`)).toEqual([
			{ id: 'tuesday-design', duration: 10800 },
			{ id: 'tuesday-meeting', duration: 7200 }
		]);
	});

	it('takes a deleted log out of the table, and keeps its tags', async () => {
		await run('up');
		await dataSource.query(`INSERT INTO "tag_time_log" VALUES ('tuesday-meeting', 'meeting')`);

		await dataSource.query(`DELETE FROM "time_log" WHERE "id" = 'tuesday-meeting'`);

		expect(await links()).toEqual([]);
		expect(await dataSource.query(`SELECT COUNT(*) AS "count" FROM "tag"`)).toEqual([{ count: 2 }]);
	});

	it('runs up again without changing anything, and down then up again', async () => {
		await run('up');
		await dataSource.query(`INSERT INTO "tag_time_log" VALUES ('tuesday-meeting', 'meeting')`);
		await run('up');
		expect(await links()).toEqual([{ timeLogId: 'tuesday-meeting', tagId: 'meeting' }]);

		await run('down');
		expect(await tables()).toEqual(['tag', 'time_log']);
		expect(await dataSource.query(`SELECT COUNT(*) AS "count" FROM "time_log"`)).toEqual([{ count: 2 }]);

		await run('up');
		expect(await tables()).toEqual(['tag', 'tag_time_log', 'time_log']);
		expect(await links()).toEqual([]);
	});
});
