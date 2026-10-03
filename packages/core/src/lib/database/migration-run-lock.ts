import { DataSource, Migration, MigrationExecutor, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * The Postgres advisory lock held around a whole migration run: ASCII `gauz` / `migr`. The two-key
 * form is a key space of its own in Postgres, so it can never collide with the single-key locks that
 * individual migrations take on their own timestamps (e.g. `1790000021000`).
 */
export const MIGRATION_RUN_LOCK_KEYS: readonly [number, number] = [0x6761757a, 0x6d696772];

type RunMigrationsOptions = Parameters<DataSource['runMigrations']>[0];

/** Whether runs against this database take the cross-process lock (Postgres only). */
export function usesMigrationRunLock(options: { readonly type?: string }): boolean {
	return options.type === DatabaseTypeEnum.postgres;
}

/**
 * Runs `run` while holding the migration-run advisory lock, on the connection that holds it.
 *
 * Session-level rather than transaction-level: with `migrationsTransactionMode: 'each'` every migration
 * commits on its own, and the lock has to outlast all of them. Postgres also releases it when the
 * session ends, so a process that dies mid-run cannot leave the others waiting. If the explicit unlock
 * fails, the session is discarded rather than returned to the pool, where it would keep the lock.
 */
export async function withMigrationRunLock<T>(
	dataSource: Pick<DataSource, 'createQueryRunner'>,
	run: (queryRunner: QueryRunner) => Promise<T>
): Promise<T> {
	const queryRunner = dataSource.createQueryRunner();
	let lockMayBeHeld = false;
	try {
		await queryRunner.connect();
		await queryRunner.query('SELECT pg_advisory_lock($1, $2)', [...MIGRATION_RUN_LOCK_KEYS]);
		lockMayBeHeld = true;
		try {
			return await run(queryRunner);
		} finally {
			// A failed unlock must not hide the run's own error; the session is discarded below instead.
			lockMayBeHeld = !(await unlock(queryRunner));
		}
	} finally {
		await (lockMayBeHeld ? discardSession(queryRunner) : queryRunner.release());
	}
}

/** Releases the lock, after rolling back anything a failed migration left open; false if that failed. */
async function unlock(queryRunner: QueryRunner): Promise<boolean> {
	try {
		if (queryRunner.isTransactionActive) {
			await queryRunner.rollbackTransaction();
		}
		await queryRunner.query('SELECT pg_advisory_unlock($1, $2)', [...MIGRATION_RUN_LOCK_KEYS]);
		return true;
	} catch {
		return false;
	}
}

/**
 * Ends the session instead of pooling it. TypeORM's Postgres query runner releases with an error
 * through `releasePostgresConnection`, which makes pg-pool destroy the client rather than reuse it;
 * should that internal ever go away, this falls back to a plain release (the pool's idle timeout then
 * ends the session).
 */
async function discardSession(queryRunner: QueryRunner): Promise<void> {
	const releaseWithError = (queryRunner as unknown as { releasePostgresConnection?: (error: Error) => Promise<void> })
		.releasePostgresConnection;
	if (typeof releaseWithError === 'function') {
		await releaseWithError.call(
			queryRunner,
			new Error('Discarding the session: the migration run lock may still be held.')
		);
	} else {
		await queryRunner.release();
	}
}

/**
 * A `DataSource` whose migration runs are one-at-a-time across processes on Postgres.
 *
 * The Gauzy API and the Teams API run the same image against one database, and both run the pending
 * migrations when they boot (`migrationsRun`). TypeORM reads the executed migrations, runs the missing
 * ones and records each — and nothing stopped the second process from reading that list before the
 * first had written to it. Each migration then ran twice (harmlessly: they are idempotent, and the
 * newer ones serialise their own statements with an advisory lock) and was RECORDED twice, two rows
 * per migration in `migrations`. Holding one lock around the whole run makes the second process wait,
 * then read a list that already holds the first one's rows: it finds nothing pending.
 *
 * Used for every Gauzy data source that runs migrations: the application's (`DatabaseModule`), the
 * migration CLI and the seeder. SQLite and MySQL run exactly as before.
 */
export class MigrationLockingDataSource extends DataSource {
	override async runMigrations(options?: RunMigrationsOptions): Promise<Migration[]> {
		if (!usesMigrationRunLock(this.options) || !this.isInitialized) {
			// Not Postgres, or not connected (TypeORM's own method throws the right error for that).
			return super.runMigrations(options);
		}
		return withMigrationRunLock(this, (queryRunner) => {
			// What `DataSource.runMigrations` does, on the locked connection instead of a fresh one.
			const executor = new MigrationExecutor(this, queryRunner);
			executor.transaction = options?.transaction ?? this.options.migrationsTransactionMode ?? 'all';
			executor.fake = options?.fake ?? false;
			return executor.executePendingMigrations();
		});
	}
}
