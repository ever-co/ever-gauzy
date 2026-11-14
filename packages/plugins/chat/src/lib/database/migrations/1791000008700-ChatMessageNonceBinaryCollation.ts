import { MigrationInterface, QueryRunner } from 'typeorm';
import { dialectOf } from '../migration-helpers';

const TABLE = 'chat_message';
const COLUMN = 'nonce';

/**
 * The case-sensitive collations the nonce can take:
 * - `utf8mb4_nopad_bin` (MariaDB 10.2+) or `utf8mb4_0900_bin` (MySQL 8.0.17+), in that order: byte for byte and NO PAD,
 *   so a trailing space counts, as it does under MySQL 8's default `utf8mb4_0900_ai_ci`. Byte equality is the finest
 *   comparison there is, so moving to either from any collation never makes two stored keys equal. MariaDB's own name
 *   comes first: MariaDB 11.4.5 also answers to `utf8mb4_0900_bin`, as an alias of the padding `utf8mb4_bin` (MDEV-36361).
 * - Without them (MySQL 8.0.1 to 8.0.16, MySQL 5.7, MariaDB before 10.2, all past their end of life), the nearest one:
 *   - from a NO PAD collation (a `*_0900_*` one, MySQL 8.0's default among them), `utf8mb4_0900_as_cs`: NO PAD too, and
 *     case- and accent-sensitive;
 *   - from any other (PAD SPACE: trailing spaces ignored already), `utf8mb4_bin`: byte for byte, trailing spaces ignored
 *     as before.
 *   Neither is finer than every collation a column can have (`utf8mb4_0900_as_cs` ignores what some tell apart, such as
 *   a zero-width space or a decomposed accent), so on that path the stored keys are checked first, and a move that would
 *   take two of them for one is refused (see {@link ChatMessageNonceBinaryCollation1791000008700}).
 */
export const CHAT_NONCE_COLLATIONS = [
	'utf8mb4_nopad_bin',
	'utf8mb4_0900_bin',
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
 * On a server without a byte-for-byte NO PAD collation, two stored keys of one author or one webhook that the chosen
 * collation would take for one are looked for first; if there are any, the migration stops with an error that says so
 * and leaves the column as it is (upgrading the server, or clearing one of the two nonces, lets it run).
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
		const binary = await caseSensitiveCollation(queryRunner, collation);
		if (collation === binary) return;
		if (!BYTE_EXACT_NO_PAD.has(binary) && (await mergesStoredKeys(queryRunner, binary))) {
			throw new Error(
				`${ChatMessageNonceBinaryCollation1791000008700.name} cannot run on this server: under ${binary}, the nearest ` +
					'case-sensitive collation it has, two stored nonces of one author or one webhook would be one key. Upgrade ' +
					'to MySQL 8.0.17+ or MariaDB 10.2+ (whose byte-for-byte collation takes every key apart), or set one of ' +
					'the two nonces to NULL, then run it again. The column is unchanged.'
			);
		}
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

/** The byte-for-byte NO PAD collations: moving to one never makes two stored keys equal. */
const BYTE_EXACT_NO_PAD: ReadonlySet<string> = new Set(['utf8mb4_nopad_bin', 'utf8mb4_0900_bin']);

/** The unique keys the nonce is part of, by the column beside it. */
const NONCE_KEY_COLUMNS = ['authorUserId', 'webhookId'] as const;

/**
 * Whether two stored nonces of one author, or of one webhook, would be one key under `collation` (one of
 * {@link CHAT_NONCE_COLLATIONS}). A row without the author (or webhook) is in no such key.
 */
async function mergesStoredKeys(queryRunner: QueryRunner, collation: string): Promise<boolean> {
	for (const column of NONCE_KEY_COLUMNS) {
		// Constant identifiers; the collation is one of the constant names above.
		const rows = (await queryRunner.query(
			`SELECT 1 AS merged FROM \`${TABLE}\` WHERE \`${COLUMN}\` IS NOT NULL AND \`${column}\` IS NOT NULL ` +
				`GROUP BY \`${column}\`, CONVERT(\`${COLUMN}\` USING utf8mb4) COLLATE ${collation} HAVING COUNT(*) > 1 LIMIT 1`
		)) as unknown[];
		if (rows.length) return true;
	}
	return false;
}

/** Whether a MySQL or MariaDB collation is NO PAD: MySQL's UCA 9.0.0 (`*_0900_*`) ones, and MariaDB's `*_nopad_*` ones. */
function isNoPad(collation: string): boolean {
	return collation.includes('_0900_') || collation.includes('_nopad_');
}

/**
 * The collation of {@link CHAT_NONCE_COLLATIONS} the column moves to from `source`, among those the server has
 * (`utf8mb4_bin` is on every server).
 */
async function caseSensitiveCollation(
	queryRunner: QueryRunner,
	source: string
): Promise<(typeof CHAT_NONCE_COLLATIONS)[number]> {
	const probed = CHAT_NONCE_COLLATIONS.slice(0, 3);
	const rows = (await queryRunner.query(
		'SELECT COLLATION_NAME AS collationName FROM information_schema.COLLATIONS WHERE COLLATION_NAME IN (?, ?, ?)',
		[...probed]
	)) as Array<{ collationName?: string }>;
	const available = new Set(rows.map((row) => row.collationName));
	// MariaDB's name first: where a MariaDB answers to `utf8mb4_0900_bin` too, that is the padding `utf8mb4_bin`.
	const exact = (['utf8mb4_nopad_bin', 'utf8mb4_0900_bin'] as const).find((name) => available.has(name));
	if (exact) return exact;
	return available.has('utf8mb4_0900_as_cs') && isNoPad(source) ? 'utf8mb4_0900_as_cs' : 'utf8mb4_bin';
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
