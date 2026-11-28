import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The table and the column this migration adds. */
const TABLE = 'ever_connect_connection';
const COLUMN = 'membershipResyncDueAt';

/**
 * `@gauzy/plugin-ever-connect`: `ever_connect_connection.membershipResyncDueAt` (epoch milliseconds, empty when none
 * is owed): a membership resync that failed is owed again from this time, by whichever API process holds the lease
 * then. It used to be kept in the memory of the process whose resync failed, so a lease taken over by another process
 * lost it, and a removal or a demotion the skipped part of the feed held waited for the next start or `410`.
 *
 * The migration lives in core because plugins cannot carry migrations yet; the plugin's `MIGRATIONS.md` lists it. The
 * column exists whether or not the plugin is loaded.
 *
 * Safe to run on a live database: one nullable column on the plugin's own one-row table, added only when missing (so
 * running `up` twice is harmless), no default, no index, no statement per row. On Postgres a transaction-scoped
 * advisory lock serialises two API processes that boot at the same time, when the migration runs in a transaction (as
 * TypeORM runs migrations by default, and as the plugin's other migrations do); without one, `ADD COLUMN IF NOT EXISTS`
 * still makes a second run change nothing. MySQL has neither transactional DDL nor `ADD COLUMN IF NOT EXISTS`, so two
 * processes booting together could both find the column missing and the second `ALTER TABLE` would fail its start: a
 * MySQL named lock makes the check and the `ALTER TABLE` one critical section, as `AddEmailSentRetryColumns` does.
 *
 * `down` drops the column.
 */
export class EverConnectMembershipResyncDue1791000019900 implements MigrationInterface {
	name = 'EverConnectMembershipResyncDue1791000019900';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000019900;

	/** The MySQL named lock of this migration. MySQL refuses lock names over 64 characters. */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				if (!(await this.hasColumn(queryRunner))) {
					await queryRunner.query(`ALTER TABLE "${TABLE}" ADD COLUMN "${COLUMN}" bigint`);
				}
				break;
			case DatabaseTypeEnum.postgres:
				if (queryRunner.isTransactionActive) {
					await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
				}
				await queryRunner.query(`ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "${COLUMN}" bigint`);
				break;
			case DatabaseTypeEnum.mysql:
				// MySQL has no `ADD COLUMN IF NOT EXISTS`: the column is added only when missing, and the check and the
				// DDL run under a named lock, so a second process booting at the same time waits and then finds it.
				await withMysqlNamedLock(queryRunner, this.mysqlLockName, async () => {
					if (!(await this.hasColumn(queryRunner))) {
						await queryRunner.query(`ALTER TABLE \`${TABLE}\` ADD \`${COLUMN}\` bigint NULL`);
					}
				});
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		if (!(await this.hasColumn(queryRunner))) {
			return;
		}
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.postgres:
				await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN "${COLUMN}"`);
				break;
			case DatabaseTypeEnum.mysql:
				await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP COLUMN \`${COLUMN}\``);
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/** Whether `ever_connect_connection` already has the column. */
	private async hasColumn(queryRunner: QueryRunner): Promise<boolean> {
		return queryRunner.hasColumn(TABLE, COLUMN);
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
