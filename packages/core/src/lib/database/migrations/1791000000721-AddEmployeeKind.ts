import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The column this migration adds, with its definition on each database. */
const KIND_COLUMN: Readonly<{ name: string } & Record<Dialect, string>> = {
	name: 'kind',
	postgres: `character varying(16) NOT NULL DEFAULT 'human'`,
	sqlite: `varchar(16) NOT NULL DEFAULT ('human')`,
	mysql: `varchar(16) NOT NULL DEFAULT 'human'`
};

/**
 * The index the entity declares with `@ColumnIndex()` on `kind`: TypeORM's own name for an index on
 * `employee (kind)`, so a generated migration sees no drift.
 */
const KIND_INDEX = 'IDX_bd5498b600e43bf3308fe5adc8';

/**
 * Adds `employee.kind` (`varchar(16) NOT NULL DEFAULT 'human'`, indexed): what an employee row represents,
 * a person (`human`) or an agent (`agent`). Part of the Gauzy ↔ Ever Works integration (G-P1-1): Ever Works
 * agents become employees with `kind = 'agent'`, created only through `EmployeeService.createAgentEmployee`.
 *
 * Every existing row is a person, which is exactly what the default writes, so nothing is backfilled and no
 * existing behaviour changes. On Postgres 11+ a column with a constant default is a catalog-only change, and
 * the index build reads the table once.
 *
 * Running `up` twice is harmless (`IF NOT EXISTS` on Postgres and on the SQLite index, a column/index check
 * on MySQL and for the SQLite column), and a transaction-scoped advisory lock makes two API processes that
 * boot at the same time against one database run it one after the other.
 *
 * `down` drops the index and the column on Postgres and MySQL. SQLite drops the index and keeps the column,
 * as every additive column of this platform is kept on the embedded dialect (dropping one there can mean a
 * table rebuild); a kept `kind` column with its default is invisible to a build without the entity member.
 */
export class AddEmployeeKind1791000000721 implements MigrationInterface {
	name = 'AddEmployeeKind1791000000721';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000000721;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable('employee'))) return;

		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}

		// Postgres guards the statement itself; the other two need the column check first.
		if (dialect === 'postgres' || !(await queryRunner.hasColumn('employee', KIND_COLUMN.name))) {
			const ifNotExists = dialect === 'postgres' ? 'IF NOT EXISTS ' : '';
			await queryRunner.query(
				`ALTER TABLE ${quoted(dialect, 'employee')} ADD COLUMN ${ifNotExists}${quoted(dialect, KIND_COLUMN.name)} ${KIND_COLUMN[dialect]}`
			);
		}

		switch (dialect) {
			case 'postgres':
			case 'sqlite':
				await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${KIND_INDEX}" ON "employee" ("kind")`);
				break;
			case 'mysql':
				if (!(await this.mysqlIndexExists(queryRunner))) {
					await queryRunner.query(`CREATE INDEX \`${KIND_INDEX}\` ON \`employee\` (\`kind\`)`);
				}
				break;
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable('employee'))) return;

		switch (dialect) {
			case 'postgres':
				await queryRunner.query(`DROP INDEX IF EXISTS "${KIND_INDEX}"`);
				await queryRunner.query(`ALTER TABLE "employee" DROP COLUMN IF EXISTS "kind"`);
				break;
			case 'sqlite':
				await queryRunner.query(`DROP INDEX IF EXISTS "${KIND_INDEX}"`);
				console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
				break;
			case 'mysql':
				if (await this.mysqlIndexExists(queryRunner)) {
					await queryRunner.query(`DROP INDEX \`${KIND_INDEX}\` ON \`employee\``);
				}
				if (await queryRunner.hasColumn('employee', KIND_COLUMN.name)) {
					await queryRunner.query(`ALTER TABLE \`employee\` DROP COLUMN \`kind\``);
				}
				break;
		}
	}

	/** Whether the `kind` index exists on MySQL, which has no `IF [NOT] EXISTS` for indexes. */
	private async mysqlIndexExists(queryRunner: QueryRunner): Promise<boolean> {
		const rows = await queryRunner.query(
			`SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee' AND INDEX_NAME = ?`,
			[KIND_INDEX]
		);
		return Array.isArray(rows) && rows.length > 0;
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

/** Quotes an identifier the way the dialect expects: backticks on MySQL, double quotes elsewhere. */
function quoted(dialect: Dialect, identifier: string): string {
	return dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
}
