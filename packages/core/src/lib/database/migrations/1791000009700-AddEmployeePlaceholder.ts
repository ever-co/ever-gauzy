import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** A column this migration adds, with its definition on each database. */
type ColumnDefinition = Readonly<{ table: string; name: string } & Record<Dialect, string>>;

/**
 * The foreign key's and the index's names of `invite.placeholderEmployeeId`: TypeORM's own (`DefaultNamingStrategy`),
 * so a schema comparison finds the constraint and the index the entity declares.
 */
export const INVITE_PLACEHOLDER_EMPLOYEE_FOREIGN_KEY = 'FK_0b55b33744cb30a409a048f3aae';
export const INVITE_PLACEHOLDER_EMPLOYEE_INDEX = 'IDX_0b55b33744cb30a409a048f3aa';

/** Whether an employee is a member without an account: false for every existing row. */
const IS_PLACEHOLDER: ColumnDefinition = {
	table: 'employee',
	name: 'isPlaceholder',
	postgres: 'boolean NOT NULL DEFAULT false',
	sqlite: 'boolean NOT NULL DEFAULT (0)',
	mysql: 'tinyint NOT NULL DEFAULT 0'
};

/** The email given when a member without an account was created. */
const PLACEHOLDER_EMAIL: ColumnDefinition = {
	table: 'employee',
	name: 'placeholderEmail',
	postgres: 'character varying',
	sqlite: 'varchar',
	mysql: 'varchar(255) NULL'
};

/** The member without an account an invitation hands over. */
const PLACEHOLDER_EMPLOYEE: ColumnDefinition = {
	table: 'invite',
	name: 'placeholderEmployeeId',
	postgres: 'uuid',
	// SQLite cannot add a constraint to an existing table, but a column it adds may carry one inline
	// (its default must then be NULL, which it is).
	sqlite: `varchar CONSTRAINT "${INVITE_PLACEHOLDER_EMPLOYEE_FOREIGN_KEY}" REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
	mysql: 'varchar(255) NULL'
};

/**
 * Adds members without an account (placeholders):
 * - `employee.isPlaceholder` (`boolean NOT NULL DEFAULT false`), false for every existing employee;
 * - `employee.placeholderEmail` (nullable), the email given when such a member was created;
 * - `invite.placeholderEmployeeId` (nullable, indexed, → `employee`, `ON DELETE SET NULL`), the member without an
 *   account a claim invitation hands over.
 *
 * Nothing is backfilled and no existing value changes: every existing employee is a member with an account, and every
 * existing invitation hands nothing over. On Postgres 11+ each added column is a catalog-only change.
 *
 * Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column, index and constraint check elsewhere), and a
 * transaction-scoped advisory lock (a named lock on MySQL) makes two API processes that boot at the same time against
 * one database run it one after the other.
 *
 * `down` drops the constraint, the index and the three columns on Postgres and MySQL. SQLite drops the index and keeps
 * the columns, as every additive column of this platform is kept on the embedded dialect: a column that carries a
 * foreign key is dropped there only by rebuilding `invite`, and a kept column with its default is invisible to a build
 * without the entity members.
 */
export class AddEmployeePlaceholder1791000009700 implements MigrationInterface {
	name = 'AddEmployeePlaceholder1791000009700';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000009700;

	/**
	 * The MySQL named lock of this migration. MySQL refuses lock names over 64 characters, so the name carries the
	 * timestamp rather than the class name.
	 */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);
		const hasEmployee = await queryRunner.hasTable(IS_PLACEHOLDER.table);
		const hasInvite = await queryRunner.hasTable(PLACEHOLDER_EMPLOYEE.table);
		if (!hasEmployee || !hasInvite) return;

		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}

		// MySQL has no transactional DDL and no migration-run lock: two processes booting together would both see
		// the columns missing. A named lock makes the checks and the DDL one critical section.
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.addColumns(queryRunner, dialect));
			return;
		}
		await this.addColumns(queryRunner, dialect);
	}

	/** Adds the three columns when they are not there yet, then the index and the foreign key of the invite's one. */
	private async addColumns(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		for (const column of [IS_PLACEHOLDER, PLACEHOLDER_EMAIL, PLACEHOLDER_EMPLOYEE]) {
			await this.addColumn(queryRunner, dialect, column);
		}
		await this.addIndex(queryRunner, dialect);
		if (dialect === 'sqlite') {
			return;
		}
		if (await this.hasForeignKey(queryRunner)) {
			return;
		}
		await queryRunner.query(
			`ALTER TABLE ${quoted(dialect, PLACEHOLDER_EMPLOYEE.table)} ADD CONSTRAINT ${quoted(
				dialect,
				INVITE_PLACEHOLDER_EMPLOYEE_FOREIGN_KEY
			)} FOREIGN KEY (${quoted(dialect, PLACEHOLDER_EMPLOYEE.name)}) REFERENCES ${quoted(
				dialect,
				'employee'
			)}(${quoted(dialect, 'id')}) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * Adds one column when it is not there yet. Asked first on every dialect: on PostgreSQL even `ADD COLUMN IF NOT
	 * EXISTS` takes an ACCESS EXCLUSIVE lock and waits behind every open transaction, while this catalog read takes none.
	 */
	private async addColumn(queryRunner: QueryRunner, dialect: Dialect, column: ColumnDefinition): Promise<void> {
		const hasColumn = await queryRunner.hasColumn(column.table, column.name);
		if (hasColumn) {
			return;
		}
		let ifNotExists = '';
		if (dialect === 'postgres') {
			ifNotExists = 'IF NOT EXISTS ';
		}
		await queryRunner.query(
			`ALTER TABLE ${quoted(dialect, column.table)} ADD COLUMN ${ifNotExists}${quoted(dialect, column.name)} ${
				column[dialect]
			}`
		);
	}

	/** Adds the index on the invite's column. MySQL has no `IF NOT EXISTS` for an index, so the table is asked first. */
	private async addIndex(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		if (dialect === 'mysql') {
			if (await this.hasIndex(queryRunner)) {
				return;
			}
			await queryRunner.query(
				`CREATE INDEX \`${INVITE_PLACEHOLDER_EMPLOYEE_INDEX}\` ON \`${PLACEHOLDER_EMPLOYEE.table}\` (\`${PLACEHOLDER_EMPLOYEE.name}\`)`
			);
			return;
		}
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "${INVITE_PLACEHOLDER_EMPLOYEE_INDEX}" ON "${PLACEHOLDER_EMPLOYEE.table}" ("${PLACEHOLDER_EMPLOYEE.name}")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		const hasEmployee = await queryRunner.hasTable(IS_PLACEHOLDER.table);
		const hasInvite = await queryRunner.hasTable(PLACEHOLDER_EMPLOYEE.table);
		if (!hasEmployee || !hasInvite) return;

		switch (dialect) {
			case 'postgres':
				await queryRunner.query(
					`ALTER TABLE "${PLACEHOLDER_EMPLOYEE.table}" DROP CONSTRAINT IF EXISTS "${INVITE_PLACEHOLDER_EMPLOYEE_FOREIGN_KEY}"`
				);
				await queryRunner.query(`DROP INDEX IF EXISTS "${INVITE_PLACEHOLDER_EMPLOYEE_INDEX}"`);
				for (const column of [PLACEHOLDER_EMPLOYEE, PLACEHOLDER_EMAIL, IS_PLACEHOLDER]) {
					await queryRunner.query(`ALTER TABLE "${column.table}" DROP COLUMN IF EXISTS "${column.name}"`);
				}
				break;
			case 'sqlite':
				await queryRunner.query(`DROP INDEX IF EXISTS "${INVITE_PLACEHOLDER_EMPLOYEE_INDEX}"`);
				console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
				break;
			case 'mysql':
				await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.mysqlDown(queryRunner));
				break;
		}
	}

	/** Drops the constraint, then the index (which MySQL keeps for a foreign key while one exists), then the columns. */
	private async mysqlDown(queryRunner: QueryRunner): Promise<void> {
		if (await this.hasForeignKey(queryRunner)) {
			await queryRunner.query(
				`ALTER TABLE \`${PLACEHOLDER_EMPLOYEE.table}\` DROP FOREIGN KEY \`${INVITE_PLACEHOLDER_EMPLOYEE_FOREIGN_KEY}\``
			);
		}
		if (await this.hasIndex(queryRunner)) {
			await queryRunner.query(
				`DROP INDEX \`${INVITE_PLACEHOLDER_EMPLOYEE_INDEX}\` ON \`${PLACEHOLDER_EMPLOYEE.table}\``
			);
		}
		for (const column of [PLACEHOLDER_EMPLOYEE, PLACEHOLDER_EMAIL, IS_PLACEHOLDER]) {
			if (await queryRunner.hasColumn(column.table, column.name)) {
				await queryRunner.query(`ALTER TABLE \`${column.table}\` DROP COLUMN \`${column.name}\``);
			}
		}
	}

	/**
	 * Whether the invite table already carries the foreign key. TypeORM's query runner has no `hasConstraint`, so the
	 * question is asked of the table's own metadata, which keeps a re-run and a revert idempotent.
	 */
	private async hasForeignKey(queryRunner: QueryRunner): Promise<boolean> {
		const table = await queryRunner.getTable(PLACEHOLDER_EMPLOYEE.table);
		return Boolean(
			table?.foreignKeys?.some((foreignKey) => foreignKey.name === INVITE_PLACEHOLDER_EMPLOYEE_FOREIGN_KEY)
		);
	}

	/** Whether the invite table already carries the index, asked of the table's metadata for the reason above. */
	private async hasIndex(queryRunner: QueryRunner): Promise<boolean> {
		const table = await queryRunner.getTable(PLACEHOLDER_EMPLOYEE.table);
		return Boolean(table?.indices?.some((index) => index.name === INVITE_PLACEHOLDER_EMPLOYEE_INDEX));
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
