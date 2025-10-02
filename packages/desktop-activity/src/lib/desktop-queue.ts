import * as Queue from 'better-queue';
import * as path from 'path';
import { QueueStore } from './queue-store';
import * as isOnline from 'is-online';
import { IScreenshotQueuePayload, ITimerCallbackPayload, ITimeslotQueuePayload, IQueueUpdatePayload } from './i-queue';

export class DesktopQueue {
	private timerQueue: Queue;
	private timeSlotQueue: Queue;
	private screenshotQueue: Queue;
	private storeTimerQueue: QueueStore;
	private storeTimeSlotQueue: QueueStore;
	private storeScreenshotQueue: QueueStore;
	private online: boolean;
	private dbPath: string;
	private auditQueueCallback: (param: IQueueUpdatePayload) => void;
	private workerInterval: NodeJS.Timeout | null = null;
	constructor(
		dbPath: string
	) {
		this.dbPath = dbPath;
		this.online = true;
		this.storeTimerQueue = new QueueStore({
			path: path.join(this.dbPath, 'gauzy-timer-queue.sqlite3')
		});
		this.storeTimeSlotQueue = new QueueStore({
			path: path.join(this.dbPath, 'gauzy-timeslot-queue.sqlite3')
		});
		this.storeScreenshotQueue = new QueueStore({
			path: path.join(this.dbPath, 'gauzy-screenshot-queue.sqlite3')
		});
	}

	public setUpdateQueueCallback(callback: (param: IQueueUpdatePayload) => void) {
		this.auditQueueCallback = callback;
	}

	private auditQueue(name: 'timer' | 'time_slot' | 'screenshot', que: Queue) {
		que.on('task_queued', (id: string, info: any) => this.auditQueueCallback?.({
			id,
			data: info,
			type: 'queued',
			queue: name
		}));
		que.on("task_started", (id: string, info: any) => this.auditQueueCallback?.({
			id,
			type: 'running',
			queue: name,
			data: info
		}));
		que.on("task_finish", (id: string, info: any) => this.auditQueueCallback?.({
			id,
			queue: name,
			type: 'succeeded',
			data: info
		}));
		que.on(
			'task_progress',
			(id: string, info) => this.auditQueueCallback?.({
				id,
				queue: name,
				type: 'progress',
				data: info
			})
		)
		que.on("task_failed", (id: string, err) => this.auditQueueCallback?.({
			id,
			queue: name,
			type: 'failed',
			err: err,
		}));
	}


	public initTimerQueue(timerCallback: (job: ITimerCallbackPayload, cb: (err?: any) => void) => void) {
		if (!this.timerQueue) {
			this.timerQueue = new Queue(
				timerCallback,
				{
					concurrent: 1,
					maxRetries: 5,
					retryDelay: 15_000,
					filter: (task, cb) => {
						if (task.queue === 'timer') cb(null, task);   // accept → worker runs with original task
						else if (task.attempts > 5) {
							cb(new Error('Attempts maximum retry'), false);
						}
						else cb(new Error('Not valid task'), false);
					}
				}
			);
			this.timerQueue.use(this.storeTimerQueue);
			this.auditQueue('timer', this.timerQueue);
		}
	}

	public initTimeslotQueue(timeSlotCallback: (job: ITimeslotQueuePayload, cb: (err?: any) => void) => void) {
		if (!this.timeSlotQueue) {
			this.timeSlotQueue = new Queue(
				timeSlotCallback,
				{
					concurrent: 2,
					maxRetries: 5,
					retryDelay: 15_000,
					filter: (task, cb) => {
						if (task.queue === 'time_slot') cb(null, task);   // accept → worker runs with original task
						else if (task.attempts > 10) {
							cb(new Error('Attempts maximum retry'), false);
						}
						else cb(new Error('Not valid task'), false);
					}
				}
			);
			this.timeSlotQueue.use(this.storeTimeSlotQueue);
			this.auditQueue('time_slot', this.timeSlotQueue);
		}
	}

	public initScreenshotQueue(screenshotCallback: (job: IScreenshotQueuePayload, cb: (err?: any) => void) => void) {
		if (!this.screenshotQueue) {
			this.screenshotQueue = new Queue(
				screenshotCallback,
				{
					concurrent: 2,
					maxRetries: 5,
					retryDelay: 15_000,
					filter: (task, cb) => {
						if (task.queue === 'screenshot') cb(null, task);   // accept → worker runs with original task
						else if (task.attempts > 5) {
							cb(new Error('Attempts maximum retry'), false);
						}
						else cb(new Error('Not valid task'), false);                             // reject → skipped
					}
				}
			);
			this.screenshotQueue.use(this.storeScreenshotQueue);
			this.auditQueue('screenshot', this.screenshotQueue);
		}
	}

	public enqueueTimer(job: ITimerCallbackPayload) {
		if (!this.timerQueue) {
			throw new Error('Timer queue not initialized. Call initTimerQueue first.');
		}
		this.timerQueue.push(job);
	}

	public enqueueTimeSlot(job: ITimeslotQueuePayload) {
		if (!this.timeSlotQueue) {
			throw new Error('TimesSlot queue not initialized. Call initTimeSlotQueue first.');
		}
		this.timeSlotQueue.push(job);
	}

	public enqueueScreenshot(job: IScreenshotQueuePayload) {
		if (!this.screenshotQueue) {
			throw new Error('Screenshot queue not initialized. Call initScreenshotQueue first.');
		}
		this.screenshotQueue.push(job);
	}

	public async stopQueue() {
		const drainPromises = [];

		if (this.timerQueue) {
			this.timerQueue.pause();
			drainPromises.push(
				Promise.race([
					new Promise<void>((resolve) => this.timerQueue.on('drain', () => resolve())),
					new Promise<void>((resolve) => setTimeout(resolve, 500))
				])
			);
		}

		if (this.timeSlotQueue) {
			this.timeSlotQueue.pause();
			drainPromises.push(
				Promise.race([
					new Promise<void>((resolve) => this.timeSlotQueue.on('drain', () => resolve())),
					new Promise<void>((resolve) => setTimeout(resolve, 500))
				])
			);
		}

		if (this.screenshotQueue) {
			this.screenshotQueue.pause();
			drainPromises.push(
				Promise.race([
					new Promise<void>((resolve) => this.screenshotQueue.on('drain', () => resolve())),
					new Promise<void>((resolve) => setTimeout(resolve, 500))
				])
			);
		}

		if (drainPromises.length > 0) {
			await Promise.all(drainPromises);
		}

	}

	public initWorker() {
		if (this.workerInterval) {
			clearInterval(this.workerInterval);
		}
		this.workerInterval = setInterval(async () => {
			const ok = await isOnline({ timeout: 1200 }).catch(() => false);
			if (ok && !this.online) {
				this.online = true;
				this.timerQueue.resume();
				this.timeSlotQueue.resume();
				this.screenshotQueue.resume();
			}
			if (!ok && this.online) {
				this.online = false;
				this.timerQueue.pause();
				this.timeSlotQueue.pause();
				this.screenshotQueue.pause();
			}
		}, 3000)
	}

	public stopWorker() {
		if (this.workerInterval) {
			clearInterval(this.workerInterval);
			this.workerInterval = null;
		}
	}

	public getList() {
		if (!this.timeSlotQueue) {
			throw new Error('TimeSlot queue not initialized. Call initTimeslotQueue first.');
		}
		this.timeSlotQueue.getStats()
	}
}
