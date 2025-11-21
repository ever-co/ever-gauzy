import * as Queue from 'better-queue';
import * as path from 'path';
import { QueueStore } from './queue-store';
import * as isOnline from 'is-online';
import { IScreenshotQueuePayload, ITimerCallbackPayload, ITimeslotQueuePayload, IQueueUpdatePayload, TQueueName } from './i-queue';

const IS_ONLINE_INTERVAL = 15;

export class DesktopQueue {
	private timerQueue: Queue;
	private timeSlotQueue: Queue;
	private screenshotQueue: Queue;
	private timerQueueRetry: Queue;
	private timeSlotQueueRetry: Queue;
	private screenshotQueueRetry: Queue
	private storeTimerQueue: QueueStore;
	private storeTimeSlotQueue: QueueStore;
	private storeScreenshotQueue: QueueStore;
	private storeTimerQueueRetry: QueueStore;
	private storeTimeSlotQueueRetry: QueueStore;
	private storeScreenshotQueueRetry: QueueStore;
	private online: boolean;
	private dbPath: string;
	private auditQueueCallback: (param: IQueueUpdatePayload) => void;
	private workerInterval: NodeJS.Timeout | null = null;
	private serviceCheckCallback: () => Promise<boolean>;
	private isOnlineIntervalCheck: number;
	private workerHandler: () => void;
	constructor(
		dbPath: string
	) {
		this.dbPath = dbPath;
		this.online = true;
		this.isOnlineIntervalCheck = 0;
		const storePath = path.join(this.dbPath, 'gauzy-queue.sqlite3');
		this.storeTimerQueue = new QueueStore({
			path: storePath,
			tableName: 'timer_queue'
		});
		this.storeTimeSlotQueue = new QueueStore({
			path: storePath,
			tableName: 'time_slot_queue'
		});
		this.storeScreenshotQueue = new QueueStore({
			path: storePath,
			tableName: 'screenshot_queue'
		});
		this.storeTimerQueueRetry = new QueueStore({
			path: storePath,
			tableName: 'timer_queue_retry'
		});
		this.storeTimeSlotQueueRetry = new QueueStore({
			path: storePath,
			tableName: 'time_slot_queue_retry'
		});
		this.storeScreenshotQueueRetry = new QueueStore({
			path: storePath,
			tableName: 'screenshot_queue_retry'
		});
	}

	public setUpdateQueueCallback(callback: (param: IQueueUpdatePayload) => void) {
		this.auditQueueCallback = callback;
	}

	public setServiceCheckCallback(callback: () => Promise<boolean>) {
		this.serviceCheckCallback = callback;
	}

	private auditQueue(name: TQueueName, que: Queue) {
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

	private queueEventHandler(name: TQueueName, que: Queue) {
		que.on('task_queued', (id: string, info: any) => this.auditQueueCallback?.({
			id,
			data: info,
			type: 'queued',
			queue: name
		}));
		que.on("task_finish", (id: string, info: any) => this.auditQueueCallback?.({
			id,
			queue: name,
			type: 'succeeded',
			data: info
		}));
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
					id: (task, cb) => cb(null, `timer-queue:${task.timerId}`),
					concurrent: 1,
					maxRetries: 0,
					filter: (task, cb) => {
						if (task.queue === 'timer') cb(null, task);   // accept → worker runs with original task
						else cb(new Error('Not valid task'), false);
					}
				}
			);
			this.timerQueue.use(this.storeTimerQueue);
			this.queueEventHandler('timer', this.timerQueue);
		}

		if (!this.timerQueueRetry) {
			this.timerQueueRetry = new Queue(
				timerCallback,
				{
					id: (task, cb) => cb(null, `timer-queue:${task.timerId}`),
					concurrent: 1,
					maxRetries: 20,
					retryDelay: 15 * 1000,
					filter: (task, cb) => {
						if (task.queue === 'timer_retry') cb(null, task);   // accept → worker runs with original task
						else cb(new Error('Not valid task'), false);
					}
				}
			);
			this.timerQueueRetry.use(this.storeTimerQueueRetry);
			this.auditQueue('timer_retry', this.timerQueueRetry);
		}
	}

	public initTimeslotQueue(timeSlotCallback: (job: ITimeslotQueuePayload, cb: (err?: any) => void) => void) {
		if (!this.timeSlotQueue) {
			this.timeSlotQueue = new Queue(
				timeSlotCallback,
				{
					id: (task, cb) => cb(null, `time-slot-queue-${task.activityId}`),
					concurrent: 2,
					maxRetries: 0,
					filter: (task, cb) => {
						if (task.queue === 'time_slot') cb(null, task);   // accept → worker runs with original task
						else cb(new Error('Not valid task'), false);
					}
				}
			);
			this.timeSlotQueue.use(this.storeTimeSlotQueue);
			this.queueEventHandler('time_slot', this.timeSlotQueue);
		}

		if (!this.timeSlotQueueRetry) {
			this.timeSlotQueueRetry = new Queue(
				timeSlotCallback,
				{
					id: (task, cb) => cb(null, `time-slot-queue-${task.activityId}`),
					concurrent: 2,
					maxRetries: 20,
					retryDelay: 15 * 1000,
					filter: (task, cb) => {
						if (task.queue === 'time_slot_retry') cb(null, task);   // accept → worker runs with original task
						else cb(new Error('Not valid task'), false);
					}
				}
			);
			this.timeSlotQueueRetry.use(this.storeTimeSlotQueueRetry);
			this.auditQueue('time_slot_retry', this.timeSlotQueueRetry);
		}
	}

	public initScreenshotQueue(screenshotCallback: (job: IScreenshotQueuePayload, cb: (err?: any) => void) => void) {
		if (!this.screenshotQueue) {
			this.screenshotQueue = new Queue(
				screenshotCallback,
				{
					id: (task, cb) => cb(null, `screenshot-queue-${task.screenshotId}`),
					concurrent: 2,
					maxRetries: 0,
					filter: (task, cb) => {
						if (task.queue === 'screenshot') cb(null, task);   // accept → worker runs with original task
						else cb(new Error('Not valid task'), false);                             // reject → skipped
					}
				}
			);
			this.screenshotQueue.use(this.storeScreenshotQueue);
			this.queueEventHandler('screenshot', this.screenshotQueue);
		}

		if (!this.screenshotQueueRetry) {
			this.screenshotQueueRetry = new Queue(
				screenshotCallback,
				{
					id: (task, cb) => cb(null, `screenshot-queue-${task.screenshotId}`),
					concurrent: 2,
					maxRetries: 20,
					retryDelay: 15 * 1000,
					filter: (task, cb) => {
						if (task.queue === 'screenshot_retry') cb(null, task);   // accept → worker runs with original task
						else cb(new Error('Not valid task'), false);                             // reject → skipped
					}
				}
			);
			this.screenshotQueueRetry.use(this.storeScreenshotQueueRetry);
			this.auditQueue('screenshot_retry', this.screenshotQueueRetry);
		}
	}

	public enqueueTimer(job: ITimerCallbackPayload) {
		if (job.isRetry && this.timerQueueRetry) {
			return this.timerQueueRetry.push(job);
		}
		if (!this.timerQueue) {
			throw new Error('Timer queue not initialized. Call initTimerQueue first.');
		}
		this.timerQueue.push(job);
	}

	public enqueueTimeSlot(job: ITimeslotQueuePayload) {
		if (job.isRetry && this.timeSlotQueueRetry) {
			return this.timeSlotQueueRetry.push(job);
		}
		if (!this.timeSlotQueue) {
			throw new Error('TimesSlot queue not initialized. Call initTimeSlotQueue first.');
		}
		this.timeSlotQueue.push(job);
	}

	public enqueueScreenshot(job: IScreenshotQueuePayload) {
		if (job.isRetry && this.screenshotQueueRetry) {
			return this.screenshotQueueRetry.push(job);
		}
		if (!this.screenshotQueue) {
			throw new Error('Screenshot queue not initialized. Call initScreenshotQueue first.');
		}
		this.screenshotQueue.push(job);
	}

	public async stopQueue() {
		const drainPromises = [];
		if (this.timerQueue) {
			this.timerQueue.pause();
			this.timerQueueRetry.pause();
			drainPromises.push(
				Promise.race([
					new Promise<void>((resolve) => this.timerQueue.on('drain', () => resolve())),
					new Promise<void>((resolve) => this.timerQueueRetry.on('drain', () => resolve())),
					new Promise<void>((resolve) => setTimeout(resolve, 500))
				])
			);
		}

		if (this.timeSlotQueue) {
			this.timeSlotQueue.pause();
			this.timeSlotQueueRetry.pause();
			drainPromises.push(
				Promise.race([
					new Promise<void>((resolve) => this.timeSlotQueue.on('drain', () => resolve())),
					new Promise<void>((resolve) => this.timeSlotQueueRetry.on('drain', () => resolve())),
					new Promise<void>((resolve) => setTimeout(resolve, 500))
				])
			);
		}

		if (this.screenshotQueue) {
			this.screenshotQueue.pause();
			this.screenshotQueueRetry.pause();
			drainPromises.push(
				Promise.race([
					new Promise<void>((resolve) => this.screenshotQueue.on('drain', () => resolve())),
					new Promise<void>((resolve) => this.screenshotQueueRetry.on('drain', () => resolve())),
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
			this.handleIsOnline();
			if (this.workerHandler) {
				this.workerHandler();
			}
		}, 1000)
	}

	private async handleIsOnline() {
		this.isOnlineIntervalCheck = (this.isOnlineIntervalCheck || 0) + 1;
		if (!(this.isOnlineIntervalCheck >= IS_ONLINE_INTERVAL)) {
			return;
		}
		this.isOnlineIntervalCheck = 0;
		const ok = await isOnline({ timeout: 1200 }).catch(() => false);
		const serviceOk = await this.serviceCheckCallback?.();
		if (ok && serviceOk && !this.online) {
			this.online = true;
			this.timerQueueRetry.resume();
			this.timeSlotQueueRetry.resume();
			this.screenshotQueueRetry.resume();
		}
		if ((!ok || !serviceOk) && this.online) {
			this.online = false;
			this.timerQueueRetry.pause();
			this.timeSlotQueueRetry.pause();
			this.screenshotQueueRetry.pause();
		}
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
		return this.timeSlotQueue.getStats();
	}

	public setWorkerHandler(callback: () => void) {
		this.workerHandler = callback;
	}
}
