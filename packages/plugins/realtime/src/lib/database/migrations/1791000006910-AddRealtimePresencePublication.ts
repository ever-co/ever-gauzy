import { MigrationInterface, QueryRunner } from 'typeorm';
import { dialectOf, lockMigrations, q, RealtimeDialect } from '../migration-helpers';

/** The two columns, in each dialect's spelling: when the organization was last told, and which revision. */
const COLUMNS: Array<{ name: string; definition: Record<RealtimeDialect, string> }> = [
	{ name: 'publishedAt', definition: { postgres: 'TIMESTAMP', mysql: 'datetime(6) NULL', sqlite: 'datetime' } },
	{
		name: 'publishedRevision',
		definition: { postgres: 'integer NOT NULL DEFAULT 0', mysql: 'int NOT NULL DEFAULT 0', sqlite: 'integer NOT NULL DEFAULT (0)' }
	}
];

/** Whether the table has a column of that name. */
async function hasColumn(queryRunner: QueryRunner, table: string, name: string): Promise<boolean> {
	const d = dialectOf(queryRunner);
	if (d === 'postgres') {
		const rows = await queryRunner.query(
			`SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
			[table, name]
		);
		return rows.length > 0;
	}
	if (d === 'mysql') {
		const rows = await queryRunner.query(
			'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
			[table, name]
		);
		return rows.length > 0;
	}
	const rows: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info("${table}")`);
	return rows.some((row) => row.name === name);
}

/**
 * `realtime_presence` remembers when the organization was last told of each employee's presence, and which revision
 * (`publishedAt`, `publishedRevision` on the published row), so `presence.changed` is told at most once per employee
 * per 5 s across API processes (spec §4 Performance; `RealtimePresenceStore.claimPublication`).
 *
 * Additive and idempotent on every dialect: a column is added only when missing (`ALTER TABLE … ADD COLUMN`, which
 * SQLite supports for a nullable column and a constant default). Existing published rows start at revision 0 told:
 * their current state is told once, at the next change or sweep. Runs only where the realtime plugin loads. `down`
 * drops the two columns.
 */
export class AddRealtimePresencePublication1791000006910 implements MigrationInterface {
	name = 'AddRealtimePresencePublication1791000006910';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		const d = dialectOf(queryRunner);
		for (const column of COLUMNS) {
			if (await hasColumn(queryRunner, 'realtime_presence', column.name)) continue;
			await queryRunner.query(`ALTER TABLE ${q(d, 'realtime_presence')} ADD COLUMN ${q(d, column.name)} ${column.definition[d]}`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		const d = dialectOf(queryRunner);
		for (const column of COLUMNS) {
			if (!(await hasColumn(queryRunner, 'realtime_presence', column.name))) continue;
			await queryRunner.query(`ALTER TABLE ${q(d, 'realtime_presence')} DROP COLUMN ${q(d, column.name)}`);
		}
	}
}
