import * as Queue from 'better-queue';
import * as QueueStore from 'better-queue-sqlite';
import isOnline from 'is-online';
import { IScreenshotQueuePayload, ITimerCallbackPayload, ITimeslotQueuePayload, IQueueUpadtePayload } from './i-queue';

export class DesktopQueue {
	static instance: DesktopQueue;
	private timerQueue: Queue;
	private timeSlotQueue: Queue;
	private screenshotQueue: Queue;
	private storeQueue: QueueStore;
	private online: boolean;
	private dbPath: string;
	private auditQueueCallback: (param: IQueueUpadtePayload) => void;
	constructor(
		dbPath: string
	) {
		this.dbPath = dbPath;
		this.online = true;
		this.storeQueue = new QueueStore({
			path: this.dbPath
		});
	}

	static getInstance(dbPath: string): DesktopQueue {
		if (!DesktopQueue.instance) {
			DesktopQueue.instance = new DesktopQueue(dbPath);
		}
		return DesktopQueue.instance;
	}

	public setUpdateQueueCallback(callback: (param: IQueueUpadtePayload) => void) {
		this.auditQueueCallback = callback;
	}

	private auditQueue(name: 'timer' | 'time_slot' | 'screenshot', que: Queue) {
		que.on('error', (err) => console.log(err));
		que.on('task_queued', (id: string, info: any) => this.auditQueueCallback({
			id,
			data: info,
			type: 'queued',
			queue: name
		}));
		que.on("task_started", (id: string) => this.auditQueueCallback({
			id,
			type: 'running',
			queue: name
		}));
		que.on("task_finish", (id: string) => this.auditQueueCallback({
			id,
			queue: name,
			type: 'succeeded'
		}));
		que.on(
			'task_progress',
			(id: string) => this.auditQueueCallback({
				id,
				queue: name,
				type: 'progress'
			})
		)
		que.on("task_failed", (id: string, err) => this.auditQueueCallback({
			id,
			queue: name,
			type: 'failed',
			err: err
		}));
	}


	public initTimerQueue(timerCallback: (job: ITimerCallbackPayload, cb: (err?: any) => void) => void) {
		if (!this.timerQueue) {
			console.log('queue store config', this.storeQueue);
			this.timerQueue = new Queue(
				timerCallback,
				{
					store: this.storeQueue,
					concurrent: 1,
					maxRetries: 10,
					retryDelay: 15_000,
					filter: (task, cb) => {
						if (task.queue === 'timer') cb(null, task);   // accept → worker runs with original task
						else cb(new Error('Not valid task'), false);
					}
				}
			)
			this.auditQueue('timer', this.timerQueue);
		}
	}

	public initTimeslotQueue(timeSlotCallback: (job: ITimeslotQueuePayload, cb: (err?: any) => void) => void) {
		if (!this.timeSlotQueue) {
			this.timeSlotQueue = new Queue(
				timeSlotCallback,
				{
					store: this.storeQueue,
					concurrent: 1,
					maxRetries: 10,
					retryDelay: 15_000,
					filter: (task, cb) => {
						if (task.queue === 'time_slot') cb(null, task);   // accept → worker runs with original task
						else cb(new Error('Not valid task'), false);
					}
				}
			)
			this.auditQueue('time_slot', this.timeSlotQueue);
		}
	}

	public initScreenshotQueue(screenshotCallback: (job: IScreenshotQueuePayload, cb: (err?: any) => void) => void) {
		if (!this.screenshotQueue) {
			this.screenshotQueue = new Queue(
				screenshotCallback,
				{
					store: this.storeQueue,
					concurrent: 1,
					maxRetries: 10,
					retryDelay: 15_000,
					filter: (task, cb) => {
						if (task.queue === 'screenshot') cb(null, task);   // accept → worker runs with original task
						else cb(new Error('Not valid task'), false);                             // reject → skipped
					}
				}
			)
			this.auditQueue('screenshot', this.screenshotQueue);
		}
	}

	public enqueueTimer(job: ITimerCallbackPayload) {
		this.timerQueue.push(job);
	}

	public enqueueTimeSlot(job: ITimeslotQueuePayload) {
		this.timeSlotQueue.push(job);
	}

	public enqueueScreenshot(job: IScreenshotQueuePayload) {
		this.screenshotQueue.push(job);
	}

	public async stopQueue() {
		this.timeSlotQueue.pause();
		this.timerQueue.pause();
		this.screenshotQueue.pause();
		await Promise.all([
			new Promise<void>((resolve) => this.timerQueue.on('drain', () => resolve())),
			new Promise<void>((resolve) => this.timeSlotQueue.on('drain', () => resolve())),
			new Promise<void>((resolve) => this.screenshotQueue.on('drain', () => resolve()))
		])
	}

	public initWorker() {
		setInterval(async () => {
			const ok = await isOnline({ timeout: 1200 }).catch(() => false);
			if (ok && !this.online) { this.online = true; this.timerQueue.resume(); this.timeSlotQueue.resume(); this.screenshotQueue.resume(); }
			if (!ok && this.online) { this.online = false; this.timerQueue.pause(); this.timeSlotQueue.pause(); this.screenshotQueue.pause(); }
		}, 3000)
	}

	public getList() {
		this.timeSlotQueue.getStats()
	}
}
