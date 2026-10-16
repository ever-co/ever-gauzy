import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The column this migration adds, with its definition on each database. */
const COLUMN: Readonly<{ name: string } & Record<Dialect, string>> = {
	name: 'isTaskSizeEstimationEnabled',
	postgres: `boolean NOT NULL DEFAULT true`,
	sqlite: `boolean NOT NULL DEFAULT (1)`,
	mysql: `tinyint NOT NULL DEFAULT 1`
};

/**
 * Adds `organization_project.isTaskSizeEstimationEnabled` (`boolean NOT NULL DEFAULT true`): whether the project's
 * tasks are estimated with its task sizes. The Plane integration turns a project's "Estimates" off and on with it.
 *
 * Every existing project used task-size estimates, which is exactly what the default writes, so nothing is
 * backfilled and no existing behaviour changes. On Postgres 11+ a column with a constant default is a
 * catalog-only change.
 *
 * Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column check elsewhere), and a
 * transaction-scoped advisory lock makes two API processes that boot at the same time against one database run
 * it one after the other.
 *
 * `down` drops the column on Postgres and MySQL. SQLite keeps it, as every additive column of this platform is
 * kept on the embedded dialect (dropping one there can mean a table rebuild); a kept column with its default is
 * invisible to a build without the entity member.
 */
export class AddOrganizationProjectTaskSizeEstimation1791000000747 implements MigrationInterface {
	name = 'AddOrganizationProjectTaskSizeEstimation1791000000747';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000000747;

	/**
	 * The MySQL named lock of this migration. MySQL refuses lock names over 64 characters, and
	 * `gauzy:migration:` + the class name is 69, so the name carries the timestamp instead.
	 */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable('organization_project'))) return;

		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}

		// MySQL has no transactional DDL and no migration-run lock: two processes booting together would both see
		// the column missing. A named lock makes the check and the DDL one critical section.
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.addColumn(queryRunner, dialect));
			return;
		}
		await this.addColumn(queryRunner, dialect);
	}

	/** Adds the column when it is not there yet. */
	private async addColumn(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		// Postgres guards the statement itself; the other two need the column check first.
		if (dialect !== 'postgres' && (await queryRunner.hasColumn('organization_project', COLUMN.name))) {
			return;
		}
		const ifNotExists = dialect === 'postgres' ? 'IF NOT EXISTS ' : '';
		await queryRunner.query(
			`ALTER TABLE ${quoted(dialect, 'organization_project')} ADD COLUMN ${ifNotExists}${quoted(dialect, COLUMN.name)} ${COLUMN[dialect]}`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable('organization_project'))) return;

		switch (dialect) {
			case 'postgres':
				await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN IF EXISTS "${COLUMN.name}"`);
				break;
			case 'sqlite':
				console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
				break;
			case 'mysql':
				if (await queryRunner.hasColumn('organization_project', COLUMN.name)) {
					await queryRunner.query(`ALTER TABLE \`organization_project\` DROP COLUMN \`${COLUMN.name}\``);
				}
				break;
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

/**
 * Runs `work` while holding a MySQL named lock (`GET_LOCK`), so that two processes running the same migration
 * concurrently run its check and DDL one after the other. The lock is session-level and released in `finally`.
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
	return dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
}
