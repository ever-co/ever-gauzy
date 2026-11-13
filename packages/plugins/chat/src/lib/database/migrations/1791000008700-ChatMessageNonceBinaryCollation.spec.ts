import { CHAT_MIGRATIONS } from '../chat-migrations';
import { CHAT_MESSAGE_WEBHOOK_INDEXES } from './1791000006730-CreateChatWebhooks';
import {
	CHAT_NONCE_BINARY_COLLATION,
	ChatMessageNonceBinaryCollation1791000008700
} from './1791000008700-ChatMessageNonceBinaryCollation';

const PROBE = /^SELECT COLLATION_NAME AS columnCollation FROM information_schema\.COLUMNS/;

/**
 * A query runner of one dialect that records its statements. `collation` is what MySQL's
 * `information_schema.COLUMNS` answers for `chat_message.nonce`: a collation, or `undefined` for no such column.
 */
function runner(type: 'postgres' | 'mysql' | 'mariadb' | 'better-sqlite3', collation?: string) {
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
			return PROBE.test(sql) && collation !== undefined ? [{ columnCollation: collation }] : [];
		})
	};
}

const ddl = (statements: string[]) => statements.filter((sql) => !sql.startsWith('SELECT'));
const migration = () => new ChatMessageNonceBinaryCollation1791000008700();

describe('ChatMessageNonceBinaryCollation1791000008700', () => {
	it('makes a case-insensitive MySQL nonce column binary, with its type and nullability unchanged', async () => {
		for (const defaultCollation of ['utf8mb4_0900_ai_ci', 'utf8mb4_unicode_ci', 'utf8mb4_general_ci']) {
			const mysql = runner('mysql', defaultCollation);
			await migration().up(mysql as never);
			expect(ddl(mysql.statements)).toEqual([
				'ALTER TABLE `chat_message` MODIFY COLUMN `nonce` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
			]);
			// The probe names the table and the column as bound values.
			expect(mysql.statements[0]).toMatch(PROBE);
			expect(mysql.params[0]).toEqual(['chat_message', 'nonce']);
		}
		expect(CHAT_NONCE_BINARY_COLLATION).toBe('utf8mb4_bin');
	});

	it('does the same on MariaDB, which runs as MySQL', async () => {
		const mariadb = runner('mariadb', 'utf8mb4_general_ci');
		await migration().up(mariadb as never);
		expect(ddl(mariadb.statements)).toHaveLength(1);
		expect(ddl(mariadb.statements)[0]).toContain('COLLATE utf8mb4_bin');
	});

	it('changes nothing on MySQL when the column is already binary, or is not there', async () => {
		const binary = runner('mysql', 'utf8mb4_bin');
		await migration().up(binary as never);
		await migration().up(binary as never);
		expect(ddl(binary.statements)).toEqual([]);
		const missing = runner('mysql');
		await migration().up(missing as never);
		await migration().down(missing as never);
		expect(ddl(missing.statements)).toEqual([]);
	});

	it('sends no statement at all on Postgres and SQLite, which compare text byte for byte already', async () => {
		for (const type of ['postgres', 'better-sqlite3'] as const) {
			const other = runner(type, 'C');
			await migration().up(other as never);
			await migration().down(other as never);
			expect(other.statements).toEqual([]);
		}
	});

	it('goes down to the table collation only from the binary one, and once', async () => {
		const binary = runner('mysql', 'utf8mb4_bin');
		await migration().down(binary as never);
		expect(ddl(binary.statements)).toEqual(['ALTER TABLE `chat_message` MODIFY COLUMN `nonce` varchar(64) NULL']);
		const already = runner('mysql', 'utf8mb4_0900_ai_ci');
		await migration().down(already as never);
		expect(ddl(already.statements)).toEqual([]);
	});

	it('raises a failed statement as it is', async () => {
		const failing = runner('mysql', 'utf8mb4_0900_ai_ci');
		failing.query.mockImplementation(async (sql: string) => {
			if (sql.startsWith('ALTER TABLE')) throw new Error('lock wait timeout');
			return [{ columnCollation: 'utf8mb4_0900_ai_ci' }];
		});
		await expect(migration().up(failing as never)).rejects.toThrow('lock wait timeout');
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
