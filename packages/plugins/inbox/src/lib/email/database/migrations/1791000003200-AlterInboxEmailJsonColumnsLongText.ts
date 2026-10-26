import { MigrationInterface, QueryRunner } from 'typeorm';
import { dialectOf, lockMigrations } from '../../../database/migration-helpers';

const TABLE = 'inbox_email';

/** The JSON text columns a received message fills: its address lists, its References chain and its kept headers. */
export const INBOX_EMAIL_JSON_COLUMNS = [
	'referenceIds',
	'sender',
	'toAddresses',
	'ccAddresses',
	'bccAddresses',
	'replyToAddresses',
	'headers'
] as const;

/** The most bytes a MySQL `text` column holds (`down` refuses while a value is longer). */
const MYSQL_TEXT_BYTES = 65_535;

/**
 * `inbox_email`'s JSON text columns become `longtext` on MySQL (review finding F109).
 *
 * MySQL's `text` stops at 64 KB, and a strict server refuses a longer value: a message with a long To or Cc list (a
 * large announcement without Bcc), a long References chain or long kept headers failed to store, and its webhook failed
 * for every retry. The inbound pipeline already cuts those lists to fit (#11094); with `longtext` the column is no
 * longer the limit. The body columns (`textBody`, `htmlSanitized`) were `longtext` from the start.
 *
 * - MySQL / MariaDB: one `ALTER TABLE … MODIFY` for the columns that are not `longtext` yet (MySQL commits it on its
 *   own; a re-run modifies nothing). `down` puts `text` back, and refuses first while a stored value is longer than
 *   `text` holds, rather than failing half-way.
 * - Postgres and SQLite: nothing to do. Their `text` has no such limit; both branches are explicit no-ops.
 *
 * Registered only where `GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true` load the Inbox email plugin.
 */
export class AlterInboxEmailJsonColumnsLongText1791000003200 implements MigrationInterface {
	name = 'AlterInboxEmailJsonColumnsLongText1791000003200';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await this.run(queryRunner, 'longtext');
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await this.run(queryRunner, 'text');
	}

	private async run(queryRunner: QueryRunner, type: 'longtext' | 'text'): Promise<void> {
		const dialect = dialectOf(queryRunner);
		if (dialect === 'postgres') {
			// Postgres `text` is unbounded: the column type stays.
			return;
		}
		if (dialect === 'sqlite') {
			// SQLite stores any length in a `text` column: the column type stays.
			return;
		}
		await lockMigrations(queryRunner);
		await this.mysql(queryRunner, type);
	}

	/** MySQL: modify the columns whose type differs from `type`, in one statement. */
	private async mysql(queryRunner: QueryRunner, type: 'longtext' | 'text'): Promise<void> {
		const rows: Array<{ name: string; type: string }> = await queryRunner.query(
			`SELECT \`COLUMN_NAME\` AS \`name\`, \`DATA_TYPE\` AS \`type\` FROM \`information_schema\`.\`COLUMNS\`
			WHERE \`TABLE_SCHEMA\` = DATABASE() AND \`TABLE_NAME\` = ? AND \`COLUMN_NAME\` IN (${INBOX_EMAIL_JSON_COLUMNS.map(() => '?').join(', ')})`,
			[TABLE, ...INBOX_EMAIL_JSON_COLUMNS]
		);
		const pending = INBOX_EMAIL_JSON_COLUMNS.filter((column) =>
			rows.some((row) => row.name === column && String(row.type).toLowerCase() !== type)
		);
		if (!pending.length) return;
		if (type === 'text') {
			const longer = pending.map((column) => `MAX(LENGTH(\`${column}\`)) AS \`${column}\``).join(', ');
			const [lengths] = (await queryRunner.query(`SELECT ${longer} FROM \`${TABLE}\``)) as Array<
				Record<string, number | string | null>
			>;
			const tooLong = pending.filter((column) => Number(lengths?.[column] ?? 0) > MYSQL_TEXT_BYTES);
			if (tooLong.length) {
				throw new Error(
					`${this.name}: cannot put ${TABLE}.${tooLong.join(', ')} back to text, a stored value is longer than ${MYSQL_TEXT_BYTES} bytes`
				);
			}
		}
		await queryRunner.query(
			`ALTER TABLE \`${TABLE}\` ${pending.map((column) => `MODIFY \`${column}\` ${type} NULL`).join(', ')}`
		);
	}
}
