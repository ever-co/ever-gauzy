import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The table this migration changes. */
const TABLE = 'organization_team';

/** The project the team files its new tasks and time under. */
const DEFAULT_PROJECT = 'defaultProjectId';

/**
 * The foreign key's name: TypeORM's own for `organization_team.defaultProjectId`
 * (`DefaultNamingStrategy.foreignKeyName`), so a schema comparison finds the constraint the entity declares.
 */
const FOREIGN_KEY = 'FK_71240f042c6420d072206740d79';

/** The column's definition on each database. */
const COLUMN: Record<Dialect, string> = {
	postgres: 'uuid',
	// SQLite cannot add a constraint to an existing table, but a column it adds may carry one inline
	// (its default must then be NULL, which it is).
	sqlite: `varchar CONSTRAINT "${FOREIGN_KEY}" REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
	mysql: 'varchar(255) NULL'
};

/**
 * Adds `organization_team.defaultProjectId` (nullable, → `organization_project`, `ON DELETE SET NULL`): the project a
 * team files its new tasks and time under. Ever Teams creates a project with each team and used to take whichever
 * project the team listed first; a team linked to several projects had no defined one.
 *
 * Nothing is backfilled and no existing value changes: the column is nullable, a team without it behaves as before,
 * and on Postgres 11+ adding it is a catalog-only change. Deleting the project releases the team's choice.
 *
 * Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column and constraint check elsewhere), and a
 * transaction-scoped advisory lock (a named lock on MySQL) makes two API processes that boot at the same time
 * against one database run it one after the other.
 *
 * `down` drops the constraint and the column on Postgres and MySQL. SQLite keeps it, as every additive column of
 * this platform is kept on the embedded dialect.
 */
export class AddOrganizationTeamDefaultProject1791000004200 implements MigrationInterface {
	name = 'AddOrganizationTeamDefaultProject1791000004200';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000004200;

	/**
	 * The MySQL named lock of this migration. MySQL refuses lock names over 64 characters, so the name carries the
	 * timestamp rather than the class name.
	 */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}

		// MySQL has no transactional DDL and no migration-run lock: two processes booting together would both see
		// the column missing. A named lock makes the checks and the DDL one critical section.
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.addColumn(queryRunner, dialect));
			return;
		}
		await this.addColumn(queryRunner, dialect);
	}

	/** Adds the column when it is not there yet, then the foreign key (inline on SQLite). */
	private async addColumn(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		const needsColumnCheck = dialect !== 'postgres';
		const hasColumn = needsColumnCheck && (await queryRunner.hasColumn(TABLE, DEFAULT_PROJECT));
		if (!hasColumn) {
			let ifNotExists = '';
			if (dialect === 'postgres') {
				ifNotExists = 'IF NOT EXISTS ';
			}
			await queryRunner.query(
				`ALTER TABLE ${quoted(dialect, TABLE)} ADD COLUMN ${ifNotExists}${quoted(dialect, DEFAULT_PROJECT)} ${COLUMN[dialect]}`
			);
		}

		if (dialect === 'sqlite' || (await this.hasForeignKey(queryRunner))) {
			return;
		}
		await queryRunner.query(
			`ALTER TABLE ${quoted(dialect, TABLE)} ADD CONSTRAINT ${quoted(dialect, FOREIGN_KEY)} FOREIGN KEY (${quoted(
				dialect,
				DEFAULT_PROJECT
			)}) REFERENCES ${quoted(dialect, 'organization_project')}(${quoted(dialect, 'id')}) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		switch (dialect) {
			case 'postgres':
				await queryRunner.query(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${FOREIGN_KEY}"`);
				await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "${DEFAULT_PROJECT}"`);
				break;
			case 'sqlite':
				console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
				break;
			case 'mysql':
				if (await this.hasForeignKey(queryRunner)) {
					await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP FOREIGN KEY \`${FOREIGN_KEY}\``);
				}
				if (await queryRunner.hasColumn(TABLE, DEFAULT_PROJECT)) {
					await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP COLUMN \`${DEFAULT_PROJECT}\``);
				}
				break;
		}
	}

	/**
	 * Whether the table already carries the foreign key. TypeORM's query runner has no `hasConstraint`, so the
	 * question is asked of the table's own metadata, which keeps a re-run and a revert idempotent.
	 */
	private async hasForeignKey(queryRunner: QueryRunner): Promise<boolean> {
		const table = await queryRunner.getTable(TABLE);
		return Boolean(table?.foreignKeys?.some((foreignKey) => foreignKey.name === FOREIGN_KEY));
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

/**
 * Runs `work` while holding a MySQL named lock (`GET_LOCK`), so that two processes running the same migration
 * concurrently run its checks and DDL one after the other. The lock is session-level and released in `finally`.
 */
async function withMysqlNamedLock(
	queryRunner: QueryRunner,
	lockName: string,
	work: () => Promise<void>
): Promise<void> {
	const [row] = await queryRunner.query(`SELECT GET_LOCK(?, 120) AS \`acquired\``, [lockName]);
	if (Number(row?.acquired) !== 1) {
		throw new Error(`Could not acquire the MySQL migration lock ${lockName}.`);
	}
	try {
		await work();
	} finally {
		await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
	}
}

/** Quotes an identifier the way the dialect expects: backticks on MySQL, double quotes elsewhere. */
function quoted(dialect: Dialect, identifier: string): string {
	if (dialect === 'mysql') {
		return `\`${identifier}\``;
	}
	return `"${identifier}"`;
}
