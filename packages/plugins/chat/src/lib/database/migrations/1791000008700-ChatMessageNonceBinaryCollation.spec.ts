import { CHAT_MIGRATIONS } from '../chat-migrations';
import { CHAT_MESSAGE_WEBHOOK_INDEXES } from './1791000006730-CreateChatWebhooks';
import {
	CHAT_NONCE_COLLATIONS,
	ChatMessageNonceBinaryCollation1791000008700
} from './1791000008700-ChatMessageNonceBinaryCollation';

const COLUMN_PROBE = /^SELECT COLLATION_NAME AS columnCollation FROM information_schema\.COLUMNS /;
const COLLATIONS_PROBE = /^SELECT COLLATION_NAME AS collationName FROM information_schema\.COLLATIONS /;
const MERGE_PROBE = /^SELECT 1 AS merged FROM `chat_message` /;

/** The collations each kind of server has, of those the migration asks for. */
const SERVERS = {
	mysql8: ['utf8mb4_0900_bin'],
	mariadb: ['utf8mb4_nopad_bin'],
	/** MariaDB 11.4.5, which also answers to `utf8mb4_0900_bin`, as an alias of the padding `utf8mb4_bin` (MDEV-36361). */
	mariadb1145: ['utf8mb4_nopad_bin', 'utf8mb4_0900_bin'],
	/** MySQL 8.0.1 to 8.0.16: the NO PAD `utf8mb4_0900_*` collations, but no `utf8mb4_0900_bin`. */
	mysql80early: ['utf8mb4_0900_as_cs'],
	/** MySQL 5.7, MariaDB before 10.2: neither NO PAD binary collation. */
	old: [] as string[]
};

/**
 * A query runner of one dialect that records its statements. `collation` is what MySQL's `information_schema.COLUMNS`
 * answers for `chat_message.nonce` (`undefined` for no such column); `server` names the collations it has.
 */
function runner(
	type: 'postgres' | 'mysql' | 'mariadb' | 'better-sqlite3',
	collation?: string | null,
	server: string[] = SERVERS.mysql8,
	/** The key column (`authorUserId`, `webhookId`) under which the stored nonces would merge, if any. */
	mergesUnder?: string
) {
	const statements: string[] = [];
	const params: unknown[][] = [];
	return {
		statements,
		params,
		connection: { options: { type } },
		hasColumn: jest.fn(async () => collation !== undefined),
		query: jest.fn(async (sql: string, parameters?: unknown[]) => {
			statements.push(sql);
			params.push(parameters ?? []);
			if (COLUMN_PROBE.test(sql)) return collation === undefined ? [] : [{ columnCollation: collation }];
			if (MERGE_PROBE.test(sql))
				return mergesUnder && sql.includes(`GROUP BY \`${mergesUnder}\``) ? [{ merged: 1 }] : [];
			if (COLLATIONS_PROBE.test(sql)) {
				return server
					.filter((name) => (parameters ?? []).includes(name))
					.map((name) => ({ collationName: name }));
			}
			return [];
		})
	};
}

const ddl = (statements: string[]) => statements.filter((sql) => !sql.startsWith('SELECT'));
const mergeProbes = (statements: string[]) => statements.filter((sql) => MERGE_PROBE.test(sql));
const migration = () => new ChatMessageNonceBinaryCollation1791000008700();
const modifyTo = (collation: string) =>
	`ALTER TABLE \`chat_message\` MODIFY COLUMN \`nonce\` varchar(64) CHARACTER SET utf8mb4 COLLATE ${collation} NULL`;

describe('ChatMessageNonceBinaryCollation1791000008700', () => {
	it('makes the MySQL 8 nonce column binary and NO PAD, so trailing spaces still count, type and nullability unchanged', async () => {
		for (const tableCollation of ['utf8mb4_0900_ai_ci', 'utf8mb4_unicode_ci', 'utf8mb4_general_ci']) {
			const mysql = runner('mysql', tableCollation);
			await migration().up(mysql as never);
			expect(ddl(mysql.statements)).toEqual([modifyTo('utf8mb4_0900_bin')]);
			// The probes bind the table, the column and the collation names.
			expect(mysql.statements[0]).toMatch(COLUMN_PROBE);
			expect(mysql.params[0]).toEqual(['chat_message', 'nonce']);
			expect(mysql.statements[1]).toMatch(COLLATIONS_PROBE);
			// Byte for byte and NO PAD: nothing can merge, so no stored key is looked at.
			expect(mergeProbes(mysql.statements)).toEqual([]);
			expect(mysql.params[1]).toEqual(['utf8mb4_nopad_bin', 'utf8mb4_0900_bin', 'utf8mb4_0900_as_cs']);
		}
	});

	it('takes MariaDB’s NO PAD binary collation there, and utf8mb4_bin only on a server with neither', async () => {
		const mariadb = runner('mariadb', 'utf8mb4_general_ci', SERVERS.mariadb);
		await migration().up(mariadb as never);
		expect(ddl(mariadb.statements)).toEqual([modifyTo('utf8mb4_nopad_bin')]);
		// Where a MariaDB also answers to `utf8mb4_0900_bin` (a padding alias there), its own NO PAD name is taken.
		const aliased = runner('mariadb', 'utf8mb4_uca1400_ai_ci', SERVERS.mariadb1145);
		await migration().up(aliased as never);
		expect(ddl(aliased.statements)).toEqual([modifyTo('utf8mb4_nopad_bin')]);
		const old = runner('mysql', 'utf8mb4_general_ci', SERVERS.old);
		await migration().up(old as never);
		expect(ddl(old.statements)).toEqual([modifyTo('utf8mb4_bin')]);
		expect(CHAT_NONCE_COLLATIONS).toEqual([
			'utf8mb4_nopad_bin',
			'utf8mb4_0900_bin',
			'utf8mb4_0900_as_cs',
			'utf8mb4_bin'
		]);
	});

	it('keeps a NO PAD collation on MySQL 8.0 before 8.0.17, where utf8mb4_bin would merge keys that differ in trailing spaces', async () => {
		const early = runner('mysql', 'utf8mb4_0900_ai_ci', SERVERS.mysql80early);
		await migration().up(early as never);
		expect(ddl(early.statements)).toEqual([modifyTo('utf8mb4_0900_as_cs')]);
		const done = runner('mysql', 'utf8mb4_0900_as_cs', SERVERS.mysql80early);
		await migration().up(done as never);
		expect(ddl(done.statements)).toEqual([]);
		// From a collation that pads (the table's `utf8mb4_general_ci`, say), `utf8mb4_bin` adds no merge, where
		// `utf8mb4_0900_as_cs` would take `key` and `key` + U+200B for one key.
		for (const source of ['utf8mb4_general_ci', 'utf8mb4_unicode_ci']) {
			const padded = runner('mysql', source, SERVERS.mysql80early);
			await migration().up(padded as never);
			expect(ddl(padded.statements)).toEqual([modifyTo('utf8mb4_bin')]);
		}
	});

	it('changes nothing when the column is already at the binary collation, or is not there, or holds no text', async () => {
		for (const [collation, server] of [
			['utf8mb4_0900_bin', SERVERS.mysql8],
			['utf8mb4_nopad_bin', SERVERS.mariadb],
			['utf8mb4_0900_as_cs', SERVERS.mysql80early],
			['utf8mb4_bin', SERVERS.old]
		] as const) {
			const binary = runner('mysql', collation, [...server]);
			await migration().up(binary as never);
			await migration().up(binary as never);
			expect(ddl(binary.statements)).toEqual([]);
		}
		for (const collation of [undefined, null]) {
			const absent = runner('mysql', collation);
			await migration().up(absent as never);
			await migration().down(absent as never);
			expect(ddl(absent.statements)).toEqual([]);
		}
	});

	it('moves a column at any other collation, a binary one included, to the NO PAD one where the server has it', async () => {
		for (const source of ['utf8mb4_bin', 'utf8mb3_bin', 'latin1_bin', 'utf8mb4_0900_as_cs']) {
			const other = runner('mysql', source);
			await migration().up(other as never);
			expect(ddl(other.statements)).toEqual([modifyTo('utf8mb4_0900_bin')]);
		}
	});

	it('sends no statement at all on Postgres and SQLite, which compare text byte for byte already', async () => {
		for (const type of ['postgres', 'better-sqlite3'] as const) {
			const other = runner(type, 'C');
			await migration().up(other as never);
			await migration().down(other as never);
			expect(other.statements).toEqual([]);
		}
	});

	it('goes down to the table collation only from a binary one it sets', async () => {
		for (const collation of CHAT_NONCE_COLLATIONS) {
			const binary = runner('mysql', collation);
			await migration().down(binary as never);
			expect(ddl(binary.statements)).toEqual([
				'ALTER TABLE `chat_message` MODIFY COLUMN `nonce` varchar(64) NULL'
			]);
		}
		const already = runner('mysql', 'utf8mb4_0900_ai_ci');
		await migration().down(already as never);
		expect(ddl(already.statements)).toEqual([]);
	});

	it('says why a rollback is refused when two keys differ only in case, and raises anything else as it is', async () => {
		const colliding = runner('mysql', 'utf8mb4_0900_bin');
		const duplicate = Object.assign(
			new Error("Duplicate entry 'u1-key-a' for key 'UQ_chat_message_author_nonce'"),
			{
				code: 'ER_DUP_ENTRY',
				errno: 1062
			}
		);
		colliding.query.mockImplementation(async (sql: string) => {
			if (sql.startsWith('ALTER TABLE')) throw duplicate;
			return COLUMN_PROBE.test(sql) ? [{ columnCollation: 'utf8mb4_0900_bin' }] : [];
		});
		const refusal = (await migration()
			.down(colliding as never)
			.catch((error: unknown) => error)) as Error & { cause?: unknown };
		expect(refusal.message).toContain('differ only in letter case');
		expect(refusal.message).toContain('nonce to NULL');
		expect(refusal.cause).toBe(duplicate);

		const failing = runner('mysql', 'utf8mb4_0900_ai_ci');
		failing.query.mockImplementation(async (sql: string) => {
			if (sql.startsWith('ALTER TABLE')) throw new Error('lock wait timeout');
			return COLUMN_PROBE.test(sql) ? [{ columnCollation: 'utf8mb4_0900_ai_ci' }] : [];
		});
		await expect(migration().up(failing as never)).rejects.toThrow('lock wait timeout');
	});

	it('looks for keys the nearest collation would merge on an older server, and refuses the move if there are any', async () => {
		// A tailored NO PAD source (`utf8mb4_ja_0900_as_cs`) is NO PAD like the default: it takes utf8mb4_0900_as_cs.
		const early = runner('mysql', 'utf8mb4_ja_0900_as_cs', SERVERS.mysql80early);
		await migration().up(early as never);
		expect(ddl(early.statements)).toEqual([modifyTo('utf8mb4_0900_as_cs')]);
		expect(mergeProbes(early.statements)).toEqual([
			'SELECT 1 AS merged FROM `chat_message` WHERE `nonce` IS NOT NULL AND `authorUserId` IS NOT NULL GROUP BY `authorUserId`, CONVERT(`nonce` USING utf8mb4) COLLATE utf8mb4_0900_as_cs HAVING COUNT(*) > 1 LIMIT 1',
			'SELECT 1 AS merged FROM `chat_message` WHERE `nonce` IS NOT NULL AND `webhookId` IS NOT NULL GROUP BY `webhookId`, CONVERT(`nonce` USING utf8mb4) COLLATE utf8mb4_0900_as_cs HAVING COUNT(*) > 1 LIMIT 1'
		]);
		for (const [source, server, under] of [
			['utf8mb4_0900_ai_ci', SERVERS.mysql80early, 'authorUserId'],
			['utf8mb4_general_ci', SERVERS.old, 'webhookId']
		] as const) {
			const merging = runner('mysql', source, [...server], under);
			const refusal = (await migration()
				.up(merging as never)
				.catch((error: unknown) => error)) as Error;
			expect(refusal.message).toContain('would be one key');
			expect(refusal.message).toContain('MySQL 8.0.17+');
			expect(ddl(merging.statements)).toEqual([]);
		}
	});

	it('is registered with the chat plugin after every other chat migration', () => {
		expect(CHAT_MIGRATIONS[CHAT_MIGRATIONS.length - 1]).toBe(ChatMessageNonceBinaryCollation1791000008700);
		const timestamps = CHAT_MIGRATIONS.map((type) => Number(/(\d{13})$/.exec(type.name)?.[1]));
		expect([...timestamps].sort((a, b) => a - b)).toEqual(timestamps);
		expect(migration().name).toBe('ChatMessageNonceBinaryCollation1791000008700');
	});

	it('covers the column the webhook receive route deduplicates on', () => {
		// `POST /api/chat/hooks/:token` answers a repeated `nonce` / `Idempotency-Key` with the first post, through this key.
		expect(
			CHAT_MESSAGE_WEBHOOK_INDEXES.find((index) => index.name === 'UQ_chat_message_webhook_nonce')
		).toMatchObject({
			columns: ['webhookId', 'nonce'],
			unique: true
		});
	});
});
