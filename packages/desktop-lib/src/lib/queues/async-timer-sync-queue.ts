import { PersistentQueue } from '@gauzy/desktop-activity';
import { app } from 'electron';
import * as fs from 'fs';
import { Knex } from 'knex';
import * as path from 'path';
import { IOfflineMode } from '../interfaces';
import { ITimerQueueJob, TimerQueueJobType, TimerQueueProcessor } from './timer-queue-processor';

/** File in the app's user data folder holding the jobs of the asynchronous timer data sync. */
export const ASYNC_TIMER_SYNC_QUEUE_FILE = 'gauzy-timer-sync-queue.sqlite3';

/** The queue name the desktop timer uses for all its jobs. */
export const DEFAULT_TIMER_QUEUE = 'gauzy-queue';

/** `appSetting.asyncTimerDataSync`: off unless explicitly `true`. */
export function isAsyncTimerDataSyncEnabled(appSetting: { asyncTimerDataSync?: unknown } | null | undefined): boolean {
	return appSetting?.asyncTimerDataSync === true;
}

export interface IAsyncTimerSyncQueueOptions {
	processor: TimerQueueProcessor;
	offlineMode: IOfflineMode;
	/** Reports a job that failed all its attempts; the job is then dropped. */
	onJobFailed: (job: ITimerQueueJob, error: unknown) => void | Promise<void>;
	/** Defaults to `<userData>/gauzy-timer-sync-queue.sqlite3`. */
	dbPath?: string;
	/** Further attempts after a failure (default 3). */
	maxRetries?: number;
	/** Pause between attempts in ms (default 1000). */
	retryDelayMs?: number;
}

/**
 * The asynchronous path of `TimerHandler.processWithQueue`, taken when `appSetting.asyncTimerDataSync` is on.
 *
 * The in-memory queue it replaces loses whatever has not run yet when the app quits or crashes, and drops a job on its
 * first failure. Here a job is stored in SQLite before `processWithQueue` returns; each queue name runs its jobs one
 * at a time, in order, through the same `TimerQueueProcessor`; a failing job is retried; and jobs left over by a quit
 * or a crash run on the next start.
 */
export class AsyncTimerSyncQueue {
	private readonly queue: PersistentQueue;
	private knex: Knex | null = null;

	constructor(private readonly options: IAsyncTimerSyncQueueOptions) {
		this.queue = new PersistentQueue({
			dbPath: options.dbPath ?? AsyncTimerSyncQueue.defaultDbPath(),
			maxRetries: options.maxRetries,
			retryDelayMs: options.retryDelayMs,
			onJobFailed: (_queue, job, error) => options.onJobFailed(job as ITimerQueueJob, error)
		});
	}

	public static defaultDbPath(): string {
		return path.join(app.getPath('userData'), ASYNC_TIMER_SYNC_QUEUE_FILE);
	}

	/**
	 * Runs the jobs an earlier asynchronous session left behind, then releases the file. Called while the setting is
	 * off, so turning it off never drops stored work. Without the file (the setting was never on) it does nothing.
	 * Resolves `false` when jobs are still left after `timeoutMs`; they stay stored for the next start.
	 */
	public static async flushLeftovers(knex: Knex, options: IAsyncTimerSyncQueueOptions, timeoutMs = 5_000): Promise<boolean> {
		const dbPath = options.dbPath ?? AsyncTimerSyncQueue.defaultDbPath();
		if (!fs.existsSync(dbPath)) {
			return true;
		}
		const leftovers = new AsyncTimerSyncQueue({ ...options, dbPath }).open(knex);
		try {
			return await leftovers.drain(timeoutMs);
		} finally {
			await leftovers.close();
		}
	}

	/** Opens the default queue, which starts the jobs a previous run left behind. Throws when the file cannot be opened. */
	public open(knex: Knex): this {
		this.knex = knex ?? this.knex;
		this.ensureQueue(DEFAULT_TIMER_QUEUE);
		return this;
	}

	/** Resolves once the job is stored (not run); rejects when it could not be stored. */
	public async processWithQueue(type: string, job: ITimerQueueJob, knex: Knex): Promise<void> {
		this.knex = knex ?? this.knex;
		this.ensureQueue(type);
		await this.queue.enqueue(type, this.withEnqueueState(job));
	}

	public drain(timeoutMs?: number): Promise<boolean> {
		return this.queue.drain(timeoutMs);
	}

	/** Stops processing and releases the file; unfinished jobs run on the next start. */
	public close(timeoutMs?: number): Promise<void> {
		return this.queue.close(timeoutMs);
	}

	/** One processor per queue name, each with its own table. */
	private ensureQueue(name: string): void {
		if (!this.queue.has(name)) {
			this.queue.register<ITimerQueueJob>(name, (job) => this.options.processor.process(job, this.knex));
		}
	}

	/**
	 * A stored job may run long after it was queued — after a restart, possibly in another offline state. A duration
	 * update therefore carries the offline mode it was queued in, which is what the in-memory queue sees, as it runs
	 * jobs right away. Otherwise a session tracked online and replayed offline would be marked unsynced and pushed a
	 * second time by offline sync.
	 */
	private withEnqueueState(job: ITimerQueueJob): ITimerQueueJob {
		if (job?.type !== TimerQueueJobType.UPDATE_DURATION || !job.data || typeof job.data.offline === 'boolean') {
			return job;
		}
		return { ...job, data: { ...job.data, offline: this.options.offlineMode.enabled } };
	}
}
