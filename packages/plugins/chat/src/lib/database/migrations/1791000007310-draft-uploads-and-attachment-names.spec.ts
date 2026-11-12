import { CreateChatAttachmentDraftTable1791000007310 } from './1791000007310-CreateChatAttachmentDraftTable';
import { AddChatMessageAttachmentNames1791000007320 } from './1791000007320-AddChatMessageAttachmentNames';

/** A query runner of one dialect that records its statements; no index or constraint exists yet. */
function runner(type: 'postgres' | 'mysql' | 'better-sqlite3', hasColumn = false) {
	const statements: string[] = [];
	return {
		statements,
		connection: { options: { type } },
		hasColumn: jest.fn(async () => hasColumn),
		query: jest.fn(async (sql: string) => {
			statements.push(sql);
			return [];
		})
	};
}

describe('CreateChatAttachmentDraftTable1791000007310', () => {
	it('creates the table with its document key, uploader and the sweep index, on each dialect', async () => {
		for (const type of ['postgres', 'mysql', 'better-sqlite3'] as const) {
			const queryRunner = runner(type);
			await new CreateChatAttachmentDraftTable1791000007310().up(queryRunner as never);
			const create = queryRunner.statements.find((sql) => sql.startsWith('CREATE TABLE IF NOT EXISTS'));
			expect(create).toBeDefined();
			expect(create).toMatch(/documentId/);
			expect(create).toMatch(/userId/);
			const indexes = queryRunner.statements.filter((sql) => /CREATE (UNIQUE )?INDEX/.test(sql)).join('\n');
			expect(indexes).toMatch(/UQ_chat_attachment_draft_document/);
			expect(indexes).toMatch(/IDX_chat_attachment_draft_created/);
			// No key to `document`: the draft is recorded before the upload's own transaction commits.
			expect(queryRunner.statements.join('\n')).not.toMatch(/REFERENCES ["`]document["`]/);
		}
	});

	it('drops the table on the way down', async () => {
		const queryRunner = runner('postgres');
		await new CreateChatAttachmentDraftTable1791000007310().down(queryRunner as never);
		expect(queryRunner.statements).toContain('DROP TABLE IF EXISTS "chat_attachment_draft"');
	});
});

describe('AddChatMessageAttachmentNames1791000007320', () => {
	it('adds the nullable column once, in each dialect’s spelling', async () => {
		const expected: Record<string, string> = {
			postgres: 'ALTER TABLE "chat_message" ADD COLUMN "attachmentNames" text NULL',
			mysql: 'ALTER TABLE `chat_message` ADD COLUMN `attachmentNames` longtext NULL',
			'better-sqlite3': 'ALTER TABLE "chat_message" ADD COLUMN "attachmentNames" text NULL'
		};
		for (const type of ['postgres', 'mysql', 'better-sqlite3'] as const) {
			const queryRunner = runner(type);
			await new AddChatMessageAttachmentNames1791000007320().up(queryRunner as never);
			expect(queryRunner.statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toEqual([expected[type]]);
		}
	});

	it('changes nothing when the column is there, and takes a concurrent add as done', async () => {
		const present = runner('mysql', true);
		await new AddChatMessageAttachmentNames1791000007320().up(present as never);
		expect(present.statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toEqual([]);

		const racing = runner('mysql');
		racing.hasColumn.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		racing.query.mockImplementation(async (sql: string) => {
			if (sql.startsWith('ALTER TABLE')) throw Object.assign(new Error("Duplicate column name 'attachmentNames'"), { errno: 1060 });
			return [];
		});
		await expect(new AddChatMessageAttachmentNames1791000007320().up(racing as never)).resolves.toBeUndefined();
	});

	it('drops the column only when it is there', async () => {
		const present = runner('better-sqlite3', true);
		await new AddChatMessageAttachmentNames1791000007320().down(present as never);
		expect(present.statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toEqual(['ALTER TABLE "chat_message" DROP COLUMN "attachmentNames"']);
		const absent = runner('better-sqlite3', false);
		await new AddChatMessageAttachmentNames1791000007320().down(absent as never);
		expect(absent.statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toEqual([]);
	});
});
