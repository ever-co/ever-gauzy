import { PersistentQueue } from '@gauzy/desktop-activity';
import { app } from 'electron';
import { Knex } from 'knex';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
 * The asynchronous path of `TimerHandler.processWithQueue`, taken when `appSetting.asyncTimerDataSync` is on: the
 * desktop timer's offline-first store.
 *
 * The in-memory queue it replaces loses whatever has not run yet when the app quits or crashes, and drops a job on its
 * first failure. Here every timer write (durations, time-slot links, ActivityWatch events, clean-ups) is stored in
 * SQLite before `processWithQueue` returns, whether online or offline; each queue name applies its jobs to the local
 * database one at a time, in order, through the same `TimerQueueProcessor`; a failing job is retried; and jobs left by
 * a quit or a crash run on the next start. What reads that database waits for it with `settle` — offline sync then
 * uploads everything once back online.
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
	 * Opens the file an earlier asynchronous session left, which starts running its jobs; null when there is none (the
	 * setting was never on). Throws when the file cannot be opened.
	 */
	public static openLeftovers(knex: Knex, options: IAsyncTimerSyncQueueOptions): AsyncTimerSyncQueue | null {
		const dbPath = options.dbPath ?? AsyncTimerSyncQueue.defaultDbPath();
		if (!fs.existsSync(dbPath)) {
			return null;
		}
		return new AsyncTimerSyncQueue({ ...options, dbPath }).open(knex);
	}

	public get isClosed(): boolean {
		return this.queue.isClosed;
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
		await this.queue.enqueue(type, await this.prepare(job));
	}

	/** Nothing being queued, stored or running. */
	public isIdle(): boolean {
		return this.queue.isIdle();
	}

	/** Resolves `true` once the jobs queued so far have been applied (`false` after `timeoutMs`). */
	public settle(timeoutMs?: number): Promise<boolean> {
		return this.queue.settle(timeoutMs);
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
			this.queue.register<ITimerQueueJob>(name, (job) =>
				this.options.processor.process(AsyncTimerSyncQueue.asStored(job), this.knex)
			);
		}
	}

	/**
	 * A stored duration update runs with `markUnsynced: false` whatever the file says. `prepare` writes that flag on every
	 * job it stores, but a job stored without it (by an earlier build) would otherwise fall back to the offline mode of
	 * the moment it runs — after a restart, possibly once offline sync has uploaded the timer — and have it uploaded
	 * again.
	 */
	private static asStored(job: ITimerQueueJob): ITimerQueueJob {
		if (job?.type !== TimerQueueJobType.UPDATE_DURATION || !job.data || job.data.markUnsynced === false) {
			return job;
		}
		return { ...job, data: { ...job.data, markUnsynced: false } };
	}

	/**
	 * A stored duration update never marks the timer unsynced: it may run long after it was queued — after a restart,
	 * once offline sync has uploaded the timer — and the timer would be uploaded a second time. A timer tracked offline
	 * is marked right away instead, as the in-memory queue does within moments.
	 */
	private async prepare(job: ITimerQueueJob): Promise<ITimerQueueJob> {
		if (job?.type !== TimerQueueJobType.UPDATE_DURATION || !job.data) {
			return job;
		}
		if (this.options.offlineMode.enabled && job.data.id) {
			await this.options.processor.markTimerUnsynced(job.data.id);
		}
		return { ...job, data: { ...job.data, markUnsynced: false } };
	}
}
