/**
 * Review finding F109: `inbox_email`'s JSON text columns are `longtext` on MySQL, so a message with a long To / Cc list,
 * References chain or kept headers fits the column (the inbound pipeline's cut-to-fit stays as the cap).
 *
 * MySQL is driven by its catalog probe (each state a run can find); Postgres and SQLite are no-ops, SQLite on a real
 * database. The migration is looked up in the plugin's own list, the way the platform receives it.
 */
import 'reflect-metadata';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { INBOX_EMAIL_MIGRATIONS } from './inbox-email-migrations';
import { CreateInboxEmailTable1791000002800 } from './migrations/1791000002800-CreateInboxEmailTable';

const NAME = 'AlterInboxEmailJsonColumnsLongText1791000003200';
const COLUMNS = ['referenceIds', 'sender', 'toAddresses', 'ccAddresses', 'bccAddresses', 'replyToAddresses', 'headers'];

function migration(): MigrationInterface {
	const Migration = INBOX_EMAIL_MIGRATIONS.find((m) => m.name === NAME);
	if (!Migration) throw new Error(`${NAME} is not in INBOX_EMAIL_MIGRATIONS`);
	return new Migration();
}

/** A query runner of `type` whose column probe answers `types` (column → DATA_TYPE) and whose length probe `lengths`. */
function runner(type: string, types: Record<string, string> = {}, lengths: Record<string, number> = {}) {
	const sent: string[] = [];
	const queryRunner = {
		connection: { options: { type } },
		query: async (sql: string) => {
			sent.push(sql.replace(/\s+/g, ' ').trim());
			if (/information_schema/.test(sql)) return Object.entries(types).map(([name, t]) => ({ name, type: t }));
			if (/MAX\(LENGTH/.test(sql)) return [lengths];
			return [];
		}
	} as unknown as QueryRunner;
	return { queryRunner, sent, ddl: () => sent.filter((sql) => /^ALTER/.test(sql)) };
}
const all = (t: string) => Object.fromEntries(COLUMNS.map((c) => [c, t]));

describe('inbox_email JSON columns longtext on MySQL (F109)', () => {
	it('is registered with the Inbox email migrations, after the table it alters', () => {
		const names = INBOX_EMAIL_MIGRATIONS.map((m) => m.name);
		expect(names).toContain(NAME);
		expect(names.indexOf(NAME)).toBeGreaterThan(names.indexOf(CreateInboxEmailTable1791000002800.name));
	});

	it('MySQL: the seven JSON text columns become longtext in one statement', async () => {
		const { queryRunner, ddl } = runner('mysql', { ...all('text'), textBody: 'longtext' });
		await migration().up(queryRunner);
		expect(ddl()).toEqual([
			`ALTER TABLE \`inbox_email\` ${COLUMNS.map((c) => `MODIFY \`${c}\` longtext NULL`).join(', ')}`
		]);
	});

	it('MySQL: a re-run modifies nothing, and a half-converted table only what is left (MariaDB too)', async () => {
		const done = runner('mysql', all('longtext'));
		await migration().up(done.queryRunner);
		expect(done.ddl()).toEqual([]);

		const half = runner('mariadb', { ...all('longtext'), toAddresses: 'text', headers: 'TEXT' });
		await migration().up(half.queryRunner);
		expect(half.ddl()).toEqual([
			'ALTER TABLE `inbox_email` MODIFY `toAddresses` longtext NULL, MODIFY `headers` longtext NULL'
		]);
	});

	it('MySQL: down puts text back when every value fits', async () => {
		const { queryRunner, ddl } = runner('mysql', all('longtext'), { toAddresses: 65_535 });
		await migration().down(queryRunner);
		expect(ddl()).toEqual([
			`ALTER TABLE \`inbox_email\` ${COLUMNS.map((c) => `MODIFY \`${c}\` text NULL`).join(', ')}`
		]);
	});

	it('MySQL: down refuses, before any change, while a stored value is longer than text holds', async () => {
		const { queryRunner, ddl } = runner('mysql', all('longtext'), {
			ccAddresses: 70_000,
			headers: '65536' as never
		});
		await expect(migration().down(queryRunner)).rejects.toThrow('inbox_email.ccAddresses, headers back to text');
		expect(ddl()).toEqual([]);
	});

	it('Postgres: nothing to do, no statement at all', async () => {
		const { queryRunner, sent } = runner('postgres', all('text'));
		await migration().up(queryRunner);
		await migration().down(queryRunner);
		expect(sent).toEqual([]);
	});

	it('SQLite: nothing to do, the table is the same before and after (a real database)', async () => {
		const dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:' });
		await dataSource.initialize();
		try {
			const queryRunner = dataSource.createQueryRunner();
			await new CreateInboxEmailTable1791000002800().up(queryRunner);
			const schema = () =>
				dataSource.query(
					`SELECT "type", "name", "sql" FROM "sqlite_master" WHERE "tbl_name" = 'inbox_email' ORDER BY "name"`
				);
			const before = await schema();
			await migration().up(queryRunner);
			expect(await schema()).toEqual(before);
			await migration().down(queryRunner);
			expect(await schema()).toEqual(before);
		} finally {
			await dataSource.destroy();
		}
	});
});
