import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	addForeignKeyIfMissing,
	baseColumns,
	baseForeignKeys,
	baseIndexes,
	createIndexIfMissing,
	dialectOf,
	dropTableIfExists,
	InboxDialect,
	IndexSpec,
	lockMigrations,
	q,
	sqliteForeignKeys
} from '../migration-helpers';

const TABLE = 'inbox_delivery';
const PREFIX = 'inbox_delivery';

/** The delivery's own keys: its entry and its user; a row goes with either. */
export const INBOX_DELIVERY_FOREIGN_KEYS = [
	{ name: `FK_${PREFIX}_item`, column: 'inboxItemId', references: 'inbox_item', onDelete: 'CASCADE' as const },
	{ name: `FK_${PREFIX}_user`, column: 'userId', references: 'user', onDelete: 'CASCADE' as const }
];

/** The delivery's own columns, after the base columns, per dialect. */
export function inboxDeliveryColumns(d: InboxDialect): string {
	const uuid = d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar(36)' : 'varchar';
	const ts = d === 'postgres' ? 'TIMESTAMP' : 'datetime';
	const nul = d === 'mysql' ? ' NULL' : '';
	const c = (name: string) => q(d, name);
	return [
		`${c('inboxItemId')} ${uuid} NOT NULL`,
		`${c('userId')} ${uuid} NOT NULL`,
		`${c('employeeId')} ${uuid}${nul}`,
		`${c('channel')} varchar(16) NOT NULL`,
		`${c('mode')} varchar(16) NOT NULL`,
		`${c('notificationType')} varchar(32)${nul}`,
		`${c('dueAt')} ${ts}${nul}`,
		`${c('digestKey')} varchar(16)${nul}`,
		`${c('sentAt')} ${ts}${nul}`,
		`${c('attempts')} int NOT NULL DEFAULT 0`,
		`${c('nextAttemptAt')} ${ts}${nul}`,
		`${c('lastError')} text${nul}`,
		`${c('failedAt')} ${ts}${nul}`
	].join(', ');
}

export const INBOX_DELIVERY_INDEXES: IndexSpec[] = [
	...baseIndexes(PREFIX),
	{ name: `UQ_${PREFIX}_item_user_channel`, columns: ['inboxItemId', 'userId', 'channel'], unique: true },
	// The sweep's reads: what is due (by mode), and a person's digest rows.
	{ name: `IDX_${PREFIX}_mode_sent_due`, columns: ['mode', 'sentAt', 'dueAt'] },
	{ name: `IDX_${PREFIX}_user_mode_sent`, columns: ['userId', 'mode', 'sentAt'] }
];

/**
 * `inbox_delivery` (the Inbox spec, "Preferences and channels" / FR-12): the delivery lane's outbox, one row per
 * entry, person and channel. Same rules as the Inbox's other tables: registered only with the plugin that reads it,
 * idempotent, serialised on Postgres, reversible.
 */
export class CreateInboxDeliveryTable1791000005300 implements MigrationInterface {
	name = 'CreateInboxDeliveryTable1791000005300';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		if (d === 'postgres') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${inboxDeliveryColumns(d)}, CONSTRAINT "PK_${PREFIX}" PRIMARY KEY ("id"))`
			);
		} else if (d === 'mysql') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${baseColumns(d)}, ${inboxDeliveryColumns(d)}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		} else {
			const own = INBOX_DELIVERY_FOREIGN_KEYS.map(
				(fk) =>
					`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE NO ACTION`
			).join(', ');
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${inboxDeliveryColumns(d)}, ${sqliteForeignKeys(PREFIX)}, ${own})`
			);
		}
		for (const index of INBOX_DELIVERY_INDEXES) {
			await createIndexIfMissing(queryRunner, TABLE, index);
		}
		for (const fk of [...baseForeignKeys(PREFIX), ...INBOX_DELIVERY_FOREIGN_KEYS]) {
			await addForeignKeyIfMissing(queryRunner, TABLE, fk);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
