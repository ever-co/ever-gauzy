import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The table this migration changes (created by the core `AuthZitadel1790000018000` migration). */
const TABLE = 'zitadel_session';

/** The column this migration adds, with its definition on each database. */
const COLUMN: Readonly<{ name: string } & Record<Dialect, string>> = {
	name: 'everRefreshTokenEncrypted',
	postgres: 'text',
	sqlite: 'text',
	mysql: 'text NULL'
};

/**
 * Adds `zitadel_session.everRefreshTokenEncrypted` (nullable `text`): the encrypted Ever ID refresh token a session
 * keeps while the App Launcher is on (`EVER_APP_LAUNCHER_ENABLED=true`). Every existing row stays NULL, and the
 * column stays NULL while the launcher is off.
 *
 * One nullable column without a default and no data step: a catalog-only change on Postgres, and no statement per
 * tenant or per row on any database, so its run time does not depend on the size of the table.
 *
 * Registered by the Ever ID sign-in plugin (`ZITADEL_ENABLED=true`), after the core migration that creates the table.
 * Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column check elsewhere), and a transaction-scoped
 * advisory lock (a named lock on MySQL) makes two API processes that boot at the same time run it one after the other.
 *
 * `down` drops the column on Postgres and MySQL (the stored tokens go with it; people sign in again to use the
 * launcher). SQLite keeps it, as every additive column of this platform is kept on the embedded dialect.
 */
export class AddZitadelSessionRefreshToken1791000006450 implements MigrationInterface {
	name = 'AddZitadelSessionRefreshToken1791000006450';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000006450;

	/** The MySQL named lock of this migration. MySQL refuses lock names over 64 characters. */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		const dialect = dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}
		// MySQL has no transactional DDL: two processes booting together would both see the column missing. A named
		// lock makes the check and the DDL one critical section.
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => addColumn(queryRunner, dialect));
			return;
		}
		await addColumn(queryRunner, dialect);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		const dialect = dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		switch (dialect) {
			case 'postgres':
				await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "${COLUMN.name}"`);
				break;
			case 'sqlite':
				// The embedded dialect keeps its additive columns; clear the values so no token outlives the rollback.
				if (await queryRunner.hasColumn(TABLE, COLUMN.name)) {
					await queryRunner.query(
						`UPDATE "${TABLE}" SET "${COLUMN.name}" = NULL WHERE "${COLUMN.name}" IS NOT NULL`
					);
				}
				break;
			case 'mysql':
				if (await queryRunner.hasColumn(TABLE, COLUMN.name)) {
					await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP COLUMN \`${COLUMN.name}\``);
				}
				break;
		}
	}
}

/** Adds the column when it is not there yet. */
async function addColumn(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
	if (dialect === 'postgres') {
		// Postgres guards the statement itself.
		await queryRunner.query(`ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "${COLUMN.name}" ${COLUMN.postgres}`);
		return;
	}
	if (await queryRunner.hasColumn(TABLE, COLUMN.name)) {
		return;
	}
	const table = dialect === 'mysql' ? `\`${TABLE}\`` : `"${TABLE}"`;
	const column = dialect === 'mysql' ? `\`${COLUMN.name}\`` : `"${COLUMN.name}"`;
	await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${COLUMN[dialect]}`);
}

/** The dialect of the connection's driver. Throws before any statement runs on any other database. */
function dialectOf(queryRunner: QueryRunner): Dialect {
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
