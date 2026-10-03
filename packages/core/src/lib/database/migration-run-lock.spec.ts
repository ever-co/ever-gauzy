import { DataSource, MigrationExecutor, QueryRunner } from 'typeorm';
import {
	MIGRATION_RUN_LOCK_KEYS,
	MigrationLockingDataSource,
	usesMigrationRunLock,
	withMigrationRunLock
} from './migration-run-lock';

/**
 * A minimal stand-in for one Postgres database shared by several processes: the `migrations` table and
 * the advisory locks, with `pg_advisory_lock` blocking until the holder unlocks.
 */
class FakePostgres {
	readonly migrationsTable: string[] = [];
	private holder: object | null = null;
	private waiting: Array<() => void> = [];

	/** A query runner for one session (one pooled connection of one process). */
	session(log: string[] = []): QueryRunner {
		const session = {};
		const query = async (sql: string) => {
			log.push(sql);
			if (sql.startsWith('SELECT pg_advisory_lock(')) {
				while (this.holder && this.holder !== session) {
					await new Promise<void>((resolve) => this.waiting.push(resolve));
				}
				this.holder = session;
			} else if (sql.startsWith('SELECT pg_advisory_unlock(')) {
				if (this.holder === session) {
					this.holder = null;
					this.waiting.splice(0).forEach((wake) => wake());
				}
			}
			return [];
		};
		return {
			connect: async () => log.push('connect'),
			release: async () => log.push('release'),
			query
		} as unknown as QueryRunner;
	}

	/**
	 * What TypeORM's executor does with the table: read the executed migrations, run the missing ones
	 * (yielding, as real DDL does), then record each.
	 */
	async executePending(all: string[]): Promise<string[]> {
		const executed = new Set(this.migrationsTable);
		const pending = all.filter((name) => !executed.has(name));
		for (const name of pending) {
			await new Promise((resolve) => setImmediate(resolve));
			this.migrationsTable.push(name);
		}
		return pending;
	}
}

const MIGRATIONS = ['EverInstance1790000021000', 'EverStatsReport1790000021100'];

describe('migration run lock', () => {
	afterEach(() => jest.restoreAllMocks());

	it('applies to Postgres only', () => {
		expect(usesMigrationRunLock({ type: 'postgres' })).toBe(true);
		expect(usesMigrationRunLock({ type: 'better-sqlite3' })).toBe(false);
		expect(usesMigrationRunLock({ type: 'sqlite' })).toBe(false);
		expect(usesMigrationRunLock({ type: 'mysql' })).toBe(false);
	});

	it('uses the two-key advisory lock, a key space apart from the per-migration single-key locks', () => {
		for (const key of MIGRATION_RUN_LOCK_KEYS) {
			expect(Number.isInteger(key) && key > 0 && key < 2 ** 31).toBe(true);
		}
	});

	describe('withMigrationRunLock', () => {
		it('locks, runs on the locked connection, unlocks and releases, in that order', async () => {
			const log: string[] = [];
			const queryRunner = new FakePostgres().session(log);
			let ranOn: QueryRunner | undefined;

			const result = await withMigrationRunLock({ createQueryRunner: () => queryRunner }, async (runner) => {
				ranOn = runner;
				log.push('run');
				return 'done';
			});

			expect(result).toBe('done');
			expect(ranOn).toBe(queryRunner);
			expect(log).toEqual([
				'connect',
				'SELECT pg_advisory_lock($1, $2)',
				'run',
				'SELECT pg_advisory_unlock($1, $2)',
				'release'
			]);
		});

		it('unlocks and releases when the run fails, and reports the run failure', async () => {
			const log: string[] = [];
			const queryRunner = new FakePostgres().session(log);

			await expect(
				withMigrationRunLock({ createQueryRunner: () => queryRunner }, async () => {
					throw new Error('migration failed');
				})
			).rejects.toThrow('migration failed');

			expect(log.slice(-2)).toEqual(['SELECT pg_advisory_unlock($1, $2)', 'release']);
		});

		/** A query runner whose unlock fails, shaped like TypeORM's Postgres one. */
		const failingUnlock = (withReleaseWithError = true) => {
			const queryRunner: {
				connect: jest.Mock;
				release: jest.Mock;
				query: jest.Mock;
				releasePostgresConnection?: jest.Mock;
			} = {
				connect: jest.fn(async () => undefined),
				release: jest.fn(async () => undefined),
				query: jest.fn(async (sql: string) => {
					if (sql.includes('unlock')) throw new Error('unlock failed');
					return [];
				})
			};
			if (withReleaseWithError) {
				queryRunner.releasePostgresConnection = jest.fn(async () => undefined);
			}
			return queryRunner;
		};

		it('keeps the run result when the unlock fails, and discards the session instead of pooling it', async () => {
			const queryRunner = failingUnlock();

			await expect(
				withMigrationRunLock(
					{ createQueryRunner: () => queryRunner as unknown as QueryRunner },
					async () => 'done'
				)
			).resolves.toBe('done');

			// Pooled, the session would keep the lock and make every other process wait.
			expect(queryRunner.releasePostgresConnection).toHaveBeenCalledWith(expect.any(Error));
			expect(queryRunner.release).not.toHaveBeenCalled();
		});

		it('falls back to a plain release when the query runner cannot be discarded', async () => {
			const queryRunner = failingUnlock(false);

			await withMigrationRunLock(
				{ createQueryRunner: () => queryRunner as unknown as QueryRunner },
				async () => 'done'
			);

			expect(queryRunner.release).toHaveBeenCalled();
		});

		it('rolls back a transaction a failed migration left open before unlocking', async () => {
			const log: string[] = [];
			const queryRunner = Object.assign(new FakePostgres().session(log), {
				isTransactionActive: true,
				rollbackTransaction: async () => void log.push('rollback')
			});

			await expect(
				withMigrationRunLock({ createQueryRunner: () => queryRunner }, async () => {
					throw new Error('migration failed');
				})
			).rejects.toThrow('migration failed');

			expect(log.slice(-3)).toEqual(['rollback', 'SELECT pg_advisory_unlock($1, $2)', 'release']);
		});

		it('records each migration once when two processes boot against one database at the same time', async () => {
			const database = new FakePostgres();
			const boot = () =>
				withMigrationRunLock({ createQueryRunner: () => database.session() }, () =>
					database.executePending(MIGRATIONS)
				);

			const [first, second] = await Promise.all([boot(), boot()]);

			expect(database.migrationsTable).toEqual(MIGRATIONS);
			expect([...first, ...second].sort()).toEqual([...MIGRATIONS].sort());
		});

		it('CONTROL: without the lock, the same two boots record every migration twice', async () => {
			const database = new FakePostgres();

			await Promise.all([database.executePending(MIGRATIONS), database.executePending(MIGRATIONS)]);

			expect(database.migrationsTable).toHaveLength(MIGRATIONS.length * 2);
		});
	});

	describe('MigrationLockingDataSource.runMigrations', () => {
		/** The override, called on a stand-in data source (only the members it reads). */
		const runMigrations = (dataSource: object, options?: Parameters<DataSource['runMigrations']>[0]) =>
			MigrationLockingDataSource.prototype.runMigrations.call(dataSource as MigrationLockingDataSource, options);

		it.each(['better-sqlite3', 'sqlite', 'mysql'])(
			'runs exactly as TypeORM does on %s, without a lock',
			async (type) => {
				const plain = jest.spyOn(DataSource.prototype, 'runMigrations').mockResolvedValue([]);
				const createQueryRunner = jest.fn();
				const dataSource = { options: { type }, isInitialized: true, createQueryRunner };

				await runMigrations(dataSource, { transaction: 'each' });

				expect(plain).toHaveBeenCalledWith({ transaction: 'each' });
				expect(createQueryRunner).not.toHaveBeenCalled();
			}
		);

		it('on Postgres, runs the pending migrations on the locked connection with the configured transaction mode', async () => {
			const log: string[] = [];
			const queryRunner = new FakePostgres().session(log);
			const plain = jest.spyOn(DataSource.prototype, 'runMigrations');
			let seen: { queryRunner?: QueryRunner; transaction?: string; fake?: boolean } = {};
			jest.spyOn(MigrationExecutor.prototype, 'executePendingMigrations').mockImplementation(async function () {
				const executor = this as { queryRunner: QueryRunner; transaction: string; fake: boolean };
				seen = { queryRunner: executor.queryRunner, transaction: executor.transaction, fake: executor.fake };
				log.push('execute');
				return [];
			});
			const dataSource = {
				options: { type: 'postgres', migrationsTransactionMode: 'each' },
				isInitialized: true,
				createQueryRunner: () => queryRunner,
				driver: { options: {}, database: undefined, buildTableName: (name: string) => name }
			};

			await runMigrations(dataSource);

			expect(plain).not.toHaveBeenCalled();
			expect(seen).toEqual({ queryRunner, transaction: 'each', fake: false });
			expect(log).toEqual([
				'connect',
				'SELECT pg_advisory_lock($1, $2)',
				'execute',
				'SELECT pg_advisory_unlock($1, $2)',
				'release'
			]);
		});

		it('leaves a data source that is not initialized to TypeORM, which refuses it', async () => {
			const plain = jest
				.spyOn(DataSource.prototype, 'runMigrations')
				.mockRejectedValue(new Error('not connected'));
			const createQueryRunner = jest.fn();

			await expect(
				runMigrations({ options: { type: 'postgres' }, isInitialized: false, createQueryRunner })
			).rejects.toThrow('not connected');
			expect(createQueryRunner).not.toHaveBeenCalled();
			expect(plain).toHaveBeenCalled();
		});
	});
});
