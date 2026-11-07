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

	it('changes nothing when the column is there already, and drops it only when it is', async () => {
		const present = runner('better-sqlite3', true);
		await new AddChatMessageAssistedBy1791000006400().up(present as never);
		expect(present.statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toEqual([]);
		await new AddChatMessageAssistedBy1791000006400().down(present as never);
		expect(present.statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toEqual(['ALTER TABLE "chat_message" DROP COLUMN "assistedBy"']);
	});
});
