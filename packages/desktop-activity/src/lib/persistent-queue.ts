import * as Queue from 'better-queue';
import { QueueStore } from './queue-store';

/**
 * What the store keeps for every job. It is written as JSON, so a payload must be JSON-serializable
 * (a `Date` comes back as an ISO string).
 */
interface IPersistedJob<T = unknown> {
	queue: string;
	payload: T;
	enqueuedAt: number;
}

export interface IPersistentJobContext {
	queue: string;
	/** 0 on the first attempt, then 1, 2, … on each retry. */
	attempt: number;
}

export type TPersistentJobProcessor<T = any> = (payload: T, context: IPersistentJobContext) => Promise<void>;

export interface IPersistentQueueOptions {
	/** SQLite file holding the jobs that are not done yet (created when missing; its folder must exist). */
	dbPath: string;
	/** Further attempts after a job first fails. Default: 3. */
	maxRetries?: number;
	/** Pause between two attempts, in ms. Default: 1000. */
	retryDelayMs?: number;
	/** Called once for a job that still fails after its last attempt. The job is then dropped. */
	onJobFailed?: (queue: string, payload: unknown, error: unknown) => void | Promise<void>;
}

export interface IPersistentQueueRegistration {
	/**
	 * Whether the queue may run its next job now — e.g. "is the API reachable" for a queue that uploads. While it
	 * answers false the jobs stay stored (across restarts too), and it is asked again every `recheckMs`.
	 */
	canRun?: () => boolean | Promise<boolean>;
	/** Default: 1000. */
	recheckMs?: number;
}

type TJobOutcome = { status: 'done' } | { status: 'failed'; error: unknown } | { status: 'interrupted' };

const DONE: TJobOutcome = { status: 'done' };
const INTERRUPTED: TJobOutcome = { status: 'interrupted' };
const POLL_MS = 25;

/**
 * The SQLite store of `QueueStore`, with the parts better-queue needs to resume work after a restart:
 *
 * - `getRunningTasks` answers `{ lockId: { taskId: task } }` (the shape better-queue reads), so a job that was
 *   running when the process died is run again with its payload;
 * - `connect` counts those running jobs too, because better-queue subtracts them from its length once they
 *   end — otherwise the queue stalls one job behind after such a resume;
 * - `takeFirstN` breaks ties on `rowid`, so jobs queued within the same millisecond keep their order;
 * - `close` releases the database file.
 */
export class PersistentQueueStore extends QueueStore {
	constructor(options: { path: string; tableName: string }) {
		super(options);
		// QueueStore names its index `idx_priority_added` for every table, and SQLite index names are unique per
		// database, so only the first table of a file gets one.
		this.db.exec(
			`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_order ON ${this.tableName}(lock, priority DESC, added ASC)`
		);
	}

	count(): number {
		const row = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`).get() as { count: number };
		return row.count;
	}

	/** Ids of the jobs stored and not finished yet. */
	ids(): string[] {
		return (this.db.prepare(`SELECT id FROM ${this.tableName}`).all() as { id: string }[]).map(({ id }) => id);
	}

	override connect(cb: (err: any, length: number) => void) {
		try {
			cb(null, this.count());
		} catch (err) {
			cb(err, 0);
		}
	}

	override getRunningTasks(cb: (err: any, map: Record<string, any>) => void) {
		try {
			const rows = this.db
				.prepare(
					`SELECT id, lock, task FROM ${this.tableName}
					WHERE lock != '' AND lock IS NOT NULL
					ORDER BY added ASC, rowid ASC`
				)
				.all() as { id: string; lock: string; task: string }[];

			const batches: Record<string, Record<string, unknown>> = {};
			for (const row of rows) {
				batches[row.lock] = { ...batches[row.lock], [row.id]: JSON.parse(row.task) };
			}
			cb(null, batches);
		} catch (err) {
			cb(err, {});
		}
	}

	override takeFirstN(n: number, cb: (err: any, lockId: string) => void) {
		try {
			cb(null, this.lockRows(n, 'ORDER BY priority DESC, added ASC, rowid ASC'));
		} catch (err) {
			cb(err, '');
		}
	}

	close(cb?: (err?: any) => void) {
		try {
			if (this.db.open) {
				this.db.close();
			}
			cb?.();
		} catch (err) {
			cb?.(err);
		}
	}
}

/**
 * Named job queues kept in a SQLite file, so jobs survive a quit, a crash or a restart.
 *
 * - Each queue name gets its own table and its own processor, and runs one job at a time in the order the
 *   jobs were queued. A queue can be held back while `canRun` answers false (e.g. while offline).
 * - `enqueue` resolves once the job is stored and rejects when it cannot be stored; it never waits for the job
 *   to run.
 * - A failing job is retried `maxRetries` times, `retryDelayMs` apart. It stays in the store meanwhile, so a
 *   restart resumes it. When the last attempt fails, `onJobFailed` is called and the job is dropped.
 * - `settle` waits for the jobs queued so far: a barrier for code that reads what they write.
 * - `close` lets the jobs being queued reach the store, stops taking jobs, cancels pending retries and waits
 *   (bounded) for the running job. Whatever has not finished stays in the store and runs on the next start —
 *   processors must therefore be idempotent.
 */
export class PersistentQueue {
	private readonly queues = new Map<string, { queue: Queue; store: PersistentQueueStore; table: string }>();
	/** Jobs being written to the store, with the way to fail them should the queue close first. */
	private readonly enqueuing = new Map<Promise<void>, (error: Error) => void>();
	private readonly inFlight = new Set<Promise<TJobOutcome>>();
	private readonly pendingRetries = new Set<() => void>();
	private closing: Promise<void> | null = null;

	constructor(private readonly options: IPersistentQueueOptions) {}

	public get isClosed(): boolean {
		return this.closing !== null;
	}

	public has(name: string): boolean {
		return this.queues.has(name);
	}

	/**
	 * Opens the queue `name` with its processor. Jobs a previous process left in its table start right away (once
	 * `canRun` allows it).
	 */
	public register<T>(
		name: string,
		processor: TPersistentJobProcessor<T>,
		registration: IPersistentQueueRegistration = {}
	): void {
		this.assertOpen();
		if (this.queues.has(name)) {
			throw new Error(`Queue "${name}" already has a processor`);
		}
		const table = PersistentQueue.tableName(name);
		for (const [other, entry] of this.queues) {
			if (entry.table === table) {
				throw new Error(`Queues "${other}" and "${name}" would share the table ${table}`);
			}
		}

		const { canRun, recheckMs = 1_000 } = registration;
		const store = new PersistentQueueStore({ path: this.options.dbPath, tableName: table });
		const queue = new Queue(
			(job: IPersistedJob<T>, done: (error?: unknown) => void) => this.run(name, processor, job, done),
			{
				store,
				concurrent: 1,
				// Retries happen inside `run`, while the job is still locked in the store; better-queue's own retry
				// deletes the job first and puts it back after the delay, which a crash in between would lose.
				maxRetries: 0,
				...(canRun && {
					precondition: (cb: (error: unknown, pass: boolean) => void) => {
						Promise.resolve()
							.then(canRun)
							.then(
								(pass) => cb(null, pass === true),
								(error) => cb(error, false)
							)
							.catch((error) => console.error(`[PersistentQueue] ${name}: could not check canRun`, error));
					},
					preconditionRetryTimeout: recheckMs
				})
			}
		);
		queue.on('error', (error) => console.error(`[PersistentQueue] ${name}:`, error));
		this.queues.set(name, { queue, store, table });
	}

	/**
	 * Stores a job on the queue `name`. Resolves once the job is in the store, rejects when it could not be stored.
	 */
	public enqueue<T>(name: string, payload: T): Promise<void> {
		if (this.isClosed) {
			return Promise.reject(new Error('PersistentQueue is closed'));
		}
		const entry = this.queues.get(name);
		if (!entry) {
			return Promise.reject(new Error(`No processor registered for queue "${name}"`));
		}
		const job: IPersistedJob<T> = { queue: name, payload, enqueuedAt: Date.now() };
		let fail: (error: Error) => void = () => undefined;
		const stored = new Promise<void>((resolve, reject) => {
			fail = reject;
			entry.queue
				.push(job)
				.on('queued', () => resolve())
				// Before 'queued' this means the job was not stored; afterwards the promise is settled and it is ignored.
				.on('failed', (reason: unknown) => reject(toError(reason, `Could not queue the job on "${name}"`)));
		});
		this.enqueuing.set(stored, fail);
		const forget = () => this.enqueuing.delete(stored);
		stored.then(forget, forget);
		return stored;
	}

	/** Jobs stored and not finished yet (running ones included), for one queue or all of them. */
	public pending(name?: string): number {
		let total = 0;
		for (const [queueName, entry] of this.queues) {
			if (!name || name === queueName) {
				total += entry.store.count();
			}
		}
		return total;
	}

	/** Nothing being queued, stored or running. */
	public isIdle(): boolean {
		return this.enqueuing.size === 0 && this.inFlight.size === 0 && this.pending() === 0;
	}

	/** Resolves `true` once every queue is idle, or `false` when `timeoutMs` passes first or the queue closes. */
	public drain(timeoutMs = 10_000): Promise<boolean> {
		return this.waitFor(() => this.isIdle(), timeoutMs);
	}

	/**
	 * Resolves `true` once every job queued before this call has finished (run or, after its last attempt, dropped) —
	 * whatever is queued after it does not count — or `false` when `timeoutMs` passes first or the queue closes.
	 */
	public async settle(timeoutMs = 10_000): Promise<boolean> {
		const deadline = Date.now() + timeoutMs;
		await settleWithin([...this.enqueuing.keys()], timeoutMs);
		if (this.isClosed) {
			return false;
		}
		const before = [...this.queues.values()].map(({ store }) => ({ store, ids: new Set(store.ids()) }));
		const finished = () => before.every(({ store, ids }) => !store.ids().some((id) => ids.has(id)));
		return this.waitFor(finished, Math.max(0, deadline - Date.now()));
	}

	/** Stops the queues and releases the database. Unfinished jobs stay stored for the next start. */
	public close(timeoutMs = 5_000): Promise<void> {
		this.closing ??= this.shutdown(timeoutMs);
		return this.closing;
	}

	private async shutdown(timeoutMs: number): Promise<void> {
		// Jobs already handed to `enqueue` reach the store first, so their callers are not left waiting.
		await settleWithin([...this.enqueuing.keys()], timeoutMs);
		for (const { queue } of this.queues.values()) {
			queue.pause();
		}
		for (const cancel of this.pendingRetries) {
			cancel();
		}
		await settleWithin([...this.inFlight], timeoutMs);
		// Give better-queue its turn to release the lock of a job that has just finished, so it is not run again.
		await new Promise((resolve) => setImmediate(resolve));
		await Promise.all(
			[...this.queues.values()].map(({ queue }) => new Promise<void>((resolve) => queue.destroy(() => resolve())))
		);
		this.queues.clear();
		for (const fail of this.enqueuing.values()) {
			fail(new Error('PersistentQueue is closed'));
		}
	}

	private run<T>(
		name: string,
		processor: TPersistentJobProcessor<T>,
		job: IPersistedJob<T>,
		done: (error?: unknown) => void
	): void {
		const execution = this.execute(name, processor, job);
		this.inFlight.add(execution);
		execution
			.then((outcome) => {
				this.inFlight.delete(execution);
				if (outcome.status === 'done') {
					done();
				} else if (outcome.status === 'failed') {
					this.reportFailure(name, job?.payload, outcome.error);
					done(outcome.error ?? new Error('Job failed'));
				}
				// 'interrupted': the queue is closing. Not calling `done` keeps the job locked in the store, and the
				// next start runs it again.
			})
			.catch((error) => console.error(`[PersistentQueue] ${name}: could not complete a job`, error));
	}

	private async execute<T>(
		name: string,
		processor: TPersistentJobProcessor<T>,
		job: IPersistedJob<T>
	): Promise<TJobOutcome> {
		let lastError: unknown;
		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			if (attempt > 0 && !(await this.waitBeforeRetry())) {
				return INTERRUPTED;
			}
			if (this.isClosed) {
				return INTERRUPTED;
			}
			try {
				await processor(job?.payload, { queue: name, attempt });
				return DONE;
			} catch (error) {
				lastError = error;
				console.warn(`[PersistentQueue] ${name}: attempt ${attempt + 1} of ${this.maxRetries + 1} failed`, error);
			}
		}
		return { status: 'failed', error: lastError };
	}

	/** Resolves `true` after the retry delay, or `false` as soon as the queue closes. */
	private waitBeforeRetry(): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			const timer = setTimeout(() => {
				this.pendingRetries.delete(cancel);
				resolve(true);
			}, this.retryDelayMs);
			const cancel = () => {
				clearTimeout(timer);
				this.pendingRetries.delete(cancel);
				resolve(false);
			};
			this.pendingRetries.add(cancel);
		});
	}

	/**
	 * Resolves `true` as soon as `condition` holds, `false` once `timeoutMs` passes, the queue closes or the store
	 * cannot be read.
	 */
	private waitFor(condition: () => boolean, timeoutMs: number): Promise<boolean> {
		const deadline = Date.now() + timeoutMs;
		const holds = () => {
			try {
				return condition();
			} catch (error) {
				console.error('[PersistentQueue] could not read the store', error);
				return null;
			}
		};
		return new Promise<boolean>((resolve) => {
			const check = () => {
				const met = this.isClosed ? null : holds();
				if (met === null) {
					resolve(false);
				} else if (met) {
					resolve(true);
				} else if (Date.now() >= deadline) {
					resolve(false);
				} else {
					setTimeout(check, POLL_MS);
				}
			};
			check();
		});
	}

	private reportFailure(name: string, payload: unknown, error: unknown): void {
		Promise.resolve()
			.then(() => this.options.onJobFailed?.(name, payload, error))
			.catch((callbackError) => console.error(`[PersistentQueue] ${name}: onJobFailed threw`, callbackError));
	}

	private assertOpen(): void {
		if (this.isClosed) {
			throw new Error('PersistentQueue is closed');
		}
	}

	private get maxRetries(): number {
		return Math.max(0, this.options.maxRetries ?? 3);
	}

	private get retryDelayMs(): number {
		return Math.max(0, this.options.retryDelayMs ?? 1_000);
	}

	/** Table names are interpolated into SQL, so they are reduced to `[A-Za-z0-9_]`. */
	private static tableName(name: string): string {
		const slug = (name ?? '').trim().replaceAll(/\W+/g, '_');
		if (!slug.replaceAll('_', '')) {
			throw new Error(`Invalid queue name "${name}"`);
		}
		return `persistent_queue_${slug}`;
	}
}

/** Resolves once every promise has settled, or after `ms`, whichever comes first. */
async function settleWithin(promises: Promise<unknown>[], ms: number): Promise<void> {
	if (!promises.length) {
		return;
	}
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<void>((resolve) => (timer = setTimeout(resolve, ms)));
	try {
		await Promise.race([Promise.allSettled(promises), timeout]);
	} finally {
		clearTimeout(timer);
	}
}

/** better-queue reports failures as plain strings such as `failed_to_put_task`. */
function toError(reason: unknown, context: string): Error {
	if (reason instanceof Error) {
		return reason;
	}
	const detail = typeof reason === 'string' ? reason : JSON.stringify(reason);
	return new Error(`${context}: ${detail}`);
}
