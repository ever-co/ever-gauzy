import { MigrationInterface, QueryRunner } from 'typeorm';
import { dialectOf } from '../migration-helpers';

const TABLE = 'chat_message';
const COLUMN = 'nonce';

/**
 * The case-sensitive collations the nonce can take, the first one the server has taken. None of them makes two stored
 * keys equal that the server's own collations took apart, so no unique index refuses a row when the column moves:
 * - `utf8mb4_0900_bin` (MySQL 8.0.17+) and `utf8mb4_nopad_bin` (MariaDB 10.2+): byte for byte and NO PAD, so a trailing
 *   space counts, as it does under MySQL 8's default `utf8mb4_0900_ai_ci`. Byte equality is the finest comparison there is.
 * - `utf8mb4_0900_as_cs` (MySQL 8.0.1 to 8.0.16, which have the NO PAD `utf8mb4_0900_ai_ci` but no `utf8mb4_0900_bin`):
 *   NO PAD, case- and accent-sensitive, and finer than every other `utf8mb4_0900_*` collation, the default included.
 * - `utf8mb4_bin` (every server): byte for byte, but trailing spaces ignored. Taken only on a server with none of the
 *   above (MySQL 5.7, MariaDB before 10.2), whose collations all ignore trailing spaces already.
 */
export const CHAT_NONCE_COLLATIONS = [
	'utf8mb4_0900_bin',
	'utf8mb4_nopad_bin',
	'utf8mb4_0900_as_cs',
	'utf8mb4_bin'
] as const;

/**
 * `chat_message.nonce` compared case-sensitively on MySQL (byte for byte wherever the server allows), as it is on
 * Postgres and SQLite.
 *
 * The column holds a member's send nonce (unique per author, `UQ_chat_message_author_nonce`) and an incoming webhook's
 * `nonce` / `Idempotency-Key` (unique per webhook, `UQ_chat_message_webhook_nonce`, migration `1791000006730`).
 * `1791000006100` made it a plain `varchar(64)`, so on MySQL it took the table's collation, and MySQL's default
 * collations ignore letter case: a second post whose key differs from the first only in case (`Key-A`, `key-a`) was
 * found as the first one's retry and answered with it, and never written.
 *
 * MySQL only: Postgres and SQLite compare text byte for byte already, and get no statement. Guarded and idempotent (the
 * column's collation is read first: a column already at the chosen collation, or missing, is left as it is; two
 * processes that both read it as not there yet write the same definition twice, which changes nothing).
 *
 * Reversible: `down` gives the column back the table's collation, which it had before. That refuses (and changes
 * nothing: the `ALTER` is atomic) while two keys of one author or one webhook differ only in letter case, since the
 * case-insensitive collation takes them for one key; the error says so, and clearing the later row's `nonce` is the
 * cleanup that lets the rollback run.
 */
export class ChatMessageNonceBinaryCollation1791000008700 implements MigrationInterface {
	name = 'ChatMessageNonceBinaryCollation1791000008700';

	public async up(queryRunner: QueryRunner): Promise<void> {
		if (dialectOf(queryRunner) !== 'mysql') return;
		const collation = await nonceCollation(queryRunner);
		if (collation === null) return;
		const binary = await caseSensitiveCollation(queryRunner);
		if (collation === binary) return;
		// Constant identifiers and type; the collation is one of the constant names above. No value of anyone's goes in.
		await queryRunner.query(
			`ALTER TABLE \`${TABLE}\` MODIFY COLUMN \`${COLUMN}\` varchar(64) CHARACTER SET utf8mb4 COLLATE ${binary} NULL`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		if (dialectOf(queryRunner) !== 'mysql') return;
		const collation = await nonceCollation(queryRunner);
		if (!(CHAT_NONCE_COLLATIONS as readonly string[]).includes(collation ?? '')) return;
		try {
			// Without a character set or a collation, the column takes the table's again, as `1791000006100` made it.
			await queryRunner.query(`ALTER TABLE \`${TABLE}\` MODIFY COLUMN \`${COLUMN}\` varchar(64) NULL`);
		} catch (error) {
			if (!isDuplicateKey(error)) throw error;
			throw Object.assign(
				new Error(
					`${ChatMessageNonceBinaryCollation1791000008700.name} cannot be reverted: two messages of one author or one ` +
						'webhook have nonces that differ only in letter case (or trailing spaces), which the table collation ' +
						'takes for one key. Set the later message’s nonce to NULL, then revert again. The column is unchanged.'
				),
				{ cause: error }
			);
		}
	}
}

/** The MySQL collation of `chat_message.nonce`, or null when the column is not there (or holds no text). */
async function nonceCollation(queryRunner: QueryRunner): Promise<string | null> {
	const rows = (await queryRunner.query(
		'SELECT COLLATION_NAME AS columnCollation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
		[TABLE, COLUMN]
	)) as Array<{ columnCollation?: string | null }>;
	return rows[0]?.columnCollation ?? null;
}

/** The first of {@link CHAT_NONCE_COLLATIONS} the server has (`utf8mb4_bin` is on every server). */
async function caseSensitiveCollation(queryRunner: QueryRunner): Promise<(typeof CHAT_NONCE_COLLATIONS)[number]> {
	const noPad = CHAT_NONCE_COLLATIONS.slice(0, 3);
	const rows = (await queryRunner.query(
		'SELECT COLLATION_NAME AS collationName FROM information_schema.COLLATIONS WHERE COLLATION_NAME IN (?, ?, ?)',
		[...noPad]
	)) as Array<{ collationName?: string }>;
	const available = new Set(rows.map((row) => row.collationName));
	return noPad.find((name) => available.has(name)) ?? 'utf8mb4_bin';
}

/** Whether MySQL refused a statement for a duplicate key (`ER_DUP_ENTRY`, 1062), on the error or on its driver error. */
function isDuplicateKey(error: unknown): boolean {
	const failure = error as {
		errno?: unknown;
		code?: unknown;
		driverError?: { errno?: unknown; code?: unknown };
	} | null;
	return [failure?.errno, failure?.code, failure?.driverError?.errno, failure?.driverError?.code]
		.map((code) => String(code ?? ''))
		.some((code) => code === '1062' || code === 'ER_DUP_ENTRY');
}
