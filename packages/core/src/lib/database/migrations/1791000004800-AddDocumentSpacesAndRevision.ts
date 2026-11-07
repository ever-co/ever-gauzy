import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** A column this migration adds, with its definition on each database. */
interface ColumnSpec extends Record<Dialect, string> {
	table: string;
	name: string;
}

/** The columns, in the order they are added. */
const COLUMNS: readonly ColumnSpec[] = [
	// The team whose space a TEAM document is in.
	{ table: 'document', name: 'organizationTeamId', postgres: `uuid`, sqlite: `varchar`, mysql: `varchar(36) NULL` },
	// The compare-and-set token of content writers: moves on every content change.
	{ table: 'document', name: 'contentRevision', postgres: `integer NOT NULL DEFAULT 1`, sqlite: `integer NOT NULL DEFAULT (1)`, mysql: `int NOT NULL DEFAULT 1` }
];

/** The index the entity declares for the team-space lists. */
const TEAM_INDEX = {
	name: 'IDX_document_tenant_org_team',
	table: 'document',
	columns: ['tenantId', 'organizationId', 'organizationTeamId']
};

/**
 * The foreign key of `document.organizationTeamId` → `organization_team.id` (`ON DELETE SET NULL`: a deleted team
 * leaves its pages in place, without a space). Named as TypeORM's default naming strategy names it, so
 * `migration:generate` sees nothing to add. SQLite cannot add a constraint to an existing table and keeps the
 * column unconstrained, as every added relation column of this platform does there.
 */
const TEAM_FK = {
	name: 'FK_afab1190756d5932503e0e0bbf5',
	table: 'document',
	column: 'organizationTeamId',
	referencedTable: 'organization_team'
};

/**
 * Adds the columns of the docs collaboration feature: `document.organizationTeamId` (the team whose space a
 * `visibility: TEAM` document is in; null for the organization and private spaces) and `document.contentRevision`
 * (moves on every content change; the `expectedRevision` of API writers), plus the index on
 * `(tenantId, organizationId, organizationTeamId)` and the team foreign key.
 *
 * Nothing is backfilled: every existing document keeps its visibility, has no team and is at revision 1. Running `up`
 * twice is harmless (`IF NOT EXISTS` on Postgres, column / index / constraint checks elsewhere), and an advisory lock
 * (a named lock on MySQL) makes two API processes that boot together run it one after the other.
 *
 * `down` drops the constraint, the index and the columns on Postgres and MySQL. SQLite keeps the columns, as every
 * additive column of this platform is kept on the embedded dialect.
 */
export class AddDocumentSpacesAndRevision1791000004800 implements MigrationInterface {
	name = 'AddDocumentSpacesAndRevision1791000004800';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000004800;

	/** The MySQL named lock of this migration. MySQL refuses lock names over 64 characters. */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);
		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.apply(queryRunner, dialect));
			return;
		}
		await this.apply(queryRunner, dialect);
	}

	private async apply(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		if (!(await queryRunner.hasTable('document'))) {
			console.log(chalk.gray(`${this.name}: no document table (the Documents plugin is not loaded), nothing to do.`));
			return;
		}
		for (const column of COLUMNS) {
			await this.addColumn(queryRunner, dialect, column);
		}
		await this.addIndex(queryRunner, dialect);
		await this.addForeignKey(queryRunner, dialect);
	}

	/** Adds the column when it is not there yet. */
	private async addColumn(queryRunner: QueryRunner, dialect: Dialect, column: ColumnSpec): Promise<void> {
		// Postgres guards the statement itself; the other two need the column check first.
		if (dialect !== 'postgres' && (await queryRunner.hasColumn(column.table, column.name))) {
			return;
		}
		const ifNotExists = dialect === 'postgres' ? 'IF NOT EXISTS ' : '';
		await queryRunner.query(
			`ALTER TABLE ${quoted(dialect, column.table)} ADD COLUMN ${ifNotExists}${quoted(dialect, column.name)} ${column[dialect]}`
		);
	}

	private async addIndex(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		const columns = TEAM_INDEX.columns.map((name) => quoted(dialect, name)).join(', ');
		if (dialect === 'mysql') {
			const table = await queryRunner.getTable(TEAM_INDEX.table);
			if (table?.indices.some((index) => index.name === TEAM_INDEX.name)) return;
			await queryRunner.query(`CREATE INDEX \`${TEAM_INDEX.name}\` ON \`${TEAM_INDEX.table}\` (${columns})`);
			return;
		}
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS ${quoted(dialect, TEAM_INDEX.name)} ON ${quoted(dialect, TEAM_INDEX.table)} (${columns})`
		);
	}

	private async addForeignKey(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		if (dialect === 'sqlite') {
			return; // no ALTER TABLE ... ADD CONSTRAINT on SQLite
		}
		if (!(await queryRunner.hasTable(TEAM_FK.referencedTable))) {
			return;
		}
		const table = await queryRunner.getTable(TEAM_FK.table);
		if (table?.foreignKeys.some((key) => key.name === TEAM_FK.name)) {
			return;
		}
		await queryRunner.query(
			`ALTER TABLE ${quoted(dialect, TEAM_FK.table)} ADD CONSTRAINT ${quoted(dialect, TEAM_FK.name)} ` +
				`FOREIGN KEY (${quoted(dialect, TEAM_FK.column)}) REFERENCES ${quoted(dialect, TEAM_FK.referencedTable)} (${quoted(dialect, 'id')}) ` +
				`ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable('document'))) {
			return;
		}
		switch (dialect) {
			case 'postgres':
				await queryRunner.query(`ALTER TABLE "${TEAM_FK.table}" DROP CONSTRAINT IF EXISTS "${TEAM_FK.name}"`);
				await queryRunner.query(`DROP INDEX IF EXISTS "${TEAM_INDEX.name}"`);
				for (const column of [...COLUMNS].reverse()) {
					await queryRunner.query(`ALTER TABLE "${column.table}" DROP COLUMN IF EXISTS "${column.name}"`);
				}
				break;
			case 'sqlite':
				await queryRunner.query(`DROP INDEX IF EXISTS "${TEAM_INDEX.name}"`);
				console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
				break;
			case 'mysql': {
				const table = await queryRunner.getTable(TEAM_FK.table);
				if (table?.foreignKeys.some((key) => key.name === TEAM_FK.name)) {
					await queryRunner.query(`ALTER TABLE \`${TEAM_FK.table}\` DROP FOREIGN KEY \`${TEAM_FK.name}\``);
				}
				if (table?.indices.some((index) => index.name === TEAM_INDEX.name)) {
					await queryRunner.query(`DROP INDEX \`${TEAM_INDEX.name}\` ON \`${TEAM_INDEX.table}\``);
				}
				for (const column of [...COLUMNS].reverse()) {
					if (await queryRunner.hasColumn(column.table, column.name)) {
						await queryRunner.query(`ALTER TABLE \`${column.table}\` DROP COLUMN \`${column.name}\``);
					}
				}
				break;
			}
		}
	}

	/** The dialect of the connection's driver. Throws before any statement runs on any other database. */
	private dialectOf(queryRunner: QueryRunner): Dialect {
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.postgres:
				return 'postgres';
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				return 'sqlite';
			case DatabaseTypeEnum.mysql:
				return 'mysql';
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}
}

/** An identifier quoted for the dialect. */
function quoted(dialect: Dialect, identifier: string): string {
	return dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
}

/**
 * Runs `work` while holding a MySQL named lock (`GET_LOCK`), so that two processes running the same migration
 * concurrently run its check and DDL one after the other. The lock is session-level and released in `finally`.
 */
async function withMysqlNamedLock(queryRunner: QueryRunner, lockName: string, work: () => Promise<void>): Promise<void> {
	const [row] = (await queryRunner.query(`SELECT GET_LOCK(?, 30) AS acquired`, [lockName])) as Array<{ acquired: number | string | null }>;
	if (Number(row?.acquired) !== 1) {
		throw new Error(`Could not acquire the MySQL lock ${lockName} for the migration.`);
	}
	try {
		await work();
	} finally {
		await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
	}
}
