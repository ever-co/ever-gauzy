import { DataSource } from 'typeorm';
import { TimeLogType } from '@gauzy/contracts';

/** One day of a member: work from 9 to 12, a break from 12 to 13, work from 13 to 17. Seven hours of work. */
const DAY_WITH_A_BREAK: [string, string, TimeLogType][] = [
	['2026-11-16 09:00:00', '2026-11-16 12:00:00', TimeLogType.TRACKED],
	['2026-11-16 12:00:00', '2026-11-16 13:00:00', TimeLogType.BREAK],
	['2026-11-16 13:00:00', '2026-11-16 17:00:00', TimeLogType.MANUAL]
];

/**
 * Runs a sum expression over a `time_log` table on SQLite (in memory) holding a day with a one-hour break, and
 * answers what it sums, in the unit of the expression.
 *
 * @param expression The SQL expression, which reads the table under the alias `time_log`.
 */
export async function sumOverDayWithABreak(expression: string): Promise<number> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		synchronize: false,
		logging: false
	});
	await dataSource.initialize();
	try {
		await dataSource.query(
			'CREATE TABLE "time_log" ("startedAt" datetime, "stoppedAt" datetime, "logType" varchar)'
		);
		for (const row of DAY_WITH_A_BREAK) {
			await dataSource.query('INSERT INTO "time_log" VALUES (?, ?, ?)', row);
		}
		const [result] = await dataSource.query(`SELECT ${expression} AS "duration" FROM "time_log"`);
		return Number(result.duration);
	} finally {
		await dataSource.destroy();
	}
}
