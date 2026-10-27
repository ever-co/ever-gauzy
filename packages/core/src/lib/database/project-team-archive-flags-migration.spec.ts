import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { NormalizeProjectAndTeamArchiveFlags1791000003440 } from './migrations/1791000003440-NormalizeProjectAndTeamArchiveFlags';

/**
 * Every list of projects and teams now reads `isArchived = false` unless the caller asks for archived rows, so a
 * row holding a null would drop out of every list. Run for real on SQLite (the demo database) against a minimal
 * fixture of both tables: a null becomes `false`, an archived row stays archived, and a re-run is a no-op.
 */
describe('project and team archive flags migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-archive-flags-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();

		for (const table of ['organization_project', 'organization_team']) {
			await dataSource.query(
				`CREATE TABLE "${table}" ("id" varchar PRIMARY KEY NOT NULL, "isArchived" boolean DEFAULT (0))`
			);
			await dataSource.query(
				`INSERT INTO "${table}" ("id", "isArchived") VALUES ('never-set', NULL), ('active', 0), ('archived', 1)`
			);
		}
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const flags = async (table: string) =>
		Object.fromEntries(
			((await dataSource.query(`SELECT "id", "isArchived" FROM "${table}" ORDER BY "id"`)) as any[]).map(
				({ id, isArchived }) => [id, isArchived === null ? null : Number(isArchived)]
			)
		);

	const up = async () => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new NormalizeProjectAndTeamArchiveFlags1791000003440().up(queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('reads a null as not archived, and leaves archived rows archived, on both tables', async () => {
		await up();

		for (const table of ['organization_project', 'organization_team']) {
			expect(await flags(table)).toEqual({ active: 0, archived: 1, 'never-set': 0 });
		}
	});

	it('changes nothing when run again', async () => {
		await up();
		await up();

		expect(await flags('organization_project')).toEqual({ active: 0, archived: 1, 'never-set': 0 });
	});

	it('skips a database without the tables', async () => {
		await dataSource.query('DROP TABLE "organization_team"');

		await expect(up()).resolves.toBeUndefined();
		expect(await flags('organization_project')).toEqual({ active: 0, archived: 1, 'never-set': 0 });
	});
});
