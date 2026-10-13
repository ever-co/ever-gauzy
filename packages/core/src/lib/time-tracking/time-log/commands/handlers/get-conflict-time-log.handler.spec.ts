// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { DataSource } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { overlapCondition } from './get-conflict-time-log.handler';

/**
 * A new time log conflicts with every existing log it overlaps. Only PostgreSQL tested a real overlap:
 * SQLite missed an existing log inside or around the new range, MySQL one overlapping either of its ends.
 */
describe('overlapCondition', () => {
	const start = '2026-10-12T10:00:00.000Z';
	const stop = '2026-10-12T11:00:00.000Z';

	it.each([DatabaseTypeEnum.sqlite, DatabaseTypeEnum.betterSqlite3])('uses a full overlap test on %s', (db) => {
		expect(overlapCondition(db, 'time_log', start, stop)).toBe(
			`"time_log"."startedAt" < '${stop}' AND "time_log"."stoppedAt" > '${start}'`
		);
	});

	it('uses the same overlap test on MySQL, with backtick-quoted identifiers', () => {
		expect(overlapCondition(DatabaseTypeEnum.mysql, 'time_log', start, stop)).toBe(
			`\`time_log\`.\`startedAt\` < '${stop}' AND \`time_log\`.\`stoppedAt\` > '${start}'`
		);
	});

	it('keeps OVERLAPS on PostgreSQL', () => {
		expect(overlapCondition(DatabaseTypeEnum.postgres, 'time_log', start, stop)).toContain('OVERLAPS');
	});

	it('rejects an unsupported database', () => {
		expect(() => overlapCondition('oracle' as DatabaseTypeEnum, 'time_log', start, stop)).toThrow();
	});
});

/**
 * The condition run against stored time logs (SQLite in memory; MySQL uses the same comparison).
 * New range: 10:00 - 11:00.
 */
describe('overlapCondition on stored time logs', () => {
	const at = (time: string) => `2026-10-12T${time}:00.000Z`;
	const logs = {
		inside: [at('10:15'), at('10:45')],
		enclosing: [at('09:00'), at('12:00')],
		overlapsStart: [at('09:30'), at('10:30')],
		overlapsEnd: [at('10:30'), at('11:30')],
		same: [at('10:00'), at('11:00')],
		touchesStart: [at('09:00'), at('10:00')],
		touchesEnd: [at('11:00'), at('12:00')],
		before: [at('08:00'), at('09:00')],
		after: [at('12:00'), at('13:00')]
	};

	let dataSource: DataSource;

	beforeAll(async () => {
		dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', logging: false });
		await dataSource.initialize();
		await dataSource.query('CREATE TABLE "time_log" ("id" varchar PRIMARY KEY, "startedAt" varchar, "stoppedAt" varchar)');
		for (const [id, [startedAt, stoppedAt]] of Object.entries(logs)) {
			await dataSource.query('INSERT INTO "time_log" VALUES (?, ?, ?)', [id, startedAt, stoppedAt]);
		}
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	it('returns every log overlapping the range, and none that only touches it', async () => {
		const condition = overlapCondition(DatabaseTypeEnum.betterSqlite3, 'time_log', at('10:00'), at('11:00'));
		const rows: { id: string }[] = await dataSource.query(
			`SELECT "id" FROM "time_log" WHERE ${condition} ORDER BY "id"`
		);

		expect(rows.map(({ id }) => id)).toEqual(['enclosing', 'inside', 'overlapsEnd', 'overlapsStart', 'same']);
	});
});
