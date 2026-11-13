import { MigrationInterface, QueryRunner } from 'typeorm';
import { dialectOf } from '../migration-helpers';

const TABLE = 'chat_message';
const COLUMN = 'nonce';
/** The collation that compares a key byte for byte, as `1791000008300` gives a click's `idempotencyKey`. */
export const CHAT_NONCE_BINARY_COLLATION = 'utf8mb4_bin';

/**
 * `chat_message.nonce` compared byte for byte on MySQL, as it is on Postgres and SQLite.
 *
 * The column holds a member's send nonce (unique per author, `UQ_chat_message_author_nonce`) and an incoming webhook's
 * `nonce` / `Idempotency-Key` (unique per webhook, `UQ_chat_message_webhook_nonce`, migration `1791000006730`).
 * `1791000006100` made it a plain `varchar(64)`, so on MySQL it took the table's collation, and MySQL's default
 * collations ignore letter case: a second post whose key differs from the first only in case (`Key-A`, `key-a`) was
 * found as the first one's retry and answered with it, and never written.
 *
 * MySQL only: Postgres and SQLite compare text byte for byte already, and get no statement. Guarded and idempotent (the
 * column's collation is read first: a column that is already binary, or missing, is left as it is; two processes that
 * both read it as not binary write the same definition twice, which changes nothing) and reversible
 * (`down` gives the column back the table's collation, which it had before). A binary collation never makes two
 * stored keys equal that were not, so the unique indexes refuse no existing row.
 */
export class ChatMessageNonceBinaryCollation1791000008700 implements MigrationInterface {
	name = 'ChatMessageNonceBinaryCollation1791000008700';

	public async up(queryRunner: QueryRunner): Promise<void> {
		if (dialectOf(queryRunner) !== 'mysql') return;
		const collation = await nonceCollation(queryRunner);
		if (collation === null || collation === CHAT_NONCE_BINARY_COLLATION) return;
		// Constant identifiers and types: no value of anyone's goes into the statement.
		await queryRunner.query(
			`ALTER TABLE \`${TABLE}\` MODIFY COLUMN \`${COLUMN}\` varchar(64) CHARACTER SET utf8mb4 COLLATE ${CHAT_NONCE_BINARY_COLLATION} NULL`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		if (dialectOf(queryRunner) !== 'mysql') return;
		if ((await nonceCollation(queryRunner)) !== CHAT_NONCE_BINARY_COLLATION) return;
		// Without a character set or a collation, the column takes the table's again, as `1791000006100` made it.
		await queryRunner.query(`ALTER TABLE \`${TABLE}\` MODIFY COLUMN \`${COLUMN}\` varchar(64) NULL`);
	}
}

/** The MySQL collation of `chat_message.nonce`, or null when the column is not there. */
async function nonceCollation(queryRunner: QueryRunner): Promise<string | null> {
	const rows = (await queryRunner.query(
		'SELECT COLLATION_NAME AS columnCollation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
		[TABLE, COLUMN]
	)) as Array<{ columnCollation?: string | null }>;
	if (!rows.length) return null;
	return rows[0].columnCollation ?? '';
}
