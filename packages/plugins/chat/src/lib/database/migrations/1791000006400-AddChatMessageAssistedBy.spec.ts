import { AddChatMessageAssistedBy1791000006400 } from './1791000006400-AddChatMessageAssistedBy';

/** A query runner of one dialect that records its statements. */
function runner(type: 'postgres' | 'mysql' | 'better-sqlite3', hasColumn: boolean) {
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

describe('AddChatMessageAssistedBy1791000006400', () => {
	it('adds the nullable column once, quoted for each dialect', async () => {
		const postgres = runner('postgres', false);
		await new AddChatMessageAssistedBy1791000006400().up(postgres as never);
		expect(postgres.statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toEqual(['ALTER TABLE "chat_message" ADD COLUMN "assistedBy" varchar(120) NULL']);

		const mysql = runner('mysql', false);
		await new AddChatMessageAssistedBy1791000006400().up(mysql as never);
		expect(mysql.statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toEqual(['ALTER TABLE `chat_message` ADD COLUMN `assistedBy` varchar(120) NULL']);
	});

	it('takes a column another process added between the check and the statement as added', async () => {
		const racing = runner('mysql', false);
		racing.hasColumn.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		racing.query.mockRejectedValueOnce(Object.assign(new Error("Duplicate column name 'assistedBy'"), { errno: 1060 }));
		await expect(new AddChatMessageAssistedBy1791000006400().up(racing as never)).resolves.toBeUndefined();
		const failing = runner('mysql', false);
		failing.query.mockRejectedValueOnce(new Error('disk full'));
		await expect(new AddChatMessageAssistedBy1791000006400().up(failing as never)).rejects.toThrow('disk full');
	});

	it('raises any other error as it is, even when the column turns out to be there', async () => {
		const timedOut = runner('mysql', false);
		timedOut.hasColumn.mockResolvedValueOnce(false).mockResolvedValue(true);
		timedOut.query.mockRejectedValueOnce(Object.assign(new Error('Lock wait timeout exceeded'), { errno: 1205 }));
		await expect(new AddChatMessageAssistedBy1791000006400().up(timedOut as never)).rejects.toThrow('Lock wait timeout exceeded');

		// Postgres: the runs are serialized and a refused statement aborts the transaction, so nothing is re-checked
		// (a re-check would fail with 25P02 and hide the real error).
		const postgres = runner('postgres', false);
		postgres.query.mockImplementation(async (sql: string) => {
			postgres.statements.push(sql);
			if (sql.startsWith('ALTER TABLE')) throw Object.assign(new Error('column "assistedBy" of relation "chat_message" already exists'), { code: '42701' });
			return [];
		});
		await expect(new AddChatMessageAssistedBy1791000006400().up(postgres as never)).rejects.toThrow('already exists');
		expect(postgres.hasColumn).toHaveBeenCalledTimes(1);
	});

	it('takes the SQLite refusals of a concurrent run as done, both ways', async () => {
		const adding = runner('better-sqlite3', false);
		adding.hasColumn.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		adding.query.mockRejectedValueOnce(new Error('SQLITE_ERROR: duplicate column name: assistedBy'));
		await expect(new AddChatMessageAssistedBy1791000006400().up(adding as never)).resolves.toBeUndefined();

		const dropping = runner('better-sqlite3', true);
		dropping.hasColumn.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
		dropping.query.mockRejectedValueOnce(new Error('SQLITE_ERROR: no such column: "assistedBy"'));
		await expect(new AddChatMessageAssistedBy1791000006400().down(dropping as never)).resolves.toBeUndefined();
	});

	it('changes nothing when the column is there already, and drops it only when it is', async () => {
		const present = runner('better-sqlite3', true);
		await new AddChatMessageAssistedBy1791000006400().up(present as never);
		expect(present.statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toEqual([]);
		await new AddChatMessageAssistedBy1791000006400().down(present as never);
		expect(present.statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toEqual(['ALTER TABLE "chat_message" DROP COLUMN "assistedBy"']);
	});
});
