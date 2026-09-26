import { AsyncLocalStorage } from 'node:async_hooks';
import { DataSource, DataSourceOptions, EntityManager, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Transactions on the embedded dialects, one at a time, and no statement inside another request's.
 *
 * 🛑 **On SQLite, TypeORM has one query runner per data source, so two requests' transactions are not
 * two transactions.** The better-sqlite3 driver — which serves both the `sqlite` and the
 * `better-sqlite3` setting, since TypeORM 1.0 ships no other SQLite driver — answers every
 * `createQueryRunner()` with the same runner (`this.queryRunner ??= new BetterSqlite3QueryRunner(this)`)
 * over the database file's one connection. Every transaction on the data source therefore drives the
 * same `BEGIN` / `SAVEPOINT` / `COMMIT` bookkeeping. Measured against an in-memory database on
 * TypeORM 1.0.0:
 *
 * - **opened in the same tick**, both issue `BEGIN`. The second fails with "cannot start a transaction
 *   within a transaction", and the `ROLLBACK` it answers that with ends the FIRST one's transaction. The
 *   first one's later statements then autocommit, and its commit fails, so it reports failure although
 *   every row it wrote is stored — and a first one that fails on its own keeps its rows too;
 * - **opened a little later**, the second runs as `SAVEPOINT typeorm_1` inside the first. The first's
 *   commit only releases that savepoint and reports success with nothing committed, and when the second
 *   then fails, its `ROLLBACK` undoes the rows the first had already reported;
 * - **a `save()` from another request**, made while a transaction is open, reads the shared
 *   `isTransactionActive`, skips the transaction it would have opened, and is rolled back with the other
 *   request's;
 * - **a single statement from another request** — a read, an `insert()`, `update()` or `delete()`, a
 *   `query()` — made while a transaction is open runs inside it: a read sees that transaction's
 *   uncommitted rows, and a write is rolled back with it although its own caller was told it succeeded;
 * - **once SQLite has rolled a transaction back on its own** (`INSERT OR ROLLBACK`, a trigger's
 *   `RAISE(ROLLBACK)`, a full disk), TypeORM's `ROLLBACK` fails and the runner is left believing a
 *   transaction is open. Every later transaction on the data source is a savepoint of nothing, and the
 *   first one to fail leaves the connection inside a transaction that nothing will ever commit.
 *
 * MikroORM does not have the defect on the same dialect: knex gives SQLite a pool of exactly one
 * connection, so a second transaction — or any statement — waits for the connection until the first
 * one ends, for at most knex's 60-second acquire timeout. This gives TypeORM the same contract, for its
 * transactions and for the statements run outside them. PostgreSQL and MySQL are not touched: their
 * drivers hand each runner its own pooled connection, and the database isolates the transactions.
 *
 * **The design.** Each data source gets a first-in-first-out queue for its connection. A top-level
 * transaction claims the connection before its `BEGIN` and gives it back once the connection is
 * outside any transaction; the next claim in line is then granted. Which code a claim belongs to is
 * kept in an `AsyncLocalStorage`, so ownership follows the transaction's own asynchronous work and
 * nothing else:
 *
 * - a transaction opened from inside the one that holds the connection is nested, and goes straight to
 *   TypeORM, which makes it a `SAVEPOINT`. It does not matter whether it is asked for through the
 *   manager the callback was handed, the data source's own manager or a query runner: a transaction
 *   never waits for itself;
 * - `EntityManager.transaction` — which `DataSource.transaction`, every repository's manager and every
 *   manager a query runner carries go through — runs its whole call in a context of its own. Two
 *   transactions opened in the same tick by the same caller therefore hold two claims, not one;
 * - `QueryRunner.startTransaction` claims the connection for the code that called it and marks that
 *   code's continuation as the owner. That covers the transaction TypeORM opens for a `save()` or
 *   `remove()` and a transaction opened by hand on a query runner, together with everything that code
 *   then runs, including a nested transaction it opens through a command handler;
 * - `isTransactionActive` reads false to every context that does not hold the connection. A `save()`
 *   from another request therefore opens — and waits for — a transaction of its own instead of joining
 *   one it does not own, and a `commitTransaction()` or `rollbackTransaction()` from such a context is
 *   refused by TypeORM itself instead of ending the holder's transaction. That is also what keeps a
 *   transaction that gave up waiting from rolling back the one it waited for;
 * - `QueryRunner.query` — which every read and write of the runner goes through, from a repository's
 *   `find()` or `update()` to a query builder's `execute()` and `DataSource.query` — runs a statement
 *   from the context holding the connection at once: it is part of that transaction, or of one of its
 *   savepoints, and a transaction never waits for its own statements. A statement from any other
 *   context takes its turn in the same line as the transactions and holds the connection only while
 *   it runs. It therefore never runs inside another request's transaction — it neither sees that
 *   transaction's uncommitted rows nor is rolled back with it — and no transaction begins half-way
 *   through it. What it costs is the wait, which is the wait a statement has on MikroORM; the
 *   bookkeeping itself measured under a microsecond for a statement on a free connection, which
 *   reaches TypeORM in its caller's turn as it always did, and a few microseconds for one that queued.
 *
 * The connection is given back when the outermost commit or rollback returns — whether or not it
 * succeeded — and the connection itself (better-sqlite3's `inTransaction`) says no transaction is
 * open; a commit that failed leaves the claim with its owner, whose rollback releases it. When TypeORM's
 * bookkeeping disagrees with the connection, it is corrected before the next claim reads it. A
 * statement gives the connection back as soon as it has run, whether or not it succeeded.
 *
 * **Limits of the ownership rule.** A claim taken through `QueryRunner.startTransaction` marks the
 * caller's continuation; when that call is made before the caller's first `await`, the mark also
 * reaches a sibling started in the same synchronous tick by the same parent, which then joins the
 * transaction as a savepoint and runs its statements inside it — the behaviour every sibling had
 * before. The `EntityManager` path has no such limit. Ownership follows the code, not the manager: a
 * transaction that waits for work it cannot see — another context's transaction it awaits, or a
 * statement it awaits that a loader or cache shared between requests started from another request's
 * context — holds the connection that work is waiting for. The work waits out
 * {@link EMBEDDED_TRANSACTION_WAIT_TIMEOUT_MS} and fails, as it would on MikroORM when it runs through a
 * manager other than the transaction's.
 */

/**
 * How long a transaction, or a statement outside one, waits for the connection before it gives up.
 *
 * It is knex's default acquire timeout, which is what a MikroORM transaction or statement waits on the
 * same dialect.
 */
export const EMBEDDED_TRANSACTION_WAIT_TIMEOUT_MS = 60_000;

/** The TypeORM data source types whose driver runs every statement through one shared query runner. */
const EMBEDDED_DATA_SOURCE_TYPES: ReadonlySet<string> = new Set<string>([
	DatabaseTypeEnum.sqlite,
	DatabaseTypeEnum.betterSqlite3
]);

/** What waits in the queue: a top-level transaction, or a single statement run outside one. */
export type EmbeddedConnectionWaiter = 'transaction' | 'statement';

/**
 * Raised to a transaction — or a statement outside one — that waited longer than the queue allows for
 * the embedded connection.
 */
export class EmbeddedTransactionWaitTimeoutError extends Error {
	/**
	 * @param waitedMs How long it waited, in milliseconds.
	 * @param waiter What waited. A transaction is the default, and its message is the one it always was.
	 */
	constructor(waitedMs: number, waiter: EmbeddedConnectionWaiter = 'transaction') {
		super(
			`EMBEDDED_TRANSACTION_WAIT_TIMEOUT: a ${waiter} waited ${waitedMs} ms for the embedded database's ` +
				`connection, which ${waiter === 'transaction' ? 'another' : 'a'} transaction still holds.`
		);
		this.name = 'EmbeddedTransactionWaitTimeoutError';
	}
}

/** How the queue is set up. */
export interface IEmbeddedTransactionQueueOptions {
	/** How long a transaction, or a statement outside one, waits for the connection, in milliseconds. */
	waitTimeoutMs?: number;
}

/**
 * One top-level transaction's claim on the connection, or one statement's outside any transaction.
 *
 * A claim serves one transaction and is never queued again, so a context that still carries a claim
 * whose transaction has ended is not mistaken for the owner of the next one. A statement's claim is
 * never carried by any context: nothing but the statement itself runs while it holds the connection.
 */
class ConnectionClaim {
	queued = false;
}

/** The first-in-first-out queue of claims on one data source's connection. */
class ConnectionQueue {
	private holder: ConnectionClaim | null = null;
	private readonly waiting: Array<{ claim: ConnectionClaim; grant: () => void }> = [];

	constructor(private readonly waitTimeoutMs: number) {}

	/** Whether any claim holds the connection. */
	get held(): boolean {
		return this.holder !== null;
	}

	/**
	 * Whether the claim is the one holding the connection.
	 *
	 * @param claim The claim, or nothing for a context that carries none.
	 * @returns True only for the holder.
	 */
	holds(claim: ConnectionClaim | undefined): boolean {
		return !!claim && claim === this.holder;
	}

	/**
	 * Gives the claim the connection at once if it is free. A free connection has no claim waiting for it.
	 *
	 * @param claim The claim.
	 * @returns True when the claim now holds the connection.
	 */
	tryAcquire(claim: ConnectionClaim): boolean {
		if (this.holder !== null) {
			return false;
		}

		this.holder = claim;
		return true;
	}

	/**
	 * Waits until the claim holds the connection.
	 *
	 * @param claim The claim.
	 * @param waiter What the claim is for, which a claim that waited too long is rejected with.
	 * @returns A promise settled when the claim is granted, or rejected when it waited too long. A claim
	 * that gave up is taken out of the line, so it is never granted afterwards.
	 */
	acquire(claim: ConnectionClaim, waiter: EmbeddedConnectionWaiter): Promise<void> {
		if (this.tryAcquire(claim)) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const entry = {
				claim,
				grant: () => {
					clearTimeout(timer);
					resolve();
				}
			};
			const timer = setTimeout(() => {
				const index = this.waiting.indexOf(entry);

				if (index >= 0) {
					this.waiting.splice(index, 1);
					reject(new EmbeddedTransactionWaitTimeoutError(this.waitTimeoutMs, waiter));
				}
			}, this.waitTimeoutMs);

			// A claim waiting on a data source that is being shut down must not keep the process alive.
			timer.unref?.();
			this.waiting.push(entry);
		});
	}

	/** Gives the connection to the next claim in line, or leaves it free. */
	release(): void {
		const next = this.waiting.shift();

		this.holder = next?.claim ?? null;
		next?.grant();
	}
}

/** The queue and the ownership context of one data source. */
interface IEmbeddedTransactionState {
	readonly queue: ConnectionQueue;
	readonly context: AsyncLocalStorage<ConnectionClaim>;
}

/**
 * The members of TypeORM's SQLite query runner the queue reads and corrects. `transactionDepth` is
 * protected in TypeORM's typings, and the connection's own `inTransaction` is better-sqlite3's.
 */
interface ISqliteRunnerInternals {
	isTransactionActive: boolean;
	transactionDepth: number;
	driver?: { databaseConnection?: { inTransaction?: unknown } };
}

/** Marks a query runner the queue already guards, so it is never wrapped twice. */
const GUARDED_RUNNER = Symbol('gauzy.embeddedTransactionQueue');

/** The state of every data source the queue was installed on. */
const STATES = new WeakMap<DataSource, IEmbeddedTransactionState>();

/**
 * Whether the data source is one whose transactions share one connection.
 *
 * @param dataSource The data source.
 * @returns True for the embedded dialects.
 */
export function isEmbeddedDataSource(dataSource: DataSource): boolean {
	return EMBEDDED_DATA_SOURCE_TYPES.has(`${dataSource?.options?.type ?? ''}`);
}

/**
 * Whether the queue is installed on the data source.
 *
 * @param dataSource The data source.
 * @returns True once {@link serializeEmbeddedTransactions} has installed it.
 */
export function hasEmbeddedTransactionQueue(dataSource: DataSource): boolean {
	return STATES.has(dataSource);
}

/**
 * Makes the transactions of an embedded data source run one at a time, as described at the top of
 * this file. Any other data source is returned exactly as it was given.
 *
 * It can be installed before or after the data source is initialized, and installing it twice is the
 * same as installing it once. It guards the query runner the driver hands out, including the new one a
 * data source that was destroyed and initialized again creates.
 *
 * @param dataSource The data source.
 * @param options How long a transaction waits for the connection.
 * @returns The same data source.
 */
export function serializeEmbeddedTransactions(
	dataSource: DataSource,
	options: IEmbeddedTransactionQueueOptions = {}
): DataSource {
	if (!isEmbeddedDataSource(dataSource) || STATES.has(dataSource)) {
		return dataSource;
	}

	const state: IEmbeddedTransactionState = {
		queue: new ConnectionQueue(options.waitTimeoutMs ?? EMBEDDED_TRANSACTION_WAIT_TIMEOUT_MS),
		context: new AsyncLocalStorage<ConnectionClaim>()
	};
	STATES.set(dataSource, state);

	// Every entity manager of the data source: its own, and every one it creates — the one each query
	// runner carries included, since `createQueryRunner` builds it through `createEntityManager`.
	const transaction = transactionOf(dataSource.manager, state);
	const createEntityManager = dataSource.createEntityManager.bind(dataSource);

	guardManager(dataSource.manager, transaction);
	dataSource.createEntityManager = (queryRunner?: QueryRunner): EntityManager =>
		guardManager(createEntityManager(queryRunner), transaction);

	// Every query runner the driver hands out, including the one it already holds.
	const driver = dataSource.driver as unknown as {
		createQueryRunner: (mode: unknown) => QueryRunner;
		queryRunner?: QueryRunner;
	};
	const createQueryRunner = driver.createQueryRunner.bind(driver);

	driver.createQueryRunner = (mode: unknown): QueryRunner => guardRunner(createQueryRunner(mode), state);

	if (driver.queryRunner) {
		guardRunner(driver.queryRunner, state);
	}

	return dataSource;
}

/**
 * Builds a data source with the queue installed: the factory the platform's TypeORM module creates its
 * data source with.
 *
 * @param options The data source options.
 * @returns The data source, not yet initialized — the module initializes it.
 */
export async function createPlatformDataSource(options: DataSourceOptions): Promise<DataSource> {
	return serializeEmbeddedTransactions(new DataSource(options));
}

/**
 * The `transaction` every guarded manager of one data source answers.
 *
 * A call from the context holding the connection is nested and is passed straight on. Any other call
 * runs in a context of its own, whose fresh claim the query runner's `startTransaction` then queues.
 *
 * @param manager A manager of the data source, whose own `transaction` is TypeORM's.
 * @param state The data source's queue and context.
 * @returns The guarded method.
 */
function transactionOf(manager: EntityManager, state: IEmbeddedTransactionState): EntityManager['transaction'] {
	const original = manager.transaction;

	return function (this: EntityManager, ...args: unknown[]) {
		if (state.queue.holds(state.context.getStore())) {
			return original.apply(this, args);
		}

		return state.context.run(new ConnectionClaim(), () => original.apply(this, args));
	} as EntityManager['transaction'];
}

/**
 * Gives a manager the guarded `transaction`.
 *
 * @param manager The manager.
 * @param transaction The data source's guarded method.
 * @returns The same manager.
 */
function guardManager(manager: EntityManager, transaction: EntityManager['transaction']): EntityManager {
	manager.transaction = transaction;
	return manager;
}

/**
 * Guards the data source's shared query runner.
 *
 * @param runner The query runner the driver handed out.
 * @param state The data source's queue and context.
 * @returns The same runner.
 */
function guardRunner(runner: QueryRunner, state: IEmbeddedTransactionState): QueryRunner {
	const target = runner as QueryRunner & ISqliteRunnerInternals & { [GUARDED_RUNNER]?: true };

	if (target[GUARDED_RUNNER]) {
		return runner;
	}
	target[GUARDED_RUNNER] = true;

	const { queue, context } = state;
	const startTransaction = runner.startTransaction.bind(runner);
	const commitTransaction = runner.commitTransaction.bind(runner);
	const rollbackTransaction = runner.rollbackTransaction.bind(runner);
	const query: (...args: unknown[]) => Promise<unknown> = runner.query.bind(runner);

	// TypeORM writes the flag; everyone reads it through the owner rule. Only the context holding the
	// connection — or anyone, while nothing holds it — sees the transaction that is open.
	let active = target.isTransactionActive;
	Object.defineProperty(target, 'isTransactionActive', {
		configurable: true,
		enumerable: true,
		get: (): boolean => active && (!queue.held || queue.holds(context.getStore())),
		set: (value: boolean) => {
			active = value;
		}
	});

	/**
	 * Gives the connection back once it is outside every transaction. TypeORM's bookkeeping is made to
	 * agree with the connection first: after a `ROLLBACK` that found SQLite had already rolled back on
	 * its own, it still says a transaction is open, and would hand the next claim a savepoint of nothing.
	 */
	const releaseIfIdle = (): void => {
		const connection = target.driver?.databaseConnection;
		const inTransaction = typeof connection?.inTransaction === 'boolean' ? connection.inTransaction : active;

		if (inTransaction) {
			return;
		}

		active = false;
		target.transactionDepth = 0;
		queue.release();
	};

	// Not `async`: `enterWith` has to run in the caller's own synchronous turn to mark its continuation.
	target.startTransaction = (isolationLevel?: Parameters<QueryRunner['startTransaction']>[0]): Promise<void> => {
		const current = context.getStore();

		if (queue.holds(current)) {
			// Opened from inside the transaction that holds the connection: TypeORM makes it a savepoint.
			return startTransaction(isolationLevel);
		}

		let claim = current;

		if (!claim || claim.queued) {
			claim = new ConnectionClaim();
			context.enterWith(claim);
		}
		claim.queued = true;

		return queue.acquire(claim, 'transaction').then(async () => {
			try {
				await startTransaction(isolationLevel);
			} catch (error) {
				releaseIfIdle();
				throw error;
			}
		});
	};

	const ending = (finish: () => Promise<void>) => async (): Promise<void> => {
		// Read before TypeORM moves the depth: only the holder's outermost commit or rollback ends the claim.
		const outermost = queue.holds(context.getStore()) && target.transactionDepth <= 1;

		try {
			await finish();
		} finally {
			if (outermost) {
				releaseIfIdle();
			}
		}
	};

	target.commitTransaction = ending(commitTransaction);
	target.rollbackTransaction = ending(rollbackTransaction);

	// Every statement of the runner, TypeORM's own `BEGIN`, `SAVEPOINT` and `COMMIT` included. Not `async`:
	// whenever it need not wait, a statement reaches TypeORM in its caller's own turn, as it always did.
	target.query = ((...args: unknown[]): Promise<unknown> => {
		if (queue.holds(context.getStore())) {
			// Part of the transaction holding the connection, or of one of its savepoints.
			return query(...args);
		}

		// Outside every transaction: it holds the connection for exactly as long as it runs, so no
		// transaction can begin half-way through it. While a transaction is open, it waits for that one
		// and for every claim queued before it.
		const claim = new ConnectionClaim();
		const run = (): Promise<unknown> => {
			try {
				return query(...args).finally(() => queue.release());
			} catch (error) {
				queue.release();
				throw error;
			}
		};

		return queue.tryAcquire(claim) ? run() : queue.acquire(claim, 'statement').then(run);
	}) as QueryRunner['query'];

	return runner;
}
