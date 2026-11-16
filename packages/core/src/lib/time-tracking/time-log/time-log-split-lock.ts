import { DataSource, QueryRunner } from 'typeorm';
import { ID } from '@gauzy/contracts';

/** How long a split waits, in seconds, for the split of the same log another API process is running. */
export const TIME_LOG_SPLIT_LOCK_WAIT_SECONDS = 10;

/** PostgreSQL's code for a lock not taken within `lock_timeout`. */
const POSTGRES_LOCK_NOT_AVAILABLE = '55P03';

/**
 * Raised when a split waited {@link TIME_LOG_SPLIT_LOCK_WAIT_SECONDS} for the split of the same log another API
 * process runs, and that one still runs: nothing was written, and the log is about to change.
 */
export class TimeLogSplitBusyError extends Error {
	constructor(timeLogId: ID) {
		super(`Another split of time log ${timeLogId} is still running`);
		this.name = 'TimeLogSplitBusyError';
	}
}

/** The name of the lock on splitting one log: 57 characters, under MySQL's limit of 64. */
function lockNameOf(timeLogId: ID): string {
	return `gauzy:time-log-split:${timeLogId}`;
}

/** The code of a database error, as the driver gives it or as TypeORM copies it. */
function errorCodeOf(error: unknown): string | undefined {
	const failure = error as { code?: unknown; driverError?: { code?: unknown } } | null;
	const code = failure?.code ?? failure?.driverError?.code;
	if (typeof code === 'string') {
		return code;
	}
	return undefined;
}

/**
 * Runs `work` in a PostgreSQL transaction of its own connection that holds the advisory lock on splitting the log:
 * `work` writes through other connections, and ending this transaction, which wrote nothing, releases the lock.
 */
async function withAdvisoryLock<T>(dataSource: DataSource, timeLogId: ID, work: () => Promise<T>): Promise<T> {
	const runner: QueryRunner = dataSource.createQueryRunner();
	await runner.connect();
	try {
		await runner.startTransaction();
		try {
			await runner.query(`SET LOCAL lock_timeout = '${TIME_LOG_SPLIT_LOCK_WAIT_SECONDS}s'`);
			try {
				await runner.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockNameOf(timeLogId)]);
			} catch (error) {
				if (errorCodeOf(error) === POSTGRES_LOCK_NOT_AVAILABLE) {
					throw new TimeLogSplitBusyError(timeLogId);
				}
				throw error;
			}
			return await work();
		} finally {
			await runner.rollbackTransaction();
		}
	} finally {
		await runner.release();
	}
}

/**
 * Runs `work` while a MySQL connection of its own holds the named lock on splitting the log, released once `work`
 * settles; `work` writes through other connections.
 */
async function withNamedLock<T>(dataSource: DataSource, timeLogId: ID, work: () => Promise<T>): Promise<T> {
	const name = lockNameOf(timeLogId);
	const runner: QueryRunner = dataSource.createQueryRunner();
	await runner.connect();
	try {
		const [row] = await runner.query('SELECT GET_LOCK(?, ?) AS `acquired`', [
			name,
			TIME_LOG_SPLIT_LOCK_WAIT_SECONDS
		]);
		const isAcquired = Number(row?.acquired) === 1;
		if (!isAcquired) {
			throw new TimeLogSplitBusyError(timeLogId);
		}
		try {
			return await work();
		} finally {
			await runner.query('SELECT RELEASE_LOCK(?)', [name]);
		}
	} finally {
		await runner.release();
	}
}

/**
 * Runs the split of one log while this API process holds the database's lock on splitting that log, so the splits of
 * a log run one after the other on every API process, as `DeleteTimeSpanHandler`'s own queue orders them within one.
 * Each then reads the log once the one before it finished, and leaves it whole when it changed since it was checked.
 * The split cannot run inside one transaction (its cut writes through `TimeLogUpdateCommand`'s own repositories), so
 * the lock is a named one, held by a connection that writes nothing: PostgreSQL's advisory lock, MySQL's `GET_LOCK`.
 * SQLite has one writer and one API process over its file: the split runs as it is, as it does without a data source.
 *
 * @param dataSource - The API's data source; none in a handler built without it.
 * @param timeLogId - The log split.
 * @param work - The split.
 * @throws TimeLogSplitBusyError When another split of the log still runs after the wait; nothing was written.
 */
export async function withTimeLogSplitLock<T>(
	dataSource: DataSource | undefined,
	timeLogId: ID,
	work: () => Promise<T>
): Promise<T> {
	const type = dataSource?.options?.type;
	if (type === 'postgres') {
		return await withAdvisoryLock(dataSource, timeLogId, work);
	}
	const isMySql = type === 'mysql' || type === 'mariadb';
	if (isMySql) {
		return await withNamedLock(dataSource, timeLogId, work);
	}
	return await work();
}
