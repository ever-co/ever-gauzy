import { MigrationInterface, QueryRunner } from 'typeorm';
import { createIndexIfMissing, createTableIfMissing, dropTableIfExists, IndexSpec, lockMigrations, q, RealtimeDialect, TableSpec } from '../migration-helpers';

/** Each dialect's spelling of an id column and of a timestamp column, as the platform's own migrations write them. */
const UUID_TYPE: Record<RealtimeDialect, string> = { postgres: 'uuid', mysql: 'varchar(36)', sqlite: 'varchar' };
const TIMESTAMP_TYPE: Record<RealtimeDialect, string> = { postgres: 'TIMESTAMP', mysql: 'datetime(6)', sqlite: 'datetime' };

/** Each dialect's spelling of a counter that starts at zero. */
const COUNTER_TYPE: Record<RealtimeDialect, string> = { postgres: 'integer NOT NULL DEFAULT 0', mysql: 'int NOT NULL DEFAULT 0', sqlite: 'integer NOT NULL DEFAULT (0)' };

/** A column of the dialect: `uuid`, a bounded `varchar`, a timestamp, or a counter. */
function column(d: RealtimeDialect, name: string, kind: 'uuid' | 'ts' | 'counter' | `varchar(${number})`, required: boolean): string {
	if (kind === 'counter') return `${q(d, name)} ${COUNTER_TYPE[d]}`;
	let type: string = kind;
	if (kind === 'uuid') type = UUID_TYPE[d];
	else if (kind === 'ts') type = TIMESTAMP_TYPE[d];
	let nullability = '';
	if (required) nullability = ' NOT NULL';
	else if (d === 'mysql') nullability = ' NULL';
	return `${q(d, name)} ${type}${nullability}`;
}

/** `realtime_presence`: per-connection presence, and each employee's published presence (`RealtimePresence`). */
export const REALTIME_PRESENCE_TABLE: TableSpec = {
	table: 'realtime_presence',
	prefix: 'realtime_presence',
	columns: (d: RealtimeDialect) =>
		[
			column(d, 'employeeId', 'uuid', true),
			column(d, 'userId', 'uuid', true),
			column(d, 'connectionId', 'varchar(64)', true),
			column(d, 'status', 'varchar(16)', true),
			column(d, 'expiresAt', 'ts', false),
			column(d, 'revision', 'counter', true)
		].join(', '),
	indexes: [
		{ name: 'UQ_realtime_presence_connection', columns: ['tenantId', 'employeeId', 'connectionId'], unique: true },
		{ name: 'IDX_realtime_presence_expires', columns: ['expiresAt'] }
	] as IndexSpec[],
	foreignKeys: [{ name: 'FK_realtime_presence_employee', column: 'employeeId', references: 'employee' }]
};

/** `realtime_replay_watermark`: the newest outbox position a retention removed, per scope (`RealtimeReplayWatermark`). */
export const REALTIME_REPLAY_WATERMARK_TABLE: TableSpec = {
	table: 'realtime_replay_watermark',
	prefix: 'realtime_replay_watermark',
	columns: (d: RealtimeDialect) =>
		[column(d, 'scopeKey', 'varchar(64)', true), column(d, 'prunedAt', 'ts', true), column(d, 'prunedEventId', 'uuid', true)].join(', '),
	indexes: [{ name: 'UQ_realtime_replay_watermark_scope', columns: ['tenantId', 'scopeKey'], unique: true }] as IndexSpec[],
	foreignKeys: []
};

/**
 * The real-time plugin's first tables (it owned none before):
 *
 * - `realtime_presence` keeps presence per connection, so an employee with two tabs who closes one stays as present as
 *   the other tab says (spec FR-7), and holds the presence last published for each employee, so a change is told once;
 * - `realtime_replay_watermark` records how far a retention removed the outbox rows of a scope, which is what a
 *   catch-up compares a cursor with to answer `resync` (spec FR-3).
 *
 * Additive and idempotent on every dialect (a table or an index is created only when missing). It runs only where the
 * plugin loads (`GAUZY_REALTIME_ENABLED=true`): a deployment without the plugin never registers it. `down` drops both
 * tables (presence is transient; a dropped watermark makes the catch-up trust what is retained, as before this table).
 */
export class CreateRealtimePresenceAndWatermarkTables1791000006820 implements MigrationInterface {
	name = 'CreateRealtimePresenceAndWatermarkTables1791000006820';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		for (const spec of [REALTIME_PRESENCE_TABLE, REALTIME_REPLAY_WATERMARK_TABLE]) {
			await createTableIfMissing(queryRunner, spec);
			for (const index of spec.indexes) {
				await createIndexIfMissing(queryRunner, spec.table, index);
			}
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, REALTIME_REPLAY_WATERMARK_TABLE.table);
		await dropTableIfExists(queryRunner, REALTIME_PRESENCE_TABLE.table);
	}
}
