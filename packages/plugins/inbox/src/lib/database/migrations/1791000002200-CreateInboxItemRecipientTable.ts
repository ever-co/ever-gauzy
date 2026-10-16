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

const TABLE = 'inbox_item_recipient';
const PREFIX = 'inbox_item_recipient';

/** The recipient's own keys: its item and its user; a recipient row goes with either. */
export const INBOX_RECIPIENT_FOREIGN_KEYS = [
	{ name: `FK_${PREFIX}_item`, column: 'inboxItemId', references: 'inbox_item', onDelete: 'CASCADE' as const },
	{ name: `FK_${PREFIX}_user`, column: 'userId', references: 'user', onDelete: 'CASCADE' as const }
];

/** The recipient's own columns, after the base columns, per dialect. */
export function inboxRecipientColumns(d: InboxDialect): string {
	const uuid = d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar(36)' : 'varchar';
	const ts = d === 'postgres' ? 'TIMESTAMP' : 'datetime';
	const bool = d === 'mysql' ? 'tinyint' : 'boolean';
	const falsy = d === 'postgres' ? 'DEFAULT false' : d === 'mysql' ? 'DEFAULT 0' : 'DEFAULT (0)';
	const nul = d === 'mysql' ? ' NULL' : '';
	const c = (name: string) => q(d, name);
	return [
		`${c('inboxItemId')} ${uuid} NOT NULL`,
		`${c('userId')} ${uuid} NOT NULL`,
		`${c('isRead')} ${bool} NOT NULL ${falsy}`,
		`${c('readAt')} ${ts}${nul}`,
		`${c('snoozedUntil')} ${ts}${nul}`,
		`${c('deliveredAt')} ${ts}${nul}`
	].join(', ');
}

export const INBOX_RECIPIENT_INDEXES: IndexSpec[] = [
	...baseIndexes(PREFIX),
	{ name: `IDX_${PREFIX}_item`, columns: ['inboxItemId'] },
	{ name: `IDX_${PREFIX}_user_read`, columns: ['userId', 'isRead'] },
	{ name: `UQ_${PREFIX}_item_user`, columns: ['inboxItemId', 'userId'], unique: true }
];

/**
 * `inbox_item_recipient` (plan 04 §2, G-P3-1): one row per user an item is addressed to, with that user's
 * read / archive / snooze state; unique on `(inboxItemId, userId)`. Same rules as the item table's migration:
 * registered only with the plugin, idempotent, serialised on Postgres, reversible.
 */
export class CreateInboxItemRecipientTable1791000002200 implements MigrationInterface {
	name = 'CreateInboxItemRecipientTable1791000002200';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		if (d === 'postgres') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${inboxRecipientColumns(d)}, CONSTRAINT "PK_${PREFIX}" PRIMARY KEY ("id"))`
			);
		} else if (d === 'mysql') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${baseColumns(d)}, ${inboxRecipientColumns(d)}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		} else {
			const own = INBOX_RECIPIENT_FOREIGN_KEYS.map(
				(fk) =>
					`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE NO ACTION`
			).join(', ');
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${inboxRecipientColumns(d)}, ${sqliteForeignKeys(PREFIX)}, ${own})`
			);
		}
		for (const index of INBOX_RECIPIENT_INDEXES) {
			await createIndexIfMissing(queryRunner, TABLE, index);
		}
		for (const fk of [...baseForeignKeys(PREFIX), ...INBOX_RECIPIENT_FOREIGN_KEYS]) {
			await addForeignKeyIfMissing(queryRunner, TABLE, fk);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
